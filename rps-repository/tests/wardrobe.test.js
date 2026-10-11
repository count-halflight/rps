import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { createWardrobe } from '../src/components/wardrobe.js';
import { createRiggedFighter } from '../src/components/riggedFighter.js';
import { levelFor } from '../src/game/engine.js';
import { BOSS_PROFILES, rivalProfile } from '../src/game/rivalProfile.js';

function fixture() {
  const root = new T.Group(), body = new T.Group(), model = new T.Group(); root.add(body); body.add(model);
  const texture = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, T.RGBAFormat);
  const skin = new T.MeshStandardMaterial({ color: '#9b7362' }); skin.name = 'Skin';
  const jacket = new T.MeshStandardMaterial({ color: '#27343c', normalMap: texture }); jacket.name = 'Jacket';
  const sourceGeometry = new T.BoxGeometry(.38, .60, .22), source = new T.Mesh(sourceGeometry, [skin, jacket]); model.add(source);
  const points = {
    spine01: [0, 1.43, 0], spine02: [0, 1.23, 0], neck03: [0, 1.64, 0], head: [0, 1.75, 0],
    upperarm01L: [-.22, 1.47, 0], upperarm01R: [.22, 1.47, 0],
    lowerarm01L: [-.32, 1.22, 0], lowerarm01R: [.32, 1.22, 0],
    wristL: [-.34, 1.02, 0], wristR: [.34, 1.02, 0],
    lowerleg01L: [-.11, .43, 0], lowerleg01R: [.11, .43, 0],
  };
  for (const [name, p] of Object.entries(points)) { const bone = new T.Bone(); bone.name = name; bone.position.set(...p); model.add(bone); }
  root.updateMatrixWorld(true);
  return { root, body, model, source, skin, jacket, texture, dispose() { sourceGeometry.dispose(); skin.dispose(); jacket.dispose(); texture.dispose(); } };
}
function meshes(f) { const out = []; f.model.traverse(o => { if (o.isMesh && o !== f.source) out.push(o); }); return out; }
function parts(f, pattern) { const out = []; f.model.traverse(o => { if (pattern.test(o.name)) out.push(o); }); return out; }
function activeInstances(pool) {
  if (!pool?.visible) return 0;
  const matrix = new T.Matrix4(), scale = new T.Vector3(); let count = 0;
  for (let i = 0; i < pool.count; i++) { pool.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix); if (scale.length() > 1e-5) count++; }
  return count;
}
function bossAppearance(ability) {
  const enemy = { ...levelFor(42, 5), ability: { id: ability } };
  const profile = rivalProfile(42, 5, enemy, 'echo');
  return { ...profile, kit: profile.wardrobe };
}

test('Bulwark has six separate bevelled armour plates, a closed helm and a tower-shield silhouette', () => {
  const f = fixture(), wardrobe = createWardrobe(f, bossAppearance('plating'));
  try {
    wardrobe.update(0);
    const plates = parts(f, /^Bulwark armour plate \d$/), carapace = f.model.getObjectByName('Bulwark six-plate carapace');
    assert.equal(plates.length, 6);
    assert.equal(activeInstances(carapace), 6);
    assert.equal(carapace.geometry.type, 'ExtrudeGeometry');
    assert.ok(carapace.geometry.parameters.options.bevelEnabled);
    assert.ok(carapace.material.metalness > .7 && carapace.material.normalMap && carapace.material.roughnessMap && carapace.material.map);
    assert.ok(carapace.material.roughness > .85 && carapace.material.clearcoat < .1, 'worn pewter stays rough enough to avoid the former white chrome glare');
    const matrices = Array.from({length: 6}, (_, i) => Array.from(carapace.instanceMatrix.array.slice(i * 16, (i + 1) * 16)).join(','));
    assert.equal(new Set(matrices).size, 6, 'the six plates remain independent surfaces in the same draw');
    assert.ok(f.model.getObjectByName('Bulwark closed siege helm'));
    const shield = f.model.getObjectByName('Bulwark tower shield');
    assert.ok(shield?.visible);
    shield.geometry.computeBoundingBox();
    const size = shield.geometry.boundingBox.getSize(new T.Vector3());
    assert.ok(size.y > .9 && size.x > .5 && size.z > .09, 'shield has real depth and covers the torso');
    assert.ok(meshes(f).filter(mesh => mesh.visible).length <= 60, 'the wardrobe leaves room for fighters and scenery in the draw budget');
  } finally { wardrobe.dispose(); f.dispose(); }
});

test('the closed siege shell encloses the shipped Kuro face and remains substantial from the side', async () => {
  // A synthetic bone fixture missed the original front-only helmet sitting
  // above the chin and exposing the side of the actual human head.
  const bytes = await readFile(new URL('../public/models/ronin-human.glb', import.meta.url));
  const gltf = await createTexturedGltfLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  );
  const f = createRiggedFighter(gltf, '#c44650', 'glaive');
  try {
    f.equipAppearance(bossAppearance('plating'));
    f.root.updateMatrixWorld(true);
    const face = new T.Box3(), point = new T.Vector3();
    f.model.traverse(mesh => {
      if (!mesh.isSkinnedMesh || !/^Skin/.test(mesh.material.name)) return;
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        if (point.y > 1.84) face.expandByPoint(point);
      }
    });
    assert.ok(!face.isEmpty());
    const batches = []; f.model.traverse(mesh => { if (mesh.userData.wardrobeParts) batches.push(mesh); });
    const helmet = batches.find(mesh => mesh.userData.wardrobeParts.includes('Bulwark closed siege helm'));
    const torso = batches.find(mesh => mesh.userData.wardrobeParts.includes('Bulwark cuirass underframe'));
    assert.ok(helmet && torso);
    const shell = new T.Box3().setFromObject(helmet), shellSize = shell.getSize(new T.Vector3());
    assert.ok(shell.min.y < face.min.y - .03 && shell.max.y > face.max.y + .12, 'chin and crown fit inside the metal shell');
    assert.ok(shell.min.x < face.min.x - .03 && shell.max.x > face.max.x + .03, 'both temples fit inside the metal shell');
    assert.ok(shell.min.z < face.min.z - .03 && shell.max.z > face.max.z + .03, 'the helmet surrounds the head instead of painting a plate on its front');
    assert.ok(shellSize.z > .35, 'a side camera still sees the helmet mass');
    const torsoSize = new T.Box3().setFromObject(torso).getSize(new T.Vector3());
    assert.ok(torsoSize.x > .7 && torsoSize.z > .4, 'the cuirass encloses a broad body volume');
    const shoulders = new T.Box3().setFromObject(f.model.getObjectByName('Bulwark paired siege pauldrons')).getSize(new T.Vector3());
    assert.ok(shoulders.x > 1.05, 'shoulder shells expand outward, not into the source sleeves');
  } finally { f.disposeAppearance(); }
});

test('heavy-hit plate breaks produce fragments and weak seams while visual phases split and strip the shield', () => {
  const f = fixture(), appearance = bossAppearance('plating'), original = structuredClone(appearance);
  const wardrobe = createWardrobe(f, appearance);
  const plates = f.model.getObjectByName('Bulwark six-plate carapace');
  const seams = f.model.getObjectByName('Bulwark six exposed weak seams');
  const fragments = () => meshes(f).filter(mesh => /^Bulwark fracture pool \d$/.test(mesh.name));
  const fragmentCount = () => fragments().reduce((count, pool) => count + activeInstances(pool), 0);
  try {
    wardrobe.update(2); assert.equal(activeInstances(plates), 6);
    const intact = plates.instanceMatrix.array.slice();
    wardrobe.setState({ brokenPlates: 2 }); wardrobe.update(2);
    assert.equal(activeInstances(plates), 4);
    assert.equal(activeInstances(seams), 2);
    assert.equal(fragmentCount(), 6);
    assert.deepEqual(plates.instanceMatrix.array.slice(32), intact.slice(32), 'breaking two plates leaves the other four transforms intact');
    wardrobe.update(3.3); assert.equal(fragmentCount(), 0);
    wardrobe.setState({ phase: 1 }); wardrobe.update(4);
    assert.equal(f.model.getObjectByName('Bulwark tower shield').visible, false);
    assert.equal(activeInstances(f.model.getObjectByName('Bulwark split-shield gauntlets')), 2);
    wardrobe.update(5, true, { phase: 2 });
    assert.equal(activeInstances(plates), 0);
    assert.equal(activeInstances(seams), 6);
    assert.equal(fragmentCount(), 0, 'reduced motion keeps the plate state without flying shards');
    assert.deepEqual(appearance, original, 'presentation state must not modify its input');
  } finally { wardrobe.dispose(); f.dispose(); }
});

test('shield presentation yaw turns its whole attached surface without rotating the six armour plates', () => {
  const f=fixture(),wardrobe=createWardrobe(f,bossAppearance('plating'));
  try {
    wardrobe.update(1,true,{shieldPresentationYaw:.4});f.root.updateMatrixWorld(true);
    const shield=f.model.getObjectByName('Bulwark tower shield'),crest=f.model.getObjectByName('Bulwark shield spine'),slit=f.model.getObjectByName('Bulwark shield slit');
    const plates=f.model.getObjectByName('Bulwark six-plate carapace').instanceMatrix.array.slice(),before=shield.getWorldQuaternion(new T.Quaternion());
    assert.equal(shield.parent,crest.parent);assert.equal(shield.parent,slit.parent);
    wardrobe.update(2,true,{shieldPresentationYaw:.78});f.root.updateMatrixWorld(true);
    const orientation=shield.getWorldQuaternion(new T.Quaternion());
    assert.ok(orientation.angleTo(before)>.3);
    assert.ok(orientation.angleTo(crest.getWorldQuaternion(new T.Quaternion()))<1e-7);
    assert.ok(orientation.angleTo(slit.getWorldQuaternion(new T.Quaternion()))<1e-7);
    assert.deepEqual(f.model.getObjectByName('Bulwark six-plate carapace').instanceMatrix.array,plates);
    wardrobe.update(3,true,{phase:1});assert.equal(shield.parent.visible,false);
  } finally {wardrobe.dispose();f.dispose();}
});

test('paired instance armour follows separate animated bones under a scaled and rotated actor', () => {
  const f = fixture(); f.root.scale.setScalar(2.3); f.root.rotation.set(.1, .7, -.2); f.root.position.set(4, -2, 3);
  const wardrobe = createWardrobe(f, bossAppearance('plating'));
  try {
    wardrobe.update(1, true);
    const pool = f.model.getObjectByName('Bulwark paired greaves'), before = pool.instanceMatrix.array.slice();
    f.model.getObjectByName('lowerleg01L').rotation.z = .35;
    f.model.getObjectByName('lowerleg01L').position.y += .16;
    wardrobe.update(2, true);
    assert.notDeepEqual(pool.instanceMatrix.array.slice(0, 16), before.slice(0, 16));
    assert.deepEqual(pool.instanceMatrix.array.slice(16), before.slice(16), 'the other leg remains independently bound');
    f.root.updateMatrixWorld(true);
    for (const [index, side] of [[0, 'L'], [1, 'R']]) {
      const instance = new T.Matrix4(); pool.getMatrixAt(index, instance);
      const actual = new T.Vector3().applyMatrix4(pool.matrixWorld.clone().multiply(instance));
      const expected = f.model.getObjectByName(`Bulwark greave ${side}`).getWorldPosition(new T.Vector3());
      assert.ok(actual.distanceTo(expected) < 1e-5, `greave ${side} left its bone attachment`);
    }
  } finally { wardrobe.dispose(); f.dispose(); }
});

test('re-equipping a posed cached fighter retains its neutral armour and helmet attachment frames', () => {
  const f = fixture(), appearance = bossAppearance('plating'); let wardrobe = createWardrobe(f, appearance);
  try {
    f.model.getObjectByName('spine01').rotation.y = -.4; f.model.getObjectByName('head').rotation.x = .25;
    wardrobe.update(2, true);
    const plates = f.model.getObjectByName('Bulwark six-plate carapace').instanceMatrix.array.slice();
    const helmet = f.model.getObjectByName('Bulwark closed siege helm').getWorldQuaternion(new T.Quaternion());
    wardrobe.dispose(); wardrobe = createWardrobe(f, appearance); wardrobe.update(2, true);
    assert.deepEqual(f.model.getObjectByName('Bulwark six-plate carapace').instanceMatrix.array, plates);
    assert.ok(helmet.angleTo(f.model.getObjectByName('Bulwark closed siege helm').getWorldQuaternion(new T.Quaternion())) < 1e-7);
  } finally { wardrobe.dispose(); f.dispose(); }
});

test('all six named boss wardrobes remain finite through phases, scans and signature telegraphs', () => {
  const signatures = new Set();
  for (const ability of Object.keys(BOSS_PROFILES)) {
    const f = fixture(), wardrobe = createWardrobe(f, bossAppearance(ability));
    try {
      for (const phase of [0, 1, 2]) for (const reduced of [false, true]) for (const time of [0, .3, 2, 4, 9]) {
        wardrobe.update(time, reduced, { phase, heat: 90, signatureWarning: true, scan: true, lastHand: 'paper' });
        f.root.updateMatrixWorld(true);
        for (const mesh of meshes(f)) {
          assert.ok(mesh.matrixWorld.elements.every(Number.isFinite), `${ability}: ${mesh.name} transform`);
          assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite), `${ability}: ${mesh.name} geometry`);
        }
      }
      signatures.add(meshes(f).map(mesh => mesh.name).filter(Boolean).join('|'));
      if (ability === 'mirror') assert.equal(f.model.getObjectByName('Onyx last-hand glyph paper').visible, true);
      if (ability === 'blackout') {
        assert.equal(f.skin.opacity, 1, 'scan resolves the wraith into a readable body');
        wardrobe.update(10, true, { scan: false }); assert.equal(f.skin.opacity, .62);
      }
      if (ability === 'thermal') {
        assert.equal(f.model.getObjectByName('Crucible furnace glass').visible, false);
        assert.equal(meshes(f).filter(mesh => mesh.name.startsWith('Crucible exposed pipe') && mesh.visible).length, 6);
      }
    } finally { wardrobe.dispose(); assert.equal(f.skin.opacity, 1); assert.equal(f.skin.transparent, false); f.dispose(); }
  }
  assert.equal(signatures.size, 6, 'bosses must have distinct equipment and silhouette geometry');
});

test('wardrobe disposal releases owned maps, materials and geometry once while preserving the base model', () => {
  for (const ability of ['plating', 'blackout']) {
    const f = fixture(), wardrobe = createWardrobe(f, bossAppearance(ability)), owned = meshes(f);
    const geometries = new Set(owned.map(mesh => mesh.geometry)), materials = new Set(owned.map(mesh => mesh.material));
    const textures = new Set([...materials].flatMap(material => [material.normalMap, material.roughnessMap]).filter(texture => texture && texture !== f.texture));
    const instances = new Set(owned.filter(mesh => mesh.isInstancedMesh));
    let disposedGeometries = 0, disposedMaterials = 0, disposedTextures = 0, disposedBase = 0, disposedInstances = 0;
    for (const instance of instances) instance.addEventListener('dispose', () => { disposedInstances++; });
    for (const geometry of geometries) geometry.addEventListener('dispose', () => { disposedGeometries++; });
    for (const material of materials) material.addEventListener('dispose', () => { disposedMaterials++; });
    for (const texture of textures) texture.addEventListener('dispose', () => { disposedTextures++; });
    f.source.geometry.addEventListener('dispose', () => { disposedBase++; });
    f.skin.addEventListener('dispose', () => { disposedBase++; });
    f.texture.addEventListener('dispose', () => { disposedBase++; });
    wardrobe.dispose(); wardrobe.dispose(); wardrobe.update(10);
    assert.equal(disposedGeometries, geometries.size);
    assert.equal(disposedMaterials, materials.size);
    assert.equal(disposedTextures, textures.size);
    assert.equal(disposedInstances, instances.size, 'owned instance buffers are released once');
    assert.equal(disposedBase, 0);
    assert.equal(meshes(f).length, 0); assert.ok(f.source.parent);
    f.dispose();
  }
});

test('static same-bone material batches reduce draws without flattening phase props or breakable plates', () => {
  for (const ability of ['plating', 'siphon', 'thermal', 'redline']) {
    const f = fixture(), wardrobe = createWardrobe(f, bossAppearance(ability));
    try {
      assert.ok(wardrobe.batchStats.after < wardrobe.batchStats.before, ability);
      assert.equal(meshes(f).filter(mesh => mesh.visible).length, wardrobe.batchStats.after);
      const batches = meshes(f).filter(mesh => mesh.userData.wardrobeParts?.length > 1);
      assert.ok(batches.length > 0);
      for (const mesh of batches) {
        assert.equal(mesh.geometry.attributes.uv.count, mesh.geometry.attributes.position.count);
        assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
      }
      if (ability === 'plating') {
        assert.equal(parts(f, /^Bulwark armour plate \d$/).length, 6);
        assert.equal(f.model.getObjectByName('Bulwark six-plate carapace').count, 6);
        assert.ok(meshes(f).filter(mesh => /^Bulwark fracture pool/.test(mesh.name)).every(mesh => !mesh.castShadow));
      }
      if (ability === 'siphon') {
        assert.ok(wardrobe.batchStats.after <= 8, 'many gown cables should not each require a separate draw');
      }
      wardrobe.update(3, false, { phase: 2, brokenPlates: 6 });
      wardrobe.dispose(); assert.equal(meshes(f).length, 0);
    } finally { wardrobe.dispose(); f.dispose(); }
  }
});

test('twenty-four modular rival looks change geometry rather than only recolouring the same costume', () => {
  const selected = new Map();
  for (let level = 1; level < 3000 && selected.size < 24; level++) {
    const profile = rivalProfile(42, level, levelFor(42, level), 'vex');
    if (profile.kit === 'echo' && !profile.boss) selected.set(profile.look.variant, profile);
  }
  assert.equal(selected.size, 24);
  const silhouettes = new Set();
  for (const profile of selected.values()) {
    const f = fixture(), wardrobe = createWardrobe(f, { ...profile, elite: false, tier: 'grunt', kit: profile.wardrobe });
    try {
      const hash = createHash('sha256');
      for (const mesh of meshes(f)) {
        hash.update(mesh.geometry.type);
        hash.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));
        hash.update(JSON.stringify(mesh.position.toArray()));
      }
      silhouettes.add(hash.digest('hex'));
    } finally { wardrobe.dispose(); f.dispose(); }
  }
  assert.equal(silhouettes.size, 24);
});
