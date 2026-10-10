import * as THREE from "three";

export const ALTERNATE_SPECTACLE_KINDS = Object.freeze([
  "timefracture", "guillotine", "threadmaze", "railcannon", "suncore",
  "magnetic", "cathedral", "origami", "gravitywell", "tidal", "tether",
  "starlance", "chronoblade", "serpent", "aurora",
]);
const TAU = Math.PI * 2;
const clamp = v => Math.min(1, Math.max(0, v));
const span = (p, a, b) => clamp((p - a) / (b - a));
const pulse = (p, at, width = .04) => Math.max(0, 1 - Math.abs(p - at) / width);
const smooth = v => v * v * (3 - 2 * v);

// The second set of finishers uses different practical constructions from the
// first set: mechanisms, physical folds, water, tethers and a creature silhouette.
export function createAlternateCinematicSets(parent, helpers) {
  const { mesh, basic, metal, ownGeometry, ownMaterial, planetMaterial, noise } = helpers;
  const root = new THREE.Group(); root.name = "Alternate finale sets"; parent.add(root);
  const sets = new Map(), dummy = new THREE.Object3D();
  const group = name => { const g = new THREE.Group(); root.add(g); sets.set(name, g); return g; };
  const glow = basic("#9ee8ff", .84), amber = basic("#ffd991", .84);
  const silver = ownMaterial(new THREE.MeshStandardMaterial({ color: "#8091a7", metalness: .74, roughness: .24, emissive: "#1a2850", emissiveIntensity: .26 }));
  const darkGlass = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#475575", roughness: .18, metalness: .75, transparent: true, opacity: .20, depthWrite: false, side: THREE.DoubleSide }));
  const voidRoot = group("void");
  const voidSky = mesh(new THREE.SphereGeometry(58, 14, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { time: { value: 0 }, type: { value: 0 } },
    vertexShader: "varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float time;uniform float type;${noise}void main(){float n=fbm(p*6.+vec3(time*.015,0,0));float line=pow(1.-abs(sin((p.x+p.y*.7)*21.+n*4.)),22.);vec3 c=type<.5?vec3(.023,.029,.02):type<1.5?vec3(.031,.022,.078):vec3(.018,.028,.045);gl_FragColor=vec4(c+vec3(.035,.055,.073)*n+vec3(.065,.069,.087)*line,1.);}`,
  }), voidRoot);

  const clock = group("clock");
  const clockBack = mesh(new THREE.CircleGeometry(2.6, 64), darkGlass, clock);
  const clockRings = [2.2, 2.5, 2.75].map((r, i) => mesh(new THREE.TorusGeometry(r, i === 1 ? .065 : .015, 6, 80), i === 1 ? silver : basic("#ffd991", .84), clock));
  const tickGeo = ownGeometry(new THREE.BoxGeometry(.018, .10, .032));
  const clockTicks = new THREE.InstancedMesh(tickGeo, amber, 60); clock.add(clockTicks);
  for (let i = 0; i < 60; i++) { const a = i * TAU / 60; dummy.position.set(Math.sin(a) * 2.33, Math.cos(a) * 2.33, .04); dummy.rotation.set(0, 0, -a); dummy.scale.set(1, i % 5 ? 1 : 2.4, 1); dummy.updateMatrix(); clockTicks.setMatrixAt(i, dummy.matrix); }
  const hourHand = new THREE.Group(), minuteHand = new THREE.Group(); clock.add(hourHand, minuteHand);
  mesh(new THREE.BoxGeometry(.06, 1.40, .035), amber, hourHand, [0, .64, .06]);
  mesh(new THREE.BoxGeometry(.034, 2.08, .023), glow, minuteHand, [0, .99, .09]);
  const clockWedges = Array.from({ length: 12 }, (_, i) => {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(Math.sin(-.15) * 2.85, Math.cos(-.15) * 2.85); shape.absarc(0, 0, 2.85, Math.PI / 2 + .15, Math.PI / 2 - .15, true); shape.closePath();
    const m = mesh(new THREE.ShapeGeometry(shape), i % 2 ? darkGlass : silver, clock); m.rotation.z = i * TAU / 12; m.position.z = -.12; return m;
  });
  const frozenBlades = Array.from({ length: 9 }, (_, i) => mesh(new THREE.ConeGeometry(.055, 1.25, 4), glow, clock));

  const guillotine = group("guillotine");
  const guillotineBase = new THREE.Group(); guillotine.add(guillotineBase);
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(.18, 6.4, .22), metal, guillotineBase, [side * 1.7, 2, -.35]);
    mesh(new THREE.BoxGeometry(.032, 6.1, .035), glow, guillotineBase, [side * 1.59, 2, -.20]);
    mesh(new THREE.BoxGeometry(.55, .25, .95), silver, guillotineBase, [side * 1.7, -1.1, -.35]);
  }
  mesh(new THREE.BoxGeometry(3.6, .22, .25), silver, guillotineBase, [0, 5.13, -.35]);
  const fallingBlade = new THREE.Group(); guillotineBase.add(fallingBlade);
  const cutterShape = new THREE.Shape(); cutterShape.moveTo(-1.52, .55); cutterShape.lineTo(1.52, .55); cutterShape.lineTo(1.52, -.56); cutterShape.lineTo(-1.52, -.05); cutterShape.closePath();
  mesh(new THREE.ExtrudeGeometry(cutterShape, { depth: .07, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 }), silver, fallingBlade);
  const bladeLine = mesh(new THREE.BoxGeometry(3.08, .035, .025), glow, fallingBlade, [0, -.30, .10]); bladeLine.rotation.z = -.167;
  const cutterStreak = mesh(new THREE.PlaneGeometry(3.05, 4.5), basic("#a1cfff", .12), guillotineBase, [0, 1.8, -.05]);

  const threads = group("threadmaze");
  const threadGeometry = ownGeometry(new THREE.BufferGeometry()); threadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(48 * 6), 3));
  const threadLines = new THREE.LineSegments(threadGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#ffb2cf", transparent: true, opacity: .78, fog: false }))); threads.add(threadLines);
  const threadAnchors = new THREE.InstancedMesh(ownGeometry(new THREE.OctahedronGeometry(.09, 0)), basic("#ffabc9", .9), 48); threads.add(threadAnchors);

  const rail = group("railcannon"), railTunnel = new THREE.Group(); rail.add(railTunnel);
  const railGates = Array.from({ length: 6 }, (_, i) => {
    const g = new THREE.Group(); railTunnel.add(g);
    mesh(new THREE.TorusGeometry(1.35, .09, 8, 48), silver, g).rotation.y = Math.PI / 2;
    mesh(new THREE.TorusGeometry(1.24, .024, 5, 48), glow, g).rotation.y = Math.PI / 2;
    g.position.x = (i - 2.5) * 1.7; return g;
  });
  for (const y of [-1.08, 1.08]) for (const z of [-.66, .66]) { mesh(new THREE.BoxGeometry(9.9, .10, .14), metal, railTunnel, [0, y, z]); mesh(new THREE.BoxGeometry(9.9, .018, .026), glow, railTunnel, [0, y + .065, z]); }
  const railPulse = mesh(new THREE.TorusGeometry(1.03, .07, 8, 40), basic("#d9fcff", .86), railTunnel); railPulse.rotation.y = Math.PI / 2;

  const sun = group("suncore");
  const sunMaterial = ownMaterial(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float time;uniform float strength;${noise}void main(){float f=fbm(p*15.+vec3(time*.2,-time*.26,0));vec3 c=mix(vec3(1.5,.12,.012),vec3(2.,1.4,.38),f);gl_FragColor=vec4(c*strength,1.);}`,
  }));
  const heldSun = mesh(new THREE.SphereGeometry(1, 40, 28), sunMaterial, sun);
  const sunCages = Array.from({ length: 3 }, (_, i) => { const m = mesh(new THREE.TorusGeometry(1.2, .018, 6, 64), amber, sun); m.rotation.x = i * Math.PI / 3; m.rotation.y = i * .7; return m; });
  const solarSpokes = new THREE.InstancedMesh(ownGeometry(new THREE.ConeGeometry(.08, 2.9, 6)), basic("#ffbc6a", .50), 28); sun.add(solarSpokes);

  const magnets = group("magnetic");
  const metalBlocks = Array.from({ length: 12 }, (_, i) => {
    const g = new THREE.Group(); magnets.add(g);
    mesh(new THREE.BoxGeometry(.42, .46, .55), silver, g);
    mesh(new THREE.BoxGeometry(.045, .35, .60), glow, g, [0, 0, .006]);
    for (const side of [-1, 1]) mesh(new THREE.CylinderGeometry(.065, .065, .035, 8), metal, g, [side * .15, .235, .10]);
    return g;
  });
  const magnetAxes = [0, 1, 2].map(i => { const m = mesh(new THREE.TorusGeometry(2.85, .014, 5, 80), basic("#8bdcff", .32), magnets); m.rotation.set(i * Math.PI / 3, i * Math.PI / 4, 0); return m; });

  const cathedral = group("cathedral");
  const crystalMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#d0bee8", metalness: .38, roughness: .18, transparent: true, opacity: .28, depthWrite: false, side: THREE.FrontSide, clearcoat: 1, emissive: "#5c327c", emissiveIntensity: .12 }));
  const cathedralPillars = Array.from({ length: 10 }, (_, i) => {
    const g = new THREE.Group(); cathedral.add(g);
    mesh(new THREE.CylinderGeometry(.15, .35, 5.2, 6), crystalMaterial, g, [0, 2.3, 0]);
    mesh(new THREE.ConeGeometry(.25, 1.1, 6), crystalMaterial, g, [0, 5.2, 0]);
    mesh(new THREE.CylinderGeometry(.015, .015, 4.5, 5), basic("#e9bcff", .80), g, [0, 2.7, .22]);
    return g;
  });
  const cathedralCrown = mesh(new THREE.TorusGeometry(2.5, .11, 6, 10), crystalMaterial, cathedral); cathedralCrown.rotation.x = Math.PI / 2;

  const origami = group("origami");
  const origamiMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#bfbee3", roughness: .52, metalness: .22, side: THREE.DoubleSide, emissive: "#645296", emissiveIntensity: .15 }));
  const foldPanels = Array.from({ length: 8 }, (_, i) => {
    const hinge = new THREE.Group(); origami.add(hinge);
    mesh(new THREE.PlaneGeometry(2.1, 4.2, 1, 1), origamiMaterial, hinge, [0, 2.1, 0]);
    mesh(new THREE.BoxGeometry(2.1, .022, .028), glow, hinge, [0, 4.2, .008]);
    mesh(new THREE.BoxGeometry(.015, 4.2, .018), glow, hinge, [-1.05, 2.1, .008]);
    return hinge;
  });
  const paperStars = Array.from({ length: 12 }, (_, i) => { const m = mesh(new THREE.OctahedronGeometry(.20, 0), i % 2 ? origamiMaterial : glow, origami); m.scale.set(1.4, .2, 1.4); return m; });

  const gravity = group("gravitywell");
  const littlePlanets = Array.from({ length: 6 }, (_, i) => mesh(new THREE.SphereGeometry(.48 + i % 3 * .12, 24, 16), planetMaterial(i % 4), gravity));
  const gravityOrbitLines = Array.from({ length: 3 }, (_, i) => { const m = mesh(new THREE.TorusGeometry(2.0 + i * .7, .012, 5, 72), basic("#df9fd6", .30), gravity); m.rotation.set(.4 + i * .6, i * .4, 0); return m; });

  const tidal = group("tidal");
  const waterMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec2 uvp;varying vec3 p;uniform float time;void main(){uvp=uv;p=position;p+=normal*sin(position.x*3.+time*4.)*.055;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
    fragmentShader: `varying vec2 uvp;varying vec3 p;uniform float time;uniform float strength;${noise}void main(){float n=fbm(vec3(p.xz*2.,time*.2)),foam=pow(.5+.5*sin(uvp.y*75.+n*13.-time*4.),15.);vec3 c=mix(vec3(.01,.21,.35),vec3(.24,1.12,1.20),foam);gl_FragColor=vec4(c,(.25+foam*.45)*strength);}`,
  }));
  const wave = mesh(new THREE.CylinderGeometry(3.15, 3.15, 3.8, 64, 12, true, 0, Math.PI * 1.2), waterMaterial, tidal); wave.rotation.x = Math.PI / 2;
  const waveCrest = mesh(new THREE.TorusGeometry(3.15, .09, 7, 64, Math.PI * 1.2), basic("#beffff", .77), tidal);
  const waterDrops = new THREE.InstancedMesh(ownGeometry(new THREE.SphereGeometry(.07, 6, 4)), basic("#b3efff", .66), 48); tidal.add(waterDrops);

  const tether = group("tether");
  const tetherRock = mesh(new THREE.IcosahedronGeometry(1.0, 1), new THREE.MeshStandardMaterial({ color: "#53414b", roughness: .79, emissive: "#e17840", emissiveIntensity: .28 }), tether);
  const tetherGeometry = ownGeometry(new THREE.BufferGeometry()); tetherGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3));
  const tetherLine = new THREE.Line(tetherGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#ffb889", fog: false }))); tether.add(tetherLine);
  const tetherAnchor = mesh(new THREE.TorusGeometry(.20, .037, 6, 24), amber, tether);

  const lance = group("starlance");
  const celestialLance = new THREE.Group(); lance.add(celestialLance);
  mesh(new THREE.CylinderGeometry(.06, .09, 8, 10), silver, celestialLance);
  mesh(new THREE.ConeGeometry(.28, 1.7, 6), basic("#d5ecff"), celestialLance, [0, 4.8, 0]);
  for (let i = 0; i < 3; i++) { const fin = mesh(new THREE.BoxGeometry(.20, 1.4, .025), basic("#e9cba5", .84), celestialLance, [0, -3.3, 0]); fin.rotation.y = i * Math.PI / 3; }
  const lanceGates = Array.from({ length: 4 }, (_, i) => mesh(new THREE.TorusGeometry(1 + i * .26, .018, 5, 64), basic("#bdceff", .45), lance));

  const serpent = group("serpent");
  const serpentMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#8de2dc", emissive: "#42bfc8", emissiveIntensity: .42, roughness: .20, metalness: .42, transparent: true, opacity: .74 }));
  const serpentGeometry = ownGeometry(new THREE.BufferGeometry());
  const serpentPositions = new Float32Array(46 * 9 * 3), serpentNormals = new Float32Array(46 * 9 * 3), serpentUvs = new Float32Array(46 * 9 * 2), serpentIndices = [];
  for (let i = 0; i < 46; i++) for (let j = 0; j < 9; j++) {
    serpentUvs.set([j / 8, i / 45], (i * 9 + j) * 2);
    if (i < 45 && j < 8) { const a = i * 9 + j, b = a + 9; serpentIndices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  serpentGeometry.setAttribute("position", new THREE.BufferAttribute(serpentPositions, 3).setUsage(THREE.DynamicDrawUsage));
  serpentGeometry.setAttribute("normal", new THREE.BufferAttribute(serpentNormals, 3).setUsage(THREE.DynamicDrawUsage));
  serpentGeometry.setAttribute("uv", new THREE.BufferAttribute(serpentUvs, 2)); serpentGeometry.setIndex(serpentIndices);
  const serpentBody = new THREE.Mesh(serpentGeometry, serpentMaterial); serpentBody.frustumCulled = false; serpent.add(serpentBody);
  const serpentPoints = Array.from({ length: 46 }, () => new THREE.Vector3());
  const tangent = new THREE.Vector3(), radial = new THREE.Vector3(), binormal = new THREE.Vector3(), radialUp = new THREE.Vector3(0, 1, 0), radialRight = new THREE.Vector3(1, 0, 0);
  const serpentHead = new THREE.Group(); serpent.add(serpentHead);
  mesh(new THREE.SphereGeometry(.36, 20, 12), serpentMaterial, serpentHead).scale.set(1.3, .72, 1.9);
  for (const side of [-1, 1]) { mesh(new THREE.SphereGeometry(.045, 8, 6), amber, serpentHead, [side * .29, .11, .36]); const horn = mesh(new THREE.ConeGeometry(.08, .65, 6), silver, serpentHead, [side * .22, .37, -.12]); horn.rotation.z = side * -.28; }
  const serpentWhiskers = [0, 1].map(i => { const points = [new THREE.Vector3((i ? 1 : -1) * .26, .0, .51), new THREE.Vector3((i ? 1 : -1) * .8, .0, .76), new THREE.Vector3((i ? 1 : -1) * 1.1, .15, .68)]; return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, .012, 4, false), amber, serpentHead); });

  const aurora = group("aurora");
  const auroraMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec2 uvp;uniform float time;void main(){uvp=uv;vec3 p=position;p.z+=sin(p.x*.8+time*.55)*.6;p.y+=sin(p.x*1.3+time*.35)*.20;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
    fragmentShader: `varying vec2 uvp;uniform float time;uniform float strength;${noise}void main(){float stripe=pow(.5+.5*sin(uvp.x*230.+time*.7+fbm(vec3(uvp*4.,time*.06))*9.),3.);float vertical=pow(1.-uvp.y,1.3);float edges=smoothstep(0.,.08,uvp.x)*(1.-smoothstep(.92,1.,uvp.x));vec3 c=mix(vec3(.08,1.,.55),vec3(.59,.17,1.20),uvp.y);gl_FragColor=vec4(c,vertical*edges*(.08+stripe*.30)*strength);}`,
  }));
  const auroraCurtains = Array.from({ length: 3 }, (_, i) => mesh(new THREE.PlaneGeometry(14, 7, 36, 8), auroraMaterial, aurora, [0, 3.6 + i * .6, -2.9 - i * 1.8]));
  const iceShards = new THREE.InstancedMesh(ownGeometry(new THREE.OctahedronGeometry(.20, 0)), ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#afd7e8", roughness: .18, metalness: .45, clearcoat: 1, transparent: true, opacity: .8 })), 28); aurora.add(iceShards);

  const reset = () => { sets.forEach(g => { g.visible = false; }); };
  reset();
  function update({ s, frame, animation, time, low, reduced }) {
    reset();
    if (!ALTERNATE_SPECTACLE_KINDS.includes(s.kind)) return false;
    const p = s.phase, sign = s.direction === -1 ? -1 : 1, center = s.center ?? [sign * 2.1, 1.7, 0];
    const hit = animation.impactAt ?? .84, rise = smooth(span(p, .18, .38)), fade = 1 - span(p, hit + .055, .98), motion = reduced ? 0 : 1;
    const contacts = (animation.contacts ?? [[.32], [.49], [.63]]).map(([at]) => at);
    const collision = Math.max(...contacts.map(at => pulse(p, at)), pulse(p, hit, .045));
    const effectScale = rise * fade, n = low ? .6 : 1;
    voidRoot.visible = s.world === "void";
    voidSky.material.uniforms.time.value = time; voidSky.material.uniforms.type.value = s.kind === "timefracture" ? 0 : s.kind === "origami" ? 1 : 2;

    if (["timefracture", "chronoblade"].includes(s.kind)) {
      clock.visible = p > .18 && p < .96; clock.position.set(center[0], center[1], center[2] - 1.5); clock.scale.setScalar(.2 + rise * .9);
      clock.rotation.y = Math.sin(p * Math.PI * 3) * .15;
      const freeze = p > .42 && p < .67, direction = s.kind === "chronoblade" && p > .48 ? -1 : 1;
      hourHand.rotation.z = freeze ? -.6 : -time * .75 * direction; minuteHand.rotation.z = freeze ? -2.1 : -time * 4 * direction;
      clockWedges.forEach((w, i) => { const shatter = span(p, .72, .95); const a = i * TAU / 12; w.position.set(Math.cos(a) * shatter * 3.4, Math.sin(a) * shatter * 3.4, -.12 - shatter * (i % 3)); w.rotation.set(shatter * (i % 3 - 1), shatter * (i % 2 ? 1 : -1), a); w.visible = s.kind === "chronoblade" || shatter > .03; });
      frozenBlades.forEach((blade, i) => { const a = i * TAU / 9, release = span(p, .66, hit); blade.position.set(Math.cos(a) * (3.0 - release * 2.3), Math.sin(a) * (3.0 - release * 2.3), .7); blade.rotation.set(0, 0, a + Math.PI / 2); blade.visible = s.kind === "timefracture" && p > .32 && p < hit + .04; });
      clockRings.forEach((ring, i) => { ring.rotation.z = time * (i % 2 ? -.15 : .12) * motion; ring.material.opacity = i === 1 ? 1 : fade * .8; }); clockBack.visible = true;
    } else if (s.kind === "guillotine") {
      guillotine.visible = p > .18 && p < .94; guillotine.position.set(sign * 2.1, 1.2, -.05); guillotineBase.scale.setScalar(.25 + rise * .75);
      const drop = smooth(span(p, hit - .115, hit)); fallingBlade.position.y = 4.2 - drop * 5.15; cutterStreak.visible = drop > .02 && drop < 1; cutterStreak.material.opacity = pulse(p, hit - .06, .08) * .20;
    } else if (s.kind === "threadmaze") {
      threads.visible = p > .18 && p < .94; threads.position.set(...center); const tighten = span(p, .42, hit), spread = 3.7 - tighten * 2.6;
      const positions = threadGeometry.attributes.position.array;
      for (let i = 0; i < 48; i++) { const a = i * 2.399, y = Math.sin(i * 2.71) * (2.1 - tighten), first = [Math.cos(a) * spread, y, Math.sin(a) * spread], second = [Math.cos(a + 2.1) * spread, -y, Math.sin(a + 2.1) * spread]; positions.set([...first, ...second], i * 6); dummy.position.set(...first); dummy.rotation.set(time * .1, a, 0); dummy.scale.setScalar(effectScale); dummy.updateMatrix(); threadAnchors.setMatrixAt(i, dummy.matrix); }
      threadGeometry.attributes.position.needsUpdate = true; threadAnchors.instanceMatrix.needsUpdate = true; threadLines.material.opacity = effectScale * (.4 + collision * .6);
    } else if (s.kind === "railcannon") {
      rail.visible = p > .20 && p < .93; rail.position.set(0, Math.max(1.25, center[1]), center[2]); railTunnel.rotation.y = sign < 0 ? Math.PI : 0; railTunnel.scale.setScalar(.2 + rise * .8);
      railPulse.position.x = -4.7 + span(p, .39, hit) * 10.2; railPulse.scale.setScalar(1 + collision * .3); railGates.forEach((gate, i) => { gate.rotation.x = i * .23 + time * .16 * motion; });
    } else if (s.kind === "suncore") {
      sun.visible = p > .18 && p < .95; const transfer = smooth(span(p, .35, .63)); sun.position.set(-sign * 1.5 + sign * transfer * 3.6, 2.7 + Math.sin(transfer * Math.PI) * 1.1, -.4);
      const detonation = span(p, hit - .025, hit + .10), radius = (.15 + rise * .57) * (1 + detonation * 4.8); heldSun.scale.setScalar(radius * (1 - span(p, hit + .1, .96)));
      sunMaterial.uniforms.time.value = time; sunMaterial.uniforms.strength.value = 1 + collision * .8; sunCages.forEach((ring, i) => { ring.scale.setScalar(.3 + rise * .65 + detonation * 2.4); ring.rotation.z = time * (i + 1) * .2 * motion; ring.material.opacity = fade * .8; });
      solarSpokes.count = Math.floor(28 * n); for (let i = 0; i < solarSpokes.count; i++) { const a = i * 2.399, y = 1 - (i + .5) / (solarSpokes.count / 2), r = Math.sqrt(Math.max(0, 1 - y * y)), radius = 1 + detonation * 4; dummy.position.set(Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dummy.position.clone().normalize()); dummy.scale.set(.7, .1 + detonation * 1.4, .7); dummy.updateMatrix(); solarSpokes.setMatrixAt(i, dummy.matrix); } solarSpokes.instanceMatrix.needsUpdate = true;
    } else if (s.kind === "magnetic") {
      magnets.visible = p > .18 && p < .95; magnets.position.set(...center); const crush = span(p, .64, hit);
      metalBlocks.forEach((block, i) => { const a = i * TAU / 12 + time * 1.25 * motion, r = (.5 + rise * 3) * (1 - crush * .74); block.position.set(Math.cos(a) * r, Math.sin(a * 1.7) * r * .52, Math.sin(a) * r); block.rotation.set(time * .7 + i, a, time * .4); block.scale.setScalar(.55 + rise * .65); }); magnetAxes.forEach((m, i) => { m.scale.setScalar(1 - crush * .4); m.rotation.z = time * .4 * (i % 2 ? -1 : 1) * motion; });
    } else if (s.kind === "cathedral") {
      cathedral.visible = p > .17 && p < .95; cathedral.position.set(sign * 2.1, -.8, -.2); const close = span(p, .44, hit), breakApart = span(p, hit, .97);
      cathedralPillars.forEach((pillar, i) => { const a = i * TAU / 10, r = 3.15 - close * 1.45 + breakApart * 3.5; pillar.position.set(Math.cos(a) * r, breakApart * Math.sin(i * 3) * 1.5, Math.sin(a) * r); pillar.rotation.set(-Math.sin(a) * close * .13 + breakApart * Math.cos(a), 0, Math.cos(a) * close * .13 + breakApart * Math.sin(a)); pillar.scale.setScalar(.18 + rise * .82); }); cathedralCrown.position.y = 4.95 - close * 1.7; cathedralCrown.scale.setScalar(rise * (1 + breakApart));
    } else if (s.kind === "origami") {
      origami.visible = p > .17 && p < .96; origami.position.set(sign * 2.1, -.3, 0); const fold = smooth(span(p, .40, hit)), open = span(p, hit + .03, .97);
      foldPanels.forEach((hinge, i) => { const a = i * TAU / 8; hinge.position.set(Math.sin(a) * (3.0 - fold * 1.4 + open * 2), 0, Math.cos(a) * (3.0 - fold * 1.4 + open * 2)); hinge.rotation.set(-fold * 1.22 + open * .8, a, 0); hinge.scale.setScalar(rise); }); paperStars.forEach((star, i) => { const a = i * 2.399; star.position.set(Math.cos(a) * (3 - fold), 2.5 + Math.sin(a) * 1.6, Math.sin(a) * (3 - fold)); star.rotation.set(time * .2, a, fold * 3); star.visible = p > .29; });
    } else if (s.kind === "gravitywell") {
      gravity.visible = p > .18 && p < .95; gravity.position.set(...center); const crush = span(p, .65, hit);
      littlePlanets.forEach((planet, i) => { const a = i * TAU / 6 + time * .6 * motion, r = (1.0 + rise * 2.7) * (1 - crush * .72); planet.position.set(Math.cos(a) * r, Math.sin(a * 1.4) * r * .55, Math.sin(a) * r); planet.rotation.y = time * .13; planet.material.uniforms.time.value = time; planet.material.uniforms.damage.value = collision * 1.2; planet.scale.setScalar(.35 + rise * 1.15); }); gravityOrbitLines.forEach((m, i) => { m.scale.setScalar(.4 + rise * .8 - crush * .6); m.rotation.z = time * .15 * (i % 2 ? 1 : -1); });
    } else if (s.kind === "tidal") {
      tidal.visible = p > .18 && p < .95; const sweep = smooth(span(p, .30, hit)); tidal.position.set(-sign * 2.9 + sign * sweep * 5.6, 1.3, -.8); tidal.rotation.z = sign * -.25; tidal.scale.setScalar(.1 + rise * .95); wave.rotation.z = -.2 + sweep * 1.1;
      waterMaterial.uniforms.time.value = time; waterMaterial.uniforms.strength.value = fade; waveCrest.rotation.z = wave.rotation.z - Math.PI / 2;
      waterDrops.count = Math.floor(48 * n); for (let i = 0; i < waterDrops.count; i++) { const a = i * 2.399, travel = (i * .173 + sweep) % 1; dummy.position.set(Math.cos(a) * 2.8, Math.sin(a) * 2 + travel * 2, Math.sin(i * 6.2) * 1.7); dummy.scale.set(.5, 1.5 + collision, .5); dummy.rotation.set(0, 0, a); dummy.updateMatrix(); waterDrops.setMatrixAt(i, dummy.matrix); } waterDrops.instanceMatrix.needsUpdate = true;
    } else if (s.kind === "tether") {
      tether.visible = p > .17 && p < .95; tether.position.set(sign * 2.1, 0, 0); const swing = span(p, .31, hit), a = -.7 + swing * Math.PI * 1.40, radius = 3.8;
      tetherRock.position.set(Math.sin(a) * radius * sign, 3.7 - Math.cos(a) * radius, -.2); tetherRock.rotation.set(time * .3, time * .4, 0); tetherRock.scale.setScalar(.2 + rise * .8); tetherAnchor.position.set(-sign * 3.2, 2.2, .1);
      const positions = tetherGeometry.attributes.position.array; for (let i = 0; i < 25; i++) { const u = i / 24; positions.set([-sign * 3.2 * (1 - u) + tetherRock.position.x * u, 2.2 * (1 - u) + tetherRock.position.y * u - Math.sin(u * Math.PI) * .45 * (1 - swing), .1 - u * .3], i * 3); } tetherGeometry.attributes.position.needsUpdate = true;
    } else if (s.kind === "starlance") {
      lance.visible = p > .18 && p < .95; lance.position.set(...center); const descent = span(p, .38, hit); celestialLance.position.set(-sign * (1 - descent) * 3.0, 7.0 - descent * 7.0, -1.2); celestialLance.rotation.z = sign * -.47; celestialLance.scale.setScalar(.25 + rise * .90);
      lanceGates.forEach((ring, i) => { ring.position.set(-sign * .8, 4.7 - i * 1.1, -.4); ring.rotation.x = Math.PI / 2; ring.rotation.z = time * .20 * (i % 2 ? 1 : -1); ring.scale.setScalar(effectScale); });
    } else if (s.kind === "serpent") {
      serpent.visible = p > .17 && p < .95; serpent.position.set(...center); const coil = span(p, .29, .69), dive = span(p, .69, hit);
      for (let i = 0; i < 46; i++) { const u = i / 45, a = u * TAU * 1.75 + time * .35 * motion, r = 2.7 - coil * 1.1 - dive * .5; serpentPoints[i].set(Math.cos(a) * r, (u - .5) * 4.4 * (1 - dive * .7) + Math.sin(u * Math.PI) * coil, Math.sin(a) * r); }
      for (let i = 0; i < 46; i++) {
        tangent.subVectors(serpentPoints[Math.min(45, i + 1)], serpentPoints[Math.max(0, i - 1)]).normalize();
        radial.crossVectors(tangent, Math.abs(tangent.y) < .9 ? radialUp : radialRight).normalize(); binormal.crossVectors(tangent, radial).normalize();
        const radius = (.11 + rise * .13) * (.48 + i / 45 * .52);
        for (let j = 0; j < 9; j++) { const a = j * TAU / 8, x = radial.x * Math.cos(a) + binormal.x * Math.sin(a), y = radial.y * Math.cos(a) + binormal.y * Math.sin(a), z = radial.z * Math.cos(a) + binormal.z * Math.sin(a), offset = (i * 9 + j) * 3; serpentPositions.set([serpentPoints[i].x + x * radius, serpentPoints[i].y + y * radius, serpentPoints[i].z + z * radius], offset); serpentNormals.set([x, y, z], offset); }
      }
      serpentGeometry.attributes.position.needsUpdate = serpentGeometry.attributes.normal.needsUpdate = true;
      serpentHead.position.copy(serpentPoints[45]); serpentHead.rotation.y = -(TAU * 1.75 + time * .35 * motion); serpentHead.scale.setScalar(.1 + rise * 1.3);
    } else if (s.kind === "aurora") {
      aurora.visible = p > .16 && p < .96; aurora.position.set(sign * 1.8, -.1, -.3); auroraMaterial.uniforms.time.value = time; auroraMaterial.uniforms.strength.value = effectScale * 1.4; auroraCurtains.forEach((curtain, i) => { curtain.rotation.y = Math.sin(time * .17 + i) * .16 * motion; });
      iceShards.count = Math.floor(28 * n); for (let i = 0; i < iceShards.count; i++) { const a = i * 2.399, drop = span(p, .36 + i % 6 * .047, hit), r = 3 - drop * 2.3; dummy.position.set(Math.cos(a) * r, 5.1 * (1 - drop) + .05, Math.sin(a) * r); dummy.rotation.set(i * .7, a, time * .3); dummy.scale.set(.3 + rise * .6, .8 + collision * .7, .3 + rise * .6); dummy.updateMatrix(); iceShards.setMatrixAt(i, dummy.matrix); } iceShards.instanceMatrix.needsUpdate = true;
    }
    return true;
  }
  return { update, reset };
}
