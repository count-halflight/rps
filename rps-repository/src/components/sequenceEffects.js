import * as THREE from "three";
import { evaluateSequence, sequenceById } from "../game/sequences/index.js";
import { createBatchedActorSlices, createReflectionSnapshots, createActorMirrorAtlas, REFLECTION_POSE_KEYS } from "./finaleActorSnapshots.js";
import { finaleQuality } from "./finaleWorld.js";
import { createSpectralMaterial } from "./spectralMaterial.js";

export const FX_LIBRARY_IDS = Object.freeze(["SHOCKRING", "DUST_RING", "CRACK_DECAL", "SPARKS", "EMBERS", "DEBRIS", "TRAIL_RIBBON", "AFTERIMAGE", "WIND_RIBBON", "SLASH_LINE", "ARC_LIGHTNING", "PRISM_BEAM", "ARROW_TRAIL", "HEAT_DISTORT", "LENS_WARP", "GLASS_SHATTER", "LIGHT_PILLAR", "LIGHT_DRAIN", "IMPACT_FRAME", "CA_PULSE", "SCREEN_RIPPLE"]);
const POST_IDS = new Set(["HEAT_DISTORT", "LENS_WARP", "IMPACT_FRAME", "CA_PULSE", "SCREEN_RIPPLE"]);
const TAU = Math.PI * 2, clamp = v => Math.max(0, Math.min(1, v)), random = i => { const value = Math.sin(i * 127.1 + 99.3) * 43758.5453; return value - Math.floor(value); };
const POSE_MAPPING = { CUT_LEFT: "crossHit", CUT_RIGHT: "reverseCross", CUT_HIGH: "riseCut", CUT_LOW: "lowCut", CROSS_CUT: "crossHit", SPIN_CUT: "stormHit", DRAW_FLASH: "drawHit", DRAW_FOLLOW: "thousandHit", RESHEATH: "lowCut", SHEATH_CLICK: "lowCut" };

export function createSequenceEffects(scene) {
  const root = new THREE.Group(); root.name = "Named sequence effects"; root.visible = false; scene.add(root);
  const geometries = new Set(), materials = new Set(), dummy = new THREE.Object3D();
  const ownGeometry = geometry => (geometries.add(geometry), geometry), ownMaterial = material => (materials.add(material), material);
  const material = (color, opacity = .4) => ownMaterial(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const lineMaterial = material("#83ffd6", .42), particleMaterial = material("#cbffe6", .48), shardMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#a6cbc1", roughness: .18, metalness: .66, transparent: true, opacity: .44, depthWrite: false, side: THREE.FrontSide }));
  const cuts = new THREE.InstancedMesh(ownGeometry(new THREE.CylinderGeometry(.0022, .0044, 1, 4)), lineMaterial, 4000); cuts.name = "Pooled delayed hairline cuts";
  const particles = new THREE.InstancedMesh(ownGeometry(new THREE.IcosahedronGeometry(.023, 0)), particleMaterial, 4000); particles.name = "Pooled sparks and embers";
  const fragments = new THREE.InstancedMesh(ownGeometry(new THREE.BoxGeometry(.032, .008, .23)), shardMaterial, 4000); fragments.name = "Pooled floating cut fragments";
  const rings = new THREE.InstancedMesh(ownGeometry(new THREE.TorusGeometry(1, .012, 5, 48)), material("#c2ffe5", .32), 16); rings.name = "Pooled contact shock rings";
  root.add(cuts, particles, fragments, rings); [cuts, particles, fragments, rings].forEach(mesh => { mesh.frustumCulled = false; mesh.castShadow = false; });
  const worldLinesGeometry = ownGeometry(new THREE.BufferGeometry()); worldLinesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(2048 * 6), 3));
  const worldLines = new THREE.LineSegments(worldLinesGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#89a99b", transparent: true, opacity: .21, depthWrite: false, fog: false }))); worldLines.name = "Pooled wind, drain and arc paths"; worldLines.frustumCulled = false; root.add(worldLines);
  const trailHistories = [[], []];
  const bladeTrails = trailHistories.map((_, index) => {
    const geometry = ownGeometry(new THREE.BufferGeometry()); geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12 * 18), 3)); geometry.setDrawRange(0, 0);
    const trail = new THREE.Mesh(geometry, material("#a5c8bb", .28)); trail.name = `Actual blade ribbon ${index}`; trail.frustumCulled = false; trail.castShadow = false; root.add(trail); return trail;
  });
  const surfaces = new THREE.Group(); surfaces.name = "Reflective cut surfaces"; root.add(surfaces);
  const surfaceMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#aabdc2", metalness: .25, roughness: .62, emissive: "#bacbd0", emissiveIntensity: .20, envMapIntensity: .08, transparent: true, opacity: .25, depthWrite: false, side: THREE.FrontSide }));
  const glassShape = new THREE.Shape(); glassShape.moveTo(-1.1, -.65); glassShape.lineTo(1.1, -.65); glassShape.lineTo(1.1, .30); glassShape.lineTo(0, .87); glassShape.lineTo(-1.1, .30); glassShape.closePath();
  const windowGeometry = ownGeometry(new THREE.ShapeGeometry(glassShape)), puddleGeometry = ownGeometry(new THREE.CircleGeometry(1, 48));
  const uv = windowGeometry.attributes.uv, positions = windowGeometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + 1.1) / 2.2, (positions.getY(i) + .65) / 1.52);
  const reflectedSurfaces = Array.from({ length: 3 }, (_, index) => { const mesh = new THREE.Mesh(index ? windowGeometry : puddleGeometry, surfaceMaterial); surfaces.add(mesh); mesh.name = index ? "Window cut reflection" : "Puddle cut reflection"; return mesh; });
  const sliceRoot = new THREE.Group(); sliceRoot.name = "Actual rival surface slices"; root.add(sliceRoot);
  const sliceMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#9aaca5", roughness: .42, metalness: .40, transparent: true, opacity: .38, depthWrite: false, side: THREE.FrontSide }));
  const sliceDissolve = { value: 0 };
  sliceMaterial.onBeforeCompile = shader => {
    shader.uniforms.sliceDissolve = sliceDissolve;
    shader.vertexShader = `attribute float sliceIndex;uniform float sliceDissolve;
    mat3 bandRotation(float index,float amount){float a=index*2.399;float x=amount*.13,y=amount*(mod(index,2.)*.44-.22),z=amount*sin(a)*.10;
    mat3 rx=mat3(1.,0.,0.,0.,cos(x),sin(x),0.,-sin(x),cos(x));
    mat3 ry=mat3(cos(y),0.,-sin(y),0.,1.,0.,sin(y),0.,cos(y));
    mat3 rz=mat3(cos(z),sin(z),0.,-sin(z),cos(z),0.,0.,0.,1.);return rz*ry*rx;}
    ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal=bandRotation(sliceIndex,sliceDissolve)*objectNormal;");
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    float a=sliceIndex*2.399;float seed=fract(sin(sliceIndex*127.1+99.3)*43758.5453);
    transformed=bandRotation(sliceIndex,sliceDissolve)*transformed+vec3(cos(a)*.9,.25+seed*1.15,sin(a)*.8)*sliceDissolve;`);
  };
  sliceMaterial.customProgramCacheKey = () => "actual-rival-surface-bands-v1";
  const ghostMaterial = ownMaterial(createSpectralMaterial({ maximumAlpha: .14, bodyCoverage: .18, edgeCoverage: .15, strength: .8 }));
  let ghostSource = null, ghostQuality = null, ghostSignature = null, ghostBanks = [], mirrorAtlas = null, sliceSource = null, sliceQuality = null, sliceMesh = null, lastAnimation = null;
  function releaseGhosts() { for (const bank of ghostBanks) { root.remove(bank.mesh); bank.mesh.dispose(); bank.geometry.dispose(); } mirrorAtlas?.dispose(); mirrorAtlas = null; surfaceMaterial.map = surfaceMaterial.emissiveMap = null; surfaceMaterial.needsUpdate = true; ghostBanks = []; ghostSource = null; ghostSignature = null; }
  function prepareGhosts(actor, quality) {
    if (!actor?.root) return;
    const identifiers = []; actor.root.traverse(o => { if (o.geometry) identifiers.push(o.geometry.uuid); }); const signature = identifiers.join("|");
    if (ghostSource === actor.root && ghostQuality === quality && ghostSignature === signature) return;
    releaseGhosts(); ghostSource = actor.root; ghostQuality = quality; ghostSignature = signature;
    ghostBanks = createReflectionSnapshots(actor, quality).map((geometry, index) => { const alpha = new THREE.InstancedBufferAttribute(new Float32Array(16), 1); geometry.setAttribute("ghostAlpha", alpha); const mesh = new THREE.InstancedMesh(geometry, ghostMaterial, 16); mesh.name = `Motion afterimage ${REFLECTION_POSE_KEYS[index]}`; mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; root.add(mesh); return { geometry, mesh, alpha }; });
    mirrorAtlas = createActorMirrorAtlas(ghostBanks.map(bank => bank.geometry)); surfaceMaterial.map = surfaceMaterial.emissiveMap = mirrorAtlas; surfaceMaterial.needsUpdate = true;
  }
  function releaseSlices() { if (sliceMesh) { sliceRoot.remove(sliceMesh); sliceMesh.geometry.dispose(); } sliceMesh = null; sliceSource = null; sliceQuality = null; }
  function prepareSlices(actor, quality) {
    if (!actor?.root || sliceSource === actor.root && sliceQuality === quality) return;
    releaseSlices(); sliceSource = actor.root; sliceQuality = quality;
    actor.root.updateWorldMatrix(true, true); sliceRoot.matrixAutoUpdate = false; sliceRoot.matrix.copy(actor.root.matrixWorld);
    sliceMesh = new THREE.Mesh(createBatchedActorSlices(actor.root, quality === "high" ? 32 : quality === "light" ? 8 : 16), sliceMaterial); sliceMesh.name = "Detached rival surface bands"; sliceMesh.castShadow = false; sliceMesh.frustumCulled = false; sliceRoot.add(sliceMesh);
  }
  function reset() { root.visible = false; ghostBanks.forEach(bank => { bank.mesh.visible = false; }); sliceRoot.visible = false; trailHistories.forEach(history => { history.length = 0; }); }
  function update({ frame, animation, attacker, defender, actorHeight, targetHeight, quality, low = false, reduced = false } = {}) {
    if (!frame?.tier || !Array.isArray(frame.fx) || frame.tier === 5 || frame.progress >= 1 || animation?.outcome === "draw") { reset(); return { active: false, hideEnvironment: false }; }
    root.visible = true; const tier = finaleQuality(quality, low), budget = tier === "high" ? 4000 : tier === "light" ? 300 : 1500;
    const sign = animation?.outcome === "loss" ? -1 : 1, origin = frame.origin ?? 1.6, authoredTime = frame.progress * (animation?.bodyDuration ?? sequenceById(frame.sequenceId)?.duration ?? animation?.duration ?? 1500) / 1000;
    if (lastAnimation !== animation?.id) { lastAnimation = animation?.id; releaseSlices(); trailHistories.forEach(history => { history.length = 0; }); }
    let cutCount = 0, particleCount = 0, fragmentCount = 0, ringCount = 0, lineCount = 0, used = 0;
    ghostBanks.forEach(bank => { bank.mesh.count = 0; bank.mesh.visible = false; }); sliceRoot.visible = false; surfaces.visible = false;
    bladeTrails.forEach(trail => { trail.visible = false; trail.geometry.setDrawRange(0, 0); });
    const accent = animation?.color ?? "#83ffd6"; lineMaterial.color.set(accent); ghostMaterial.uniforms.tint.value.set(accent).lerp(new THREE.Color("#89969d"), .72); particleMaterial.color.set(accent).lerp(new THREE.Color("#ffffff"), .38);
    if (scene.environment && surfaceMaterial.envMap !== scene.environment) { surfaceMaterial.envMap = scene.environment; surfaceMaterial.needsUpdate = true; }
    const target = defender?.root.position.clone() ?? new THREE.Vector3(sign * origin, 0, 0), hero = attacker?.root.position.clone() ?? new THREE.Vector3(-sign * origin, 0, 0);
    const targetScale = defender?.root.scale.y ?? animation?.targetScale ?? 1, actorScale = attacker?.root.scale.y ?? animation?.actorScale ?? 1;
    const victimHeight = targetHeight ?? animation?.targetHeight ?? 1.9 * targetScale, fighterHeight = actorHeight ?? animation?.actorHeight ?? 1.9 * actorScale;
    target.y += victimHeight * .56; hero.y += fighterHeight * .58;
    const buffer = worldLinesGeometry.attributes.position;
    const addLine = (a, b) => { if (lineCount >= 2048) return; buffer.setXYZ(lineCount * 2, ...a); buffer.setXYZ(lineCount * 2 + 1, ...b); lineCount++; };
    const postEffects = [], displayEffects = [...frame.fx];
    // Physical cut scars remain on the glass and paving after the airborne
    // strokes finish. The authored contact/damage clock is unchanged.
    if (frame.sequenceId === "ECHO-SF") {
      const scars = sequenceById(frame.sequenceId)?.beats.flatMap(beat => beat.fx).filter(fx => fx.id === "SLASH_LINE" && fx.reflection).at(-1);
      if (scars && authoredTime >= scars.end) {
        const scarFade = Math.max(0, 1 - (authoredTime - scars.end) / .95);
        if (scarFade > 0) displayEffects.push({ ...scars, marksOnly: true, age: authoredTime - scars.at, phase: 1 - scarFade, opacity: .12 * scarFade });
      }
    }
    surfaceMaterial.opacity = .25;
    for (const fx of displayEffects) {
      const anchor = fx.worldPoint ? new THREE.Vector3(...fx.worldPoint) : fx.anchor === "attacker" || fx.anchor === "weapon" ? hero : target;
      const phase = clamp(fx.phase ?? 0), opacity = Math.min(.6, fx.opacity ?? .4), seed = fx.seed ?? 1, fade = Math.sin(Math.PI * phase) ** .45;
      if (POST_IDS.has(fx.id)) { postEffects.push({ ...fx, opacity: fx.soft ? Math.min(.12, opacity) : opacity }); continue; }
      if (fx.id === "SLASH_LINE") {
        const desired = Math.min(fx.count ?? 1, tier === "light" ? 240 : tier === "medium" ? 1100 : 3000), count = Math.max(0, Math.min(desired, budget - used)); used += count;
        for (let i = 0; i < count; i++) {
          const bodyStroke = fx.reflection && count > 24 && i < 12;
          const bodyFade = bodyStroke ? Math.max(0, 1 - Math.max(0, (fx.age ?? 0) - .16) / .22) : 1;
          if (bodyStroke && (fx.marksOnly || bodyFade <= 0)) continue;
          const a = i * 2.399 + seed * .01, r = count === 1 ? 0 : .10 + random(i + seed) * .44;
          dummy.position.copy(anchor); dummy.position.x += Math.cos(a) * r; dummy.position.z += Math.sin(a) * r * .72; dummy.position.y += count === 1 ? 0 : (random(i + 71) - .5) * 1.15 * targetScale;
          let roll = fx.axis === "vertical" ? 0 : fx.axis === "diagonal-up" ? -.68 : fx.axis === "diagonal-down" ? .68 : fx.axis === "cross" ? (i % 2 ? .78 : -.78) : fx.axis === "horizontal-low" ? Math.PI / 2 : fx.axis === "horizontal" ? Math.PI / 2 : a;
          if (fx.axis === "horizontal-low") dummy.position.y = target.y - .55 * targetScale;
          dummy.rotation.set(Math.sin(a) * .25, Math.cos(a) * .42, roll);
          if (count === 1) { dummy.position.z += Math.max(.16, victimHeight * .16); dummy.rotation.set(0, 0, roll); }
          dummy.scale.set(count === 1 ? 2.1 : 1, count === 1 ? Math.max(1.5, victimHeight * .91) : (.24 + random(i + 31) * .8) * targetScale, count === 1 ? 2.1 : 1); if (bodyStroke) dummy.scale.multiplyScalar(bodyFade); dummy.updateMatrix(); cuts.setMatrixAt(cutCount++, dummy.matrix);
          if (fx.reflection && count > 24 && i >= 12) {
            // Hundreds of late cuts mark the wet arena and mirror props. Keep a
            // dozen readable blade paths on the rival instead of filling their
            // whole body with a vibrating cylinder of subpixel noise.
            if (i % 4 !== 0) {
              const radius = .85 + random(i + seed) * 2.2;
              dummy.position.set(target.x + Math.cos(a) * radius, .037, target.z + Math.sin(a) * radius);
              dummy.rotation.set(Math.PI / 2, 0, a + Math.PI / 2); dummy.scale.set(.65, .10 + random(i + 47) * .40, .65);
            } else {
              const side = i % 8 ? 1 : -1;
              dummy.position.set(sign * (side < 0 ? -3.3 : 4.5) + (random(i + 41) - .5) * 1.65, side < 0 ? 2.6 : 3.0, -2.655);
              dummy.position.y += (random(i + 69) - .5) * .90; dummy.rotation.set(0, 0, roll); dummy.scale.set(.65, .10 + random(i + 47) * .38, .65);
            }
            dummy.updateMatrix(); cuts.setMatrixAt(cutCount - 1, dummy.matrix);
          }
        }
        lineMaterial.opacity = Math.min(.5, opacity) * (count === 1 ? 1 - phase * .45 : .45 + fade * .55);
        if (fx.reflection) {
          prepareGhosts(attacker, tier);
          const mirrorPose = Math.max(0, REFLECTION_POSE_KEYS.indexOf(POSE_MAPPING[frame.attacker?.poseId] ?? "drawHit")); mirrorAtlas.offset.x = mirrorPose / 8;
          surfaces.visible = true;
          if (fx.marksOnly) surfaceMaterial.opacity = .12 * (1 - phase);
          reflectedSurfaces.forEach((surface, i) => {
            surface.position.set(i ? sign * (i === 1 ? -3.3 : 4.5) : target.x - .4, i ? 2.2 + i * .4 : .035, i ? -2.7 : 1.8);
            surface.rotation.set(i ? 0 : -Math.PI / 2, 0, 0); surface.scale.set(i ? 1 : 1.25, i ? 1 : .8, 1);
            for (let j = 0; j < 8; j++) addLine([surface.position.x - .85 + j * .05, surface.position.y + (i ? -.3 + j * .08 : .009), surface.position.z + .04], [surface.position.x + .85, surface.position.y + (i ? .22 - j * .04 : .009), surface.position.z + (i ? .04 : .65)]);
          });
        }
      } else if (["SPARKS", "EMBERS", "DUST_RING", "DEBRIS", "GLASS_SHATTER"].includes(fx.id)) {
        const sliceFragments = fx.style === "slices", fragmentFade = sliceFragments ? Math.max(0, 1 - Math.max(0, (fx.age ?? 0) - .18) / .45) : 1;
        const count = fragmentFade <= 0 ? 0 : Math.max(0, Math.min(fx.count ?? (fx.id === "DUST_RING" ? 32 : 24), budget - used)); used += count;
        const debris = fx.id === "DEBRIS" || fx.id === "GLASS_SHATTER", pool = debris ? fragments : particles;
        for (let i = 0; i < count; i++) {
          const a = i * 2.399 + seed * .03, speed = .6 + random(i + seed) * 2.3, age = fx.age ?? phase * .4;
          dummy.position.copy(anchor); dummy.position.x += Math.cos(a) * age * speed; dummy.position.z += Math.sin(a) * age * speed;
          dummy.position.y += fx.id === "DUST_RING" ? -anchor.y + .06 + phase * .22 : age * (1.2 + random(i + 51) * 1.7) - age * age * (debris ? .15 : 2.2);
          dummy.rotation.set(a + phase, a * .7, phase * 2.4); const size = .3 + random(i + 17) * .9;
          dummy.scale.setScalar(size * (debris ? 1.2 : .5 + fade)); if (fx.style === "slices") dummy.scale.set(.6, .6, .5 + phase * .8);
          dummy.updateMatrix(); pool.setMatrixAt(debris ? fragmentCount++ : particleCount++, dummy.matrix);
        }
        particleMaterial.opacity = Math.min(.5, opacity) * (1 - phase * .8); shardMaterial.opacity = Math.min(.5, opacity) * (1 - phase * .55) * fragmentFade;
        if (fx.style === "slices" && defender) {
          prepareSlices(defender, tier); sliceRoot.visible = true; const dissolve = frame.dissolve?.progress ?? phase;
          sliceDissolve.value = dissolve;
          sliceMaterial.opacity = .38 * (1 - dissolve * .7);
        }
      } else if (fx.id === "SHOCKRING" && ringCount < 16) {
        dummy.position.copy(anchor); dummy.rotation.set(fx.anchor === "floor" ? Math.PI / 2 : 0, .18 * sign, 0); dummy.scale.setScalar((fx.size ?? .7) * (.1 + phase * 1.45)); dummy.updateMatrix(); rings.setMatrixAt(ringCount++, dummy.matrix); rings.material.opacity = opacity * (1 - phase);
      } else if (fx.id === "TRAIL_RIBBON") {
        const seconds = frame.unscaledSeconds ?? authoredTime, segments = attacker?.weaponSegments?.() ?? [];
        bladeTrails.forEach((trail, index) => {
          const history = trailHistories[index], segment = segments[index];
          if (!segment) { history.length = 0; return; }
          // A discontinuous seek never becomes a giant triangle across the arena.
          if (history.length && (seconds < history.at(-1).time || seconds - history.at(-1).time > .16)) history.length = 0;
          while (history.length && seconds - history[0].time > .16) history.shift();
          const sample = { time: seconds, segment: segment.map(point => point.clone()) };
          if (history.length && history.at(-1).time === seconds) history[history.length - 1] = sample; else history.push(sample);
          if (history.length > 13) history.shift();
          const positions = trail.geometry.attributes.position; let vertex = 0;
          for (let j = 1; j < history.length; j++) {
            const [base, tip] = history[j - 1].segment, [nextBase, nextTip] = history[j].segment;
            for (const point of [base, tip, nextTip, base, nextTip, nextBase]) positions.setXYZ(vertex++, point.x, point.y, point.z);
          }
          trail.visible = vertex > 0; trail.geometry.setDrawRange(0, vertex); positions.needsUpdate = true; trail.material.color.set(accent); trail.material.opacity = Math.min(.34, opacity);
        });
      } else if (fx.id === "AFTERIMAGE" && attacker) {
        prepareGhosts(attacker, tier); ghostBanks.forEach(bank => { bank.mesh.count = 0; bank.mesh.visible = true; });
        for (let i = 0; i < Math.min(fx.count ?? 6, 12); i++) {
          const past = Math.max(0, authoredTime - .035 - i * .024), sample = evaluateSequence(frame.sequenceId, past, { actorScale, targetScale, outcome: animation?.outcome, finalHit: animation?.finalHit });
          const poseKey = POSE_MAPPING[sample.attacker.poseId] ?? "drawHit", bank = ghostBanks[REFLECTION_POSE_KEYS.indexOf(poseKey)]; if (!bank) continue;
          const instance = bank.mesh.count++;
          dummy.position.set(sign * (-origin + sample.attacker.x), sample.attacker.y, sample.attacker.z); dummy.rotation.set(0, sign * Math.PI / 2 + (sample.attacker.yaw ?? 0) * sign, sample.attacker.roll ?? 0); dummy.scale.copy(attacker.root.scale); dummy.updateMatrix(); bank.mesh.setMatrixAt(instance, dummy.matrix);
          bank.alpha.setX(instance, Math.min(.24, opacity) * (1 - i / Math.max(1, Math.min(fx.count ?? 6, 12))) ** 1.2);
        }
        ghostBanks.forEach(bank => { bank.mesh.instanceMatrix.needsUpdate = true; bank.alpha.needsUpdate = true; }); ghostMaterial.uniforms.strength.value = .72 + fade * .16;
      } else {
        const count = fx.id === "LIGHT_DRAIN" ? tier === "light" ? 24 : 48 : fx.id === "ARC_LIGHTNING" ? 22 : 32;
        for (let i = 0; i < count; i++) {
          const u = i / count, next = (i + 1) / count, angle = u * TAU * 1.6 + phase * 3, nextAngle = next * TAU * 1.6 + phase * 3;
          if (fx.id === "LIGHT_DRAIN") {
            const a = i * 2.399, flow = (random(i) + phase * 1.4) % 1, distance = 3.3 * (1 - flow), end = Math.max(0, distance - .28);
            const altitude = anchor.y + Math.sin(a * .7) * (1 - flow) * 1.25;
            addLine([anchor.x + Math.cos(a) * distance, altitude, anchor.z + Math.sin(a) * distance], [anchor.x + Math.cos(a + .08) * end, altitude + (anchor.y - altitude) * .15, anchor.z + Math.sin(a + .08) * end]);
          }
          else if (fx.id === "CRACK_DECAL") { const a = i * 2.399, distance = .3 + phase * 2; addLine([target.x + Math.cos(a) * .2, .025, target.z + Math.sin(a) * .2], [target.x + Math.cos(a) * distance, .025, target.z + Math.sin(a) * distance]); }
          else if (fx.id === "ARC_LIGHTNING") { addLine([anchor.x + Math.sin(i * 7.3) * .25, anchor.y + u * 3, anchor.z], [anchor.x + Math.sin((i + 1) * 7.3) * .25, anchor.y + next * 3, anchor.z]); }
          else if (fx.id === "PRISM_BEAM" || fx.id === "ARROW_TRAIL" || fx.id === "LIGHT_PILLAR") { addLine(fx.id === "LIGHT_PILLAR" ? [anchor.x, .03, anchor.z] : hero.toArray(), fx.id === "LIGHT_PILLAR" ? [anchor.x, 6, anchor.z] : target.toArray()); }
          else { const radius = fx.id === "WIND_RIBBON" ? 1.7 : .75; addLine([anchor.x + Math.cos(angle) * radius, anchor.y + Math.sin(angle * .6) * .7, anchor.z + Math.sin(angle) * radius], [anchor.x + Math.cos(nextAngle) * radius, anchor.y + Math.sin(nextAngle * .6) * .7, anchor.z + Math.sin(nextAngle) * radius]); }
        }
      }
    }
    if (!frame.fx.some(fx => fx.id === "TRAIL_RIBBON")) trailHistories.forEach(history => { history.length = 0; });
    cuts.count = cutCount; particles.count = particleCount; fragments.count = fragmentCount; rings.count = ringCount;
    [cuts, particles, fragments, rings].forEach(mesh => { mesh.visible = mesh.count > 0; mesh.instanceMatrix.needsUpdate = true; });
    worldLines.visible = lineCount > 0; worldLinesGeometry.setDrawRange(0, lineCount * 2); buffer.needsUpdate = true;
    return { active: true, hideEnvironment: false, world: "arena", lights: frame.lights, postEffects, particleCount: used, particleBudget: budget, counter: frame.counter, dissolve: frame.dissolve, defenderOpacity: frame.defender?.opacity ?? 1 };
  }
  return { root, update, reset, dispose() { releaseGhosts(); releaseSlices(); root.traverse(object => { if (object.isInstancedMesh) object.dispose(); }); scene.remove(root); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
