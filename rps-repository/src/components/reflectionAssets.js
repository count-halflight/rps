import * as THREE from "three";
import { assetUrl } from "../game/assets.js";

const MAGIC = "TRNREF01", ASSET = Symbol("prebaked reflection surface"), packs = new Map(), loading = new Map();
let manifestPromise = null;
const qualityTier = quality => quality === "high" || quality === "light" ? quality : "medium";
const formats = { f32: Float32Array, u32: Uint32Array, u16: Uint16Array, u8: Uint8Array };

// The offline baker writes the arrays in render order. Reading a pack creates
// typed views, never skins an actor, decimates a mesh or rasterises a mirror.
export function decodeReflectionPack(buffer, expected = {}) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 16 || buffer.byteLength > 48 * 1024 * 1024) throw new Error("Invalid reflection pack size");
  if (new TextDecoder().decode(new Uint8Array(buffer, 0, 8)) !== MAGIC) throw new Error("Invalid reflection pack signature");
  const jsonLength = new DataView(buffer).getUint32(8, true), start = Math.ceil((12 + jsonLength) / 4) * 4;
  if (jsonLength < 20 || jsonLength > 65536 || start > buffer.byteLength) throw new Error("Invalid reflection pack header");
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, jsonLength)));
  if (![1, 2].includes(header.format) || !["high", "medium", "light"].includes(header.quality) || !/^[a-f0-9]{64}$/.test(header.fingerprint)) throw new Error("Unsupported reflection pack metadata");
  if (expected.fingerprint && header.fingerprint !== expected.fingerprint || expected.quality && header.quality !== expected.quality) throw new Error("Reflection pack does not match its manifest");
  const arrays = new Map(), ranges = [];
  for (const section of header.sections ?? []) {
    const Format = formats[section.type], offset = start + section.offset, bytes = section.length * (Format?.BYTES_PER_ELEMENT ?? 0);
    if (!Format || !Number.isSafeInteger(section.offset) || section.offset < 0 || offset % Format.BYTES_PER_ELEMENT || !Number.isSafeInteger(section.length) || section.length < 0 || offset + bytes > buffer.byteLength || arrays.has(section.name)) throw new Error("Invalid reflection pack section");
    if (ranges.some(([lo, hi]) => offset < hi && offset + bytes > lo)) throw new Error("Overlapping reflection pack sections");
    ranges.push([offset, offset + bytes]); const values = new Format(buffer, offset, section.length);
    if (section.type === "f32" && !values.every(Number.isFinite) || section.type === "u16" && values.some(value => (value & 0x7c00) === 0x7c00)) throw new Error("Non-finite reflection surface");
    arrays.set(section.name, values);
  }
  const variantMetadata = header.format === 2 ? header.variants : header.poses;
  const variants = (variantMetadata ?? []).map(pose => {
    const position = arrays.get(pose.position), normal = arrays.get(pose.normal), color = arrays.get(pose.color), index = arrays.get(pose.index);
    if (!(position instanceof Float32Array) || !position.length || position.length % 3 || !(normal instanceof Float32Array) || !(color instanceof Float32Array) || normal.length !== position.length || color.length !== position.length || !(index instanceof Uint32Array) || !index.length || index.length % 3 || index.some(value => value >= position.length / 3)) throw new Error("Invalid reflection pose geometry");
    if (!Array.isArray(pose.bounds) || pose.bounds.length !== 6 || !pose.bounds.every(Number.isFinite)) throw new Error("Invalid reflection pose bounds");
    if (pose.bladeAnchor && (!Array.isArray(pose.bladeAnchor) || pose.bladeAnchor.length !== 3 || !pose.bladeAnchor.every(Number.isFinite))) throw new Error("Invalid reflection blade anchor");
    return { position, normal, color, index, bounds: pose.bounds, triangles: index.length / 3, sourceTriangles: pose.sourceTriangles, poseId: pose.poseId, bladeAnchor: pose.bladeAnchor, bladeSegment: pose.bladeSegment };
  });
  const primaryBanks = header.format === 2 ? header.poses : Array.from({ length: 8 }, (_, index) => index);
  const bankCount = header.format === 2 ? 24 : 8;
  if (!Array.isArray(primaryBanks) || primaryBanks.length !== 8 || primaryBanks.some(bank => !Number.isInteger(bank) || bank < 0 || bank >= variants.length) || variants.length !== bankCount) throw new Error("Invalid reflection pose banks");
  const poses = primaryBanks.map(bank => variants[bank]);
  if (header.format === 2) for (let family = 0; family < 8; family++) {
    const contact = variants[family * 3 + 1];
    for (const variant of variants.slice(family * 3, family * 3 + 3)) if (variant.position.length !== contact.position.length || variant.index.length !== contact.index.length || variant.index.some((index, vertex) => index !== contact.index[vertex]) || !variant.bladeAnchor) throw new Error("Reflection phases do not share contact topology");
  }
  const atlas = header.atlas ?? {}, positionData = arrays.get(atlas.position), normalData = arrays.get(atlas.normal), mirror = header.mirror ?? {}, mirrorData = arrays.get(mirror.pixels), Format = header.format === 2 ? Uint16Array : Float32Array;
  if (atlas.width !== 1024 || !Number.isInteger(atlas.height) || atlas.height < 1 || atlas.height > 2048 || !Number.isInteger(atlas.vertices) || atlas.vertices !== Math.max(...variants.map(pose => pose.index.length)) || atlas.vertices * bankCount > atlas.width * atlas.height || !(positionData instanceof Format) || !(normalData instanceof Format) || positionData.length !== atlas.width * atlas.height * 4 || normalData.length !== positionData.length || !Array.isArray(atlas.poseCounts) || atlas.poseCounts.length !== bankCount || atlas.poseCounts.some((count, i) => count !== variants[i].index.length) || !(mirrorData instanceof Uint8Array) || mirror.width !== 768 || mirror.height !== 160 || mirrorData.length !== mirror.width * mirror.height * 4) throw new Error("Invalid reflection image atlas");
  return { format: header.format, fingerprint: header.fingerprint, quality: header.quality, poses, variants: header.format === 2 ? variants : null, primaryBanks, atlas: { ...atlas, halfFloat: header.format === 2, positionData, normalData }, mirror: { width: mirror.width, height: mirror.height, data: mirrorData }, byteLength: buffer.byteLength };
}

export async function preloadReflectionAssets(quality = "medium", { fetcher = globalThis.fetch, base } = {}) {
  const tier = qualityTier(quality); if (packs.has(tier)) return packs.get(tier);
  if (loading.has(tier)) return loading.get(tier);
  if (!manifestPromise) manifestPromise = (async () => {
    const response = await fetcher(assetUrl("models/echo-reflections.json", base));
    if (!response.ok) throw new Error(`Reflection manifest failed (${response.status})`);
    const manifest = await response.json();
    if (![1, 2].includes(manifest.format) || !/^[a-f0-9]{64}$/.test(manifest.fingerprint)) throw new Error("Invalid reflection manifest");
    return manifest;
  })().catch(error => { manifestPromise = null; throw error; });
  const promise = (async () => {
    const manifest = await manifestPromise, path = manifest.packs?.[tier]?.path;
    if (path !== `models/echo-reflections-${tier}.bin`) throw new Error("Invalid reflection tier path");
    const response = await fetcher(assetUrl(path, base));
    if (!response.ok) throw new Error(`Reflection tier failed (${response.status})`);
    const pack = decodeReflectionPack(await response.arrayBuffer(), { fingerprint: manifest.fingerprint, quality: tier });
    packs.set(tier, pack); return pack;
  })().finally(() => loading.delete(tier));
  loading.set(tier, promise); return promise;
}

export function reflectionAssetsReady(quality = "medium") { return packs.has(qualityTier(quality)); }
export function reflectionAssetData(snapshots) {
  const pack = snapshots?.[0]?.[ASSET];
  if (!pack || !snapshots.every(geometry => geometry[ASSET] === pack)) return null;
  return snapshots.length === (pack.variants?.length ?? pack.poses.length) ? pack : { ...pack, atlas: null };
}

export function reflectionAssetsForActor(actor, quality = "medium", { variants = false } = {}) {
  if (actor?.style !== "blades" || !actor.standingHeight || !actor.model?.getObjectByName("spine04")) return null;
  const pack = packs.get(qualityTier(quality));
  if (!pack) throw new Error("Echo reflection assets must finish preloading before cinematic playback");
  if (variants && !pack.variants) throw new Error("Authored reflection banks require a current preflight pack");
  return (variants ? pack.variants : pack.poses).map(pose => {
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "color"]) geometry.setAttribute(name, new THREE.BufferAttribute(pose[name], 3));
    geometry.setIndex(new THREE.BufferAttribute(pose.index, 1));
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...pose.bounds.slice(0, 3)), new THREE.Vector3(...pose.bounds.slice(3)));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    geometry.userData.poseId = pose.poseId; geometry.userData.bladeAnchor = pose.bladeAnchor; geometry.userData.bladeSegment = pose.bladeSegment; geometry.userData.sharedReflectionTopology = variants; geometry.userData.sourceTriangles = pose.sourceTriangles; geometry.userData.prebaked = true; geometry.userData.reflectionQuality = pack.quality; geometry[ASSET] = pack;
    return geometry;
  });
}
