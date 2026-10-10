import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const sphere = new THREE.SphereGeometry(1, 16, 12),
  box = new THREE.BoxGeometry(1, 1, 1),
  cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
function piece(group, material, geometry, pos, scale, rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rotation);
  m.castShadow = true;
  group.add(m);
  return m;
}
function organic(group, material, profile, z = 1) {
  const geo = new THREE.LatheGeometry(
    profile.map(([y, r]) => new THREE.Vector2(r, y)),
    20,
  );
  return piece(group, material, geo, [0, 0, 0], [1, 1, z]);
}
function combine(group) {
  for (const child of [...group.children]) if (child.isGroup) combine(child);
  const batches = new Map();
  for (const child of [...group.children])
    if (child.isMesh && !child.userData.moving) {
      child.updateMatrix();
      const geo = child.geometry.clone().applyMatrix4(child.matrix);
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(geo);
      group.remove(child);
    }
  for (const [material, geos] of batches) {
    const merged = mergeGeometries(
      geos.map((g) => (g.index ? g.toNonIndexed() : g)),
      false,
    );
    const m = new THREE.Mesh(merged, material);
    m.castShadow = true;
    group.add(m);
    geos.forEach((g) => g.dispose());
  }
}
export function createFighter(kind = 0, accent = "#83ffd6") {
  const ronin = kind % 3 === 1,
    bruiser = kind % 3 === 2;
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const skin = mat(ronin ? "#bd8b72" : bruiser ? "#7f503d" : "#d9ab90"),
    coat = mat(ronin ? "#60252d" : bruiser ? "#34302a" : "#1e2527"),
    cloth = mat("#17191e"),
    hair = mat(ronin ? "#c2c4be" : "#101419"),
    boots = mat("#101314", { roughness: 0.43 }),
    bone = mat("#d2c7ae"),
    steel = mat("#76828b", { metalness: 0.8, roughness: 0.28 });
  const glow = mat(accent, {
    emissive: accent,
    emissiveIntensity: 1.5,
    roughness: 0.4,
  });
  organic(
    body,
    cloth,
    [
      [0.82, 0.16],
      [0.95, 0.24],
      [1.11, 0.28],
      [1.2, 0.27],
    ],
    0.68,
  );
  organic(
    body,
    coat,
    [
      [1.09, 0.25],
      [1.27, 0.27],
      [1.42, 0.36],
      [1.65, 0.37],
      [1.76, 0.21],
    ],
    0.61,
  );
  piece(body, skin, sphere, [0, 1.77, 0], [0.105, 0.15, 0.1]);
  piece(body, steel, box, [0, 1.42, 0.225], [0.022, 0.57, 0.022]);
  piece(
    body,
    bone,
    box,
    [-0.18, 1.64, 0.16],
    [0.08, 0.24, 0.045],
    [0, 0, -0.55],
  );
  piece(body, bone, box, [0.18, 1.64, 0.16], [0.08, 0.24, 0.045], [0, 0, 0.55]);
  piece(body, boots, box, [0, 1.09, 0.17], [0.5, 0.07, 0.07]);
  piece(body, steel, box, [0, 1.09, 0.22], [0.1, 0.08, 0.024]);
  for (const s of [-1, 1]) {
    piece(
      body,
      cloth,
      box,
      [s * 0.22, 1.25, 0.18],
      [0.16, 0.13, 0.05],
      [0, 0, s * 0.1],
    );
    piece(
      body,
      glow,
      box,
      [s * 0.29, 1.5, 0.19],
      [0.025, 0.23, 0.022],
      [0, 0, s * -0.2],
    );
  }
  const head = new THREE.Group();
  head.position.y = 1.9;
  body.add(head);
  organic(
    head,
    skin,
    [
      [-0.13, 0.07],
      [-0.08, 0.12],
      [0.04, 0.155],
      [0.16, 0.145],
      [0.22, 0.1],
    ],
    0.82,
  );
  piece(head, skin, sphere, [0, 0.21, -0.012], [0.143, 0.09, 0.123]);
  piece(head, skin, sphere, [0, 0.04, 0.135], [0.035, 0.065, 0.042]);
  const eyes = mat("#f2e3cc"),
    iris = mat("#242321");
  for (const s of [-1, 1]) {
    piece(head, skin, sphere, [s * 0.145, 0.02, 0], [0.023, 0.045, 0.026]);
    piece(head, eyes, sphere, [s * 0.062, 0.088, 0.118], [0.034, 0.012, 0.012]);
    piece(head, iris, sphere, [s * 0.06, 0.088, 0.13], [0.011, 0.012, 0.005]);
    piece(
      head,
      hair,
      box,
      [s * 0.064, 0.118, 0.118],
      [0.074, 0.012, 0.016],
      [0, s * 0.12, s * -0.12],
    );
  }
  piece(
    head,
    mat("#653f37"),
    sphere,
    [0, -0.058, 0.104],
    [0.039, 0.006, 0.009],
  );
  piece(head, hair, sphere, [0, 0.216, -0.02], [0.151, 0.082, 0.137]);
  if (ronin)
    for (let i = 0; i < 9; i++)
      piece(
        head,
        hair,
        new THREE.ConeGeometry(0.039, 0.18, 5),
        [(i - 4) * 0.035, 0.27, -0.015],
        [1, 1, 1],
        [0.25, 0, -0.5 + i / 9],
      );
  else {
    piece(
      head,
      hair,
      sphere,
      [-0.08, 0.18, 0.078],
      [0.102, 0.086, 0.069],
      [0, 0, -0.5],
    );
    piece(head, hair, sphere, [0.11, 0.035, -0.047], [0.045, 0.18, 0.09]);
    piece(head, hair, sphere, [0, 0.04, -0.107], [0.13, 0.17, 0.04]);
  }
  if (bruiser) {
    piece(head, hair, sphere, [0, -0.055, 0.067], [0.12, 0.06, 0.06]);
    piece(body, skin, sphere, [0, 1.63, 0.17], [0.17, 0.12, 0.07]);
  }
  const arms = [],
    elbows = [],
    hands = [],
    legs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.34, 1.62, 0);
    body.add(arm);
    arms.push(arm);
    piece(arm, coat, sphere, [s * 0.01, -0.13, 0], [0.12, 0.21, 0.12]);
    piece(arm, coat, cylinder, [0, -0.24, 0], [0.091, 0.28, 0.088]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.38;
    arm.add(elbow);
    elbows.push(elbow);
    piece(elbow, skin, sphere, [0, -0.12, 0], [0.077, 0.18, 0.078]);
    piece(elbow, boots, cylinder, [0, -0.2, 0], [0.087, 0.17, 0.084]);
    for (let i = 0; i < 4; i++)
      piece(
        elbow,
        bone,
        cylinder,
        [0, -0.15 - i * 0.035, 0],
        [0.09, 0.012, 0.087],
      );
    const hand = new THREE.Group();
    hand.position.y = -0.34;
    elbow.add(hand);
    hands.push(hand);
    piece(hand, skin, sphere, [0, -0.04, 0], [0.077, 0.086, 0.06]);
    for (let i = 0; i < 4; i++)
      piece(
        hand,
        skin,
        sphere,
        [(i - 1.5) * 0.034, -0.097, 0.018],
        [0.02, 0.038, 0.027],
      );
    piece(
      hand,
      skin,
      sphere,
      [s * 0.067, -0.052, 0.017],
      [0.026, 0.045, 0.025],
      [0, 0, s * -0.4],
    );
    const leg = new THREE.Group();
    leg.position.set(s * 0.15, 1.0, 0);
    body.add(leg);
    legs.push(leg);
    piece(leg, cloth, sphere, [0, -0.2, 0], [0.125, 0.27, 0.13]);
    piece(leg, cloth, cylinder, [0, -0.38, 0], [0.095, 0.33, 0.1]);
    piece(leg, boots, cylinder, [0, -0.72, 0], [0.088, 0.36, 0.085]);
    piece(leg, boots, sphere, [0, -0.95, 0.055], [0.11, 0.07, 0.19]);
    piece(leg, steel, box, [0, -0.57, 0.077], [0.09, 0.07, 0.03]);
    if (ronin) {
      const tail = new THREE.Group();
      tail.position.set(s * 0.18, 1.14, -0.04);
      body.add(tail);
      piece(
        tail,
        coat,
        box,
        [s * 0.06, -0.33, -0.03],
        [0.2, 0.65, 0.06],
        [0.12, 0, s * 0.14],
      );
      legs[s < 0 ? 0 : 1].userData.tail = tail;
    }
  }
  const gear = { rock: [], paper: [], scissors: [] };
  hands.forEach((hand, i) => {
    const r = new THREE.Group();
    hand.add(r);
    gear.rock.push(r);
    piece(r, steel, sphere, [0, -0.04, -0.01], [0.12, 0.12, 0.105]);
    for (let j = 0; j < 3; j++)
      piece(
        r,
        glow,
        box,
        [(j - 1) * 0.056, -0.09, 0.095],
        [0.04, 0.054, 0.025],
      );
    const blade = new THREE.Group();
    hand.add(blade);
    gear.scissors.push(blade);
    piece(blade, steel, cylinder, [0, -0.05, 0], [0.032, 0.26, 0.032]);
    piece(
      blade,
      glow,
      new THREE.ConeGeometry(0.045, 0.86, 3),
      [0, -0.59, 0],
      [1, 1, 1],
      [0, 0, Math.PI],
    );
    piece(blade, steel, box, [0, -0.16, 0], [0.23, 0.024, 0.045]);
    const field = new THREE.Group();
    hand.add(field);
    gear.paper.push(field);
    const ring = piece(
      field,
      glow,
      new THREE.TorusGeometry(0.2, 0.008, 4, 30),
      [0, -0.06, 0.1],
      [1, 1, 1],
    );
    ring.userData.moving = true;
  });
  combine(root);
  const setWeapon = (id) =>
    Object.entries(gear).forEach(([key, parts]) =>
      parts.forEach((p) => (p.visible = key === id)),
    );
  const pose = (p = {}, time = 0) => {
    body.rotation.set(p.body || 0, 0, p.roll || 0);
    head.rotation.y = 0.08 * Math.sin(time * 0.8);
    arms[0].rotation.set(p.armL ?? -0.55, 0, -0.16);
    arms[1].rotation.set(p.armR ?? -0.55, 0, 0.16);
    elbows[0].rotation.x = p.elbowL ?? -1.1;
    elbows[1].rotation.x = p.elbowR ?? -1.1;
    legs[0].rotation.x = p.legL ?? 0.1;
    legs[1].rotation.x = p.legR ?? -0.1;
    legs.forEach((l, i) => {
      if (l.userData.tail)
        l.userData.tail.rotation.x = 0.07 * Math.sin(time * 2 + i);
    });
  };
  pose();
  setWeapon("rock");
  return { root, body, head, arms, elbows, legs, hands, setWeapon, pose, glow };
}
