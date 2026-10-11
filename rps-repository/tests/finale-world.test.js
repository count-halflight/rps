import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFinaleWorld, AFTERLIGHT_ACT_BOUNDARIES, afterlightAct } from "../src/components/finaleWorld.js";
import { createBossDissolve, BOSS_DISSOLVE_STYLES } from "../src/components/bossDissolve.js";
import { bakeActorSurface, createReflectionSnapshots, createReflectionVariantSnapshots, transferSnapshotTopology, simplifyActorSnapshot } from "../src/components/finaleActorSnapshots.js";
import { createReflectionPoseAtlas } from "../src/components/reflectionPoseAtlas.js";

function actorFixture(scene, x = 0) {
  const root = new THREE.Group(), body = new THREE.Group(), model = new THREE.Group(); root.add(body); body.add(model); root.position.x = x;
  const geometries = [], materials = [], add = (parent, geometry, position, name = "") => {
    const material = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(geometry, material);
    geometries.push(geometry); materials.push(material); mesh.position.set(...position); mesh.name = name; parent.add(mesh); return mesh;
  };
  const pelvis = new THREE.Bone(); pelvis.name = "spine04"; model.add(pelvis);
  const bone = (parent, name, position) => { const value = new THREE.Bone(); value.name = name; value.position.set(...position); parent.add(value); return value; };
  const lowerSpine = bone(pelvis, "spine02", [0, .95, 0]), upperSpine = bone(lowerSpine, "spine01", [0, .3, 0]);
  bone(upperSpine, "head", [0, .35, 0]); add(upperSpine, new THREE.BoxGeometry(.42, .5, .25), [0, 0, 0]);
  const blades = [], stowed = [];
  for (const [side, sign] of [["L", 1], ["R", -1]]) {
    const upperArm = bone(upperSpine, `upperarm01${side}`, [sign * .23, .16, 0]), lowerArm = bone(upperArm, `lowerarm01${side}`, [0, -.30, 0]);
    const wrist = bone(lowerArm, `wrist${side}`, [0, -.27, 0]);
    add(upperArm, new THREE.BoxGeometry(.1, .28, .1), [0, -.14, 0]); add(lowerArm, new THREE.BoxGeometry(.08, .25, .08), [0, -.125, 0]);
    const blade = add(wrist, new THREE.BoxGeometry(.035, .7, .025), [0, .3, 0], `EchoBlade${side}`); blade.visible = false; blades.push(blade);
    stowed.push(add(pelvis, new THREE.BoxGeometry(.04, .4, .03), [sign * .27, .68, -.12], `EchoStowedBlade${side}`));
    const upperLeg = bone(pelvis, `upperleg01${side}`, [sign * .11, .88, 0]), lowerLeg = bone(upperLeg, `lowerleg01${side}`, [0, -.43, 0]);
    bone(lowerLeg, `foot${side}`, [0, -.40, 0]);
    add(upperLeg, new THREE.BoxGeometry(.15, .4, .15), [0, -.2, 0]); add(lowerLeg, new THREE.BoxGeometry(.12, .37, .12), [0, -.185, 0]);
  }
  scene.add(root);
  return { root, body, model, weaponGroups: { blades, stowedBlades: stowed }, geometries, materials,
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); scene.remove(root); } };
}
function frameAt(seconds) { return { progress: seconds / 15, finale: { id: "ECHO-AF", time: seconds, center: [2.1, 1.9, 0], fighterCenter: [-1.6, 0, 0] } }; }
const animation = { id: "echo-afterlight-test", sequenceId: "ECHO-AF", duration: 15000, outcome: "win" };

test("ECHO-AF preserves the exact five-act boundaries on a fifteen-second clock", () => {
  assert.deepEqual(AFTERLIGHT_ACT_BOUNDARIES, [0, 2.5, 5.5, 9, 12.5, 15]);
  for (const [time, expected] of [[0, 1], [2.499, 1], [2.5, 2], [5.499, 2], [5.5, 3], [8.999, 3], [9, 4], [12.499, 4], [12.5, 5], [15, 5]]) assert.equal(afterlightAct(time), expected);
});

test("all quality tiers retain twenty-four staged reflections, mirrors and delayed cuts", () => {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 2.1), world = createFinaleWorld(scene);
  try {
    for (const quality of ["high", "medium", "light"]) for (const seconds of [.1, 2.5, 4.2, 5.5, 6.3, 8.8, 9, 10.2, 11.7, 12.5, 14.4]) {
      const result = world.update({ frame: frameAt(seconds), animation, attacker, defender, quality, reduced: quality === "light" });
      assert.equal(result.act, afterlightAct(seconds)); assert.equal(result.reflectionCount, 24); assert.equal(result.hideEnvironment, false);
      assert.equal(world.root.getObjectByName("Twenty-four mirror faces").count, 24);
      assert.equal(world.root.getObjectByName("Twenty-four delayed mint cuts").count, 24);
      const pools = world.root.children.filter(o => o.name === "Echo reflection poses");
      assert.equal(pools.length, 1); assert.equal(result.reflectionDraws, 1);
      assert.equal(pools[0].geometry.userData.poseCount, 24);
      assert.equal(pools.reduce((sum, pool) => sum + pool.count, 0), 24);
      for (const pool of pools) assert.ok(pool.geometry.attributes.ghostAlpha.array.every(value => value <= .550001));
      scene.updateMatrixWorld(true);
      world.root.traverse(object => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${quality} ${seconds}: ${object.name} transform`);
        const positions = object.geometry?.attributes.position?.array;
        if (positions) assert.ok(positions.every(Number.isFinite), `${quality} ${seconds}: geometry`);
        if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.every(Number.isFinite), `${quality} ${seconds}: instances`);
      });
    }
    assert.equal(world.update({ frame: frameAt(15), animation, attacker, defender }).active, false); assert.equal(world.root.visible, false);
  } finally { world.dispose(); attacker.dispose(); defender.dispose(); }
});

test("reflection atlas stores every real pose and submits the twenty-four reflections in one draw", () => {
  const scene = new THREE.Scene(), actor = actorFixture(scene), snapshots = createReflectionSnapshots(actor, "medium"), atlas = createReflectionPoseAtlas(snapshots, 24);
  try {
    assert.equal(atlas.mesh.count, 24); assert.equal(atlas.geometry.userData.poseCount, 8);
    assert.ok(atlas.textureBytes < 128 * 1024 * 1024);
    for (let pose = 0; pose < snapshots.length; pose++) {
      const source = snapshots[pose], vertices = source.index?.count ?? source.attributes.position.count;
      for (const i of [0, Math.floor(vertices / 2), vertices - 1]) {
        const index = source.index?.getX(i) ?? i, offset = (pose * atlas.vertices + i) * 4;
        assert.equal(atlas.positions.image.data[offset], source.attributes.position.getX(index));
        assert.equal(atlas.positions.image.data[offset + 1], source.attributes.position.getY(index));
        assert.equal(atlas.positions.image.data[offset + 2], source.attributes.position.getZ(index));
        assert.ok(Math.abs(atlas.normals.image.data[offset] - source.attributes.normal.getX(index)) < .00001);
      }
    }
    assert.ok(atlas.positions.image.data.every(Number.isFinite)); assert.ok(atlas.normals.image.data.every(Number.isFinite));
    assert.equal(atlas.positions.magFilter, THREE.NearestFilter); assert.equal(atlas.positions.generateMipmaps, false);
  } finally { atlas.dispose(); snapshots.forEach(geometry => geometry.dispose()); actor.dispose(); }
});

test("mirror glass has visible silvered surfaces and the epilogue halo follows physical fighter height", () => {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 2.1), world = createFinaleWorld(scene);
  try {
    world.update({ frame: frameAt(6.3), animation, attacker, defender, actorHeight: 1.72, targetHeight: 2.4 });
    const mirrors = world.root.getObjectByName("Twenty-four mirror faces"); assert.ok(mirrors.material.opacity >= .2 && mirrors.material.opacity <= .3); assert.ok(mirrors.material.roughnessMap); assert.ok(mirrors.material.alphaMap); assert.ok(mirrors.material.envMapIntensity <= .2);
    assert.ok(new Set(mirrors.material.map.image.data).size > 25, "chipped silvering must contain visible surface variation instead of empty panel centers");
    const reflected = world.root.getObjectByName("Twenty-four boss mirror reflections"), imageMatrix = new THREE.Matrix4(); reflected.getMatrixAt(0, imageMatrix);
    const scale = new THREE.Vector3().setFromMatrixScale(imageMatrix); assert.ok(scale.z < scale.x * .04, "the actual boss surface must fit as a planar mirror image rather than a person protruding through the glass");
    assert.ok(reflected.geometry.attributes.ghostAlpha.getX(0) >= .3); assert.ok(reflected.material.uniforms.bodyCoverage.value >= .25 && reflected.material.uniforms.bodyCoverage.value <= .30); assert.ok(reflected.material.uniforms.maximumAlpha.value <= .16);
    world.update({ frame: frameAt(13.5), animation, attacker, defender, actorHeight: 1.72 });
    const halo = world.root.getObjectByName("Trinity finale rings"); assert.ok(Math.abs(halo.position.y - 2.22) < .00001);
    const echo = world.root.getObjectByName("Delayed actual Echo reflection"), puddle = world.root.getObjectByName("Epilogue delayed puddle echo");
    assert.ok(echo.material.isShaderMaterial); assert.ok(echo.material.uniforms.puddleCenter.value.equals(puddle.position));
    assert.ok(echo.material.uniforms.strength.value <= .16); assert.equal(echo.material.side, THREE.FrontSide);
  } finally { world.dispose(); attacker.dispose(); defender.dispose(); }
});

test("the active Echo strike dominates subdued stationary boss images without removing any reflection", () => {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 2.1), world = createFinaleWorld(scene);
  try {
    world.update({ frame: frameAt(6.3), animation, attacker, defender });
    const echo = world.root.getObjectByName("Echo reflection poses"), boss = world.root.getObjectByName("Twenty-four boss mirror reflections");
    const alphas = Array.from(echo.geometry.attributes.ghostAlpha.array.subarray(0, echo.count)), active = alphas.filter(alpha => alpha > .04), inactive = alphas.filter(alpha => alpha <= .04);
    assert.equal(echo.count, 24); assert.equal(boss.count, 24); assert.ok(active.length >= 1 && active.length <= 2); assert.ok(inactive.every(alpha => alpha <= .035001));
    assert.ok(echo.material.uniforms.maximumAlpha.value <= .45); assert.ok(echo.material.uniforms.bodyCoverage.value > boss.material.uniforms.bodyCoverage.value * 1.8);
    const activeCoverage = Math.max(...active) * echo.material.uniforms.bodyCoverage.value, bossCoverage = boss.geometry.attributes.ghostAlpha.getX(0) * boss.material.uniforms.bodyCoverage.value;
    assert.ok(activeCoverage > bossCoverage * 2.8, "one moving Echo must read more strongly than a static pane image");
  } finally { world.dispose(); attacker.dispose(); defender.dispose(); }
});

test("degenerate reflected normals receive a safe fallback before they can spread NaNs through bloom", () => {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const atlas = createReflectionPoseAtlas([geometry], 1);
  try {
    for (let vertex = 0; vertex < 3; vertex++) assert.deepEqual(Array.from(atlas.normals.image.data.subarray(vertex * 4, vertex * 4 + 3)), [0, 1, 0]);
    assert.ok(atlas.material.vertexShader.includes("safeNormal(normalMatrix*mat3(instance)*posedNormal")); assert.ok(atlas.material.fragmentShader.includes("safeNormal(vNormal"));
    assert.ok(!atlas.material.fragmentShader.includes("normalize(vNormal)")); assert.ok(!atlas.material.fragmentShader.includes("normalize(vView)"));
  } finally { atlas.dispose(); geometry.dispose(); }
});

test("pooled reflection snapshots contain different anatomical poses without changing source weapons", () => {
  const scene = new THREE.Scene(), actor = actorFixture(scene), before = [];
  actor.root.traverse(o => { before.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]); });
  const snapshots = createReflectionSnapshots(actor, "medium");
  try {
    assert.equal(snapshots.length, 8);
    const fingerprints = snapshots.map(g => Array.from(g.attributes.position.array.slice(0, 24)).map(v => v.toFixed(3)).join(","));
    assert.ok(new Set(fingerprints).size >= 6, "reflections must change body geometry, not only their orbit angle");
    for (const [object, position, quaternion, scale, visible] of before) {
      assert.ok(object.position.equals(position)); assert.ok(object.quaternion.equals(quaternion)); assert.ok(object.scale.equals(scale)); assert.equal(object.visible, visible);
    }
    assert.ok(actor.weaponGroups.blades.every(blade => !blade.visible)); assert.ok(actor.weaponGroups.stowedBlades.every(blade => blade.visible));
  } finally { snapshots.forEach(g => g.dispose()); actor.dispose(); }
});

test("reflection quality simplification reduces triangles while retaining the complete silhouette bounds", () => {
  const root = new THREE.Group(), source = new THREE.SphereGeometry(.7, 48, 32), material = new THREE.MeshBasicMaterial(); root.add(new THREE.Mesh(source, material));
  const baked = bakeActorSurface(root), light = simplifyActorSnapshot(baked, .14);
  try {
    assert.ok(light.index.count < baked.attributes.position.count * .65);
    const expected = baked.boundingBox.getSize(new THREE.Vector3()), actual = light.boundingBox.getSize(new THREE.Vector3());
    assert.ok(actual.distanceTo(expected) < .25); assert.ok(light.attributes.position.array.every(Number.isFinite));
  } finally { baked.dispose(); light.dispose(); source.dispose(); material.dispose(); }
});

test("all boss dissolution styles preserve finite geometry and leave borrowed resources intact", () => {
  const scene = new THREE.Scene(), actor = actorFixture(scene), dissolution = createBossDissolve(scene);
  let borrowedDisposals = 0; actor.geometries.forEach(g => g.addEventListener("dispose", () => { borrowedDisposals++; }));
  try {
    for (const style of BOSS_DISSOLVE_STYLES) for (const quality of ["high", "medium", "light"]) for (const progress of [.01, .24, .6, .99, 1]) {
      const state = dissolution.update({ actor, style, quality, progress });
      assert.ok(state.opacity >= 0 && state.opacity <= 1); assert.equal(state.hide, progress >= .24);
      dissolution.root.traverse(object => {
        assert.ok(object.matrix.elements.every(Number.isFinite)); if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.every(Number.isFinite));
      });
    }
    dissolution.dispose(); assert.equal(borrowedDisposals, 0); assert.equal(actor.root.parent, scene);
  } finally { if (dissolution.root.parent) dissolution.dispose(); actor.dispose(); }
});

test("finale teardown releases every pooled geometry, material, texture and instance buffer exactly once", () => {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 2.1), world = createFinaleWorld(scene);
  world.update({ frame: frameAt(6.3), animation, attacker, defender, quality: "high" });
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set(), disposals = new Map();
  world.root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); if (object.isInstancedMesh) instances.add(object);
    for (const key of ["map", "roughnessMap", "alphaMap", "emissiveMap"]) if (object.material?.[key]) textures.add(object.material[key]);
    for (const uniform of Object.values(object.material?.uniforms ?? {})) if (uniform.value?.isTexture) textures.add(uniform.value);
  });
  for (const resource of [...geometries, ...materials, ...textures, ...instances]) { disposals.set(resource, 0); resource.addEventListener("dispose", () => disposals.set(resource, disposals.get(resource) + 1)); }
  let borrowed = 0; [...attacker.geometries, ...defender.geometries, ...attacker.materials, ...defender.materials].forEach(resource => resource.addEventListener("dispose", () => { borrowed++; }));
  world.dispose();
  for (const count of disposals.values()) assert.equal(count, 1); assert.equal(borrowed, 0); assert.equal(attacker.root.parent, scene); assert.equal(defender.root.parent, scene);
  attacker.dispose(); defender.dispose();
});


test("authored reflection phases share vertices and morph real surfaces inside the existing single draw", () => {
  const scene = new THREE.Scene(), actor = actorFixture(scene), snapshots = createReflectionVariantSnapshots(actor, "medium"), atlas = createReflectionPoseAtlas(snapshots, 24);
  try {
    assert.equal(snapshots.length, 24); assert.equal(atlas.mesh.count, 24); assert.equal(atlas.geometry.userData.poseCount, 24);
    assert.equal(atlas.positions.type, THREE.HalfFloatType); assert.equal(atlas.normals.type, THREE.HalfFloatType);
    assert.ok(atlas.material.vertexShader.includes("poseIndexB*poseVertexCount")); assert.ok(atlas.material.vertexShader.includes("clamp(poseBlend,0.,1.)"));
    assert.equal(atlas.geometry.attributes.poseIndexB, atlas.poseBankB); assert.equal(atlas.geometry.attributes.poseBlend, atlas.blend);
    for (let family = 0; family < 8; family++) {
      const phases = snapshots.slice(family * 3, family * 3 + 3);
      assert.equal(phases[0].index.array, phases[1].index.array); assert.equal(phases[1].index.array, phases[2].index.array);
      assert.ok(phases.every(geometry => geometry.attributes.position.count === phases[1].attributes.position.count));
      assert.notDeepEqual(phases[0].attributes.position.array, phases[1].attributes.position.array);
      assert.notDeepEqual(phases[1].attributes.position.array, phases[2].attributes.position.array);
      for (let phase = 0; phase < 3; phase++) for (const vertex of [0, Math.floor(phases[phase].index.count / 2), phases[phase].index.count - 1]) {
        const bank = family * 3 + phase, index = phases[phase].index.getX(vertex), address = (bank * atlas.vertices + vertex) * 4;
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(atlas.positions.image.data[address + axis]) - phases[phase].attributes.position.array[index * 3 + axis]) < .002);
      }
    }
  } finally { atlas.dispose(); snapshots.forEach(geometry => geometry.dispose()); actor.dispose(); }
});

test("contact topology carries its original vertex correspondence into every authored phase", () => {
  const raw = new THREE.BufferGeometry(); raw.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0], 3)); raw.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(18).fill(.4), 3));
  const topology = simplifyActorSnapshot(raw, .001), moved = raw.clone();
  for (let vertex = 0; vertex < moved.attributes.position.count; vertex++) moved.attributes.position.setZ(vertex, vertex * .07);
  const result = transferSnapshotTopology(moved, topology);
  try {
    assert.equal(result.index.array, topology.index.array);
    for (let vertex = 0; vertex < result.attributes.position.count; vertex++) assert.equal(result.attributes.position.getZ(vertex), moved.attributes.position.getZ(topology.attributes.sourceVertex.getX(vertex)));
    assert.ok(result.userData.sharedReflectionTopology);
  } finally { raw.dispose(); moved.dispose(); topology.dispose(); result.dispose(); }
});

test("shared reflection welding keeps touching limbs separate when they move apart in anticipation", () => {
  const contact = new THREE.BufferGeometry(); contact.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0], 3)); contact.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(18).fill(.4), 3));
  const pre = contact.clone(); for (let vertex = 3; vertex < 6; vertex++) pre.attributes.position.setZ(vertex, .4);
  const topology = simplifyActorSnapshot(contact, .001, { motionSurfaces: [pre] }), transferred = transferSnapshotTopology(pre, topology);
  try {
    assert.equal(topology.index.count, 6); assert.equal(topology.attributes.position.count, 6);
    const z = Array.from(transferred.attributes.position.array).filter((_, index) => index % 3 === 2); assert.equal(z.filter(value => value > .39).length, 3); assert.equal(z.filter(value => value === 0).length, 3);
  } finally { contact.dispose(); pre.dispose(); topology.dispose(); transferred.dispose(); }
});

test("epilogue puddle retains its authored family poses after the twenty-four-bank migration", () => {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 2.1), world = createFinaleWorld(scene);
  try {
    world.update({ frame: { ...frameAt(13.2), finale: { ...frameAt(13.2).finale, puddleEcho: .2 } }, animation, attacker, defender });
    const echo = world.root.getObjectByName("Delayed actual Echo reflection"); assert.equal(echo.geometry.userData.poseId, "thousandHit.contact");
    world.update({ frame: { ...frameAt(13.8), finale: { ...frameAt(13.8).finale, puddleEcho: .8 } }, animation, attacker, defender });
    assert.equal(echo.geometry.userData.poseId, "lowCut.contact");
  } finally { world.dispose(); attacker.dispose(); defender.dispose(); }
});
