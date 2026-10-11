import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createSequenceEffects } from "../src/components/sequenceEffects.js";
import { createActorSurfaceSlices, createBatchedActorSlices, bakeActorSurface, createReflectionSnapshots, createActorMirrorAtlas } from "../src/components/finaleActorSnapshots.js";
import { evaluateSequence, presentationForSequenceId } from "../src/game/sequences/index.js";
import { createSpectralMaterial } from "../src/components/spectralMaterial.js";

function actorFixture(scene, x) {
  const root = new THREE.Group(), body = new THREE.Group(), model = new THREE.Group(), geometry = new THREE.CapsuleGeometry(.23, 1.1, 5, 12), material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material); mesh.position.y = .9; root.add(body); body.add(model); model.add(mesh); root.position.x = x; scene.add(root);
  return { root, body, model, geometry, material, weaponSegments: () => [[new THREE.Vector3(root.position.x, 1.1, .03), new THREE.Vector3(root.position.x + .4, 1.7, .03)]],
    dispose() { geometry.dispose(); material.dispose(); scene.remove(root); } };
}
function setup() {
  const scene = new THREE.Scene(), attacker = actorFixture(scene, -1.6), defender = actorFixture(scene, 1.6), effects = createSequenceEffects(scene);
  return { scene, attacker, defender, effects, dispose() { effects.dispose(); attacker.dispose(); defender.dispose(); } };
}
function sample(id, time, fixture, quality = "high", options = {}) {
  const animation = { id, ...presentationForSequenceId(id, { quality, ...options }) }, frame = evaluateSequence(id, time, animation);
  const sign = animation.outcome === "loss" ? -1 : 1;
  fixture.attacker.root.position.set(sign * (-frame.origin + frame.attacker.x), frame.attacker.y, frame.attacker.z);
  fixture.defender.root.position.set(sign * (frame.origin + frame.defender.x), frame.defender.y, frame.defender.z);
  return { frame, animation, state: fixture.effects.update({ frame, animation, quality, attacker: fixture.attacker, defender: fixture.defender }) };
}

test("quick draw reveals exactly one delayed horizon cut after the sheath closes", () => {
  const fixture = setup();
  try {
    sample("ECHO-S0", .60, fixture); assert.equal(fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").count, 0);
    sample("ECHO-S0", .70, fixture); assert.equal(fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").count, 1);
    const line = fixture.effects.root.getObjectByName("Pooled delayed hairline cuts"), matrix = new THREE.Matrix4(); line.getMatrixAt(0, matrix);
    const bounds = new THREE.Box3().setFromObject(fixture.defender.root);
    assert.ok(matrix.elements[14] > bounds.max.z, "the thin cut must sit on the visible body front instead of being hidden inside the torso");
    const direction = new THREE.Vector3(0, 1, 0).transformDirection(matrix); assert.ok(Math.abs(direction.y) < .00001 && Math.abs(direction.x) > .9999);
    assert.equal(fixture.effects.root.getObjectByName("Pooled sparks and embers").count, 12);
    assert.equal(fixture.effects.root.getObjectByName("Pooled contact shock rings").count, 1);
    sample("ECHO-S0", 1.02, fixture); assert.equal(fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").visible, false);
  } finally { fixture.dispose(); }
});

test("thousand cuts stages curved motion copies and grows from thin contact lines to a local bloom", () => {
  const fixture = setup();
  try {
    sample("ECHO-S2", 1.03, fixture);
    assert.equal(fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").count, 32);
    const ghosts = fixture.effects.root.children.filter(object => object.name.startsWith("Motion afterimage "));
    assert.equal(ghosts.reduce((count, mesh) => count + mesh.count, 0), 8);
    const locations = [], matrix = new THREE.Matrix4();
    for (const ghost of ghosts) for (let i = 0; i < ghost.count; i++) { ghost.getMatrixAt(i, matrix); locations.push(matrix.elements.slice(12, 15).map(value => value.toFixed(3)).join(",")); }
    assert.ok(new Set(locations).size > 3, "afterimages must follow different earlier positions rather than stack on the current fighter");
    for (const ghost of ghosts) { assert.equal(ghost.material.side, THREE.FrontSide); assert.equal(ghost.material.depthWrite, false); assert.ok(ghost.material.uniforms.maximumAlpha.value <= .14); }
    const alphas = ghosts.flatMap(ghost => Array.from(ghost.geometry.attributes.ghostAlpha.array.subarray(0, ghost.count)));
    assert.ok(alphas.every(value => value > 0 && value <= .240001)); assert.ok(new Set(alphas.map(value => value.toFixed(3))).size > 3, "older copies must fade instead of filling the scene with identical solid cutouts");
    const { state } = sample("ECHO-S2", 2.60, fixture);
    assert.equal(fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").count, 1000);
    assert.equal(state.counter, 1000); assert.ok(state.postEffects.some(effect => effect.id === "CA_PULSE"));
    assert.equal(ghosts.reduce((count, mesh) => count + mesh.count, 0), 0);
  } finally { fixture.dispose(); }
});

test("spectral material bounds face coverage even when multiple body surfaces overlap", () => {
  const material = createSpectralMaterial({ maximumAlpha: .11, bodyCoverage: .025, edgeCoverage: .38, strength: .8 });
  try {
    assert.equal(material.side, THREE.FrontSide); assert.equal(material.depthWrite, false);
    const uniforms = material.uniforms, individualFace = .24 * uniforms.strength.value * uniforms.bodyCoverage.value;
    const accumulatedFace = 1 - (1 - individualFace) ** 24;
    assert.ok(accumulatedFace < .12, "even 24 overlapping ghost faces retain the action beneath them");
    assert.ok(uniforms.maximumAlpha.value <= .11); assert.ok(uniforms.edgeCoverage.value > uniforms.bodyCoverage.value * 10);
  } finally { material.dispose(); }
});

test("normal effect anchors follow supplied physical character height rather than model scale", () => {
  const fixture = setup();
  try {
    const animation = { id: "height-probe", ...presentationForSequenceId("ECHO-S0", { targetHeight: 2.4, actorHeight: 1.72 }) }, frame = evaluateSequence("ECHO-S0", .7, animation);
    fixture.defender.root.scale.setScalar(.82); fixture.effects.update({ frame, animation, attacker: fixture.attacker, defender: fixture.defender });
    const matrix = new THREE.Matrix4(); fixture.effects.root.getObjectByName("Pooled delayed hairline cuts").getMatrixAt(0, matrix);
    assert.ok(Math.abs(matrix.elements[13] - fixture.defender.root.position.y - 2.4 * .56) < .00001);
  } finally { fixture.dispose(); }
});

test("ordinary finisher uses reflective surfaces and slices the actual rival surface", () => {
  const fixture = setup();
  try {
    sample("ECHO-SF", 2.15, fixture);
    assert.equal(fixture.effects.root.getObjectByName("Reflective cut surfaces").visible, true);
    const windows = fixture.effects.root.getObjectByName("Reflective cut surfaces").children;
    assert.equal(windows.length, 3); assert.ok(windows.every(mesh => mesh.material.envMapIntensity <= .1 && mesh.material.opacity <= .3));
    assert.ok(windows.every(mesh => mesh.material.map?.isTexture && mesh.material.emissiveMap === mesh.material.map), "existing mirror draws contain actual posed fighter imagery");
    assert.equal(windows[0].geometry.type, "CircleGeometry"); assert.equal(windows[1].geometry.type, "ShapeGeometry");
    const { state } = sample("ECHO-SF", 5.50, fixture);
    const slices = fixture.effects.root.getObjectByName("Actual rival surface slices");
    assert.equal(slices.visible, true); assert.equal(slices.children.length, 1);
    const geometry = slices.children[0].geometry; assert.equal(geometry.userData.sliceCount, 32); assert.equal(new Set(geometry.attributes.sliceIndex.array).size, 32);
    assert.ok(state.defenderOpacity < 1); assert.equal(state.dissolve.style, "slice");
    for (const [minimum, maximum] of geometry.userData.bandBounds) assert.ok(maximum - minimum <= 1.56 / 32 + .00001);
  } finally { fixture.dispose(); }
});

test("actor mirror imagery contains distinct posed surfaces without an extra render target", () => {
  const fixture = setup(), poses = createReflectionSnapshots(fixture.attacker, "medium"), atlas = createActorMirrorAtlas(poses);
  try {
    assert.equal(atlas.image.width, 96 * 8); assert.equal(atlas.image.height, 160); assert.equal(atlas.repeat.x, 1 / 8);
    assert.ok(atlas.image.data.some((value, index) => index % 4 === 3 && value === 238), "rasterized body surfaces must appear in the glass image");
    assert.ok(atlas.image.data.some((value, index) => index % 4 === 3 && value === 70), "the image retains translucent glass around the body silhouette");
    assert.ok(atlas.image.data.every(Number.isFinite)); assert.ok(atlas.image.data.byteLength < 1024 * 1024);
  } finally { atlas.dispose(); poses.forEach(pose => pose.dispose()); fixture.dispose(); }
});

test("thousand reflected cuts mark the ground and glass instead of obscuring the rival", () => {
  const fixture = setup();
  try {
    sample("ECHO-SF", 5.0, fixture); const cuts = fixture.effects.root.getObjectByName("Pooled delayed hairline cuts"), matrix = new THREE.Matrix4();
    assert.equal(cuts.count, 1000); let floor = 0, glass = 0, body = 0;
    for (let i = 0; i < cuts.count; i++) { cuts.getMatrixAt(i, matrix); if (Math.abs(matrix.elements[13] - .037) < .00001) floor++; else if (Math.abs(matrix.elements[14] + 2.655) < .00001) glass++; else body++; }
    assert.equal(body, 12); assert.ok(floor > 700); assert.ok(glass > 200); assert.equal(floor + glass + body, 1000);
  } finally { fixture.dispose(); }
});

test("finisher recovery retains quiet floor and window scars while the actual sliced rival replaces airborne filler", () => {
  const fixture = setup();
  try {
    sample("ECHO-SF", 5.3, fixture, "medium"); assert.ok(fixture.effects.root.getObjectByName("Pooled floating cut fragments").count > 0);
    sample("ECHO-SF", 6.2, fixture, "medium");
    const fragments = fixture.effects.root.getObjectByName("Pooled floating cut fragments"), cuts = fixture.effects.root.getObjectByName("Pooled delayed hairline cuts"), slices = fixture.effects.root.getObjectByName("Actual rival surface slices"), matrix = new THREE.Matrix4();
    assert.equal(fragments.count, 0); assert.equal(fragments.visible, false); assert.equal(slices.visible, true); assert.equal(slices.children.length, 1); assert.ok(cuts.count > 900); assert.ok(cuts.material.opacity < .1);
    let floor = 0, glass = 0;
    for (let i = 0; i < cuts.count; i++) { cuts.getMatrixAt(i, matrix); if (Math.abs(matrix.elements[13] - .037) < .00001) floor++; else if (Math.abs(matrix.elements[14] + 2.655) < .00001) glass++; }
    assert.equal(floor + glass, cuts.count); assert.ok(floor > 700 && glass > 200, "persistent scars stay confined to physical scenery rather than the rival silhouette");
  } finally { fixture.dispose(); }
});

test("batched body bands retain the clipped surface geometry in a single material draw", () => {
  const fixture = setup(), separate = createActorSurfaceSlices(fixture.defender.root, 16), merged = createBatchedActorSlices(fixture.defender.root, 16);
  try {
    assert.equal(merged.attributes.position.count, separate.reduce((count, geometry) => count + geometry.attributes.position.count, 0));
    assert.equal(merged.attributes.normal.count, merged.attributes.position.count); assert.equal(merged.attributes.sliceIndex.count, merged.attributes.position.count);
    let start = 0;
    for (let band = 0; band < separate.length; band++) {
      const vertices = separate[band].attributes.position.count;
      assert.deepEqual(Array.from(merged.attributes.position.array.subarray(start * 3, (start + vertices) * 3)), Array.from(separate[band].attributes.position.array));
      assert.ok(merged.attributes.sliceIndex.array.subarray(start, start + vertices).every(value => value === band)); start += vertices;
    }
  } finally { separate.forEach(geometry => geometry.dispose()); merged.dispose(); fixture.dispose(); }
});

test("surface slicing preserves the complete source area and never creates whole-body cube substitutes", () => {
  const fixture = setup(), source = bakeActorSurface(fixture.defender.root), slices = createActorSurfaceSlices(fixture.defender.root, 16);
  const surfaceArea = geometry => {
    const positions = geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let area = 0;
    for (let i = 0; i < positions.count; i += 3) { a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2); area += b.sub(a).cross(c.sub(a)).length() / 2; }
    return area;
  };
  try {
    assert.equal(slices.length, 16);
    const totalArea = slices.reduce((sum, geometry) => sum + surfaceArea(geometry), 0);
    assert.ok(Math.abs(totalArea - surfaceArea(source)) < .00001, "all clipped body triangles must remain in exactly one or more adjacent slice bands");
    assert.ok(slices.every(geometry => geometry.attributes.position.array.every(Number.isFinite)));
  } finally { source.dispose(); slices.forEach(geometry => geometry.dispose()); fixture.dispose(); }
});

test("all authored frames fit the shared quality particle budget and remain finite under deterministic seeks", () => {
  const fixture = setup();
  try {
    for (const quality of ["high", "medium", "light"]) for (const id of ["ECHO-S0", "ECHO-S2", "ECHO-SF"]) {
      const duration = presentationForSequenceId(id).duration / 1000;
      for (let step = 0; step < 24; step++) {
        const time = duration * (step + .25) / 24, { state } = sample(id, time, fixture, quality);
        assert.ok(state.particleCount <= state.particleBudget); assert.equal(state.particleBudget, quality === "high" ? 4000 : quality === "medium" ? 1500 : 300);
        fixture.scene.updateMatrixWorld(true);
        fixture.effects.root.traverse(object => {
          assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${id} ${quality} ${time} transform ${object.name}`);
          if (object.isInstancedMesh) assert.ok(object.instanceMatrix.array.subarray(0, object.count * 16).every(Number.isFinite));
          if (object.geometry?.attributes.position) assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
        });
      }
      sample(id, duration * .69, fixture, quality);
      const pool = fixture.effects.root.getObjectByName("Pooled delayed hairline cuts"), before = Array.from(pool.instanceMatrix.array.subarray(0, pool.count * 16));
      sample(id, duration * .12, fixture, quality); sample(id, duration * .69, fixture, quality);
      assert.deepEqual(Array.from(pool.instanceMatrix.array.subarray(0, pool.count * 16)), before);
    }
  } finally { fixture.dispose(); }
});

test("blade ribbons follow the real weapon and clear on discontinuous seeks", () => {
  const fixture = setup();
  try {
    sample("ECHO-S0", .42, fixture); sample("ECHO-S0", .44, fixture);
    const trail = fixture.effects.root.getObjectByName("Actual blade ribbon 0"); assert.equal(trail.geometry.drawRange.count, 6);
    assert.equal(trail.geometry.attributes.position.getY(1), Math.fround(1.7));
    sample("ECHO-S0", .43, fixture); assert.equal(trail.geometry.drawRange.count, 0);
    sample("ECHO-S0", .60, fixture); assert.equal(trail.visible, false);
  } finally { fixture.dispose(); }
});

test("effects teardown releases pooled and captured resources once without touching either actor", () => {
  const fixture = setup(); sample("ECHO-SF", 2.15, fixture); sample("ECHO-SF", 5.50, fixture);
  const resources = new Set(), counts = new Map();
  fixture.effects.root.traverse(object => { if (object.geometry) resources.add(object.geometry); if (object.material) { resources.add(object.material); if (object.material.map) resources.add(object.material.map); if (object.material.emissiveMap) resources.add(object.material.emissiveMap); } if (object.isInstancedMesh) resources.add(object); });
  for (const resource of resources) { counts.set(resource, 0); resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource) + 1)); }
  let borrowed = 0; [fixture.attacker.geometry, fixture.attacker.material, fixture.defender.geometry, fixture.defender.material].forEach(resource => resource.addEventListener("dispose", () => { borrowed++; }));
  fixture.effects.dispose(); for (const count of counts.values()) assert.equal(count, 1); assert.equal(borrowed, 0);
  assert.equal(fixture.attacker.root.parent, fixture.scene); assert.equal(fixture.defender.root.parent, fixture.scene); fixture.attacker.dispose(); fixture.defender.dispose();
});
