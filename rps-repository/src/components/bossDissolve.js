import * as THREE from "three";
import { bakeActorSurface } from "./finaleActorSnapshots.js";

export const BOSS_DISSOLVE_STYLES = Object.freeze(["shatter", "ash", "ribbon", "arc-burst", "slice"]);
const clamp = value => Math.min(1, Math.max(0, value));
const noise = i => { const n = Math.sin(i * 127.1 + 93.7) * 43758.5453; return n - Math.floor(n); };

export function createBossDissolve(parent) {
  const root = new THREE.Group(); root.name = "Afterlight boss dissolution"; root.visible = false; parent.add(root);
  const glass = new THREE.MeshPhysicalMaterial({ color: "#b6fff0", metalness: .63, roughness: .10, clearcoat: 1, transparent: true, opacity: .54, depthWrite: false, side: THREE.FrontSide });
  const ash = new THREE.MeshBasicMaterial({ color: "#bcb8ad", transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
  const light = new THREE.MeshBasicMaterial({ color: "#d8f9ff", transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
  const geometries = [new THREE.BoxGeometry(.11, .11, .11), new THREE.PlaneGeometry(.045, .045), new THREE.PlaneGeometry(.035, .65)];
  const cubes = new THREE.InstancedMesh(geometries[0], glass, 192), flakes = new THREE.InstancedMesh(geometries[1], ash, 300), strands = new THREE.InstancedMesh(geometries[2], light, 96);
  cubes.name = "Boss glass cubes"; flakes.name = "Boss drifting ash"; strands.name = "Boss light ribbons";
  [cubes, flakes, strands].forEach(object => { object.frustumCulled = false; object.castShadow = false; });
  root.add(cubes, flakes, strands);
  const dummy = new THREE.Object3D(), bounds = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
  let source = null, points = [], sourceTransform = new THREE.Matrix4();
  function prepare(actor) {
    if (!actor?.root || source === actor.root) return;
    source = actor.root;
    const surface = bakeActorSurface(actor.root), positions = surface.attributes.position;
    bounds.copy(surface.boundingBox); bounds.getSize(size); bounds.getCenter(center); sourceTransform.copy(actor.root.matrixWorld);
    points = [];
    for (let i = 0; i < 300; i++) {
      if (positions.count) { const index = Math.min(positions.count - 1, Math.floor(noise(i + 11) * positions.count)); points.push(new THREE.Vector3().fromBufferAttribute(positions, index)); }
      else points.push(new THREE.Vector3((noise(i) - .5) * .7, noise(i + 8) * 2.4, (noise(i + 22) - .5) * .5));
    }
    surface.dispose();
  }
  function update({ actor, style = "shatter", progress = 0, quality = "medium", center: anchor } = {}) {
    progress = clamp(progress);
    root.visible = progress > 0 && progress < 1;
    if (!root.visible) return { style, progress, opacity: progress >= 1 ? 0 : 1, hide: progress >= 1 };
    prepare(actor);
    const count = quality === "high" ? 192 : quality === "light" ? 48 : 96;
    cubes.visible = style === "shatter" || style === "slice"; flakes.visible = style === "ash"; strands.visible = style === "ribbon" || style === "arc-burst";
    cubes.count = count; flakes.count = quality === "high" ? 300 : quality === "light" ? 96 : 180; strands.count = quality === "high" ? 96 : quality === "light" ? 24 : 48;
    const mesh = flakes.visible ? flakes : strands.visible ? strands : cubes;
    for (let i = 0; i < mesh.count; i++) {
      const p = points[i % points.length] ?? center, a = i * 2.399, distance = .20 + noise(i + 31) * 1.6;
      dummy.position.copy(p).applyMatrix4(sourceTransform);
      if (anchor && !actor) dummy.position.add(new THREE.Vector3(...anchor));
      if (style === "shatter") { dummy.position.x += Math.cos(a) * progress * distance; dummy.position.z += Math.sin(a) * progress * distance; dummy.position.y += progress * (1.1 + noise(i + 77) * 2.1); }
      else if (style === "ash") { dummy.position.x += progress * 2.4 + Math.sin(a + progress * 5) * progress * .6; dummy.position.y += progress * (1.1 + noise(i + 77)); dummy.position.z += Math.cos(a) * progress; }
      else if (style === "ribbon") { dummy.position.x += Math.cos(a + progress * 8) * progress * 1.6; dummy.position.z += Math.sin(a + progress * 8) * progress * 1.6; dummy.position.y += progress * 3.6; }
      else if (style === "arc-burst") { dummy.position.x += Math.cos(a) * progress * 3.5; dummy.position.z += Math.sin(a) * progress * 3.5; dummy.position.y += Math.sin(a * 2.4) * progress * 2; }
      else { dummy.position.x += (i % 2 ? 1 : -1) * progress * 1.5; dummy.position.y += Math.sin(a) * progress * .7; dummy.position.z += progress * (noise(i) - .5) * 1.2; }
      dummy.rotation.set(progress * (noise(i) * 3 - 1.5), a + progress * .6, progress * 1.4);
      const shrink = .55 + (1 - progress) * .7;
      dummy.scale.setScalar(shrink);
      if (style === "slice") dummy.scale.set(3.2, .14, .7);
      if (style === "ribbon") dummy.scale.set(1, 1 + progress * 2.6, 1);
      if (style === "arc-burst") dummy.scale.set(.6, 1 + progress * 3.7, .6);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    glass.opacity = .54 * (1 - progress * .6); ash.opacity = .5 * (1 - progress); light.opacity = .48 * (1 - progress);
    return { style, progress, opacity: 1 - clamp(progress / .24), hide: progress >= .24 };
  }
  return { root, update, reset() { root.visible = false; source = null; points = []; }, dispose() { parent.remove(root); [cubes, flakes, strands].forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); [glass, ash, light].forEach(m => m.dispose()); } };
}
