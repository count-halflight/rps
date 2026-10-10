import * as THREE from "three";
const material = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
export function createEnvironment(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const animated = [],
    districtProps = [],
    signs = [],
    lights = [];
  const concrete = material("#20282c"),
    metal = material("#303c42", { metalness: 0.5, roughness: 0.35 }),
    dark = material("#101820"),
    floorMat = material("#192328", { metalness: 0.75, roughness: 0.24 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const add = (g, m, p, s, parent = root) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(...p);
    o.scale.set(...s);
    parent.add(o);
    o.receiveShadow = true;
    return o;
  };
  add(box, floorMat, [0, -0.15, 0], [22, 0.3, 20]);
  const tiles = new THREE.InstancedMesh(box, metal, 70);
  const dummy = new THREE.Object3D();
  const originals = [];
  for (let i = 0; i < 70; i++) {
    const x = (i % 10) - 4.5,
      z = Math.floor(i / 10) - 3;
    dummy.position.set(x, 0.012, z);
    dummy.scale.set(0.975, 0.035, 0.975);
    dummy.updateMatrix();
    tiles.setMatrixAt(i, dummy.matrix);
    originals.push([x, z]);
  }
  root.add(tiles);
  const windowMat = new THREE.MeshBasicMaterial({ color: "#89d1c9" });
  const windows = new THREE.InstancedMesh(box, windowMat, 240);
  for (let i = 0; i < 16; i++) {
    const x = ((i % 8) - 3.5) * 3.2,
      z = -6 - Math.floor(i / 8) * 4,
      h = 4 + ((i * 7) % 9);
    add(box, dark, [x, h / 2, z], [2.5, h, 2]);
    add(box, metal, [x, h + 0.06, z], [2.65, 0.12, 2.2]);
    for (let j = 0; j < 15; j++) {
      dummy.position.set(
        x + ((j % 3) - 1) * 0.63,
        1.2 + Math.floor(j / 3) * 1.05,
        z + 1.012,
      );
      dummy.scale.set(0.19, 0.47, 0.02);
      dummy.updateMatrix();
      windows.setMatrixAt(i * 15 + j, dummy.matrix);
    }
  }
  root.add(windows);
  // Street signs are painted type on real geometry, with no HTML wallpaper.
  function sign(text, color, x, y, z, w = 1.4, h = 0.55, rotation = 0) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111918";
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 172);
    ctx.fillStyle = color;
    ctx.font = '700 76px "Chakra Petch", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 96);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex });
    const o = add(new THREE.PlaneGeometry(w, h), m, [x, y, z], [1, 1, 1]);
    o.rotation.y = rotation;
    signs.push(o);
    return o;
  }
  sign("夜市", "#e55345", -4, 3, -3, 2.3, 0.85, 0.18);
  sign("09", "#9ecfc0", 3.8, 4.1, -4, 1.4, 0.7, -0.15);
  sign("AFTER HOURS", "#d2b694", 0, 5, -6, 3.8, 0.65);
  for (const s of [-1, 1]) {
    add(box, concrete, [s * 5, 1.1, -2], [1.2, 2.2, 3]);
    add(box, metal, [s * 5, 2.25, -2], [1.4, 0.1, 3.2]);
    for (let i = 0; i < 5; i++)
      add(box, metal, [s * 5, 0.7 + i * 0.14, -0.45], [1, 0.035, 0.1]);
    const lamp = new THREE.PointLight(s < 0 ? "#8affe0" : "#ff986a", 16, 9);
    lamp.position.set(s * 3.5, 3, -0.5);
    scene.add(lamp);
    lights.push(lamp);
  }
  const props = Array.from({ length: 6 }, () => {
    const g = new THREE.Group();
    root.add(g);
    districtProps.push(g);
    return g;
  });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  // Rain district: overhead rail and cables with a passing carriage.
  add(box, metal, [0, 5.4, -3.8], [15, 0.17, 0.3], props[0]);
  const train = add(
    box,
    material("#334648"),
    [-8, 6, -4],
    [3.8, 0.95, 1.1],
    props[0],
  );
  for (let i = 0; i < 5; i++)
    add(
      box,
      glow("#c3dbce"),
      [-1.3 + i * 0.6, 0, 0.57],
      [0.36, 0.4, 0.02],
      train,
    );
  animated.push({ object: train, type: "train" });
  // Foundry: turning turbines, pumping pistons, lit furnace.
  for (const s of [-1, 1]) {
    const fan = add(
      new THREE.TorusGeometry(0.8, 0.1, 8, 24),
      metal,
      [s * 3.7, 2, -2.5],
      [1, 1, 1],
      props[1],
    );
    for (let i = 0; i < 5; i++) {
      const blade = add(box, metal, [0, 0, 0], [1.4, 0.12, 0.07], fan);
      blade.rotation.z = (i * Math.PI) / 5;
    }
    animated.push({ object: fan, type: "fan", phase: s });
    const piston = add(box, metal, [s * 4, 1, -1], [0.28, 1.4, 0.3], props[1]);
    animated.push({ object: piston, type: "piston", phase: s });
  }
  add(box, glow("#fb6330"), [0, 1.6, -4.5], [4, 1.5, 0.08], props[1]);
  // Vault: orbiting faceted monoliths.
  for (let i = 0; i < 8; i++) {
    const crystal = add(
      new THREE.OctahedronGeometry(0.6),
      material("#70618e", {
        metalness: 0.8,
        roughness: 0.15,
        emissive: "#443052",
        emissiveIntensity: 0.6,
      }),
      [0, 3, -4],
      [0.5, 1.8, 0.5],
      props[2],
    );
    animated.push({ object: crystal, type: "orbit", phase: (i * Math.PI) / 4 });
  }
  // Market: swaying lanterns and awnings.
  for (let i = 0; i < 12; i++) {
    const lamp = add(
      new THREE.SphereGeometry(0.18, 12, 8),
      glow(i % 2 ? "#ed7850" : "#ddd092"),
      [(i - 5.5) * 0.65, 3.7, -2.6],
      [1, 1.5, 1],
      props[3],
    );
    animated.push({ object: lamp, type: "lantern", phase: i });
  }
  add(box, material("#7d3948"), [-3.4, 2.8, -3], [2.4, 0.07, 2], props[3]);
  add(box, material("#426a60"), [3.4, 2.8, -3], [2.4, 0.07, 2], props[3]);
  // Garden: breathing signal trees and a rotating antenna.
  for (const s of [-1, 1]) {
    add(
      new THREE.CylinderGeometry(0.1, 0.2, 3, 8),
      metal,
      [s * 3.7, 1.5, -3],
      [1, 1, 1],
      props[4],
    );
    for (let j = 0; j < 4; j++) {
      const leaf = add(
        new THREE.IcosahedronGeometry(0.55, 0),
        material("#435c4a", { emissive: "#346134", emissiveIntensity: 0.25 }),
        [s * 3.7 + ((j % 2) - 0.5) * 0.8, 2 + j * 0.28, -3],
        [1.2, 0.6, 1],
        props[4],
      );
      animated.push({ object: leaf, type: "leaf", phase: j + s });
    }
  }
  // Docks: low water, rotating beacon and moving distant ships.
  const water = add(
    new THREE.PlaneGeometry(22, 8, 14, 8),
    material("#184049", { metalness: 0.9, roughness: 0.15 }),
    [0, -0.03, -5],
    [1, 1, 1],
    props[5],
  );
  water.rotation.x = -Math.PI / 2;
  animated.push({ object: water, type: "water" });
  const boat = add(
    box,
    material("#303d47"),
    [-6, 0.6, -6],
    [2.8, 1.2, 1.3],
    props[5],
  );
  animated.push({ object: boat, type: "boat" });
  const count = 550,
    positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = Math.random() * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({
      color: "#a9c8c8",
      size: 0.024,
      transparent: true,
      opacity: 0.6,
    }),
  );
  root.add(rain);
  let current = -1;
  return {
    root,
    tiles,
    update(time, level, district, frame, reduced = false) {
      const index = (level - 1) % 6;
      if (index !== current) {
        current = index;
        props.forEach((p, i) => (p.visible = i === index));
        windowMat.color.set(district.color);
        floorMat.color.set(
          index === 1 ? "#35251f" : index === 2 ? "#292338" : "#192a2b",
        );
        lights[0].color.set(district.color);
      }
      const t = reduced ? 0 : time;
      animated.forEach(({ object: o, type, phase = 0 }) => {
        if (type === "train") o.position.x = ((t * 0.85 + 8) % 22) - 11;
        else if (type === "fan") o.rotation.z = t * (0.5 + phase * 0.1);
        else if (type === "piston")
          o.position.y = 1 + Math.sin(t * 2 + phase) * 0.35;
        else if (type === "orbit") {
          o.position.set(
            Math.cos(t * 0.18 + phase) * 3.4,
            2.8 + Math.sin(t + phase) * 0.3,
            -3.4 + Math.sin(t * 0.18 + phase) * 0.7,
          );
          o.rotation.y = t * 0.3 + phase;
        } else if (type === "lantern")
          o.rotation.z = Math.sin(t + phase) * 0.12;
        else if (type === "leaf")
          o.rotation.z = Math.sin(t * 0.8 + phase) * 0.12;
        else if (type === "boat") {
          o.position.x = Math.sin(t * 0.07) * 7;
          o.position.y = 0.6 + Math.sin(t) * 0.08;
        } else if (type === "water") {
          const a = o.geometry.attributes.position;
          for (let i = 0; i < a.count; i++)
            a.setZ(
              i,
              Math.sin(a.getX(i) * 2 + t) * 0.05 +
                Math.cos(a.getY(i) * 3 + t * 0.7) * 0.035,
            );
          a.needsUpdate = true;
        }
      });
      rain.visible = index === 0 || index === 5 || index === 4;
      rain.material.opacity = index === 4 ? 0.2 : 0.5;
      if (!reduced) {
        for (let i = 0; i < count; i++) {
          positions[i * 3 + 1] =
            9 - ((t * (index === 5 ? 2.7 : 4.8) + i * 0.13) % 9);
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      lights[1].intensity = 12 + Math.sin(t * 0.6) * 3;
      const fracture =
        frame?.weapon === "rock" &&
        frame?.progress > 0.64 &&
        frame?.collapse > 0
          ? frame.shock
          : 0;
      for (let i = 0; i < 70; i++) {
        const [x, z] = originals[i],
          d = Math.hypot(x - 1.7, z);
        dummy.position.set(
          x,
          0.012 + (d < 2 ? fracture * (2 - d) * 0.55 : 0),
          z,
        );
        dummy.rotation.set(
          fracture * Math.sin(i) * 0.2,
          0,
          fracture * Math.cos(i) * 0.15,
        );
        dummy.scale.set(0.975, 0.035, 0.975);
        dummy.updateMatrix();
        tiles.setMatrixAt(i, dummy.matrix);
      }
      tiles.instanceMatrix.needsUpdate = true;
    },
  };
}
