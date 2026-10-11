import * as THREE from "three";
import { bakeActorSurface, createReflectionVariantSnapshots, simplifyActorSnapshot, REFLECTION_POSE_KEYS } from "./finaleActorSnapshots.js";
import { createBossDissolve } from "./bossDissolve.js";
import { createSpectralMaterial } from "./spectralMaterial.js";
import { createReflectionPoseAtlas } from "./reflectionPoseAtlas.js";
import { reflectionContactTransform } from "./reflectionContact.js";

export const AFTERLIGHT_ACT_BOUNDARIES = Object.freeze([0, 2.5, 5.5, 9, 12.5, 15]);
const TAU = Math.PI * 2;
const clamp = value => Math.min(1, Math.max(0, value));
const span = (time, from, to) => clamp((time - from) / (to - from));
const smooth = value => value * value * (3 - 2 * value);
const random = index => { const value = Math.sin(index * 127.1 + 83.9) * 43758.5453; return value - Math.floor(value); };
export function afterlightAct(time) {
  return time < 2.5 ? 1 : time < 5.5 ? 2 : time < 9 ? 3 : time < 12.5 ? 4 : 5;
}
export function finaleQuality(quality, low) {
  return low || quality === "low" || quality === "light" ? "light" : quality === "high" ? "high" : "medium";
}

function chippedMirrorMaps() {
  const side = 128, color = new Uint8Array(side * side * 4), rough = new Uint8Array(side * side * 4), silver = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const u = x / side, v = y / side, edge = Math.min(u, 1 - u, v, 1 - v);
    const grain = random(x * 127 + y), chipped = edge < .035 + Math.sin(v * 91 + u * 45) * .017 && grain > .25;
    const stain = Math.sin(u * 13 + v * 5) * Math.sin(v * 19 - u * 3), scratch = Math.abs(Math.sin((u + v * .31) * 173)) < .012;
    const intensity = chipped ? 42 + grain * 16 : 176 + stain * 5 - (scratch ? 17 : 0), k = (y * side + x) * 4;
    color.set([intensity * .93, intensity, intensity * 1.045, 255], k);
    const r = chipped ? 219 : scratch ? 169 : 112 + (stain + 1) * 8;
    rough.set([r, r, r, 255], k); const a = chipped ? 50 : 222 - grain * 22; silver.set([a, a, a, 255], k);
  }
  const texture = (pixels, srgb = false) => { const value = new THREE.DataTexture(pixels, side, side); if (srgb) value.colorSpace = THREE.SRGBColorSpace; value.needsUpdate = true; return value; };
  return { color: texture(color, true), roughness: texture(rough), silver: texture(silver) };
}
function puddleEchoMaterial() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.FrontSide, vertexColors: true,
    uniforms: { puddleCenter: { value: new THREE.Vector3() }, puddleRadii: { value: new THREE.Vector2(1.3, 3) }, strength: { value: .16 } },
    vertexShader: `varying vec3 vWorld,vColor;void main(){vColor=vec3(.3);
#ifdef USE_COLOR
vColor=color;
#endif
vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 puddleCenter;uniform vec2 puddleRadii;uniform float strength;varying vec3 vWorld,vColor;
    void main(){float d=vWorld.y-cameraPosition.y;if(abs(d)<.001)discard;
    vec3 ground=cameraPosition+(vWorld-cameraPosition)*((puddleCenter.y-cameraPosition.y)/d);
    vec2 uv=(ground.xz-puddleCenter.xz)/puddleRadii;float edge=dot(uv,uv);if(edge>1.)discard;
    float alpha=strength*(1.-smoothstep(.65,1.,edge));gl_FragColor=vec4(mix(vec3(.08,.13,.14),vColor*.7,.5),alpha);}`,
  });
}

export function createFinaleWorld(scene) {
  const root = new THREE.Group(); root.name = "Afterlight finale world"; root.visible = false; scene.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set(), dummy = new THREE.Object3D();
  const ownGeometry = geometry => (geometries.add(geometry), geometry), ownMaterial = material => (materials.add(material), material);
  const mesh = (geometry, material, parent = root) => { const object = new THREE.Mesh(ownGeometry(geometry), ownMaterial(material)); parent.add(object); return object; };
  const basic = (color, opacity = 1) => ownMaterial(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, fog: false }));
  const mirrorMaps = chippedMirrorMaps(); Object.values(mirrorMaps).forEach(texture => textures.add(texture));
  const dome = new THREE.Group(); dome.name = "Twenty-four mirror dome"; root.add(dome);
  const mirrorMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#65737b", map: mirrorMaps.color, roughnessMap: mirrorMaps.roughness, alphaMap: mirrorMaps.silver, emissive: "#596a75", emissiveMap: mirrorMaps.color, emissiveIntensity: .035, roughness: 1, metalness: .66, envMapIntensity: .16, clearcoat: .35, transparent: true, opacity: .24, depthWrite: false, side: THREE.FrontSide }));
  const windowShape = new THREE.Shape(); windowShape.moveTo(-.455, -1.075); windowShape.lineTo(.455, -1.075); windowShape.lineTo(.455, .77); windowShape.lineTo(0, 1.405); windowShape.lineTo(-.455, .77); windowShape.closePath();
  const mirrorGeometry = ownGeometry(new THREE.ShapeGeometry(windowShape));
  const mirrorUV = mirrorGeometry.attributes.uv, mirrorVertices = mirrorGeometry.attributes.position;
  for (let i = 0; i < mirrorUV.count; i++) mirrorUV.setXY(i, (mirrorVertices.getX(i) + .455) / .91, (mirrorVertices.getY(i) + 1.075) / 2.48);
  const mirrors = new THREE.InstancedMesh(mirrorGeometry, mirrorMaterial, 24); mirrors.name = "Twenty-four mirror faces"; dome.add(mirrors);
  const border = new THREE.Shape(); border.moveTo(-.5, -1.12); border.lineTo(.5, -1.12); border.lineTo(.5, .80); border.lineTo(0, 1.50); border.lineTo(-.5, .80); border.closePath();
  const opening = new THREE.Path(); opening.moveTo(-.455, -1.075); opening.lineTo(-.455, .77); opening.lineTo(0, 1.405); opening.lineTo(.455, .77); opening.lineTo(.455, -1.075); opening.closePath(); border.holes.push(opening);
  const frameGeometry = ownGeometry(new THREE.ExtrudeGeometry(border, { depth: .035, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1 }));
  const frameMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#382d23", emissive: "#9a8253", emissiveIntensity: .055, metalness: .87, roughness: .28, transparent: true, opacity: .58, depthWrite: false }));
  const frames = new THREE.InstancedMesh(frameGeometry, frameMaterial, 24); frames.name = "Twenty-four mirror frames"; dome.add(frames);
  const mirrorGlints = new THREE.InstancedMesh(ownGeometry(new THREE.BoxGeometry(.012, 1.95, .025)), basic("#b9b19a", .065), 24); dome.add(mirrorGlints);
  const crownsGeometry = ownGeometry(new THREE.ConeGeometry(.085, .31, 4)); crownsGeometry.translate(0, 1.665, 0);
  const crowns = new THREE.InstancedMesh(crownsGeometry, frameMaterial, 24); crowns.name = "Twenty-four gilt pointed crowns"; dome.add(crowns);
  [mirrors, frames, mirrorGlints, crowns].forEach(object => { object.frustumCulled = false; object.castShadow = false; });

  const rings = new THREE.Group(); rings.name = "Trinity finale rings"; root.add(rings);
  const handColors = ["#92bdac", "#aba9bd", "#c6ad83"], whiteGold = new THREE.Color("#fff3c5");
  const trinityRings = handColors.map((color, i) => mesh(new THREE.TorusGeometry(1.05 + i * .15, .023, 6, 64), basic(color, .6), rings));
  const drainGeometry = ownGeometry(new THREE.BufferGeometry()); drainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(72 * 12), 3));
  const drainMaterial = ownMaterial(new THREE.LineBasicMaterial({ color: "#b8ffe0", transparent: true, opacity: .28, depthWrite: false, fog: false }));
  const drain = new THREE.LineSegments(drainGeometry, drainMaterial); drain.name = "Converging district light threads"; drain.frustumCulled = false; root.add(drain);

  const cutLines = new THREE.InstancedMesh(ownGeometry(new THREE.CylinderGeometry(.006, .012, 1, 5)), basic("#83ffd6", .45), 24);
  cutLines.name = "Twenty-four delayed mint cuts"; cutLines.frustumCulled = false; root.add(cutLines);
  const shockwave = mesh(new THREE.TorusGeometry(1, .025, 6, 96), basic("#eaf9da", .35)); shockwave.name = "Afterlight relight wave"; shockwave.rotation.x = -Math.PI / 2;

  const puddle = new THREE.Group(); puddle.name = "Epilogue delayed puddle echo"; root.add(puddle);
  const puddlePlane = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: "#081b1c", roughness: .09, metalness: .92, transparent: true, opacity: .78, depthWrite: false, side: THREE.DoubleSide }), puddle);
  puddlePlane.rotation.x = -Math.PI / 2; puddlePlane.scale.set(1.3, 3, 1);
  const puddleMaterial = ownMaterial(puddleEchoMaterial());
  let puddleEcho = null, snapshotSource = null, snapshotQuality = null, snapshotPoses = [], reflectionAtlas = null;
  const ghostMaterial = ownMaterial(createSpectralMaterial({ color: "#b0bfc1", maximumAlpha: .16, bodyCoverage: .28, edgeCoverage: .06 }));
  const dissolver = createBossDissolve(root);
  let bossMirror = null, bossMirrorSource = null, bossMirrorQuality = null;

  function clearBossMirrors() {
    if (bossMirror) { dome.remove(bossMirror); bossMirror.dispose(); bossMirror.geometry.dispose(); }
    bossMirror = null; bossMirrorSource = null; bossMirrorQuality = null;
  }
  function prepareBossMirrors(actor, quality) {
    if (!actor?.root || actor.root === bossMirrorSource && quality === bossMirrorQuality) return;
    clearBossMirrors(); bossMirrorSource = actor.root; bossMirrorQuality = quality;
    const surface = bakeActorSurface(actor.root), geometry = simplifyActorSnapshot(surface, quality === "light" ? .065 : .030); surface.dispose();
    geometry.setAttribute("ghostAlpha", new THREE.InstancedBufferAttribute(new Float32Array(24).fill(.35), 1));
    bossMirror = new THREE.InstancedMesh(geometry, ghostMaterial, 24); bossMirror.name = "Twenty-four boss mirror reflections"; bossMirror.frustumCulled = false; bossMirror.renderOrder = 2; dome.add(bossMirror);
  }

  function clearSnapshots() {
    if (puddleEcho) { puddle.remove(puddleEcho); puddleEcho = null; }
    reflectionAtlas?.dispose(); reflectionAtlas = null; snapshotPoses.forEach(geometry => geometry.dispose());
    snapshotPoses = []; snapshotSource = null; snapshotQuality = null;
  }
  function prepareSnapshots(actor, quality) {
    if (!actor?.root || actor.root === snapshotSource && quality === snapshotQuality) return;
    clearSnapshots(); snapshotSource = actor.root; snapshotQuality = quality;
    snapshotPoses = createReflectionVariantSnapshots(actor, quality);
    reflectionAtlas = createReflectionPoseAtlas(snapshotPoses, 24); root.add(reflectionAtlas.mesh);
    if (snapshotPoses.length) { puddleEcho = new THREE.Mesh(snapshotPoses[1], puddleMaterial); puddleEcho.name = "Delayed actual Echo reflection"; puddleEcho.frustumCulled = false; puddle.add(puddleEcho); }
  }
  let lastAnimation = null;
  function reset() { root.visible = false; dissolver.reset(); if (reflectionAtlas) reflectionAtlas.mesh.visible = false; }
  function update({ frame, animation, time = 0, actorHeight, targetHeight, quality, low = false, reduced = false, attacker, defender } = {}) {
    const finale = frame?.finale, id = finale?.id ?? animation?.sequenceId;
    if (id !== "ECHO-AF" || !frame || frame.progress >= 1 || animation?.outcome === "draw") { reset(); return { active: false, hideEnvironment: false }; }
    const tier = finaleQuality(quality, low), elapsed = Math.min(15, Math.max(0, finale?.time ?? frame.progress * 15));
    const physicalTargetHeight = targetHeight ?? animation?.targetHeight ?? 1.9 * (defender?.root.scale.y ?? 1);
    const act = afterlightAct(elapsed), center = finale?.center ?? [defender?.root.position.x ?? 1.6, (defender?.root.position.y ?? 0) + physicalTargetHeight * .58, defender?.root.position.z ?? 0], fighterCenter = finale?.fighterCenter ?? [-1.6, 0, 0];
    if (lastAnimation !== animation?.id) { lastAnimation = animation?.id; clearSnapshots(); clearBossMirrors(); dissolver.reset(); }
    prepareSnapshots(attacker, tier); prepareBossMirrors(defender, tier); root.visible = true;
    const convergence = smooth(span(elapsed, 2.5, 5.5)), implode = smooth(span(elapsed, 9, 10.1));
    const domeStrength = finale?.dome ?? convergence * (1 - implode);
    dome.visible = elapsed >= 2.5 && elapsed < 10.1;
    dome.position.set(center[0], Math.max(1.6, center[1]), center[2]);
    for (let i = 0; i < 24; i++) {
      const latitude = Math.floor(i / 8), angle = i % 8 * TAU / 8 + latitude * .28;
      const radius = (3.4 - latitude * .58) * (1 - implode * .88), y = [-.35, .95, 2.20][latitude];
      dummy.position.set(Math.cos(angle) * radius, y + implode * .8, Math.sin(angle) * radius);
      dummy.lookAt(0, y * .72, 0); dummy.rotateZ(Math.sin(i * 8.1) * .075 + implode * (i % 2 ? 1 : -1) * .8);
      dummy.scale.setScalar((.12 + convergence * .88) * (1 - implode * .72)); dummy.updateMatrix();
      frames.setMatrixAt(i, dummy.matrix); mirrors.setMatrixAt(i, dummy.matrix); crowns.setMatrixAt(i, dummy.matrix);
      if (bossMirror) {
        const bounds = bossMirror.geometry.boundingBox, size = bounds.getSize(new THREE.Vector3()), midpoint = bounds.getCenter(new THREE.Vector3());
        const fit = Math.min(.72, .78 / Math.max(.01, size.x * defender.root.scale.x), 1.8 / Math.max(.01, size.y * defender.root.scale.y));
        const reflected = dummy.clone(); reflected.scale.copy(defender.root.scale).multiplyScalar(fit * (.12 + convergence * .88) * (1 - implode * .72)); reflected.scale.z *= .035;
        const offset = new THREE.Vector3(-midpoint.x * reflected.scale.x, -midpoint.y * reflected.scale.y + .02, .025).applyQuaternion(dummy.quaternion);
        reflected.position.add(offset); reflected.updateMatrix();
        bossMirror.setMatrixAt(i, reflected.matrix); bossMirror.geometry.attributes.ghostAlpha.setX(i, .35 * domeStrength);
      }
      dummy.position.add(new THREE.Vector3(Math.cos(angle + Math.PI / 2) * .49, 0, Math.sin(angle + Math.PI / 2) * .49)); dummy.updateMatrix(); mirrorGlints.setMatrixAt(i, dummy.matrix);
    }
    frames.instanceMatrix.needsUpdate = mirrors.instanceMatrix.needsUpdate = mirrorGlints.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
    if (bossMirror) { bossMirror.instanceMatrix.needsUpdate = true; bossMirror.geometry.attributes.ghostAlpha.needsUpdate = true; }
    if (scene.environment && mirrorMaterial.envMap !== scene.environment) { mirrorMaterial.envMap = scene.environment; mirrorMaterial.needsUpdate = true; }
    mirrorMaterial.opacity = .24 * domeStrength; frameMaterial.opacity = .58 * domeStrength; mirrorGlints.material.opacity = .065 * domeStrength;

    rings.visible = act === 2 || act === 5;
    const physicalActorHeight = actorHeight ?? animation?.actorHeight ?? 1.9 * (attacker?.root.scale.y ?? 1);
    rings.position.set(fighterCenter[0], act === 5 ? fighterCenter[1] + physicalActorHeight + .5 : fighterCenter[1] + physicalActorHeight * .78, fighterCenter[2] - (act === 5 ? 0 : .55));
    const haloStrength = finale?.halo ?? (act === 5 ? 1 - span(elapsed, 13.1, 15) : 1), ringMerge = span(elapsed, 4.5, 5.5);
    trinityRings.forEach((ring, i) => {
      const orbit = reduced ? i * .7 : elapsed * (.45 + convergence * 2.8) + i * .85;
      ring.rotation.set(act === 5 ? Math.PI / 2 : orbit * .6, act === 5 ? 0 : orbit, act === 5 ? 0 : orbit * .4);
      ring.scale.setScalar(act === 5 ? .75 : .18 + convergence * .55); ring.position.y = act === 5 ? i * .025 : Math.sin(orbit) * .12;
      ring.material.color.set(handColors[i]).lerp(whiteGold, act === 5 ? .72 : ringMerge * .76);
      ring.material.opacity = act === 5 ? .29 * haloStrength : .3 * span(elapsed, 2.5, 3.05) * (1 - ringMerge * .72);
    });
    drain.visible = act === 2; const threadCount = tier === "high" ? 72 : tier === "light" ? 24 : 48, drainPositions = drainGeometry.attributes.position;
    for (let i = 0; i < threadCount; i++) {
      const angle = i * 2.399, flow = (random(i) + convergence * 1.6) % 1, radius = 4.2 * (1 - flow), end = Math.max(0, radius - .38);
      const y = physicalActorHeight * .66 + (1 - flow) * Math.sin(angle * .7) * 1.4;
      drainPositions.setXYZ(i * 2, fighterCenter[0] + Math.cos(angle) * radius, y, fighterCenter[2] + Math.sin(angle) * radius);
      drainPositions.setXYZ(i * 2 + 1, fighterCenter[0] + Math.cos(angle + .09) * end, y + (physicalActorHeight * .66 - y) * .14, fighterCenter[2] + Math.sin(angle + .09) * end);
    }
    drainGeometry.setDrawRange(0, threadCount * 2); drainPositions.needsUpdate = true; drainMaterial.opacity = .14 * convergence;

    const reflectionFrames = finale?.reflections ?? Array.from({ length: 24 }, (_, index) => {
      const angle = index * TAU / 24, strikeTime = 5.5 + index * 3.3 / 24, progress = span(elapsed, strikeTime, strikeTime + .16), active = elapsed >= strikeTime && elapsed < strikeTime + .16;
      const radius = active ? 3.4 - Math.sin(progress * Math.PI) * 2.35 : 3.4;
      return { index, angle, active, opacity: active ? .55 : .035, poseId: REFLECTION_POSE_KEYS[index % 8], root: [center[0] + Math.cos(angle) * radius, .08 + index % 3 * .12, center[2] + Math.sin(angle) * radius] };
    });
    if (reflectionAtlas) { reflectionAtlas.mesh.count = 0; reflectionAtlas.mesh.visible = elapsed >= 3 && elapsed < 10.2; }
    const reflectionContacts = [];
    for (const reflection of reflectionFrames) {
      if (!reflectionAtlas) break;
      const index = reflection.index ?? 0, namedPose = REFLECTION_POSE_KEYS.indexOf(reflection.poseId ?? reflection.pose?.poseId), pose = namedPose >= 0 ? namedPose : index % 8;
      const instance = reflectionAtlas.mesh.count++, position = reflection.root ?? [center[0] + Math.cos(reflection.angle) * 3.4, 0, center[2] + Math.sin(reflection.angle) * 3.4];
      const transformed = reflectionContactTransform({ ...reflection, root: position, poseBankA: reflection.poseBankA ?? pose * 3 + 1 }, snapshotPoses, { attacker, defender, center, targetHeight: physicalTargetHeight });
      dummy.position.copy(transformed.position); dummy.quaternion.copy(transformed.quaternion); dummy.scale.copy(transformed.scale);
      dummy.updateMatrix(); reflectionAtlas.mesh.setMatrixAt(instance, dummy.matrix);
      reflectionAtlas.poseBankA.setX(instance, transformed.bankA); reflectionAtlas.poseBankB.setX(instance, transformed.bankB); reflectionAtlas.blend.setX(instance, transformed.blend);
      if (transformed.diagnostic) reflectionContacts.push(transformed.diagnostic);
      reflectionAtlas.alpha.setX(instance, Math.min(reflection.active ? .55 : .035, reflection.opacity ?? (reflection.active ? .55 : .035)) * (1 - implode));
    }
    if (reflectionAtlas) { reflectionAtlas.mesh.instanceMatrix.needsUpdate = true; reflectionAtlas.alpha.needsUpdate = true; reflectionAtlas.poseBankA.needsUpdate = true; reflectionAtlas.poseBankB.needsUpdate = true; reflectionAtlas.blend.needsUpdate = true; }

    const cutStrength = finale?.cutLines ?? smooth(span(elapsed, 9, 9.2)) * (1 - span(elapsed, 11.4, 12.5));
    cutLines.visible = act === 4; cutLines.material.opacity = Math.min(.35, cutStrength * .34);
    for (let i = 0; i < 24; i++) {
      const angle = i * 2.399, radius = .26 + i % 4 * .08, height = center[1] + (i % 5 - 2) * .24;
      dummy.position.set(center[0] + Math.cos(angle) * radius, height, center[2] + Math.sin(angle) * radius);
      dummy.rotation.set(Math.sin(i * 3.1) * .72, angle, Math.PI / 2 + Math.sin(i * 2.2) * .68); dummy.scale.set(.65, .60 + random(i) * .9, .65); dummy.updateMatrix(); cutLines.setMatrixAt(i, dummy.matrix);
    }
    cutLines.instanceMatrix.needsUpdate = true;
    const dissolve = finale?.dissolve ?? { style: "shatter", progress: smooth(span(elapsed, 9.3, 12.5)) };
    const bossDissolve = dissolver.update({ actor: defender, style: dissolve.style === "shatter-to-glass" ? "shatter" : dissolve.style, progress: dissolve.progress, quality: tier, center });
    const wave = span(elapsed, 9.3, 12.5); shockwave.visible = act === 4; shockwave.position.set(center[0], .045, center[2]); shockwave.scale.setScalar(.5 + wave * 13); shockwave.material.opacity = .14 * Math.sin(wave * Math.PI);

    puddle.visible = act === 5; puddle.position.set(fighterCenter[0], .027, fighterCenter[2] + 1.0); puddleMaterial.uniforms.puddleCenter.value.copy(puddle.position);
    if (puddleEcho && snapshotPoses.length) {
      const echoLowering = finale?.puddleEcho ?? span(elapsed, 13.1, 13.8), bank = (echoLowering > .5 ? 1 : 7) * 3 + 1;
      puddleEcho.geometry = snapshotPoses[bank]; puddleEcho.position.set(0, .01, -1.0); puddleEcho.rotation.set(0, attacker?.root.rotation.y ?? 0, 0); puddleEcho.scale.set(attacker.root.scale.x, -attacker.root.scale.y, attacker.root.scale.z);
      puddleMaterial.uniforms.strength.value = .16 * (1 - span(elapsed, 14.2, 15));
    }
    const lights = finale?.lights ?? { blackout: 1 - span(elapsed, 9.3, 12.5), relight: span(elapsed, 9.3, 12.5) };
    const postEffects = (frame.fx ?? []).filter(fx => ["HEAT_DISTORT", "LENS_WARP", "IMPACT_FRAME", "CA_PULSE", "SCREEN_RIPPLE"].includes(fx.id)).map(fx => ({ ...fx, opacity: fx.soft ? Math.min(.12, fx.opacity ?? .12) : Math.min(.6, fx.opacity ?? .12) }));
    return { active: true, hideEnvironment: false, world: "arena", act, bossDissolve, lights, postEffects, freezeRain: act <= 4, halo: haloStrength, reflectionCount: 24, reflectionDraws: 1, reflectionContacts, reflectionTextureBytes: reflectionAtlas?.textureBytes ?? 0 };
  }
  reset();
  return { root, update, reset, dispose() { clearSnapshots(); clearBossMirrors(); dissolver.dispose(); root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); scene.remove(root); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
