import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { MeshoptSimplifier } from "three/examples/jsm/libs/meshopt_simplifier.module.js";
import { createTexturedGltfLoader } from "../tests/helpers/texturedGltfLoader.js";
import { createRiggedFighter } from "../src/components/riggedFighter.js";
import { bakeAuthoredReflectionPoses, simplifyActorSnapshot, transferSnapshotTopology, createActorMirrorAtlas } from "../src/components/finaleActorSnapshots.js";
import { createReflectionPoseAtlas } from "../src/components/reflectionPoseAtlas.js";
import { decodeReflectionPack } from "../src/components/reflectionAssets.js";
import { ECHO_REFLECTION_FAMILIES } from "../src/game/sequences/echo/reflectionPoses.js";

const root = fileURLToPath(new URL("../", import.meta.url)), output = resolve(root, "public/models");
const sources = ["public/models/echo-human.glb", "src/components/riggedFighter.js", "src/components/poseRig.js", "src/components/wardrobe.js", "src/components/facialExpressions.js", "src/components/finaleActorSnapshots.js", "src/components/reflectionPoseAtlas.js", "src/game/poseKeys.js", "src/game/sequences/echo/reflectionPoses.js", "src/game/sequences/echo/reflectionBladeAnchors.js", "src/game/sequences/echo/poses.js", "src/game/sequences/math.js", "tests/helpers/texturedGltfLoader.js", "scripts/build-reflections.mjs"];
const sourceBuffers = await Promise.all(sources.map(path => readFile(resolve(root, path))));
const hash = createHash("sha256"); sources.forEach((path, index) => hash.update(path + "\0").update(sourceBuffers[index]));
const fingerprint = hash.digest("hex"), manifestPath = resolve(output, "echo-reflections.json");
if (process.argv.includes("--check")) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.fingerprint !== fingerprint) throw new Error("Echo reflection assets are stale. Run node scripts/build-reflections.mjs after the final model/pose edit.");
  for (const tier of ["high", "medium", "light"]) {
    const bytes = await readFile(resolve(root, "public", manifest.packs[tier].path));
    decodeReflectionPack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { fingerprint, quality: tier });
  }
  console.log(`Echo reflection packs match source ${fingerprint.slice(0, 12)}`);
  process.exit(0);
}

await MeshoptSimplifier.ready;
const gltfBytes = sourceBuffers[0], gltf = await createTexturedGltfLoader().parseAsync(gltfBytes.buffer.slice(gltfBytes.byteOffset, gltfBytes.byteOffset + gltfBytes.byteLength), "");
const actor = createRiggedFighter(gltf, "#83ffd6", "blades");
actor.equipAppearance({ color: "#83ffd6", kit: { layer: "vest", detail: "scarf" } });
const started = performance.now(), surfaces = bakeAuthoredReflectionPoses(actor, { sampleTextures: true });
console.log(`Twenty-four authored Echo phases baked in ${((performance.now() - started) / 1000).toFixed(2)}s`);
const welded = ECHO_REFLECTION_FAMILIES.map((family, index) => {
  const surface = surfaces[index * 3 + 1], anchor = new THREE.Vector3(...surface.userData.bladeAnchor);
  if (anchor.distanceTo(new THREE.Vector3(...family.bladeAnchor)) > .02) throw new Error(`Authored blade calibration is stale: ${family.id}`);
  const geometry = simplifyActorSnapshot(surface, .003, { featureCell: .002, weaponCell: .0015, motionSurfaces: [surfaces[index * 3], surfaces[index * 3 + 2]] });
  geometry.userData.sourceTriangles = surface.attributes.position.count / 3; return geometry;
});

function lodSurface(source, target) {
  const position = source.attributes.position.array, color = source.attributes.color.array, normal = source.attributes.normal.array, importance = source.attributes.partImportance.array;
  const attribute = new Float32Array(source.attributes.position.count * 7), locked = new Uint8Array(source.attributes.position.count);
  for (let i = 0; i < locked.length; i++) {
    attribute.set(color.subarray(i * 3, i * 3 + 3), i * 7); attribute.set(normal.subarray(i * 3, i * 3 + 3), i * 7 + 3); attribute[i * 7 + 6] = importance[i] * .15;
  }
  // Preserve real silhouette extremes and both blade/grip endpoints; avoid
  // locking every ornamental hilt vertex, which prevents useful Light LODs.
  for (const region of [() => true, i => importance[i] === 2 && position[i * 3] >= 0, i => importance[i] === 2 && position[i * 3] < 0]) {
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      let best = -Infinity, vertex = -1;
      for (let i = 0; i < locked.length; i++) if (region(i) && position[i * 3 + axis] * sign > best) { best = position[i * 3 + axis] * sign; vertex = i; }
      if (vertex >= 0) locked[vertex] = 1;
    }
  }
  let indices, error;
  for (const tolerance of [.025, .06, .15, .5]) {
    [indices, error] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(source.index.array), position, 3, attribute, 7, [.08, .08, .08, .04, .04, .04, .2], locked, Math.min(target * 3, source.index.count), tolerance, ["Permissive"]);
    if (indices.length <= target * 3) break;
  }
  if (indices.length > target * 3) throw new Error(`Reflection LOD exceeded ${target} triangles (${indices.length / 3})`);
  const [remap, count] = MeshoptSimplifier.compactMesh(indices), result = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color"]) {
    const data = new Float32Array(count * 3), sourceData = source.attributes[name].array;
    for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) data.set(sourceData.subarray(i * 3, i * 3 + 3), remap[i] * 3);
    result.setAttribute(name, new THREE.BufferAttribute(data, 3));
  }
  const correspondence = new Uint32Array(count);
  for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) correspondence[remap[i]] = source.attributes.sourceVertex.getX(i);
  result.setAttribute("sourceVertex", new THREE.BufferAttribute(correspondence, 1));
  result.setIndex(new THREE.BufferAttribute(indices, 1)); result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData.sourceTriangles = source.userData.sourceTriangles; result.userData.simplificationError = error;
  return result;
}

function packTier(quality, poses, atlas, mirror) {
  const arrays = [], sections = [], stored = new Map(); let byteLength = 0;
  const add = (name, array) => {
    if (stored.has(array)) return stored.get(array);
    stored.set(array, name); byteLength = Math.ceil(byteLength / 4) * 4;
    sections.push({ name, type: array instanceof Float32Array ? "f32" : array instanceof Uint32Array ? "u32" : array instanceof Uint16Array ? "u16" : "u8", offset: byteLength, length: array.length });
    arrays.push(array); byteLength += array.byteLength; return name;
  };
  const metadata = poses.map((geometry, pose) => ({
    position: add(`pose${pose}.position`, geometry.attributes.position.array), normal: add(`pose${pose}.normal`, geometry.attributes.normal.array), color: add(`pose${pose}.color`, poses[Math.floor(pose / 3) * 3 + 1].attributes.color.array), index: add(`pose${pose}.index`, geometry.index.array),
    bounds: [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()], sourceTriangles: geometry.userData.sourceTriangles, poseId: geometry.userData.poseId, bladeAnchor: geometry.userData.bladeAnchor, bladeSegment: geometry.userData.bladeSegment,
  }));
  const header = { format: 2, fingerprint, quality, variants: metadata, poses: Array.from({ length: 8 }, (_, family) => family * 3 + 1), atlas: { width: atlas.positions.image.width, height: atlas.positions.image.height, vertices: atlas.vertices, poseCounts: atlas.poseCounts,
    position: add("atlas.position", atlas.positions.image.data), normal: add("atlas.normal", atlas.normals.image.data) }, mirror: { width: mirror.image.width, height: mirror.image.height, pixels: add("mirror.pixels", mirror.image.data) }, sections };
  const json = new TextEncoder().encode(JSON.stringify(header)), start = Math.ceil((12 + json.length) / 4) * 4, bytes = new Uint8Array(start + byteLength);
  bytes.set(new TextEncoder().encode("TRNREF01")); new DataView(bytes.buffer).setUint32(8, json.length, true); bytes.set(json, 12);
  arrays.forEach((array, i) => bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), start + sections[i].offset));
  decodeReflectionPack(bytes.buffer, { fingerprint, quality }); return bytes;
}

await mkdir(output, { recursive: true });
const packs = {};
for (const [quality, target] of [["high", 12000], ["medium", 6000], ["light", 3000]]) {
  const time = performance.now(), topologies = welded.map(surface => lodSurface(surface, target)), poses = surfaces.map((surface, bank) => transferSnapshotTopology(surface, topologies[Math.floor(bank / 3)]));
  topologies.forEach(geometry => geometry.dispose());
  const primary = Array.from({ length: 8 }, (_, family) => poses[family * 3 + 1]), atlas = createReflectionPoseAtlas(poses, 24, { halfFloat: true }), mirror = createActorMirrorAtlas(primary), bytes = packTier(quality, poses, atlas, mirror);
  const path = `models/echo-reflections-${quality}.bin`; await writeFile(resolve(root, "public", path), bytes);
  packs[quality] = { path, byteLength: bytes.byteLength, triangles: poses.map(geometry => geometry.index.count / 3), reflectionTextureBytes: atlas.textureBytes, maxReflectionTriangles: atlas.vertices / 3 * 24 };
  console.log(`${quality}: ${packs[quality].triangles.join("/")} triangles, ${(bytes.byteLength / 1048576).toFixed(2)} MiB, ${((performance.now() - time) / 1000).toFixed(2)}s offline`);
  atlas.dispose(); mirror.dispose(); poses.forEach(geometry => geometry.dispose());
}
const sourceDigests = Object.fromEntries(sources.map((path, i) => [path, createHash("sha256").update(sourceBuffers[i]).digest("hex")]));
await writeFile(manifestPath, JSON.stringify({ format: 2, fingerprint, sourceDigests, poses: 8, poseBanks: 24, phasesPerFamily: 3, reflections: 24, standingHeight: actor.standingHeight, packs }, null, 2) + "\n");
welded.forEach(geometry => geometry.dispose()); surfaces.forEach(geometry => geometry.dispose()); actor.disposeAppearance();
console.log(`Reflection preflight assets ready: ${fingerprint.slice(0, 12)}`);
