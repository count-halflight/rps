import * as THREE from "three";
function plateGeometry(w, h, d, bevel = 0.025) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + bevel, -h / 2);
  shape.lineTo(w / 2 - bevel, -h / 2);
  shape.lineTo(w / 2, -h / 2 + bevel);
  shape.lineTo(w / 2, h / 2 - bevel);
  shape.lineTo(w / 2 - bevel, h / 2);
  shape.lineTo(-w / 2 + bevel, h / 2);
  shape.lineTo(-w / 2, h / 2 - bevel);
  shape.lineTo(-w / 2, -h / 2 + bevel);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel / 2,
    bevelThickness: bevel / 2,
  });
  geo.translate(0, 0, -d / 2);
  return geo;
}
export function createMech(color, enemy = false) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const surface = document.createElement("canvas");
  surface.width = surface.height = 256;
  const paint = surface.getContext("2d");
  paint.fillStyle = "#9da39f";
  paint.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const shade = 105 + Math.random() * 90;
    paint.fillStyle = `rgba(${shade},${shade},${shade},.12)`;
    paint.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 2,
      1,
    );
  }
  for (let i = 0; i < 160; i++) {
    paint.strokeStyle = i % 3 ? "#696f6b22" : "#dde0d144";
    paint.lineWidth = 0.5;
    paint.beginPath();
    const x = Math.random() * 256,
      y = Math.random() * 256;
    paint.moveTo(x, y);
    paint.lineTo(x + Math.random() * 30, y + Math.random() * 3);
    paint.stroke();
  }
  const wear = new THREE.CanvasTexture(surface);
  wear.colorSpace = THREE.SRGBColorSpace;
  wear.wrapS = wear.wrapT = THREE.RepeatWrapping;
  const metal = new THREE.MeshStandardMaterial({
    color: enemy ? "#29343a" : "#35484b",
    map: wear,
    bumpMap: wear,
    bumpScale: 0.008,
    metalness: 0.82,
    roughness: 0.34,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#0d161a",
    metalness: 0.75,
    roughness: 0.45,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: "#687c81",
    metalness: 0.95,
    roughness: 0.24,
  });
  const glow = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.7,
    metalness: 0.4,
    roughness: 0.3,
  });
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const plate = (w, h, d, mat, parent, x, y, z) =>
    mesh(plateGeometry(w, h, d), mat, parent, x, y, z);
  const bolt = (parent, x, y, z) => {
    const b = mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 0.018, 6),
      silver,
      parent,
      x,
      y,
      z,
    );
    b.rotation.x = Math.PI / 2;
  };
  // Segmented, machined armor over a visible articulated chassis.
  plate(0.64, 0.72, 0.39, dark, body, 0, 1.94, 0);
  const chest = plate(0.7, 0.47, 0.27, metal, body, 0, 2.07, 0.18);
  chest.rotation.x = -0.13;
  for (const s of [-1, 1]) {
    const pec = plate(0.28, 0.25, 0.07, silver, body, s * 0.19, 2.14, 0.34);
    pec.rotation.z = s * -0.14;
    const slit = plate(0.22, 0.027, 0.01, glow, body, s * 0.19, 2.1, 0.39);
    slit.rotation.z = s * -0.14;
    bolt(body, s * 0.26, 2.23, 0.37);
    plate(0.075, 0.39, 0.1, metal, body, s * 0.34, 1.84, 0.18);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const rib = plate(
        0.15,
        0.045,
        0.11,
        silver,
        body,
        side * 0.25,
        1.87 - i * 0.065,
        0.07,
      );
      rib.rotation.z = side * -0.23;
    }
    const piston = mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 0.48, 8),
      silver,
      body,
      side * 0.38,
      1.8,
      -0.08,
    );
    piston.rotation.z = side * 0.17;
    const hipJoint = mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.15, 16),
      silver,
      body,
      side * 0.28,
      1.4,
      0.01,
    );
    hipJoint.rotation.z = Math.PI / 2;
    const pecLayer = plate(
      0.29,
      0.12,
      0.04,
      metal,
      body,
      side * 0.19,
      1.99,
      0.35,
    );
    pecLayer.rotation.z = side * 0.18;
  }
  for (let i = 0; i < 3; i++)
    plate(
      0.38 - i * 0.025,
      0.085,
      0.26,
      metal,
      body,
      0,
      1.72 - i * 0.115,
      0.04,
    );
  mesh(
    new THREE.CylinderGeometry(0.095, 0.12, 0.16, 12),
    dark,
    body,
    0,
    2.39,
    0,
  );
  const head = new THREE.Group();
  head.position.set(0, 2.58, 0.035);
  body.add(head);
  plate(0.34, 0.29, 0.34, metal, head, 0, -0.015, 0);
  const crown = mesh(
    new THREE.SphereGeometry(0.19, 8, 5),
    metal,
    head,
    0,
    0.11,
    -0.015,
  );
  crown.scale.set(1, 0.65, 0.97);
  const brow = plate(0.35, 0.055, 0.07, dark, head, 0, 0.075, 0.18);
  brow.rotation.x = -0.2;
  for (const side of [-1, 1]) {
    const cheek = plate(
      0.07,
      0.19,
      0.13,
      metal,
      head,
      side * 0.14,
      -0.075,
      0.13,
    );
    cheek.rotation.z = side * -0.23;
  }
  plate(0.31, 0.11, 0.05, dark, head, 0, 0.02, 0.184);
  plate(0.265, 0.026, 0.012, glow, head, 0, 0.035, 0.217);
  plate(0.12, 0.08, 0.05, dark, head, 0, -0.13, 0.205);
  for (let i = 0; i < 4; i++)
    plate(0.013, 0.043, 0.005, silver, head, -0.035 + i * 0.023, -0.13, 0.235);
  for (const s of [-1, 1]) {
    plate(0.045, 0.22, 0.21, silver, head, s * 0.2, -0.01, 0);
    const antenna = mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.23, 6),
      metal,
      head,
      s * 0.17,
      0.26,
      -0.05,
    );
    antenna.rotation.z = s * -0.2;
    mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      glow,
      head,
      s * 0.19,
      0.38,
      -0.05,
    );
  }
  plate(0.51, 0.23, 0.33, metal, body, 0, 1.39, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.235, 1.27, 0);
    root.add(leg);
    legs.push(leg);
    mesh(new THREE.SphereGeometry(0.13, 12, 8), silver, leg, 0, -0.02, 0);
    const thigh = plate(0.29, 0.5, 0.29, metal, leg, 0, -0.31, 0.005);
    thigh.rotation.z = s * 0.08;
    plate(0.065, 0.31, 0.07, dark, leg, s * 0.13, -0.32, 0.15);
    plate(0.13, 0.33, 0.03, silver, leg, 0, -0.28, 0.16);
    mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10),
      dark,
      leg,
      s * 0.11,
      -0.28,
      -0.06,
    );
    plate(0.23, 0.18, 0.32, silver, leg, 0, -0.62, 0.04);
    plate(0.15, 0.025, 0.02, glow, leg, 0, -0.62, 0.21);
    plate(0.25, 0.47, 0.27, metal, leg, 0, -0.94, -0.01);
    const shin = plate(0.15, 0.38, 0.055, silver, leg, 0, -0.94, 0.155);
    shin.rotation.x = -0.07;
    plate(0.055, 0.3, 0.015, glow, leg, s * 0.07, -0.94, 0.137);
    plate(0.3, 0.15, 0.46, dark, leg, 0, -1.23, 0.07);
    plate(0.3, 0.07, 0.28, metal, leg, 0, -1.15, 0.19);
    for (const x of [-0.08, 0.08]) bolt(leg, x, -0.72, 0.165);
  }
  const arms = [],
    weapons = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.52, 2.2, 0);
    arm.rotation.z = s * 0.18;
    body.add(arm);
    arms.push(arm);
    mesh(new THREE.SphereGeometry(0.16, 16, 10), silver, arm);
    const pauldron = plate(
      0.45,
      0.32,
      0.43,
      metal,
      arm,
      s * 0.025,
      -0.02,
      0.045,
    );
    pauldron.rotation.z = s * -0.15;
    plate(0.3, 0.13, 0.045, silver, arm, s * 0.015, 0.035, 0.29);
    for (let i = 0; i < 3; i++)
      plate(0.2, 0.024, 0.026, dark, arm, s * 0.015, -0.06 - i * 0.043, 0.28);
    plate(0.28, 0.035, 0.025, glow, arm, 0, 0.08, 0.26);
    plate(0.19, 0.35, 0.21, metal, arm, 0, -0.29, 0);
    mesh(new THREE.SphereGeometry(0.1, 12, 8), dark, arm, 0, -0.5, 0);
    const elbow = mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12),
      silver,
      arm,
      0,
      -0.5,
      0,
    );
    elbow.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const strut = mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8),
        silver,
        arm,
        side * 0.105,
        -0.28,
        0.11,
      );
      strut.rotation.z = side * 0.05;
    }
    const cablePoints = [
      new THREE.Vector3(s * 0.12, -0.12, -0.12),
      new THREE.Vector3(s * 0.16, -0.37, -0.14),
      new THREE.Vector3(s * 0.11, -0.56, -0.08),
    ];
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(cablePoints),
        12,
        0.018,
        6,
        false,
      ),
      dark,
      arm,
    );
    const fore = new THREE.Group();
    fore.position.set(0, -0.54, 0);
    arm.add(fore);
    fore.rotation.x = -0.2;
    plate(0.24, 0.38, 0.28, metal, fore, 0, -0.17, 0.025);
    plate(0.13, 0.2, 0.045, dark, fore, 0, -0.16, 0.19);
    for (let i = 0; i < 3; i++)
      plate(0.1, 0.022, 0.01, glow, fore, 0, -0.08 - i * 0.065, 0.217);
    plate(0.2, 0.17, 0.23, dark, fore, 0, -0.46, 0.02);
    for (let i = 0; i < 4; i++)
      plate(0.037, 0.12, 0.08, silver, fore, -0.07 + i * 0.048, -0.49, 0.155);
    const gauntlet = new THREE.Group();
    fore.add(gauntlet);
    plate(0.37, 0.42, 0.35, metal, gauntlet, 0, -0.32, 0.1);
    const fist = mesh(
      new THREE.IcosahedronGeometry(0.24, 0),
      metal,
      gauntlet,
      0,
      -0.53,
      0.13,
    );
    fist.scale.set(1.1, 0.7, 1);
    for (let i = 0; i < 4; i++) {
      const knuckle = mesh(
        new THREE.CylinderGeometry(0.04, 0.045, 0.035, 6),
        silver,
        gauntlet,
        -0.13 + i * 0.085,
        -0.49,
        0.31,
      );
      knuckle.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 3; i++)
      plate(0.035, 0.28, 0.025, glow, gauntlet, -0.1 + i * 0.1, -0.33, 0.292);
    const blades = new THREE.Group();
    fore.add(blades);
    for (const offset of [-0.11, 0.11]) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.035, 0);
      shape.lineTo(0.035, 0);
      shape.lineTo(0.06, -0.72);
      shape.lineTo(0, -0.95);
      shape.lineTo(-0.025, -0.7);
      shape.closePath();
      const blade = mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false }),
        glow,
        blades,
        offset,
        -0.25,
        0.17,
      );
      blade.rotation.z = s * -0.12;
    }
    const veil = new THREE.Group();
    fore.add(veil);
    const shield = mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.025, 6),
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.23,
        side: THREE.DoubleSide,
        metalness: 0.4,
        roughness: 0.2,
      }),
      veil,
      0,
      -0.24,
      0.34,
    );
    shield.rotation.x = Math.PI / 2;
    const rim = mesh(
      new THREE.TorusGeometry(0.46, 0.014, 6, 6),
      glow,
      veil,
      0,
      -0.24,
      0.36,
    );
    rim.rotation.z = Math.PI / 6;
    const ring = mesh(
      new THREE.TorusGeometry(0.24, 0.005, 6, 24),
      glow,
      veil,
      0,
      -0.24,
      0.37,
    );
    weapons.push({ gauntlet, blades, veil, ring });
  }
  // Spine vents and a shoulder-mounted reactor give each frame depth from oblique angles.
  for (const s of [-1, 1]) {
    plate(0.12, 0.55, 0.13, dark, body, s * 0.22, 2.02, -0.28);
    for (let i = 0; i < 5; i++)
      plate(0.14, 0.027, 0.025, silver, body, s * 0.22, 2.2 - i * 0.075, -0.36);
  }
  const reactor = mesh(
    new THREE.TorusGeometry(0.11, 0.025, 8, 20),
    glow,
    body,
    0,
    2.01,
    0.365,
  );
  const core = mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    glow,
    body,
    0,
    2.01,
    0.36,
  );
  return {
    root,
    body,
    head,
    arms,
    legs,
    weapons,
    reactor,
    core,
    setWeapon(id) {
      weapons.forEach((w) => {
        w.gauntlet.visible = id === "rock";
        w.blades.visible = id === "scissors";
        w.veil.visible = id === "paper";
      });
    },
  };
}
