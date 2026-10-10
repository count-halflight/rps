import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
const axisX = new THREE.Vector3(1, 0, 0),
  axisZ = new THREE.Vector3(0, 0, 1);
export function createRiggedFighter(
  gltf,
  accent = "#83ffd6",
  style = "blades",
) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    model = clone(gltf.scene);
  root.add(body);
  body.add(model);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  model.updateMatrixWorld(true);
  const bone = (name) => model.getObjectByName(name.replaceAll(".", "")),
    arms = [bone("upperarm01.L"), bone("upperarm01.R")],
    elbows = [bone("lowerarm01.L"), bone("lowerarm01.R")],
    legs = [bone("upperleg01.L"), bone("upperleg01.R")],
    hands = [bone("wrist.L"), bone("wrist.R")],
    head = bone("head");
  const controls = [...arms, ...elbows, ...legs, head],
    base = new Map(controls.map((b) => [b, b.quaternion.clone()]));
  const drops = arms.map((arm, i) => {
    const start = arm.getWorldPosition(new THREE.Vector3()),
      end = elbows[i].getWorldPosition(new THREE.Vector3()),
      d = end.sub(start);
    let a = -Math.PI / 2 - Math.atan2(d.y, d.x);
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  });
  const steel = new THREE.MeshStandardMaterial({
      color: "#70797c",
      metalness: 0.7,
      roughness: 0.32,
    }),
    glow = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.8,
      roughness: 0.45,
    });
  const gear = { rock: [], paper: [], scissors: [] };
  const add = (parent, geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  hands.forEach((hand) => {
    const rock = new THREE.Group();
    hand.add(rock);
    gear.rock.push(rock);
    add(
      rock,
      new THREE.BoxGeometry(0.11, 0.065, 0.045),
      steel,
      [0, 0.115, 0.015],
    );
    for (let i = 0; i < 3; i++)
      add(rock, new THREE.BoxGeometry(0.027, 0.023, 0.017), glow, [
        (i - 1) * 0.035,
        0.147,
        0.028,
      ]);
    const blade = new THREE.Group();
    hand.add(blade);
    gear.scissors.push(blade);
    add(
      blade,
      new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10),
      steel,
      [0, 0.04, 0],
    );
    add(blade, new THREE.BoxGeometry(0.19, 0.018, 0.035), steel, [0, -0.04, 0]);
    const katana = add(
      blade,
      new THREE.ConeGeometry(0.033, 0.85, 3),
      glow,
      [0, -0.48, 0],
    );
    katana.rotation.z = Math.PI;
    const field = new THREE.Group();
    hand.add(field);
    gear.paper.push(field);
    add(
      field,
      new THREE.TorusGeometry(0.16, 0.007, 4, 36),
      glow,
      [0, 0.1, 0.09],
    );
  });
  Object.values(gear)
    .flat()
    .forEach((g) => (g.visible = false));
  const kit = new THREE.Group();
  hands[0].add(kit);
  if (style === "blades") {
    gear.scissors.forEach((g) => (g.visible = true));
  } else if (style === "brawler") {
    gear.rock.forEach((g) => {
      g.visible = true;
      g.scale.setScalar(1.7);
    });
  } else if (style === "mage" || style === "glaive") {
    add(
      kit,
      new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10),
      steel,
      [0, -0.15, 0],
    );
    if (style === "mage") {
      const crystal = add(
        kit,
        new THREE.OctahedronGeometry(0.14),
        glow,
        [0, 0.89, 0],
      );
      crystal.scale.y = 1.8;
      add(kit, new THREE.TorusGeometry(0.2, 0.018, 6, 24), steel, [0, 0.85, 0]);
    } else {
      const edge = add(
        kit,
        new THREE.ConeGeometry(0.16, 0.7, 3),
        glow,
        [0, 0.96, 0],
      );
      edge.scale.z = 0.3;
      add(kit, new THREE.BoxGeometry(0.34, 0.04, 0.08), steel, [0, 0.68, 0]);
    }
  } else if (style === "archer") {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI;
      points.push(new THREE.Vector3(Math.cos(a) * 0.32, Math.sin(a) * 0.65, 0));
    }
    add(
      kit,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        24,
        0.025,
        6,
        false,
      ),
      steel,
      [0, 0.05, 0],
    );
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 1.3, 5),
      glow,
    );
    kit.add(string);
    string.position.y = 0.05;
    add(
      kit,
      new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8),
      steel,
      [0, 0.05, 0],
    );
    const shaft = add(
      hands[1],
      new THREE.CylinderGeometry(0.006, 0.006, 0.65, 5),
      steel,
      [0, -0.2, 0],
    );
    shaft.rotation.z = Math.PI / 2;
  }
  // Hands grip their actual weapons instead of remaining in a spread-finger pose.
  model.traverse((b) => {
    if (b.isBone && /^finger[2-5]-[123]/.test(b.name)) b.rotation.x += 0.65;
  });
  function rotate(b, q) {
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion()),
      local = parent.clone().invert().multiply(q).multiply(parent);
    b.quaternion.copy(local.multiply(base.get(b)));
    b.updateWorldMatrix(false, true);
  }
  const qx = (angle) =>
      new THREE.Quaternion().setFromAxisAngle(
        axisX
          .clone()
          .applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())),
        angle,
      ),
    qz = (angle) =>
      new THREE.Quaternion().setFromAxisAngle(
        axisZ
          .clone()
          .applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())),
        angle,
      );
  const pose = (p = {}, time = 0) => {
    body.rotation.set((p.body || 0) * 0.35, 0, p.roll || 0);
    model.updateWorldMatrix(true, true);
    arms.forEach((b, i) =>
      rotate(
        b,
        qx(i === 0 ? (p.armL ?? -0.45) : (p.armR ?? -0.45)).multiply(
          qz(drops[i] + (i === 0 ? 0.08 : -0.08)),
        ),
      ),
    );
    elbows.forEach((b, i) =>
      rotate(b, qx(i === 0 ? (p.elbowL ?? -0.8) : (p.elbowR ?? -0.8))),
    );
    legs.forEach((b, i) =>
      rotate(b, qx(i === 0 ? (p.legL ?? 0.06) : (p.legR ?? -0.06))),
    );
    rotate(
      head,
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.sin(time * 0.8) * 0.04,
      ),
    );
  };
  const setWeapon = (id) => {
    glow.emissiveIntensity = id ? 1.8 : 0.65;
  };
  pose();
  setWeapon("rock");
  return {
    root,
    body,
    head,
    arms,
    elbows,
    legs,
    hands,
    pose,
    setWeapon,
    glow,
    style,
  };
}
