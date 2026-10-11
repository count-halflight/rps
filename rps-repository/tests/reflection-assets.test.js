import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { bakeActorSurface, simplifyActorSnapshot, createReflectionSnapshots, createReflectionVariantSnapshots, createActorMirrorAtlas } from "../src/components/finaleActorSnapshots.js";
import { createReflectionPoseAtlas } from "../src/components/reflectionPoseAtlas.js";
import { preloadReflectionAssets, reflectionAssetsReady, decodeReflectionPack } from "../src/components/reflectionAssets.js";
import { reflectionContactTransform } from "../src/components/reflectionContact.js";
import { echoReflectionPose, ECHO_REFLECTION_FAMILIES } from "../src/game/sequences/index.js";

const modelDir = new URL("../public/models/", import.meta.url);
const bufferOf = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test("indexed skin baking visits each vertex once and retains material-group colors", () => {
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); geometry.setIndex([0, 1, 2, 0, 2, 1]);
  geometry.addGroup(0, 3, 0); geometry.addGroup(3, 3, 1);
  const materials = [new THREE.MeshBasicMaterial({ color: "#ff0000" }), new THREE.MeshBasicMaterial({ color: "#00ff00" })], mesh = new THREE.Mesh(geometry, materials); root.add(mesh); root.position.set(20, 0, -10);
  let evaluations = 0; const original = mesh.getVertexPosition.bind(mesh); mesh.getVertexPosition = (index, target) => { evaluations++; return original(index, target); };
  const baked = bakeActorSurface(root);
  try {
    assert.equal(evaluations, 3); assert.equal(baked.userData.vertexEvaluations, 3);
    assert.deepEqual(Array.from(baked.attributes.position.array), [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0]);
    for (let vertex = 0; vertex < 6; vertex++) assert.deepEqual(Array.from(baked.attributes.color.array.subarray(vertex * 3, vertex * 3 + 3)), vertex < 3 ? [1, 0, 0] : [0, 1, 0]);
  } finally { baked.dispose(); geometry.dispose(); materials.forEach(material => material.dispose()); }
});

test("surface welding removes repeated and zero-area faces while preserving reversed winding", () => {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 1, 2, 1, 2, 0, 2, 1, 0, 0, 0, 1, 0, 1, 3]);
  const simplified = simplifyActorSnapshot(geometry, .001);
  try { assert.equal(simplified.index.count, 6); assert.deepEqual(Array.from(simplified.index.array), [0, 1, 2, 2, 1, 0]); }
  finally { simplified.dispose(); geometry.dispose(); }
});

test("the canonical fighter requires preflight rather than quietly baking eight poses during a clip", () => {
  assert.equal(reflectionAssetsReady("medium"), false);
  const model = new THREE.Group(), spine = new THREE.Bone(); spine.name = "spine04"; model.add(spine);
  assert.throws(() => createReflectionSnapshots({ root: model, model, style: "blades", standingHeight: 2.1 }, "medium"), /preloading/);
});

test("real model packs load once and create all quality tiers without evaluating any live skin vertices", async () => {
  const requests = [], manifest = JSON.parse(await readFile(new URL("echo-reflections.json", modelDir), "utf8"));
  const fetcher = async url => {
    requests.push(url); const name = url.split("?")[0].split("/").at(-1), bytes = await readFile(new URL(name, modelDir));
    return { ok: true, status: 200, json: async () => JSON.parse(bytes.toString()), arrayBuffer: async () => bufferOf(bytes) };
  };
  const model = new THREE.Group(), spine = new THREE.Bone(); spine.name = "spine04"; model.add(spine);
  const forbidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); forbidden.getVertexPosition = () => { throw new Error("Live skinning must not run"); }; model.add(forbidden);
  const actor = { root: model, model, style: "blades", standingHeight: 2.1 };
  try {
    for (const [quality, maximum] of [["high", 12000], ["medium", 6000], ["light", 3000]]) {
      const [pack, duplicate] = await Promise.all([preloadReflectionAssets(quality, { fetcher }), preloadReflectionAssets(quality, { fetcher })]);
      assert.equal(pack, duplicate); assert.equal(pack.fingerprint, manifest.fingerprint); assert.equal(reflectionAssetsReady(quality), true);
      const poses = createReflectionSnapshots(actor, quality), variants = createReflectionVariantSnapshots(actor, quality), atlas = createReflectionPoseAtlas(variants, 24), mirror = createActorMirrorAtlas(poses);
      try {
        assert.equal(poses.length, 8); assert.equal(variants.length, 24); assert.equal(atlas.mesh.count, 24); assert.equal(atlas.geometry.userData.poseCount, 24);
        assert.equal(atlas.positions.type, THREE.HalfFloatType); assert.equal(atlas.normals.type, THREE.HalfFloatType);
        assert.equal(atlas.positions.image.data, pack.atlas.positionData); assert.equal(atlas.normals.image.data, pack.atlas.normalData); assert.equal(mirror.image.data, pack.mirror.data);
        assert.ok(atlas.textureBytes <= 16 * 1024 * 1024); assert.ok(poses.every(geometry => geometry.index.count / 3 <= maximum));
        assert.ok(new Set(poses.map(geometry => createHash("sha256").update(new Uint8Array(geometry.attributes.position.array.buffer, geometry.attributes.position.array.byteOffset, geometry.attributes.position.array.byteLength)).digest("hex"))).size >= 6);
        const firstBounds = poses[0].boundingBox, originalHeight = firstBounds.max.y - firstBounds.min.y;
        assert.ok(originalHeight > 1.6 && originalHeight < 2.4, "each LOD contains a complete anatomical fighter");
        assert.ok(firstBounds.min.y < .3 && firstBounds.max.y < 2.2, "baked skin must use the real attached bind inverse rather than floating above the weapons and feet");
        assert.ok(poses.every(geometry => geometry.userData.prebaked));
        let released = 0; poses[0].addEventListener("dispose", () => { released++; }); poses[0].dispose();
        const replacement = createReflectionSnapshots(actor, quality); assert.equal(replacement[0].attributes.position.array, pack.poses[0].position); assert.equal(released, 1); replacement.forEach(geometry => geometry.dispose());
      } finally { atlas.dispose(); mirror.dispose(); variants.forEach(geometry => geometry.dispose()); poses.slice(1).forEach(geometry => geometry.dispose()); }
    }
    assert.equal(requests.length, 4, "one manifest and exactly one binary pack per quality");
  } finally { forbidden.geometry.dispose(); forbidden.material.dispose(); }
});

test("pack validation rejects stale source fingerprints, truncation and non-finite surfaces", async () => {
  const bytes = await readFile(new URL("echo-reflections-light.bin", modelDir)), buffer = bufferOf(bytes);
  assert.throws(() => decodeReflectionPack(buffer, { fingerprint: "0".repeat(64) }), /manifest/);
  assert.throws(() => decodeReflectionPack(buffer.slice(0, buffer.byteLength - 16)), /section/);
  const damaged = buffer.slice(0), length = new DataView(damaged).getUint32(8, true), header = JSON.parse(new TextDecoder().decode(new Uint8Array(damaged, 12, length))), start = Math.ceil((12 + length) / 4) * 4;
  new DataView(damaged).setFloat32(start + header.sections[0].offset, NaN, true);
  assert.throws(() => decodeReflectionPack(damaged), /Non-finite/);
});


test("all authored packed blade contacts reach the actual posed bone surface in metre-scale mirrored staging", async () => {
  const bytes = await readFile(new URL("echo-reflections-medium.bin", modelDir)), pack = decodeReflectionPack(bufferOf(bytes));
  assert.equal(pack.format, 2); assert.equal(pack.variants.length, 24);
  const snapshots = pack.variants.map(pose => ({ userData: { bladeAnchor: pose.bladeAnchor } }));
  const attacker = { root: new THREE.Group() }, defender = { root: new THREE.Group(), model: new THREE.Group() }; defender.root.add(defender.model);
  for (const name of ["spine01", "spine04", "spine02", "head"]) { const bone = new THREE.Bone(); bone.name = name; bone.position.set(.04, {spine01:1.10,spine04:.80,spine02:1.02,head:1.45}[name], .07); defender.model.add(bone); }
  for (const direction of [1, -1]) for (const actorHeight of [1.60, 1.72]) for (const targetHeight of [1.7, 2.4]) for (let index = 0; index < 24; index++) {
    attacker.root.scale.setScalar(actorHeight / 2.1); defender.root.position.set(direction * 1.6, -.13, .24); defender.root.rotation.set(-.20, direction * .32, .08); defender.root.scale.setScalar(targetHeight / 2.1); defender.root.updateWorldMatrix(true, true);
    const pose = echoReflectionPose(index, .43, { actorHeight, targetHeight, direction, defenderY: -.3 }), center = [direction * 1.6, targetHeight * .58, .24];
    const reflection = { ...pose, index, active: true, progress: .43, pose, root: [pose.root[0] + center[0], pose.root[1], pose.root[2] + center[2]], contactPoint: [pose.contactPoint[0] + center[0], pose.contactPoint[1], pose.contactPoint[2] + center[2]] };
    const result = reflectionContactTransform(reflection, snapshots, { attacker, defender, center, targetHeight });
    assert.ok(result.diagnostic.contact); assert.ok(result.diagnostic.distance < .000001, `index ${index}, direction ${direction}, targetHeight ${targetHeight}: actual edge meets the real bone surface`);
    const matrix = new THREE.Matrix4().compose(result.position, result.quaternion, result.scale), packedBlade = new THREE.Vector3(...pack.variants[result.bankA].bladeAnchor).applyMatrix4(matrix);
    assert.ok(packedBlade.distanceTo(new THREE.Vector3(...result.diagnostic.targetPoint)) < .000001);
    const family = ECHO_REFLECTION_FAMILIES[index % 8]; assert.ok(new THREE.Vector3(...pack.variants[result.bankA].bladeAnchor).distanceTo(new THREE.Vector3(...family.bladeAnchor)) < .00002);
  }
});

test("packed phase banks preserve matching surface indices and reject non-finite half-float data", async () => {
  const bytes = await readFile(new URL("echo-reflections-light.bin", modelDir)), buffer = bufferOf(bytes), pack = decodeReflectionPack(buffer);
  assert.equal(pack.variants.length, 24);
  for (let family = 0; family < 8; family++) {
    const [pre, contact, follow] = pack.variants.slice(family * 3, family * 3 + 3);
    assert.equal(pre.index, contact.index); assert.equal(contact.index, follow.index);
    assert.equal(pre.position.length, contact.position.length); assert.equal(contact.position.length, follow.position.length);
    assert.notDeepEqual(pre.position, contact.position); assert.notDeepEqual(contact.position, follow.position);
  }
  const damaged = buffer.slice(0), length = new DataView(damaged).getUint32(8, true), header = JSON.parse(new TextDecoder().decode(new Uint8Array(damaged, 12, length))), start = Math.ceil((12 + length) / 4) * 4;
  const section = header.sections.find(section => section.name === header.atlas.position);
  new DataView(damaged).setUint16(start + section.offset, 0x7c01, true);
  assert.throws(() => decodeReflectionPack(damaged), /Non-finite/);
});
