import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRiggedFighter } from '../src/components/riggedFighter.js';
import { rivalProfile } from '../src/game/rivalProfile.js';
import { levelFor } from '../src/game/engine.js';
import { estimateSceneDraws, selectLargestShadowCasters, FILM_POST_DRAWS, SCENE_DRAW_BUDGET } from '../src/components/renderBudget.js';

function box(material = new T.MeshStandardMaterial(), size = [1, 1, 1]) {
  return new T.Mesh(new T.BoxGeometry(...size), material);
}
function dispose(scene) {
  const geometries = new Set(), materials = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

test('full-scene estimates honor visible ancestors, layer masks and declared pass exclusions without mutation', () => {
  const scene = new T.Scene(), hidden = new T.Group(), visible = box(), hiddenMesh = box(), otherLayer = box();
  hidden.visible = false; hidden.add(hiddenMesh); otherLayer.layers.set(2); scene.add(hidden, visible, otherLayer);
  const camera = new T.PerspectiveCamera();
  try {
    const initial = scene.toJSON();
    assert.equal(estimateSceneDraws(scene).color, 2);
    assert.equal(estimateSceneDraws(scene, { camera }).color, 1);
    assert.equal(estimateSceneDraws(scene, { exclude: [visible] }).color, 1);
    assert.equal(estimateSceneDraws(hidden).color, 0);
    assert.deepEqual(scene.toJSON(), initial, 'estimating does not mutate transforms, flags, materials or geometry');
  } finally { dispose(scene); }
});

test('multi-material costs follow active geometry groups and draw ranges rather than the material array length', () => {
  const scene = new T.Scene(), materials = [new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), new T.MeshStandardMaterial()];
  const mesh = box(materials); mesh.geometry.clearGroups();
  mesh.geometry.addGroup(0, 6, 0); mesh.geometry.addGroup(6, 6, 1); mesh.geometry.addGroup(12, 0, 2); mesh.geometry.addGroup(18, 6, 0);
  scene.add(mesh);
  try {
    assert.equal(estimateSceneDraws(scene).color, 3);
    materials[1].visible = false; assert.equal(estimateSceneDraws(scene).color, 2);
    mesh.geometry.setDrawRange(6, 12); assert.equal(estimateSceneDraws(scene).color, 0);
    materials[1].visible = true; assert.equal(estimateSceneDraws(scene).color, 1);
    mesh.geometry.clearGroups(); assert.equal(estimateSceneDraws(scene).color, 0, 'array materials need render groups');
    mesh.material = materials[0]; mesh.geometry.setDrawRange(0, Infinity);
    assert.equal(estimateSceneDraws(scene).color, 1, 'a scalar material renders the range once');
    mesh.geometry.setDrawRange(40, Infinity); assert.equal(estimateSceneDraws(scene).color, 0);
  } finally { dispose(scene); materials.forEach(material => material.dispose()); }
});

test('zero-count instancing skips draws while degenerate hidden transforms retain a conservative draw', () => {
  const scene = new T.Scene(), instances = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial(), 4);
  const key = new T.DirectionalLight(); key.castShadow = true; instances.castShadow = true; scene.add(instances, key);
  try {
    instances.count = 0; assert.deepEqual(estimateSceneDraws(scene), { color: 0, shadow: 0, transmission: 0, shadowPasses: 1, casters: 0, post: 0, reflection: 0, baseTotal: 0, total: 0 });
    instances.count = 4; for (let i = 0; i < 4; i++) instances.setMatrixAt(i, new T.Matrix4().makeScale(0, 0, 0));
    assert.equal(estimateSceneDraws(scene).color, 1);
    assert.equal(estimateSceneDraws(scene).shadow, 1);
    instances.visible = false; assert.equal(estimateSceneDraws(scene).total, 0);
  } finally { instances.dispose(); dispose(scene); }
});

test('transparent DoubleSide uses two color draws but one shadow draw; point lights account for six shadow faces', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial({ transparent: true, side: T.DoubleSide }), mesh = box(material);
  mesh.castShadow = true;
  const direction = new T.DirectionalLight(), point = new T.PointLight(); direction.castShadow = point.castShadow = true;
  scene.add(mesh, direction, point);
  try {
    const estimate = estimateSceneDraws(scene);
    assert.equal(estimate.color, 2); assert.equal(estimate.shadowPasses, 7); assert.equal(estimate.shadow, 7);
    material.forceSinglePass = true; assert.equal(estimateSceneDraws(scene).color, 1);
    assert.equal(estimateSceneDraws(scene, { shadows: false }).shadow, 0);
    point.visible = false; assert.equal(estimateSceneDraws(scene).shadow, 1);
    assert.equal(estimateSceneDraws(scene, { shadowType: T.VSMShadowMap }).shadow, 3, 'VSM adds two blur draws');
  } finally { dispose(scene); }
});

test('reflection plans include their first full pass and transmission costs before rendering', () => {
  const scene = new T.Scene(), water = box(), far = new T.Group(), skyline = box(), actor = box(); far.add(skyline);
  const key = new T.DirectionalLight(); key.castShadow = true; actor.castShadow = true; scene.add(water, far, actor, key);
  const plan = { enabled: true, maxPasses: 1, excluded: [water, far] };
  try {
    const estimate = estimateSceneDraws(scene, { post: FILM_POST_DRAWS, reflection: plan });
    assert.equal(estimate.baseTotal, 19); assert.equal(estimate.reflection, 1); assert.equal(estimate.total, 20);
    assert.equal(estimateSceneDraws(scene, { reflection: { ...plan, enabled: false } }).reflection, 0);
    const glass = box(new T.MeshPhysicalMaterial({ transmission: .5, side: T.DoubleSide })); scene.add(glass);
    const glassEstimate = estimateSceneDraws(scene, { reflection: plan });
    assert.equal(glassEstimate.transmission, 4, 'three opaque draws plus a transmissive back face');
    assert.equal(glassEstimate.reflection, 4, 'reflected actor, glass, opaque capture and glass back face');
    const boundary = estimateSceneDraws(scene, { post: SCENE_DRAW_BUDGET - glassEstimate.baseTotal, reflection: plan });
    assert.equal(boundary.baseTotal, SCENE_DRAW_BUDGET);
    assert.ok(boundary.total > SCENE_DRAW_BUDGET, 'a main frame at the limit must reject the first reflection pass');
  } finally { dispose(scene); }
});

test('caster selection favors structural volume over dense tiny ornaments and recaps newly equipped armour', () => {
  const actor = new T.Group(), core = box(undefined, [1, 1.5, .6]), leg = box(undefined, [.5, 1, .5]), plate = box(undefined, [1.2, .9, .5]);
  const jewel = new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.MeshStandardMaterial()); jewel.scale.setScalar(.015);
  const distantTrims = [[-5, 0, 0], [5, 0, 0], [0, 7, 0]].map(position => new T.BoxGeometry(.1, .1, .1).translate(...position));
  const sparse = new T.Mesh(mergeGeometries(distantTrims, false), new T.MeshStandardMaterial()); distantTrims.forEach(geometry => geometry.dispose());
  const hidden = new T.Group(), hiddenHuge = box(undefined, [10, 10, 10]); hidden.visible = false; hidden.add(hiddenHuge);
  actor.add(core, leg, jewel, sparse, hidden); core.castShadow = leg.castShadow = jewel.castShadow = sparse.castShadow = hiddenHuge.castShadow = true;
  try {
    assert.deepEqual(new Set(selectLargestShadowCasters(actor, 2)), new Set([core, leg]));
    assert.equal(jewel.castShadow, false); assert.equal(hiddenHuge.castShadow, false); assert.equal(sparse.castShadow, false, 'disconnected tiny trims do not win through their large empty bounding envelope');
    plate.castShadow = true; actor.add(plate); actor.visible = false;
    assert.deepEqual(new Set(selectLargestShadowCasters(actor, 2)), new Set([core, plate]), 'hidden cached actors can be prepared and new armour enters the mass selection');
    assert.equal(leg.castShadow, false);
    assert.equal(selectLargestShadowCasters(actor, 0).length, 0); assert.equal(core.castShadow, false);
  } finally { dispose(actor); }
});

test('loaded player and Bulwark wardrobe retain at most three shadow casters each after equipment and phase changes', async () => {
  const scene = new T.Scene(), key = new T.DirectionalLight(); key.castShadow = true; scene.add(key);
  const actors = [];
  try {
    for (const [model, style] of [['echo', 'blades'], ['ronin', 'glaive']]) {
      const bytes = await readFile(new URL(`../public/models/${model}-human.glb`, import.meta.url));
      const gltf = await createTexturedGltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      if (model === 'echo') assert.ok(estimateSceneDraws(gltf.scene).color <= 19,
        'the textured Echo model keeps its 19-draw source budget before runtime gear');
      const actor = createRiggedFighter(gltf, '#a4afb2', style); actors.push(actor); scene.add(actor.root);
    }
    actors[0].equipAppearance({ color: '#83ffd6', kit: { layer: 'vest', detail: 'scarf' } });
    const profile = rivalProfile(42, 25, { ...levelFor(42, 25), ability: { id: 'plating' } }, 'echo');
    actors[1].equipAppearance({ ...profile, kit: profile.wardrobe });
    assert.ok(estimateSceneDraws(scene).shadow > 6, 'equipment increases uncapped actor shadow draws');
    for (const phase of [0, 1, 2]) {
      actors[1].setAppearanceState({ phase, brokenPlates: phase * 2 });
      actors.forEach(actor => actor.pose({ reduced: true, time: phase + 2 }));
      const selections = actors.map(actor => selectLargestShadowCasters(actor.root, 3));
      assert.equal(selections[0].length, 3); assert.equal(selections[1].length, 3);
      assert.ok(selections[1].some(object => object.userData.wardrobeParts || object.name.startsWith('Bulwark')), 'new armour participates in the shadow budget');
      const estimate = estimateSceneDraws(scene, { post: FILM_POST_DRAWS });
      assert.equal(estimate.shadow, 6);
      assert.ok(estimate.total < SCENE_DRAW_BUDGET, 'the two full human rigs and wardrobe leave scenery budget');
      assert.equal(estimate.total, estimate.color + 6 + FILM_POST_DRAWS);
    }
  } finally { actors.forEach(actor => actor.disposeAppearance()); dispose(scene); }
});
