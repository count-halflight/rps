import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const clamp = value => Math.max(0, Math.min(1, value));
const noise = value => { const n = Math.sin(value * 127.1 + 99.3) * 43758.5453; return n - Math.floor(n); };

// Ancillary events use their own grammar, never an invented attack ID. Five
// shared draws cover physical contacts, items and the two-handed reveal ritual.
export function createSceneMomentEffects(scene) {
  const root = new THREE.Group(); root.name = "Ancillary physical effects"; root.visible = false; scene.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const ownGeometry = geometry => (geometries.add(geometry), geometry), ownMaterial = material => (materials.add(material), material);
  const dummy = new THREE.Object3D(), point = new THREE.Vector3();
  const ringMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: "#a6afa4", transparent: true, opacity: .24, depthWrite: false, fog: true }));
  const rings = new THREE.InstancedMesh(ownGeometry(new THREE.TorusGeometry(1, .008, 5, 64)), ringMaterial, 16); rings.name = "Ancillary shield shock rings";
  const plateShape = new THREE.Shape(); plateShape.moveTo(-.12, -.10); plateShape.lineTo(.07, -.115); plateShape.lineTo(.14, -.025); plateShape.lineTo(.09, .105); plateShape.lineTo(-.07, .12); plateShape.lineTo(-.14, .015); plateShape.closePath();
  const plateGeometry = ownGeometry(new THREE.ExtrudeGeometry(plateShape, { depth: .022, bevelEnabled: true, bevelThickness: .006, bevelSize: .008, bevelSegments: 2, steps: 1 })); plateGeometry.translate(0, 0, -.011);
  const plateMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#545b60", metalness: .78, roughness: .68, transparent: true, opacity: .5, depthWrite: false }));
  const plates = new THREE.InstancedMesh(plateGeometry, plateMaterial, 48); plates.name = "Ancillary broken armour plates";
  const propMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: .58, roughness: .31, transparent: true, opacity: .48, depthWrite: false }));
  const props = new THREE.InstancedMesh(ownGeometry(new RoundedBoxGeometry(1, 1, 1, 2, .12)), propMaterial, 128); props.name = "Ancillary physical item and hand props";
  const dustGeometry = ownGeometry(new THREE.BufferGeometry()); dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(192 * 3), 3)); dustGeometry.setDrawRange(0, 0);
  const size = 32, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1), i = (y * size + x) * 4; pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - r) ** 2)], i); }
  const dustMap = new THREE.DataTexture(pixels, size, size); dustMap.needsUpdate = true; textures.add(dustMap);
  const dustMaterial = ownMaterial(new THREE.PointsMaterial({ color: "#8f9699", size: .12, map: dustMap, transparent: true, opacity: .22, depthWrite: false, fog: true }));
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.name = "Ancillary landing dust";
  const sparkGeometry = ownGeometry(new THREE.BufferGeometry()); sparkGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(512 * 6), 3)); sparkGeometry.setDrawRange(0, 0);
  const sparkMaterial = ownMaterial(new THREE.LineBasicMaterial({ color: "#bd9c67", transparent: true, opacity: .4, depthWrite: false, fog: true }));
  const sparks = new THREE.LineSegments(sparkGeometry, sparkMaterial); sparks.name = "Ancillary shield edge sparks";
  root.add(rings, plates, dust, sparks, props); root.children.forEach(object => { object.frustumCulled = false; object.castShadow = false; });
  let momentId = null, lastTime = -1; const emitters = new Map();
  function reset() { root.visible = false; root.children.forEach(object => { object.visible = false; }); momentId = null; lastTime = -1; emitters.clear(); }
  function anchorFor(fx, actor, height) {
    if (fx.worldPoint) return new THREE.Vector3(...fx.worldPoint);
    const position = actor.root.getWorldPosition(new THREE.Vector3());
    if (fx.anchor === "feet" || fx.anchor === "floor") { position.y = .045; return position; }
    if (fx.anchor === "shield") {
      const shield = actor.root.getObjectByName("Bulwark shield slit") ?? actor.root.getObjectByName("Bulwark tower shield");
      if (shield) return shield.getWorldPosition(position);
    }
    if (fx.anchor === "hands" && actor.hands?.length) {
      position.set(0, 0, 0); let count = 0;
      for (const hand of actor.hands) if (hand?.getWorldPosition) { position.add(hand.getWorldPosition(point)); count++; }
      if (count) return position.divideScalar(count);
    }
    position.y += height * .58; return position;
  }
  function update({ frame, actor, player, enemy, quality = "medium", low = false, reduced = false } = {}) {
    actor ??= player ?? enemy;
    if (!frame?.momentId || frame.finished || !actor?.root || !Array.isArray(frame.fx)) { reset(); return { active: false, hideEnvironment: false }; }
    const time = frame.time ?? frame.unscaledSeconds ?? 0;
    if (momentId !== frame.momentId || time < lastTime) { emitters.clear(); momentId = frame.momentId; } lastTime = time;
    actor.root.updateWorldMatrix(true, true); root.visible = true;
    const tier = low || quality === "light" ? "light" : quality, dustLimit = tier === "high" ? 96 : tier === "light" ? 32 : 64;
    const modelHeight = actor.standingHeight * actor.root.scale.y;
    const height = frame.actorHeight ?? (Number.isFinite(modelHeight) ? modelHeight : 2.2);
    let ringCount = 0, plateCount = 0, dustCount = 0, sparkCount = 0, propCount = 0;
    ringMaterial.color.set("#a6afa4"); ringMaterial.opacity = .24; dustMaterial.color.set("#8f9699"); dustMaterial.opacity = .22; dustMaterial.size = .12; sparkMaterial.color.set("#bd9c67"); sparkMaterial.opacity = .4;
    const addLine = (from, to) => { if (sparkCount >= 512) return; sparkGeometry.attributes.position.setXYZ(sparkCount * 2, ...from); sparkGeometry.attributes.position.setXYZ(sparkCount * 2 + 1, ...to); sparkCount++; };
    const addProp = (position, scale, rotation = [0, 0, 0], color = "#c8b27f") => {
      if (propCount >= 128) return; dummy.position.fromArray(position); dummy.scale.fromArray(scale); dummy.rotation.fromArray([...rotation, "XYZ"]); dummy.updateMatrix(); props.setMatrixAt(propCount, dummy.matrix); props.setColorAt(propCount++, new THREE.Color(color));
    };
    const addRing = (position, radius, rotation = [0, 0, 0], color = "#a6afa4") => {
      if (ringCount >= 16) return; dummy.position.fromArray(position); dummy.rotation.fromArray([...rotation, "XYZ"]); dummy.scale.setScalar(radius); dummy.updateMatrix(); rings.setMatrixAt(ringCount, dummy.matrix); rings.setColorAt(ringCount++, new THREE.Color(color));
    };
    const handShape = (anchor, hand, strength, crack = 0, bounce = 0) => {
      const x = anchor.x, y = anchor.y + bounce * .09, z = anchor.z + .22, color = strength > .2 ? "#b8ba83" : "#859394";
      const s = .65 + strength * .10;
      addProp([x, y, z], [.18 * s, .18 * s, .065], [0, 0, -.12], color);
      const raised = hand === "paper" ? 4 : hand === "scissors" ? 2 : 0;
      for (let finger = 0; finger < 4; finger++) {
        const offset = (finger - 1.5) * .049 * s, length = finger < raised ? .15 * s : .052 * s, spread = hand === "scissors" && finger < 2 ? (finger ? -.25 : .25) : .025 * (finger - 1.5);
        const chip = crack * (finger % 2 ? 1 : -1) * .03;
        addProp([x + offset + chip, y + .11 * s + length / 2, z + (finger < raised ? 0 : .043)], [.037 * s, length, .046], [0, 0, spread + crack * .15], color);
        if (crack > .05) addLine([x + offset - .025, y + .08, z + .025], [x + offset + .027, y + .16 + finger * .013, z + .033]);
      }
      addProp([x - .10 * s, y + .025, z + .027], [.045, .095 * s, .045], [0, 0, -.6], color);
    };
    for (const fx of frame.fx) {
      if (!["SHOCKRING", "DUST_RING", "SPARKS", "EMBERS", "DEBRIS", "TRINITY_RINGS", "HAND_TOTEM", "INJECTOR", "WIND_RIBBON", "FROST_CREEP", "LIGHT_DRAIN", "CHARGE_CELL", "SCAN_LINE", "HAND_GLYPH", "PRISM_BEAM"].includes(fx.id)) continue;
      if (fx.id === "DEBRIS" && !["armour", "single-plate"].includes(fx.style)) continue;
      const sourceActor = fx.side === "enemy" ? enemy ?? actor : fx.side === "player" ? player ?? actor : actor;
      const key = `${fx.id}:${fx.at}:${fx.style ?? ""}:${fx.side ?? ""}`;
      let emitter = emitters.get(key);
      if (!emitter) {
        const anchor = anchorFor(fx, sourceActor, frame[fx.side]?.height ?? height), plateOrigins = [];
        if (fx.id === "DEBRIS") sourceActor.root.traverse(object => { if (Number.isInteger(object.userData.armourPlate)) plateOrigins.push(object.getWorldPosition(new THREE.Vector3())); });
        emitter = { anchor, plateOrigins }; emitters.set(key, emitter);
      }
      const age = Math.max(0, fx.age ?? time - fx.at), phase = clamp(fx.phase ?? age / Math.max(.01, fx.end - fx.at)), seed = (fx.at ?? 0) * 117, opacity = Math.min(.6, fx.opacity ?? .4);
      const ballistic = ["DEBRIS", "SPARKS", "EMBERS", "DUST_RING"].includes(fx.id), anchor = fx.worldPoint && !ballistic ? new THREE.Vector3(...fx.worldPoint) : emitter.anchor;
      if (fx.id === "TRINITY_RINGS") {
        for (let i = 0; i < 3; i++) addRing([anchor.x, anchor.y, anchor.z + i * .01], .19 + i * .085 + (fx.ringPulses?.[i] ?? 0) * .06, [0, 0, time * .08 * (i % 2 ? 1 : -1)], i === 1 ? "#929ba6" : "#b4b08a");
        ringMaterial.opacity = .18 + Math.max(0, ...(fx.ringPulses ?? [])) * .10;
      } else if (fx.id === "HAND_TOTEM" || fx.id === "HAND_GLYPH") {
        const revealed = fx.id !== "HAND_TOTEM" || !frame.reveal || frame.reveal.playerHand !== null;
        if (fx.hand && revealed) handShape(anchor, fx.hand, fx.ignite ?? fx.print ?? 0, fx.crack ?? 0, fx.bounce ?? 0);
      } else if (fx.id === "INJECTOR") {
        const z = anchor.z + .20, angle = -.35;
        addProp([anchor.x, anchor.y, z], [.055, .23, .055], [0, 0, angle], "#97a6aa");
        addProp([anchor.x + .025, anchor.y + .067, z + .024], [.026, .10 * (1 - phase) + .018, .021], [0, 0, angle], "#68b68a");
        addProp([anchor.x - .050, anchor.y - .126, z], [.010, .10, .010], [0, 0, angle], "#c7d0cc");
        addProp([anchor.x + .049, anchor.y + .128, z], [.095, .025, .052], [0, 0, angle], "#68747a");
      } else if (fx.id === "CHARGE_CELL") {
        const z = anchor.z + .20, fill = clamp(fx.fill ?? phase);
        addProp([anchor.x, anchor.y, z], [.115, .25, .052], [0, 0, -.12], "#566269");
        addProp([anchor.x + .014, anchor.y + .139, z], [.057, .021, .041], [0, 0, -.12], "#b49f73");
        for (let i = 0; i < 6; i++) if (fill > i / 6) addProp([anchor.x - .012 + i * .004, anchor.y - .094 + i * .037, z + .037], [.077 * Math.min(1, (fill - i / 6) * 6), .021, .012], [0, 0, -.12], "#80c3a7");
      } else if (fx.id === "SCAN_LINE") {
        const half = (fx.width ?? .9) * .5, z = anchor.z + .30;
        addLine([anchor.x - half, anchor.y, z], [anchor.x + half, anchor.y, z]);
        addLine([anchor.x - half, anchor.y - .045, z], [anchor.x - half, anchor.y + .045, z]); addLine([anchor.x + half, anchor.y - .045, z], [anchor.x + half, anchor.y + .045, z]);
        sparkMaterial.color.set(fx.color ?? "#83d9d1"); sparkMaterial.opacity = Math.min(.4, opacity);
      } else if (fx.id === "WIND_RIBBON" && fx.style === "vent-steam") {
        const count = Math.min(dustLimit, 192 - dustCount);
        for (let i = 0; i < count; i++) { const u = (noise(i + seed) + phase * 1.7) % 1, side = i % 2 ? 1 : -1;
          dustGeometry.attributes.position.setXYZ(dustCount++, anchor.x + side * (.25 + u * .40) + Math.sin(u * 6 + i) * .08, anchor.y + u * .7 + Math.sin(i * 2.4) * .1, anchor.z + .15 + Math.sin(u * 4 + i) * .10); }
        dustMaterial.color.set("#96b3b9"); dustMaterial.opacity = Math.min(.22, opacity) * Math.sin(phase * Math.PI); dustMaterial.size = .14;
      } else if (fx.id === "FROST_CREEP") {
        const bodyHeight = frame[fx.side]?.height ?? height, radius = .22;
        for (let i = 0; i < 24; i++) { const a = i * 2.399, y = anchor.y - .35 + noise(i) * .70, crawl = .035 + phase * .10;
          addLine([anchor.x + Math.cos(a) * radius, y, anchor.z + .22], [anchor.x + Math.cos(a) * radius + Math.sin(a) * crawl, Math.min(bodyHeight * .83, y + crawl), anchor.z + .235]); }
        sparkMaterial.color.set("#9fc4cb"); sparkMaterial.opacity = Math.min(.3, opacity) * Math.sin(phase * Math.PI);
      } else if (fx.id === "LIGHT_DRAIN" && fx.axis === "charge-cell") {
        for (let i = 0; i < 20; i++) { const a = i * 2.399, u = (noise(i) + phase) % 1, r = .16 + (1 - u) * .55, r2 = Math.max(.12, r - .035);
          addLine([anchor.x + Math.cos(a) * r, anchor.y + Math.sin(a) * r * .45, anchor.z + .18], [anchor.x + Math.cos(a) * r2, anchor.y + Math.sin(a) * r2 * .45, anchor.z + .20]); }
        sparkMaterial.color.set("#80b79f"); sparkMaterial.opacity = Math.min(.3, opacity);
      } else if (fx.id === "PRISM_BEAM" && fx.style === "barrier") {
        const radius = .34, z = anchor.z + .19;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = (i + 1) / 6 * Math.PI * 2; addLine([anchor.x + Math.cos(a) * radius, anchor.y + Math.sin(a) * radius, z], [anchor.x + Math.cos(b) * radius, anchor.y + Math.sin(b) * radius, z]); }
        sparkMaterial.color.set("#a8b6bf"); sparkMaterial.opacity = opacity;
      } else if (fx.id === "SHOCKRING" && ringCount < 16) {
        dummy.position.copy(anchor); const ground = fx.anchor === "feet" || fx.anchor === "floor"; dummy.rotation.set(ground ? Math.PI / 2 : 0, 0, 0);
        if (fx.axis === "body-rise") { dummy.position.y += phase * (fx.rise ?? height); dummy.rotation.set(Math.PI / 2, 0, 0); }
        dummy.scale.setScalar((fx.size ?? 1) * (.12 + phase * 1.35)); dummy.updateMatrix(); rings.setMatrixAt(ringCount, dummy.matrix); rings.setColorAt(ringCount++, new THREE.Color(fx.color ?? "#a6afa4")); ringMaterial.opacity = Math.min(.26, opacity) * (1 - phase);
      } else if (fx.id === "DUST_RING") {
        const origins = fx.worldPoints?.length ? fx.worldPoints.map(value => new THREE.Vector3(...value)) : [anchor];
        const count = Math.min(dustLimit * origins.length, fx.worldPoints ? dustLimit * origins.length : fx.count ?? dustLimit, 192 - dustCount), radius = fx.size ?? 1;
        for (let i = 0; i < count; i++) {
          const from = origins[i % origins.length], angle = i * 2.399, r = radius * (.22 + phase * (.8 + noise(i + seed) * .6));
          dustGeometry.attributes.position.setXYZ(dustCount++, from.x + Math.cos(angle) * r, .045 + (.035 + noise(i + 51) * .24) * Math.sin(phase * Math.PI), from.z + Math.sin(angle) * r);
        }
        dustMaterial.opacity = Math.min(.24, opacity) * (1 - phase * .8); dustMaterial.size = (reduced ? .10 : .13) + phase * .16;
      } else if (fx.id === "SPARKS" || fx.id === "EMBERS") {
        const count = Math.min(fx.count ?? 24, 96 - sparkCount);
        for (let i = 0; i < count; i++) {
          const angle = i * 2.399 + seed, velocity = .8 + noise(i + seed) * 2.1, vx = Math.cos(angle) * velocity, vz = Math.sin(angle) * velocity, vy = .5 + noise(i + 71) * 2;
          const x = anchor.x + vx * age, y = Math.max(.04, anchor.y + vy * age - 4.9 * age * age), z = anchor.z + vz * age, tail = .016 + noise(i + 17) * .035;
          sparkGeometry.attributes.position.setXYZ(sparkCount * 2, x, y, z); sparkGeometry.attributes.position.setXYZ(sparkCount * 2 + 1, x - vx * tail, Math.max(.035, y - (vy - 9.8 * age) * tail), z - vz * tail); sparkCount++;
        }
        sparkMaterial.color.set(fx.id === "EMBERS" ? "#bb6e39" : "#bd9c67"); sparkMaterial.opacity = Math.min(.45, opacity) * (1 - phase);
      } else if (fx.id === "DEBRIS") {
        const count = Math.min(fx.count ?? 18, 48 - plateCount);
        for (let i = 0; i < count; i++) {
          const from = fx.style === "single-plate" || !emitter.plateOrigins.length ? anchor : emitter.plateOrigins[Math.floor(i / 3) % emitter.plateOrigins.length];
          const angle = i * 2.399 + seed * .01, speed = .6 + noise(i + seed) * 1.4, vy = .8 + noise(i + 71) * 1.1;
          dummy.position.set(from.x + Math.cos(angle) * speed * age, Math.max(.035, from.y + vy * age - 4.9 * age * age), from.z + Math.sin(angle) * speed * age);
          const landed = dummy.position.y <= .036, tumble = age * (1.3 + noise(i + 47) * 2.5);
          dummy.rotation.set(landed ? Math.PI / 2 : tumble, angle + tumble * .4, landed ? angle : tumble * .6); dummy.scale.setScalar(.4 + noise(i + 31) * .75);
          dummy.updateMatrix(); plates.setMatrixAt(plateCount++, dummy.matrix);
        }
        plateMaterial.opacity = Math.min(.5, opacity) * (1 - phase ** 3);
      }
    }
    rings.count = ringCount; rings.visible = ringCount > 0; rings.instanceMatrix.needsUpdate = true;
    plates.count = plateCount; plates.visible = plateCount > 0; plates.instanceMatrix.needsUpdate = true;
    props.count = propCount; props.visible = propCount > 0; props.instanceMatrix.needsUpdate = true; if (props.instanceColor) props.instanceColor.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    dust.visible = dustCount > 0; dustGeometry.setDrawRange(0, dustCount); dustGeometry.attributes.position.needsUpdate = true;
    sparks.visible = sparkCount > 0; sparkGeometry.setDrawRange(0, sparkCount * 2); sparkGeometry.attributes.position.needsUpdate = true;
    return { active: true, hideEnvironment: false, world: "arena", particleCount: plateCount + dustCount + sparkCount + propCount, particleBudget: tier === "high" ? 4000 : tier === "light" ? 300 : 1500, lights: frame.lights, momentId: frame.momentId };
  }
  reset();
  return { root, update, reset, dispose() { rings.dispose(); plates.dispose(); props.dispose(); root.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose()); } };
}
