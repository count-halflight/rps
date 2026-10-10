import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ATTACK_CATALOG } from "../src/game/attackCatalog.js";
import { attackPresentation, cinematicFrame } from "../src/game/cinematics.js";
import { createCinematicWorld, SPECTACLE_KINDS, createImpactRockGeometry, impactRubbleFlight } from "../src/components/cinematicWorld.js";

const worlds = new Set(["orbital", "gravitywell", "starlance", "eclipse"]);
const voids = new Set(["singularity", "rift", "timefracture", "origami", "chronoblade"]);
function fixture() {
  const scene = new THREE.Scene(), root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(.5, 2, .5), material = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(geometry, material)); scene.add(root);
  return { scene, actor: { root }, dispose() { geometry.dispose(); material.dispose(); } };
}
function input(kind, phase, direction = 1, low = false) {
  return {
    frame: { progress: phase, revealed: true, spectacle: { kind, phase, intensity: .9, direction, center: [direction * 2.1, phase < .7 ? 7 : 1.7, -.4], world: phase > .4 && phase < .73 ? worlds.has(kind) ? "space" : voids.has(kind) ? "void" : "arena" : "arena" } },
    animation: { id: `${kind}-${direction}`, finisher: true, outcome: direction < 0 ? "loss" : "win", impactAt: .84, contacts: [[.32], [.49], [.63]] },
    time: phase * 9.4, low, reduced: false,
  };
}

test("all authored finishers have a distinct practical cinematic set", () => {
  const authored = ATTACK_CATALOG.filter(a => a.final).map(a => a.staging?.kind);
  assert.equal(authored.length, 30);
  assert.equal(new Set(authored).size, 30);
  assert.deepEqual(new Set(SPECTACLE_KINDS), new Set(authored));
});

test("cinematic props remain finite at every launch, contact, world transition and recovery", () => {
  const f = fixture(), world = createCinematicWorld(f.scene);
  try {
    for (const kind of SPECTACLE_KINDS) for (const phase of [.13, .31, .43, .52, .63, .73, .84, .94]) for (const direction of [1, -1]) for (const low of [false, true]) {
      world.update({ ...input(kind, phase, direction, low), attacker: f.actor, defender: f.actor });
      f.scene.updateMatrixWorld(true);
      world.root.traverse(object => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${kind} at ${phase}: ${object.name || object.type} transform`);
        if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.every(Number.isFinite), `${kind} at ${phase}: instance transform`);
        const positions = object.geometry?.attributes.position?.array;
        if (positions) assert.ok(positions.every(Number.isFinite), `${kind} at ${phase}: vertices`);
      });
    }
  } finally { world.dispose(); f.dispose(); }
});

test("spectacle restores the arena for draw, skipped reveal, ordinary attack, completion and disposal", () => {
  const f = fixture(), world = createCinematicWorld(f.scene), active = input("orbital", .52);
  try {
    assert.equal(world.update({ ...active, attacker: f.actor }).hideEnvironment, true);
    for (const inactive of [
      {},
      { ...active, frame: { ...active.frame, revealed: false } },
      { ...active, frame: { ...active.frame, progress: 1 } },
      { ...active, animation: { ...active.animation, finisher: false } },
      { ...active, animation: { ...active.animation, outcome: "draw" } },
    ]) {
      const flags = world.update(inactive);
      assert.equal(flags.hideEnvironment, false);
      assert.equal(world.root.visible, false);
    }
    world.update({ ...active, attacker: f.actor }); world.reset(); assert.equal(world.root.visible, false);
    world.dispose(); assert.equal(f.scene.children.includes(world.root), false); assert.equal(f.scene.children.includes(f.actor.root), true);
  } finally { if (world.root.parent) world.dispose(); f.dispose(); }
});

test("Fault sever splits rough ankle-height pavement without activating the mirror cage", () => {
  const f = fixture(), world = createCinematicWorld(f.scene);
  try {
    world.update({ ...input("mirror", .52), attacker: f.actor });
    const mirror = world.root.getObjectByName("mirror"), fault = world.root.getObjectByName("fracture-ground");
    assert.equal(mirror.visible, true);
    for (const phase of [.24, .52, .84, .94]) for (const direction of [-1, 1]) {
      world.update({ ...input("fracture", phase, direction), attacker: f.actor });
      f.scene.updateMatrixWorld(true);
      assert.equal(mirror.visible, false, "rock must not reuse paper's glass cage");
      assert.equal(fault.visible, true, "the fault must remain visible through buildup and final impact");
      const slabs = fault.children.filter(o => o.name === "Split pavement slab");
      assert.equal(slabs.length, 8);
      for (const slab of slabs) {
        assert.ok(slab.material.roughness > .9, "broken pavement should retain a matte surface");
        const localBounds = new THREE.Box3().setFromBufferAttribute(slab.geometry.attributes.position);
        assert.ok(localBounds.getSize(new THREE.Vector3()).y > .10, "pavement needs fractured edge depth");
        const bounds = new THREE.Box3().setFromObject(slab);
        assert.ok(bounds.max.y < .45, "ground faults must not obscure the actors' torsos");
        if (slab.position.x > 0) assert.ok(bounds.min.x > fault.position.x + .04);
        else assert.ok(bounds.max.x < fault.position.x - .04);
      }
      let borrowedEchoGeometry = 0;
      mirror.traverse(o => { if (o.geometry === f.actor.root.children[0].geometry) borrowedEchoGeometry++; });
      assert.equal(borrowedEchoGeometry, 0, "a fault must not create spectral mirror fighters");
    }
    world.update({ ...input("mirror", .52), attacker: f.actor });
    assert.equal(fault.visible, false); assert.equal(mirror.visible, true);
  } finally { world.dispose(); f.dispose(); }
});

test("removing spectral fighters releases their bone textures and instance buffers without disposing the live fighter", () => {
  const scene = new THREE.Scene(), sourceRoot = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(.5, 2, .5), sourceMaterial = new THREE.MeshStandardMaterial();
  const count = sourceGeometry.attributes.position.count, weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  sourceGeometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  sourceGeometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const model = new THREE.SkinnedMesh(sourceGeometry, sourceMaterial), bone = new THREE.Bone();
  model.add(bone); sourceRoot.add(model); model.bind(new THREE.Skeleton([bone])); model.skeleton.computeBoneTexture(); scene.add(sourceRoot);
  let sourceTexturesDisposed = 0, sourceGeometryDisposed = 0, cloneTexturesDisposed = 0, instanceBuffersDisposed = 0;
  model.skeleton.boneTexture.addEventListener("dispose", () => { sourceTexturesDisposed++; });
  sourceGeometry.addEventListener("dispose", () => { sourceGeometryDisposed++; });
  const world = createCinematicWorld(scene);
  try {
    world.update({ ...input("mirror", .52), attacker: { root: sourceRoot } });
    const clonedSkeletons = new Set(), instances = new Set();
    world.root.traverse(o => {
      if (o.isSkinnedMesh) clonedSkeletons.add(o.skeleton);
      if (o.isInstancedMesh) instances.add(o);
    });
    assert.equal(clonedSkeletons.size, 3);
    for (const skeleton of clonedSkeletons) {
      assert.notEqual(skeleton, model.skeleton); skeleton.computeBoneTexture();
      skeleton.boneTexture.addEventListener("dispose", () => { cloneTexturesDisposed++; });
    }
    for (const instance of instances) instance.addEventListener("dispose", () => { instanceBuffersDisposed++; });
    world.reset(); assert.equal(cloneTexturesDisposed, clonedSkeletons.size);
    world.dispose();
    assert.equal(cloneTexturesDisposed, clonedSkeletons.size);
    assert.equal(instanceBuffersDisposed, instances.size);
    assert.equal(sourceTexturesDisposed, 0);
    assert.equal(sourceGeometryDisposed, 0);
    assert.equal(scene.children.includes(sourceRoot), true);
  } finally { if (world.root.parent) world.dispose(); model.skeleton.dispose(); sourceGeometry.dispose(); sourceMaterial.dispose(); }
});

test("cathedral crystals reveal the trapped actor and release their unique material", () => {
  const f = fixture(), world = createCinematicWorld(f.scene);
  let disposals = 0;
  try {
    world.update({ ...input("cathedral", .84), attacker: f.actor });
    const pillars = [];
    world.root.traverse(o => { if (o.geometry?.parameters?.height === 5.2) pillars.push(o); });
    assert.equal(pillars.length, 10, "the regression must inspect the actual cathedral pillars");
    const material = pillars[0].material, cathedral = pillars[0].parent.parent;
    assert.ok(pillars.every(pillar => pillar.material === material));
    assert.equal(material.transparent, true);
    assert.ok(material.opacity > .1 && material.opacity <= .3, "several overlapping pillars must remain translucent");
    assert.equal(material.side, THREE.FrontSide, "back faces must not double the crystal occlusion");
    assert.equal(material.depthWrite, false, "crystals must not hide subsequently drawn transparent props");
    world.root.traverse(o => {
      if (o.material !== material) return;
      let parent = o;
      while (parent && parent !== cathedral) parent = parent.parent;
      assert.equal(parent, cathedral, "readability changes must not alter other cinematic sets");
    });
    material.addEventListener("dispose", () => { disposals++; });
    world.dispose(); assert.equal(disposals, 1, "the unique registered material must be released once");
  } finally { if (world.root.parent) world.dispose(); f.dispose(); }
});

test("concrete debris has small irregular surfaces and falls back onto the ground", () => {
  const rock = createImpactRockGeometry();
  try {
    assert.ok(rock.attributes.position.count >= 240);
    const bounds = new THREE.Box3().setFromBufferAttribute(rock.attributes.position);
    assert.ok(bounds.getSize(new THREE.Vector3()).length() < .45);
    const colors = rock.attributes.color.array;
    assert.ok(Math.max(...colors) - Math.min(...colors) > .12);
    for (let i = 0; i < 64; i++) {
      let previousRadius = 0;
      for (const seconds of [0, .12, .25, .5, 1, 3]) {
        const flight = impactRubbleFlight(i, seconds), radius = Math.hypot(flight.x, flight.z);
        assert.deepEqual(flight, impactRubbleFlight(i, seconds));
        assert.ok([flight.x, flight.y, flight.z, ...flight.rotation, ...flight.scale].every(Number.isFinite));
        assert.ok(flight.y >= .04 && flight.y < .9, `rubble ${i} has left the ankle-height explosion`);
        assert.ok(radius >= previousRadius); previousRadius = radius;
        if (seconds === 3) assert.equal(flight.y, .045);
      }
    }
  } finally { rock.dispose(); }
});


test("space backdrops follow authored world windows without leaking planets into arena attacks", () => {
  const f = fixture(), world = createCinematicWorld(f.scene);
  const space = world.root.getObjectByName("space");
  try {
    assert.ok(space.children.some(o => o.geometry?.parameters?.radius === 7), "the test must cover the actual Earth mesh");
    assert.ok(space.children.some(o => o.geometry?.parameters?.radius === 5), "the test must cover the actual Sun mesh");
    for (const sequence of ATTACK_CATALOG) {
      const animation = {
        ...attackPresentation(sequence.weapon, !!sequence.final, false, sequence.variant || 0, sequence.character, sequence.id, sequence.finisherIndex || 0),
        playerWeapon: sequence.weapon, outcome: "win", finalHit: !!sequence.final,
      };
      assert.equal(animation.sequenceId, sequence.id);
      for (const phase of [.13, .30, .40, .42, .43, .55, .69, .72, .73, sequence.impact, .94]) {
        const frame = cinematicFrame(animation, animation.duration * phase / 1000);
        const flags = world.update({ frame, animation, time: animation.duration * phase / 1000, attacker: f.actor });
        assert.equal(space.visible, frame.spectacle?.world === "space", `${sequence.id} at ${phase}: Earth/Sun must follow the authored world`);
        assert.equal(flags.hideEnvironment, ["space", "void"].includes(frame.spectacle?.world));
        if (sequence.id === "cinder.rock.final" && phase === .55) {
          assert.ok(space.children.some(o => o.isGroup && o.visible), "the orbital kick must retain its crossing planets");
        }
        if (["vex.rock.final", "vex.paper.final", "vex.scissors.final"].includes(sequence.id) && phase === .55) {
          assert.equal(world.root.getObjectByName("sky-weapons").visible, true, "local meteors, constellations and the eclipse must remain active");
        }
      }
    }
  } finally { world.dispose(); f.dispose(); }
});
