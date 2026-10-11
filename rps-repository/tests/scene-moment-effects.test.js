import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createSceneMomentEffects } from "../src/components/sceneMomentEffects.js";
import { createCinematicWorld } from "../src/components/cinematicWorld.js";
import { evaluateSceneMoment, SCENE_MOMENTS } from "../src/game/sceneMoments.js";
import { evaluateCombatMoment, COMBAT_MOMENTS } from "../src/game/combatMoments.js";

function fixture() {
  const scene = new THREE.Scene(), root = new THREE.Group(), geometry = new THREE.BoxGeometry(.3, .2, .025), material = new THREE.MeshStandardMaterial();
  root.position.set(1.6, 0, 0); scene.add(root);
  for (let i = 0; i < 6; i++) { const plate = new THREE.Mesh(geometry, material); plate.position.set(i % 2 ? .18 : -.18, 1.5 - Math.floor(i / 2) * .25, .28); plate.userData.armourPlate = i; root.add(plate); }
  const shield = new THREE.Object3D(); shield.name = "Bulwark shield slit"; shield.position.set(.35, .9, .3); root.add(shield);
  const effects = createSceneMomentEffects(scene), actor = { root, standingHeight: 2.2 };
  return { scene, actor, effects, geometry, material, dispose() { effects.dispose(); geometry.dispose(); material.dispose(); } };
}
function sample(f, id, time, quality = "medium") {
  const frame = evaluateSceneMoment(id, time, { actorHeight: 2.4 }); f.actor.root.position.fromArray(frame.root.pos);
  return { frame, state: f.effects.update({ frame, actor: f.actor, quality }) };
}

test("a planted shield creates ground accents and sparks at the actual shield", () => {
  const f = fixture();
  try {
    const { state } = sample(f, "bulwark.intro", 2.3), root = f.effects.root, rings = root.getObjectByName("Ancillary shield shock rings"), matrix = new THREE.Matrix4();
    assert.equal(state.active, true); assert.equal(state.hideEnvironment, false); assert.equal(rings.count, 1); rings.getMatrixAt(0, matrix);
    assert.ok(Math.abs(matrix.elements[13] - .045) < .00001, "the shield landing stays at ground height despite the crouched actor root");
    assert.equal(root.getObjectByName("Ancillary landing dust").geometry.drawRange.count, 64);
    const sparks = root.getObjectByName("Ancillary shield edge sparks"); assert.equal(sparks.geometry.drawRange.count, 48);
    const shield = f.actor.root.getObjectByName("Bulwark shield slit").getWorldPosition(new THREE.Vector3()), positions = sparks.geometry.attributes.position;
    assert.ok(Math.abs(positions.getY(0) - shield.y) < .2, "edge sparks originate at the physical shield rather than the actor centre");
  } finally { f.dispose(); }
});

test("armor shed preserves plate origins and uses thin beveled metal fragments with gravity", () => {
  const f = fixture();
  try {
    sample(f, "bulwark.phase2", 1.10); const pool = f.effects.root.getObjectByName("Ancillary broken armour plates"), matrix = new THREE.Matrix4();
    assert.equal(pool.count, 36); pool.getMatrixAt(0, matrix); assert.ok(matrix.elements[13] > 1.4, "fragments begin at the real chest plate");
    pool.geometry.computeBoundingBox(); const size = pool.geometry.boundingBox.getSize(new THREE.Vector3()); assert.ok(size.z < size.y * .2); assert.ok(pool.geometry.attributes.position.count > 100, "fractured plates retain bevelled edge surfaces");
    f.actor.root.position.x += 5;
    const later = evaluateSceneMoment("bulwark.phase2", 2.45, { actorHeight: 2.4 }); f.effects.update({ frame: later, actor: f.actor });
    pool.getMatrixAt(0, matrix); assert.ok(Math.abs(matrix.elements[13] - .035) < .00001); assert.ok(matrix.elements[12] < 4, "shed armor does not follow the actor after emission");
    assert.ok(pool.material.roughness >= .6 && pool.material.metalness >= .7);
  } finally { f.dispose(); }
});

test("all ancillary moment frames are finite, budgeted and reset between moments", () => {
  const f = fixture();
  try {
    for (const quality of ["high", "medium", "light"]) for (const moment of SCENE_MOMENTS) for (const time of moment.reviewTimes) {
      const { state } = sample(f, moment.id, Math.min(time, moment.duration / 1000 - .001), quality);
      assert.ok(state.particleCount <= state.particleBudget); assert.ok(state.particleCount <= 300);
      f.scene.updateMatrixWorld(true); f.effects.root.traverse(object => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
        if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.subarray(0, object.count * 16).every(Number.isFinite));
        if (object.geometry?.attributes.position) assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
      });
    }
    sample(f, "bulwark.phase1", 1.6); const pool = f.effects.root.getObjectByName("Ancillary broken armour plates"), before = Array.from(pool.instanceMatrix.array.subarray(0, pool.count * 16));
    sample(f, "bulwark.phase1", .3); sample(f, "bulwark.phase1", 1.6); assert.deepEqual(Array.from(pool.instanceMatrix.array.subarray(0, pool.count * 16)), before);
    f.effects.update({ frame: null, actor: f.actor }); assert.equal(f.effects.root.visible, false); assert.ok(f.effects.root.children.every(object => !object.visible));
  } finally { f.dispose(); }
});

test("cinematic world consumes ancillary frames without inventing a canonical attack", () => {
  const f = fixture(), world = createCinematicWorld(f.scene);
  try {
    const moment = evaluateSceneMoment("bulwark.plate-break", .55, { actorHeight: 2.4 });
    const state = world.update({ moment, attacker: f.actor, quality: "medium" });
    assert.equal(state.active, true); assert.equal(state.momentId, "bulwark.plate-break"); assert.equal(state.particleCount, 29); assert.equal(world.root.visible, false);
    const root = f.scene.getObjectByName("Ancillary physical effects"); // This fixture also owns a separate pool.
    assert.ok(f.scene.children.filter(object => object.name === "Ancillary physical effects").some(object => object.visible));
    world.update({}); assert.ok(f.scene.children.filter(object => object.name === "Ancillary physical effects").every(object => !object.visible)); assert.ok(root);
  } finally { world.dispose(); f.dispose(); }
});

test("ancillary teardown disposes only owned pool resources exactly once", () => {
  const f = fixture(), resources = new Set(), counts = new Map(); sample(f, "bulwark.intro", 2.3);
  f.effects.root.traverse(object => { if (object.geometry) resources.add(object.geometry); if (object.material) { resources.add(object.material); if (object.material.map) resources.add(object.material.map); } if (object.isInstancedMesh) resources.add(object); });
  for (const resource of resources) { counts.set(resource, 0); resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource) + 1)); }
  let borrowed = 0; [f.geometry, f.material].forEach(resource => resource.addEventListener("dispose", () => borrowed++));
  f.effects.dispose(); assert.ok([...counts.values()].every(count => count === 1)); assert.equal(borrowed, 0); assert.equal(f.actor.root.parent, f.scene);
  f.geometry.dispose(); f.material.dispose();
});

test("paired hand reveal follows three physical pulses and preserves the unrevealed choice", () => {
  const f = fixture(), options = { playerHand: "paper", enemyHand: "rock", outcome: "win" };
  try {
    let frame = evaluateCombatMoment("combat.reveal", .80, options); f.effects.update({ frame, player: f.actor, enemy: f.actor });
    const rings = f.effects.root.getObjectByName("Ancillary shield shock rings"), props = f.effects.root.getObjectByName("Ancillary physical item and hand props"), matrix = new THREE.Matrix4();
    assert.equal(rings.count, 3); assert.equal(props.count, 0, "the opponent's selected sign is not shown before the third downbeat");
    frame = evaluateCombatMoment("combat.reveal", .93, options); f.effects.update({ frame, player: f.actor, enemy: f.actor });
    assert.equal(rings.count, 4); assert.equal(props.count, 12); props.getMatrixAt(1, matrix); const paperFinger = new THREE.Vector3().setFromMatrixScale(matrix).y;
    props.getMatrixAt(7, matrix); const rockFinger = new THREE.Vector3().setFromMatrixScale(matrix).y; assert.ok(paperFinger > rockFinger * 2, "paper has extended fingers while rock remains a closed fist");
    assert.ok(f.effects.root.getObjectByName("Ancillary shield edge sparks").geometry.drawRange.count > 0, "losing hand totem carries physical crack lines");
  } finally { f.dispose(); }
});

test("medkit uses a physical injector and a ring rising through the actor's height", () => {
  const f = fixture();
  try {
    const frame = evaluateCombatMoment("item.medkit", .60, { playerHeight: 1.72 }); f.effects.update({ frame, player: f.actor });
    const props = f.effects.root.getObjectByName("Ancillary physical item and hand props"), matrix = new THREE.Matrix4(); assert.equal(props.count, 4);
    props.getMatrixAt(0, matrix); const injector = frame.fx.find(fx => fx.id === "INJECTOR"); assert.ok(Math.abs(matrix.elements[12] - injector.worldPoint[0]) < .00001);
    const ring = frame.fx.find(fx => fx.id === "SHOCKRING"); f.effects.root.getObjectByName("Ancillary shield shock rings").getMatrixAt(0, matrix);
    assert.ok(Math.abs(matrix.elements[13] - ring.worldPoint[1] - ring.phase * ring.rise) < .00001);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(matrix); assert.ok(Math.abs(normal.y) > .99, "the heal ring sweeps upward as a horizontal physical circle");
  } finally { f.dispose(); }
});

test("coolant releases local steam and frost while the battery fills its six real cells", () => {
  const f = fixture();
  try {
    f.effects.update({ frame: evaluateCombatMoment("item.coolant", .6), player: f.actor });
    assert.equal(f.effects.root.getObjectByName("Ancillary landing dust").geometry.drawRange.count, 64);
    assert.equal(f.effects.root.getObjectByName("Ancillary shield edge sparks").geometry.drawRange.count, 48);
    const props = f.effects.root.getObjectByName("Ancillary physical item and hand props");
    f.effects.update({ frame: evaluateCombatMoment("item.battery", .42), player: f.actor }); assert.equal(props.count, 2, "empty charge cell has only its physical casing and terminal");
    f.effects.update({ frame: evaluateCombatMoment("item.battery", .89), player: f.actor }); assert.equal(props.count, 8, "full charge presents all six filled segments");
  } finally { f.dispose(); }
});

test("scan follows its moving world point and prints the actual scanned hand", () => {
  const f = fixture();
  try {
    const positions = f.effects.root.getObjectByName("Ancillary shield edge sparks").geometry.attributes.position;
    for (const time of [.3, .65, .8]) { const frame = evaluateCombatMoment("item.scan", time, { enemyHeight: 2.4, scannedHand: "scissors" }); f.effects.update({ frame, player: f.actor, enemy: f.actor });
      const line = frame.fx.find(fx => fx.id === "SCAN_LINE"); assert.ok(Math.abs(positions.getY(0) - line.worldPoint[1]) < .00001, "scan is not pinned to its first emitter sample"); }
    assert.equal(f.effects.root.getObjectByName("Ancillary physical item and hand props").count, 6);
  } finally { f.dispose(); }
});

test("clash uses the authored contact point and both actual skid origins", () => {
  const f = fixture();
  try {
    let frame = evaluateCombatMoment("combat.clash", .40); f.effects.update({ frame, player: f.actor, enemy: f.actor });
    const positions = f.effects.root.getObjectByName("Ancillary shield edge sparks").geometry.attributes.position, point = frame.fx.find(fx => fx.id === "SPARKS").worldPoint;
    assert.ok(Math.abs(positions.getX(0) - point[0]) < .00001 && Math.abs(positions.getY(0) - point[1]) < .00001);
    frame = evaluateCombatMoment("combat.clash", .52); f.effects.update({ frame, player: f.actor, enemy: f.actor });
    const dust = f.effects.root.getObjectByName("Ancillary landing dust").geometry; assert.equal(dust.drawRange.count, 128);
    const x = Array.from({ length: dust.drawRange.count }, (_, i) => dust.attributes.position.getX(i)); assert.ok(x.some(value => value < -.5) && x.some(value => value > .5));
  } finally { f.dispose(); }
});

test("all shared combat frames remain finite and budgeted without mutating either actor", () => {
  const f = fixture(); f.actor.root.updateWorldMatrix(true, true); const before = f.actor.root.matrix.clone(), world = createCinematicWorld(f.scene);
  try {
    for (const quality of ["high", "medium", "light"]) for (const moment of COMBAT_MOMENTS) for (const time of moment.reviewTimes.filter(time => time < moment.duration / 1000)) {
      const frame = evaluateCombatMoment(moment.id, time, { scannedHand: "paper" }), state = f.effects.update({ frame, player: f.actor, enemy: f.actor, quality });
      assert.ok(state.particleCount <= state.particleBudget); assert.ok(f.effects.root.children.filter(object => object.visible).length <= 5);
      f.effects.root.traverse(object => { if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.subarray(0, object.count * 16).every(Number.isFinite)); if (object.geometry?.attributes.position) assert.ok(object.geometry.attributes.position.array.every(Number.isFinite)); });
    }
    assert.deepEqual(f.actor.root.matrix.elements, before.elements);
    const combat = evaluateCombatMoment("item.battery", .7), moment = evaluateSceneMoment("bulwark.phase1", 1.6);
    assert.equal(world.update({ combat, moment, player: f.actor, enemy: f.actor }).momentId, "item.battery", "shared combat presentation takes priority over floor staging");
  } finally { world.dispose(); f.dispose(); }
});
