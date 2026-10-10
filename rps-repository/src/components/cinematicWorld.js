import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createAlternateCinematicSets, ALTERNATE_SPECTACLE_KINDS } from "./alternateCinematicSets.js";

// These are practical sets, not a screen-wide colour filter. Every finale has
// something with depth that the camera and the two actors can move around.
export const SPECTACLE_KINDS = Object.freeze([
  "fracture", "mirror", "blade-storm", "crater", "inferno", "orbital",
  "prism", "integral", "singularity", "meteor", "constellation", "eclipse",
  "thunder", "turbine", "rift",
  ...ALTERNATE_SPECTACLE_KINDS,
]);

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const span = (p, a, b) => clamp((p - a) / (b - a));
const pulse = (p, at, width) => Math.max(0, 1 - Math.abs(p - at) / width);
const smooth = p => p * p * (3 - 2 * p);
const TAU = Math.PI * 2;
const rubbleNoise = i => { const n = Math.sin(i * 127.1 + 91.7) * 43758.5453; return n - Math.floor(n); };

export function createImpactRockGeometry(radius = .115) {
  const geometry = new THREE.IcosahedronGeometry(radius, 2), positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / radius, y = positions.getY(i) / radius, z = positions.getZ(i) / radius;
    const erosion = 1 + Math.sin(x * 7.2 + z * 4.9) * .14 + Math.cos(y * 9.1 + x * 3.4) * .10;
    positions.setXYZ(i, x * radius * erosion * .87, y * radius * erosion * .58, z * radius * erosion);
    const grain = .68 + rubbleNoise(Math.floor((x + y * 2 + z * 3) * 23)) * .27;
    colors.set([grain * .98, grain, grain * 1.025], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

// Seconds, metres and gravity keep the fragments on a ballistic path. They
// scatter out of the broken rim, bounce once, then settle on the actual floor.
export function impactRubbleFlight(index, seconds) {
  const seed = rubbleNoise(index), scatter = rubbleNoise(index + 31), speed = 1.2 + rubbleNoise(index + 71) * 4.3;
  const t = Math.max(0, seconds - (index % 7) * .005), angle = index * 2.399 + seed * .35;
  const up = .9 + seed * 3.1, landing = up * 2 / 9.81, after = Math.max(0, t - landing);
  const travel = speed * Math.min(t, landing) + speed * .20 * (1 - Math.exp(-after * 5));
  const radius = .73 + scatter * .55 + travel;
  const y = .045 + (t <= landing ? Math.max(0, up * t - 4.905 * t * t) : Math.max(0, up * .19 * after - 4.905 * after * after));
  const spin = Math.min(t, landing + .17);
  return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius,
    rotation: [spin * (seed * 9 - 4), angle + spin * (scatter * 7 - 3), spin * 4],
    scale: [.50 + seed * .72, .52 + scatter * .65, .45 + rubbleNoise(index + 19) * .90] };
}

function craterRimGeometry() {
  const segments = 72, rings = 6, positions = [], colors = [], indices = [];
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= segments; i++) {
    const u = j / rings, a = i * TAU / segments, jagged = 1 + Math.sin(a * 13) * .045 + Math.sin(a * 29) * .024;
    const r = (.91 + u * .70) * jagged, ridge = Math.sin(u * Math.PI) * (.20 + Math.sin(a * 7) * .045);
    positions.push(Math.cos(a) * r, .012 + ridge, Math.sin(a) * r);
    const shade = .165 + u * .03 + Math.sin(a * 17 + j) * .025;
    colors.push(shade * .94, shade, shade * 1.04);
    if (j < rings && i < segments) { const k = j * (segments + 1) + i, next = k + segments + 1; indices.push(k, k + 1, next, next, k + 1, next + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function faultSlabGeometry(index) {
  const width = .78 + rubbleNoise(index + 181) * .14, length = .86 + rubbleNoise(index + 211) * .10;
  const corners = [[-.5, -.42], [-.38, -.5], [.36, -.5], [.5, -.33], [.5, .37], [.34, .5], [-.39, .5], [-.5, .31]];
  const shape = new THREE.Shape();
  corners.forEach(([x, z], i) => {
    const chipped = .96 + rubbleNoise(index * 17 + i + 241) * .08;
    if (i === 0) shape.moveTo(x * width * chipped, z * length * chipped);
    else shape.lineTo(x * width * chipped, z * length * chipped);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: true, bevelSize: .018, bevelThickness: .012, bevelSegments: 1, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, -.11, 0);
  const positions = geometry.attributes.position, colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const top = y > -.018, grain = .55 + rubbleNoise(Math.floor(x * 117 + z * 193) + index * 31) * .29;
    if (top) positions.setY(i, y + Math.sin(x * 23 + z * 19 + index) * .005);
    const shade = grain * (top ? 1 : .55);
    colors.set([shade * .94, shade, shade * 1.035], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
const noise = `
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec3(7.1,13.7,9.2);a*=.5;}return n;}`;

function planetMaterial(kind) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, kind: { value: kind }, damage: { value: 0 } },
    vertexShader: `varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normal;vPos=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vNormal;varying vec3 vPos;uniform float time;uniform float kind;uniform float damage;${noise}
    void main(){vec3 p=vPos;float n=fbm(p*5.5),fine=fbm(p*24.);vec3 c;
    if(kind<.5){float land=smoothstep(.46,.52,n);c=mix(vec3(.025,.17,.41),mix(vec3(.10,.28,.14),vec3(.48,.39,.22),fine),land);float ice=smoothstep(.74,.90,abs(p.y));c=mix(c,vec3(.75,.86,.91),ice);float cloud=smoothstep(.55,.69,fbm(p*9.+vec3(time*.018,0,0)));c=mix(c,vec3(.84,.89,.97),cloud*.55);}
    else if(kind<1.5){float stripe=sin(p.y*43.+n*9.)*.5+.5;c=mix(vec3(.35,.15,.10),vec3(.80,.56,.31),stripe);float eye=exp(-length((p.xy-vec2(.34,-.25))*vec2(9.,17.)));c=mix(c,vec3(.60,.20,.10),eye);}
    else if(kind<2.5){c=mix(vec3(.65,.48,.23),vec3(.89,.78,.55),.45+.35*sin(p.y*48.+n*3.));}
    else{c=mix(vec3(.29,.08,.045),vec3(.72,.31,.16),n);c*=.72+fine*.6;}
    float day=.25+.75*max(0.,dot(normalize(vNormal),normalize(vec3(-.7,.7,.9))));float crack=pow(max(0.,sin(p.x*33.+p.y*17.+n*20.)),38.)*damage;
    gl_FragColor=vec4(c*day+vec3(1.,.46,.13)*crack*2.,1.);}`,
  });
}

function atmosphereMaterial(color, opacity = .34) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: "varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}",
    fragmentShader: "varying vec3 vNormal;varying vec3 vView;uniform vec3 tint;uniform float opacity;void main(){float rim=pow(1.-abs(dot(vNormal,vView)),2.4);gl_FragColor=vec4(tint*1.8,rim*opacity);}",
  });
}

export function createCinematicWorld(scene) {
  const root = new THREE.Group();
  root.name = "Cinematic sets";
  root.visible = false;
  scene.add(root);
  const sets = new Map(), geometries = new Set(), materials = new Set();
  const ownGeometry = g => (geometries.add(g), g);
  const ownMaterial = m => (materials.add(m), m);
  const group = name => { const g = new THREE.Group(); g.name = name; root.add(g); sets.set(name, g); return g; };
  const mesh = (g, material, parent, position = [0, 0, 0]) => {
    const m = new THREE.Mesh(ownGeometry(g), ownMaterial(material));
    m.position.set(...position); parent.add(m); return m;
  };
  const basic = (color, opacity = 1) => ownMaterial(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, fog: false }));
  const metal = ownMaterial(new THREE.MeshStandardMaterial({ color: "#344b64", metalness: .76, roughness: .25, emissive: "#253a60", emissiveIntensity: .18 }));
  const warm = basic("#ffb778"), cold = basic("#91f5ff"), purple = basic("#bda1ff");
  const dummy = new THREE.Object3D();

  // Space includes a genuine curved Earth horizon, cloud layers, a sun and
  // different bodies that fracture individually as the opponent crosses them.
  const space = group("space");
  const sky = mesh(new THREE.SphereGeometry(65, 16, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: "varying vec3 dir;void main(){dir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 dir;${noise}void main(){float nebula=pow(fbm(dir*5.),3.);float band=exp(-abs(dir.y+.10)*13.);gl_FragColor=vec4(vec3(.002,.004,.014)+vec3(.055,.035,.14)*nebula+vec3(.035,.075,.13)*band,1.);}`,
  }), space);
  const starPositions = [], starColors = [];
  for (let i = 0; i < 380; i++) {
    const a = i * 2.399963, y = 1 - (i + .5) / 190, r = Math.sqrt(Math.max(0, 1 - y * y));
    starPositions.push(Math.cos(a) * r * 48, y * 48 + 8, Math.sin(a) * r * 48);
    const t = i % 5; starColors.push(t ? .72 : 1, t === 2 ? .62 : .84, t === 4 ? .65 : 1);
  }
  const starGeo = ownGeometry(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  starGeo.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeo, ownMaterial(new THREE.PointsMaterial({ size: .10, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .95, fog: false, depthWrite: false })));
  space.add(stars);
  const earthMat = ownMaterial(planetMaterial(0));
  const earth = mesh(new THREE.SphereGeometry(7, 48, 32), earthMat, space, [8, -5, -22]);
  const earthAir = mesh(new THREE.SphereGeometry(7.15, 32, 20), atmosphereMaterial("#5398ff", .50), space, [8, -5, -22]);
  const sunMat = ownMaterial(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: "varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float time;${noise}void main(){float flame=fbm(p*13.+vec3(time*.13,-time*.2,0));gl_FragColor=vec4(mix(vec3(1.5,.23,.04),vec3(2.,1.6,.6),flame),1.);}`,
  }));
  mesh(new THREE.SphereGeometry(5, 32, 20), sunMat, space, [-18, 19, -34]);
  mesh(new THREE.SphereGeometry(5.7, 24, 16), atmosphereMaterial("#ff873c", .65), space, [-18, 19, -34]);
  const planetGeo = ownGeometry(new THREE.SphereGeometry(1, 40, 28));
  const planets = [1, 2, 3].map((kind, i) => {
    const g = new THREE.Group(); space.add(g);
    const material = ownMaterial(planetMaterial(kind));
    const body = new THREE.Mesh(planetGeo, material); g.add(body);
    const halves = [0, 1].map(side => {
      const half = mesh(new THREE.SphereGeometry(1, 28, 20, side * Math.PI, Math.PI), material, g);
      half.visible = false; return half;
    });
    if (i === 1) {
      const ring = mesh(new THREE.RingGeometry(1.35, 2.25, 80, 1), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "varying vec3 p;void main(){float r=length(p.xy),band=.52+.48*sin(r*119.);float gap=1.-smoothstep(.015,.045,abs(r-1.85));gl_FragColor=vec4(vec3(.67,.51,.30)*(band*.6+.4),(.24+band*.55)*(1.-gap));}",
      }), g); ring.rotation.x = -1.2; ring.rotation.y = .22;
    }
    mesh(new THREE.SphereGeometry(1.025, 24, 16), atmosphereMaterial(i === 2 ? "#e27048" : "#d7b690", .26), g);
    return { root: g, body, halves, material, hit: [.43, .52, .61][i] };
  });
  const planetShards = new THREE.InstancedMesh(ownGeometry(new THREE.IcosahedronGeometry(.19, 0)), ownMaterial(new THREE.MeshStandardMaterial({ color: "#bd8864", roughness: .8, emissive: "#fa3b0a", emissiveIntensity: .7, fog: false })), 72);
  space.add(planetShards);
  const trails = Array.from({ length: 12 }, (_, i) => mesh(new THREE.CylinderGeometry(.008, .055, 5, 5), basic(i % 2 ? "#ff7843" : "#c3eaff", .36), space));

  // A tilted disc and a dark three-dimensional core are separate from the
  // distortion rings. The silhouette remains legible through the accretion.
  const singularity = group("singularity");
  const blackCore = mesh(new THREE.SphereGeometry(.8, 32, 24), basic("#000006"), singularity);
  const holeGlow = mesh(new THREE.SphereGeometry(.92, 32, 20), atmosphereMaterial("#b488ff", .84), singularity);
  const discMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 uvp;uniform float time;uniform float strength;${noise}void main(){vec2 p=(uvp-.5)*2.;float r=length(p),a=atan(p.y,p.x);float inner=smoothstep(.23,.31,r),outer=1.-smoothstep(.69,.99,r);float spiral=fbm(vec3(r*13.,sin(a*3.+r*18.-time*3.),cos(a*3.+r*18.-time*3.)));float ring=pow(.5+.5*sin(r*90.-time*4.+spiral*5.),4.);vec3 color=mix(vec3(.29,.06,.68),vec3(1.6,.64,.26),pow(1.-r,1.6));gl_FragColor=vec4(color*(.65+ring),inner*outer*(.28+spiral*.7)*strength);}`,
  }));
  const accretion = mesh(new THREE.PlaneGeometry(7, 7), discMaterial, singularity);
  accretion.rotation.x = -.96; accretion.rotation.z = .18;
  const lensRings = Array.from({ length: 5 }, (_, i) => {
    const m = mesh(new THREE.TorusGeometry(1 + i * .43, .012 + i * .004, 5, 64), basic(i % 2 ? "#927cff" : "#e9baff", .2), singularity);
    m.rotation.x = -.9; m.rotation.y = i * .12; return m;
  });
  const gravityLines = new THREE.InstancedMesh(ownGeometry(new THREE.ConeGeometry(.018, .55, 4)), basic("#cab4ff", .58), 70);
  singularity.add(gravityLines);
  const voidShell = mesh(new THREE.SphereGeometry(58, 12, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { time: { value: 0 } },
    vertexShader: "varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float time;${noise}void main(){float m=pow(fbm(p*7.+time*.016),3.);gl_FragColor=vec4(vec3(.008,.001,.018)+vec3(.12,.013,.26)*m,1.);}`,
  }), singularity);

  // The turbine has an open front so the fighter is visible inside its moving
  // blades. It is an industrial energy trap, never a gore animation.
  const turbine = group("turbine");
  const turbineFrame = new THREE.Group(); turbine.add(turbineFrame);
  const cageGeo = ownGeometry(new THREE.TorusGeometry(2.2, .16, 10, 64));
  [-.95, .95].forEach(z => { const ring = new THREE.Mesh(cageGeo, metal); ring.position.z = z; turbineFrame.add(ring); });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    mesh(new THREE.CylinderGeometry(.06, .06, 1.9, 8), metal, turbineFrame, [Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0]).rotation.x = Math.PI / 2;
  }
  const rotorA = new THREE.Group(), rotorB = new THREE.Group();
  turbineFrame.add(rotorA, rotorB); rotorA.position.z = -.76; rotorB.position.z = .80;
  [-.94, .94].forEach(z => mesh(new THREE.TorusGeometry(2.05, .022, 6, 64), basic("#9baeff", .75), turbineFrame, [0, 0, z]));
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(.46, -.11); bladeShape.lineTo(1.8, -.24); bladeShape.quadraticCurveTo(2.15, .02, 1.75, .38); bladeShape.lineTo(.46, .08); bladeShape.closePath();
  const bladeGeo = ownGeometry(new THREE.ExtrudeGeometry(bladeShape, { depth: .035, bevelEnabled: true, bevelThickness: .02, bevelSize: .025, bevelSegments: 2 }));
  const frontBladeMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#7999b9", emissive: "#5778a6", emissiveIntensity: .28, metalness: .55, roughness: .15, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide }));
  const rotors = [rotorA, rotorB].map((rotor, row) => {
    const edge = basic(row ? "#b5ecff" : "#cbb6ff", .86);
    for (let i = 0; i < 7; i++) { const g = new THREE.Group(); g.rotation.z = i * TAU / 7; rotor.add(g); g.add(new THREE.Mesh(bladeGeo, row ? frontBladeMaterial : metal)); const line = mesh(new THREE.BoxGeometry(1.34, .014, .02), edge, g, [1.13, .10, .064]); line.rotation.z = .08; }
    return rotor;
  });
  const turbineVortex = mesh(new THREE.CylinderGeometry(1.92, 1.92, 1.7, 48, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: .5 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 vUv;uniform float time;uniform float strength;void main(){float streak=pow(max(0.,sin(vUv.x*75.+vUv.y*20.-time*15.)),18.);gl_FragColor=vec4(vec3(.30,.72,1.)*(1.+streak),streak*strength);}",
  }), turbineFrame); turbineVortex.rotation.x = Math.PI / 2;

  const impact = group("impact");
  const craterRim = mesh(craterRimGeometry(), new THREE.MeshStandardMaterial({ color: "#454a52", vertexColors: true, roughness: .98, metalness: .015, side: THREE.DoubleSide }), impact);
  craterRim.receiveShadow = true;
  const craterDark = mesh(new THREE.CircleGeometry(1.08, 72), new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv;${noise}void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float grit=fbm(vec3(p*22.,0.));float edge=smoothstep(.35,1.,r);gl_FragColor=vec4(mix(vec3(.005,.007,.012),vec3(.058,.061,.069)+grit*.028,edge),1.);}`,
  }), impact); craterDark.rotation.x = -Math.PI / 2;
  const crackPoints = [];
  for (let i = 0; i < 14; i++) { const a = i * 2.399, length = .5 + rubbleNoise(i + 131) * 1.1; let previous = [Math.cos(a) * 1.15, .027, Math.sin(a) * 1.15];
    for (let j = 1; j <= 4; j++) { const radius = 1.15 + length * j / 4, angle = a + Math.sin(i * 7 + j * 5) * .11; const next = [Math.cos(angle) * radius, .027, Math.sin(angle) * radius]; crackPoints.push(...previous, ...next); previous = next; }
  }
  const craterCracks = new THREE.LineSegments(ownGeometry(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(crackPoints, 3))), ownMaterial(new THREE.LineBasicMaterial({ color: "#12151b", transparent: true, opacity: .82 }))); impact.add(craterCracks);
  const impactRings = Array.from({ length: 3 }, (_, i) => {
    const m = mesh(new THREE.TorusGeometry(1, .025, 6, 64), basic(i % 2 ? "#ffc295" : "#ff6a41", .55), impact);
    m.rotation.x = Math.PI / 2; return m;
  });
  const shardMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#81848a", vertexColors: true, metalness: .015, roughness: .97 }));
  const shards = new THREE.InstancedMesh(ownGeometry(createImpactRockGeometry()), shardMaterial, 64); shards.name = "Ballistic concrete rubble"; shards.castShadow = shards.receiveShadow = true; impact.add(shards);
  for (let i = 0; i < 64; i++) { const shade = .71 + rubbleNoise(i + 19) * .27; shards.setColorAt(i, new THREE.Color(shade * .98, shade, shade * 1.025)); }
  const dustMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { strength: { value: 0 }, tint: { value: new THREE.Color("#858384") }, time: { value: 0 } },
    vertexShader: "varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 uvp;uniform float strength;uniform vec3 tint;uniform float time;${noise}void main(){float r=length(uvp-.5)*2.;float n=fbm(vec3(uvp*9.,time*.15));gl_FragColor=vec4(tint,(1.-smoothstep(.15,1.,r))*n*strength);}`,
  }));
  const dust = mesh(new THREE.PlaneGeometry(2.8, 1.2), dustMaterial, impact, [0, .45, -.7]);
  const dustPuffs = Array.from({ length: 4 }, (_, i) => mesh(new THREE.PlaneGeometry(2.2, 1.1), dustMaterial, impact));

  // Fault sever tears two banks of actual pavement apart. The construction
  // stays at ankle height, leaving the weapon contacts and faces visible.
  const fractureGround = group("fracture-ground");
  const pavementMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#555b64", vertexColors: true, roughness: .97, metalness: .015 }));
  const faultSlabs = Array.from({ length: 8 }, (_, i) => {
    const slab = mesh(faultSlabGeometry(i), pavementMaterial, fractureGround);
    slab.name = "Split pavement slab"; slab.castShadow = slab.receiveShadow = true; return slab;
  });
  const faultDarkMaterial = basic("#10151a"), faultGlowMaterial = basic("#61aca6", .25);
  const faultDirection = new THREE.Vector3(), vertical = new THREE.Vector3(0, 1, 0);
  const faultPath = [[.02, -2.28], [-.08, -1.40], [.10, -.52], [-.07, .38], [.09, 1.32], [-.04, 2.27]];
  const faultSegments = [];
  for (let i = 0; i < faultPath.length - 1; i++) faultSegments.push([faultPath[i], faultPath[i + 1]]);
  for (let row = 0; row < 3; row++) for (const bank of [-1, 1]) {
    const z = (row - 1) * 1.02;
    faultSegments.push([[faultPath[row + 1][0], z], [bank * .85, z + bank * .10]], [[bank * .85, z + bank * .10], [bank * 1.9, z + bank * .24]]);
  }
  const faultLines = faultSegments.map(([a, b]) => {
    const dark = mesh(new THREE.CylinderGeometry(.036, .036, 1, 5), faultDarkMaterial, fractureGround);
    const glow = mesh(new THREE.CylinderGeometry(.009, .009, 1, 5), faultGlowMaterial, fractureGround);
    dark.name = "Broken pavement seam"; glow.name = "Ground fault edge";
    faultDirection.set(b[0] - a[0], 0, b[1] - a[1]); const length = faultDirection.length(); faultDirection.normalize();
    for (const line of [dark, glow]) {
      line.position.set((a[0] + b[0]) / 2, line === dark ? .010 : .018, (a[1] + b[1]) / 2);
      line.quaternion.setFromUnitVectors(vertical, faultDirection); line.scale.y = length;
    }
    return { dark, glow };
  });

  const mirror = group("mirror");
  const mirrorMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#aee8e1", metalness: .90, roughness: .12, transparent: true, opacity: .35, side: THREE.DoubleSide, clearcoat: 1 }));
  const mirrorPanels = Array.from({ length: 8 }, (_, i) => {
    const g = new THREE.Group(); mirror.add(g);
    mesh(new THREE.PlaneGeometry(.72, 3.2), mirrorMaterial, g);
    mesh(new THREE.BoxGeometry(.73, .012, .012), cold, g, [0, 1.61, .006]);
    mesh(new THREE.BoxGeometry(.73, .012, .012), cold, g, [0, -1.61, .006]);
    mesh(new THREE.BoxGeometry(.012, 3.2, .012), cold, g, [-.365, 0, .006]);
    return g;
  });
  const floatingBlades = Array.from({ length: 18 }, (_, i) => {
    const shape = new THREE.Shape(); shape.moveTo(-.04, -.7); shape.lineTo(.035, -.7); shape.lineTo(.06, .5); shape.lineTo(0, .92); shape.lineTo(-.035, .5); shape.closePath();
    return mesh(new THREE.ExtrudeGeometry(shape, { depth: .02, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1 }), i % 2 ? cold : purple, mirror);
  });
  let echoSource = null, echoPool = [], echoMaterials = [];
  const clearEchoes = () => {
    const skeletons = new Set();
    echoPool.forEach(e => { e.root.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton); }); mirror.remove(e.root); });
    skeletons.forEach(skeleton => skeleton.dispose());
    echoMaterials.forEach(m => m.dispose()); echoPool = []; echoMaterials = []; echoSource = null;
  };
  const prepareEchoes = attacker => {
    if (!attacker?.root || echoSource === attacker.root) return;
    clearEchoes(); echoSource = attacker.root;
    const originals = []; attacker.root.traverse(o => originals.push(o));
    for (let i = 0; i < 3; i++) {
      const cloned = cloneSkeleton(attacker.root), copies = []; cloned.traverse(o => copies.push(o));
      cloned.traverse(o => { if (o.isMesh) { const material = new THREE.MeshBasicMaterial({ color: i % 2 ? "#d0baff" : "#a0ffe6", transparent: true, opacity: .18, depthWrite: false, fog: false }); echoMaterials.push(material); o.material = material; o.castShadow = o.receiveShadow = false; } });
      mirror.add(cloned); echoPool.push({ root: cloned, originals, copies });
    }
  };

  const prism = group("prism");
  const prismMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({ color: "#a794f8", roughness: .12, metalness: .7, clearcoat: 1, transparent: true, opacity: .65 }));
  const prisms = Array.from({ length: 16 }, (_, i) => mesh(new THREE.OctahedronGeometry(.34, 0), prismMaterial, prism));
  const diagram = mesh(new THREE.RingGeometry(.85, .875, 80), basic("#d6c5ff", .7), prism); diagram.rotation.x = -Math.PI / 2;
  const integralColumns = new THREE.InstancedMesh(ownGeometry(new THREE.BoxGeometry(.1, 1, .26)), basic("#aa98ff", .40), 32); prism.add(integralColumns);
  const integralCurvePoints = Array.from({ length: 41 }, (_, i) => { const x = i / 40; return new THREE.Vector3((x - .5) * 4.5, .35 + Math.sin(x * Math.PI) * 2.3, -.05); });
  const curve = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(integralCurvePoints), 50, .022, 5, false), basic("#e9d9ff"), prism);
  const graphLineGeometry = ownGeometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.3, 0, 0), new THREE.Vector3(2.3, 0, 0), new THREE.Vector3(-2.3, 0, 0), new THREE.Vector3(-2.3, 3, 0)]));
  const graphAxes = new THREE.LineSegments(graphLineGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#b9a5df", transparent: true, opacity: .7, fog: false }))); prism.add(graphAxes);

  const inferno = group("inferno");
  const fireMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 uvp;uniform float time;uniform float strength;${noise}void main(){float n=fbm(vec3(uvp*vec2(8.,5.),time*.55));float flame=1.-uvp.y-n*.55;float sides=smoothstep(0.,.14,uvp.x)*(1.-smoothstep(.86,1.,uvp.x));float a=smoothstep(.05,.4,flame)*sides*strength;gl_FragColor=vec4(mix(vec3(1.4,.14,.035),vec3(1.8,1.25,.35),pow(1.-uvp.y,3.)),a);}`,
  }));
  const flamePlumes = Array.from({ length: 9 }, (_, i) => mesh(new THREE.PlaneGeometry(.85, 3.4), fireMaterial, inferno));
  const furnaceBands = Array.from({ length: 3 }, (_, i) => {
    const m = mesh(new THREE.TorusGeometry(1.7 + i * .4, .045, 6, 64), basic(i % 2 ? "#ffe1a6" : "#ff792c", .80), inferno); m.rotation.x = -Math.PI / 2; return m;
  });

  const storm = group("storm");
  const stormCloudMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: "#101425", transparent: true, opacity: .56, depthWrite: false, fog: false }));
  const stormClouds = Array.from({ length: 7 }, (_, i) => {
    const cloud = mesh(new THREE.SphereGeometry(1.6, 12, 8), stormCloudMaterial, storm, [(i - 3) * 1.1, 6.1 + i % 2 * .3, -3.4]);
    cloud.scale.set(1.6, .42, 1); return cloud;
  });
  const lightningGeometry = ownGeometry(new THREE.BufferGeometry());
  lightningGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(14 * 3 * 2), 3));
  const bolt = new THREE.LineSegments(lightningGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#d6e8ff", transparent: true, opacity: .95, fog: false }))); storm.add(bolt);
  const thunderRings = Array.from({ length: 3 }, (_, i) => mesh(new THREE.TorusGeometry(1 + i * .6, .035, 6, 64), basic(i % 2 ? "#b999ff" : "#aeccff", .5), storm));
  const riftMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: "varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 uvp;uniform float time;uniform float strength;${noise}void main(){vec2 p=uvp-.5;float r=length(p*vec2(1.,.5));float a=atan(p.y,p.x);float edge=exp(-abs(r-.25)*68.);float n=fbm(vec3(uvp*8.,time*.20));vec3 color=mix(vec3(.25,.05,.65),vec3(.5,.7,1.8),edge);float opacity=(edge*.85+step(r,.25)*n*.42)*strength;gl_FragColor=vec4(color,opacity);}`,
  }));
  const rift = mesh(new THREE.PlaneGeometry(5, 7), riftMaterial, storm);
  const riftSky = mesh(new THREE.SphereGeometry(58, 14, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { time: { value: 0 } },
    vertexShader: "varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float time;${noise}void main(){float n=fbm(p*9.+vec3(time*.025,0,0));float fissure=pow(max(0.,1.-abs(sin(p.x*14.+p.y*9.+n*8.))),20.);gl_FragColor=vec4(vec3(.005,.013,.025)+vec3(.012,.024,.063)*n+vec3(.09,.14,.27)*fissure,1.);}`,
  }), storm);

  const skyWeapons = group("sky-weapons");
  const constellationNodes = new THREE.InstancedMesh(ownGeometry(new THREE.OctahedronGeometry(.1, 0)), warm, 14); skyWeapons.add(constellationNodes);
  const constellationGeometry = ownGeometry(new THREE.BufferGeometry()); constellationGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(13 * 6), 3));
  const constellationLines = new THREE.LineSegments(constellationGeometry, ownMaterial(new THREE.LineBasicMaterial({ color: "#ffe9be", transparent: true, opacity: .58, fog: false }))); skyWeapons.add(constellationLines);
  const meteorBodies = new THREE.InstancedMesh(ownGeometry(new THREE.IcosahedronGeometry(.20, 1)), ownMaterial(new THREE.MeshStandardMaterial({ color: "#332f31", emissive: "#ff7c20", emissiveIntensity: 1.5, roughness: .75, fog: false })), 20); skyWeapons.add(meteorBodies);
  const meteorTails = new THREE.InstancedMesh(ownGeometry(new THREE.ConeGeometry(.20, 1.7, 6)), basic("#ffc978", .54), 20); skyWeapons.add(meteorTails);
  const eclipseDisc = mesh(new THREE.SphereGeometry(2, 32, 20), basic("#040611"), skyWeapons, [0, 5, -7]);
  const eclipseCorona = mesh(new THREE.TorusGeometry(2.09, .04, 6, 80), basic("#ffcc85", .9), skyWeapons, [0, 5, -6.9]);
  const alternateSets = createAlternateCinematicSets(root, { mesh, basic, metal, ownGeometry, ownMaterial, planetMaterial, noise });

  let lastAnimation = null;
  const reset = () => { root.visible = false; sets.forEach(g => { g.visible = false; }); alternateSets.reset(); if (echoPool.length) clearEchoes(); };
  reset();

  function update({ frame, animation, time = 0, low = false, reduced = false, attacker, defender } = {}) {
    const s = frame?.spectacle;
    if (!s || !animation?.finisher || frame.progress >= 1 || !frame.revealed || animation.outcome === "draw") { reset(); return { hideEnvironment: false }; }
    const p = clamp(s.phase ?? frame.progress), sign = s.direction === -1 ? -1 : 1;
    const center = s.center ?? [sign * 2.1, 1.7, 0], intensity = clamp(s.intensity ?? 1);
    const scale = reduced ? .6 : 1, countScale = low ? .6 : 1;
    root.visible = true; sets.forEach(g => { g.visible = false; });
    if (lastAnimation !== animation.id) {
      // A rival can reuse the same body with a new costume on the next floor.
      // Fresh echoes follow that live costume and release the previous skins.
      lastAnimation = animation.id; clearEchoes();
    }
    const showSpace = s.world === "space";
    space.visible = showSpace;
    if (showSpace) {
      sky.position.set(center[0] * .12, center[1] * .1, center[2] * .08);
      stars.rotation.y = reduced ? .03 : time * .003;
      earth.rotation.y = time * .025; earthMat.uniforms.time.value = time; sunMat.uniforms.time.value = time;
      earth.position.set(sign * 8, -6, -24); earthAir.position.copy(earth.position);
      planets.forEach((planet, i) => {
        const hit = planet.hit, approach = span(p, hit - .055, hit + .035), age = span(p, hit, hit + .07);
        planet.root.visible = s.kind === "orbital" && p > hit - .08 && p < hit + .07;
        planet.root.position.set(center[0] + sign * (4.5 - approach * 7.2), center[1] + .20 - age * 1.1, center[2] - 1.8 - i * .12);
        const radius = [2.4, 1.8, 1.9][i]; planet.root.scale.setScalar(radius * (1 - age * .4));
        planet.body.visible = age < .12;
        planet.halves.forEach((half, side) => {
          half.visible = age >= .12;
          half.position.set((side ? 1 : -1) * age * 1.3, -age * age * .8, (side ? -1 : 1) * age * .3);
          half.rotation.set(age * (side ? -.8 : .8), side * age * .35, age * (side ? .45 : -.45));
        });
        planet.body.rotation.y = time * (.17 + i * .09);
        planet.material.uniforms.time.value = time; planet.material.uniforms.damage.value = pulse(p, hit, .045) * 1.7;
      });
      planetShards.visible = s.kind === "orbital" && p >= .43 && p < .69;
      for (let i = 0; i < 72; i++) {
        const bodyIndex = Math.floor(i / 24), local = i % 24, age = span(p, [.43, .52, .61][bodyIndex], [.51, .60, .69][bodyIndex]);
        const a = local * 2.399, r = .8 + age * 5;
        dummy.position.set(center[0] + Math.cos(a) * r, center[1] + Math.sin(a * 1.71) * r * .8, center[2] - 1.8 + Math.sin(a) * r);
        dummy.rotation.set(age * local * .43, a, age * local * .8); dummy.scale.setScalar(age > 0 && age < 1 ? (.35 + local % 3 * .23) * (1 - age * .65) : 0);
        dummy.updateMatrix(); planetShards.setMatrixAt(i, dummy.matrix);
      }
      planetShards.instanceMatrix.needsUpdate = true;
      trails.forEach((m, i) => { m.visible = s.kind === "orbital" && p > .35 && p < .83 && i < 12 * countScale; m.position.set(center[0] + Math.sin(i * 9) * 2.2, center[1] + Math.cos(i * 7) * 2.2, center[2] - 2 - i * .11); m.rotation.x = Math.PI / 2 + .3; m.scale.y = .3 + intensity * 1.6; });
    } else { planets.forEach(planet => { planet.root.visible = false; }); }

    singularity.visible = s.kind === "singularity" && p > .21 && p < .91;
    if (singularity.visible) {
      const growth = smooth(span(p, .21, .42)), collapse = span(p, .77, .89);
      // Anchor the event horizon behind the victim rather than covering them.
      const anchor = s.anchor ?? [sign * 2.1, 5.4, -2.25]; singularity.position.set(...anchor);
      const size = (.15 + growth * 1.18) * (1 - collapse * .85); blackCore.scale.setScalar(size); holeGlow.scale.setScalar(size);
      accretion.scale.setScalar(.25 + growth * .98 - collapse * .8);
      accretion.rotation.z = .18 + (reduced ? 0 : time * .17); discMaterial.uniforms.time.value = time; discMaterial.uniforms.strength.value = intensity * (1 - collapse);
      lensRings.forEach((m, i) => { m.scale.setScalar(.3 + growth + Math.sin(time * .5 + i) * .025 * scale); m.rotation.z = time * .12 * (i % 2 ? 1 : -1) * scale; m.material.opacity = (.1 + growth * .18) * (1 - collapse); });
      gravityLines.count = Math.floor(70 * countScale);
      for (let i = 0; i < gravityLines.count; i++) {
        const a = i * 2.399 + time * .9 * scale, u = (i * .173 + time * .18 * scale) % 1, r = .85 + (1 - u) * 4;
        dummy.position.set(Math.cos(a) * r, Math.sin(a * .8) * r * .5, Math.sin(a) * r * .52); dummy.rotation.set(.2, -a, a + Math.PI / 2); dummy.scale.set(.45, .5 + u * 1.3, .45); dummy.updateMatrix(); gravityLines.setMatrixAt(i, dummy.matrix);
      }
      gravityLines.instanceMatrix.needsUpdate = true; voidShell.visible = s.world === "void"; voidShell.position.set(-anchor[0], -anchor[1], -anchor[2]); voidShell.material.uniforms.time.value = time;
    }

    turbine.visible = s.kind === "turbine" && p > .22 && p < .92;
    if (turbine.visible) {
      turbine.position.set(...center); turbine.position.z -= .20; turbineFrame.rotation.y = Math.sin(p * 4) * .13;
      const opening = smooth(span(p, .22, .39)), release = span(p, .82, .94); turbineFrame.scale.setScalar((.2 + opening * .8) * (1 + release * .6));
      turbineFrame.position.y = 0;
      rotors[0].rotation.z = time * (3.2 + intensity * 8) * scale; rotors[1].rotation.z = -time * (4.4 + intensity * 8) * scale;
      turbineVortex.material.uniforms.time.value = time; turbineVortex.material.uniforms.strength.value = .32 * opening * (1 - release);
    }

    const impactKinds = ["fracture", "crater", "orbital", "inferno", "blade-storm", "meteor", "thunder", "turbine", "rift"];
    const finalHit = animation.impactAt ?? .82, impactSeconds = Math.max(0, (p - finalHit) * (animation.duration ?? 9000) / 1000);
    impact.visible = impactKinds.includes(s.kind) && p + 1e-9 >= finalHit;
    if (impact.visible) {
      impact.position.set(sign * 2.1, .02, 0);
      const crater = ["crater", "orbital", "meteor"].includes(s.kind), fracture = s.kind === "fracture";
      const craterScale = 1.03 + Math.min(.11, impactSeconds * .25);
      craterRim.visible = crater; craterDark.visible = crater; craterCracks.visible = crater;
      craterRim.scale.setScalar(craterScale); craterDark.scale.setScalar(craterScale); craterDark.position.y = .002;
      craterCracks.scale.setScalar(craterScale);
      impactRings.forEach((m, i) => { const expansion = clamp((impactSeconds - i * .05) / (.50 + i * .10)); m.scale.setScalar(.35 + expansion * (4.3 + i)); m.position.y = .035 + i * .01; m.material.opacity = (fracture ? .28 : .56) * (1 - expansion); m.material.color.set(fracture ? "#71b2aa" : ["turbine", "rift", "thunder"].includes(s.kind) ? "#a4c9ff" : "#d4c3b0"); });
      shards.count = Math.floor(64 * countScale); shardMaterial.color.set(fracture ? "#7c8589" : crater ? "#858990" : "#86808f");
      shardMaterial.roughness = crater || fracture ? .97 : .74; shardMaterial.metalness = crater || fracture ? .015 : .22;
      shardMaterial.emissive.set("#000000"); shardMaterial.emissiveIntensity = 0;
      for (let i = 0; i < shards.count; i++) { const flight = impactRubbleFlight(i, impactSeconds); dummy.position.set(flight.x, flight.y, flight.z); dummy.rotation.set(...flight.rotation); dummy.scale.set(...flight.scale); dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix); }
      shards.instanceMatrix.needsUpdate = true;
      dustMaterial.uniforms.strength.value = (crater ? .66 : .30) * Math.exp(-impactSeconds * 1.7); dustMaterial.uniforms.time.value = time;
      dustMaterial.uniforms.tint.value.set(crater ? "#868384" : fracture ? "#719497" : "#817c8d");
      dust.scale.set(1 + impactSeconds * 1.05, 1 + impactSeconds * .40, 1); dust.position.y = .45 + impactSeconds * .35;
      dustPuffs.forEach((m, i) => { const a = i * TAU / 4 + .4, radius = 1.0 + impactSeconds * 1.5; m.visible = crater && (!low || i % 2 === 0); m.position.set(Math.cos(a) * radius, .38 + impactSeconds * .22 + (i % 2) * .11, Math.sin(a) * radius); m.rotation.y = a + Math.PI / 2; m.scale.set(1 + impactSeconds * .8, .7 + impactSeconds * .32, 1); });
    }

    fractureGround.visible = s.kind === "fracture" && p > .18 && p < .98;
    if (fractureGround.visible) {
      const opening = smooth(span(p, .18, .38)), release = span(p, finalHit, .98);
      const contact = Math.max(0, ...(animation.contacts ?? []).map(([at]) => pulse(p, at, .05)), pulse(p, finalHit, .055));
      fractureGround.position.set(sign * 2.1, .024, 0);
      faultSlabs.forEach((slab, i) => {
        const bank = i % 2 ? 1 : -1, row = Math.floor(i / 2), breakage = opening * (.035 + contact * .075 + release * .13);
        slab.position.set(bank * (.57 + breakage + Math.sin(row * 4.1) * .035), -.13 + opening * .145 + contact * .085 + release * .045, (row - 1.5) * 1.04 + Math.sin(i * 7.3) * .03);
        slab.rotation.set(opening * Math.sin(i * 2.4) * (.045 + contact * .08), Math.sin(i * 3.7) * .04, -bank * opening * (.045 + contact * .13 + release * .045));
      });
      faultGlowMaterial.opacity = opening * (.18 + intensity * .13 + contact * .12) * (1 - release * .6);
      faultLines.forEach(({ dark, glow }, i) => { dark.visible = true; glow.visible = !low || i < 11; });
    }

    mirror.visible = ["mirror", "blade-storm"].includes(s.kind) && p > .18 && p < .91;
    if (mirror.visible) {
      const buildup = span(p, .18, .36), release = span(p, .77, .92);
      mirror.position.set(...center);
      mirrorPanels.forEach((g, i) => { const a = i * TAU / 8 + .3; g.visible = s.kind !== "blade-storm"; g.position.set(Math.cos(a) * (2.8 + release * 3), .1 + Math.sin(i * 4.3) * .3, Math.sin(a) * (2.8 + release * 3)); g.rotation.set(release * (i - 3) * .23, -a + Math.PI / 2 + release * 1.3, release * .4 * (i % 2 ? 1 : -1)); g.scale.setScalar(buildup); });
      floatingBlades.forEach((m, i) => { const a = i * TAU / 18 + time * .8 * scale, contact = pulse(p, .36 + (i % 6) * .058, .045), r = 3.5 * (1 - contact * .78) + release * 3; m.visible = s.kind === "blade-storm" && i < 18 * countScale; m.position.set(Math.cos(a) * r, Math.sin(i * 2.2) * 1.5, Math.sin(a) * r); m.rotation.set(-Math.sin(a) * .6, a + Math.PI / 2, -Math.PI / 2 - a); m.scale.setScalar(.5 + buildup * .5); });
      if (s.kind === "mirror" || s.kind === "blade-storm") {
        prepareEchoes(attacker);
        echoPool.forEach((echo, i) => {
          echo.root.visible = !reduced && (!low || i === 0) && p > .32 && p < .77;
          if (!echo.root.visible) return;
          echo.originals.forEach((original, j) => { const copy = echo.copies[j]; if (!copy) return; copy.position.copy(original.position); copy.quaternion.copy(original.quaternion); copy.scale.copy(original.scale); copy.visible = original.visible; });
          const contactTimes = (animation.contacts ?? []).map(([at]) => at);
          const echoHit = contactTimes[[0, 2, 3][i]] ?? .39 + i * .12;
          const a = i * TAU / 3 + time * .32, attack = pulse(p, echoHit, .07), r = 2.6 - attack * 1.25;
          echo.root.position.set(Math.cos(a) * r, -1.7 * attacker.root.scale.y / 1.35 + attack * .22, Math.sin(a) * r); echo.root.rotation.y = -a - Math.PI / 2; echo.root.scale.copy(attacker.root.scale);
          echo.root.traverse(o => { if (o.isMesh) o.material.opacity = .15 + attack * .24; });
        });
      } else echoPool.forEach(e => { e.root.visible = false; });
    } else echoPool.forEach(e => { e.root.visible = false; });

    prism.visible = ["prism", "integral"].includes(s.kind) && p > .15 && p < .94;
    if (prism.visible) {
      prism.position.set(sign * 1.15, .04, 0); const growth = smooth(span(p, .15, .39)), collapse = span(p, .75, .91);
      diagram.position.set(.7 * sign, .015, -.1); diagram.scale.setScalar(.5 + growth * 2.3); diagram.rotation.z = time * .25 * scale;
      prisms.forEach((m, i) => { const a = i * TAU / 16 + time * .32 * scale; const r = (1.2 + growth * 1.6) * (1 - collapse * .7); m.position.set(sign * .7 + Math.cos(a) * r, .2 + growth * (1.2 + Math.sin(a * 3) * .7), Math.sin(a) * r * .75); m.rotation.set(time * .25 + i, time * .35, a); m.scale.set(.45, .8 + pulse(p, .39 + i % 4 * .08, .05) * 2, .45); m.visible = s.kind === "prism" || i % 4 === 0; });
      integralColumns.visible = s.kind === "integral"; curve.visible = graphAxes.visible = s.kind === "integral";
      if (s.kind === "integral") { const sweep = span(p, .25, .69); for (let i = 0; i < 32; i++) { const u = (i + .5) / 32, height = (.35 + Math.sin(u * Math.PI) * 2.3) * growth, release = Math.max(0, (collapse - i / 80) * 1.7); dummy.position.set(sign * .1 + (u - .5) * 4.5 + release * sign * 2, height / 2 + release * 2, -.10 + Math.sin(i * .7) * release); dummy.scale.set(.9, i / 32 < sweep ? height * (1 - release * .55) : .02, 1); dummy.rotation.set(0, release * 3, release * (i - 15) * .04); dummy.updateMatrix(); integralColumns.setMatrixAt(i, dummy.matrix); } integralColumns.instanceMatrix.needsUpdate = true; curve.scale.setScalar(growth); graphAxes.scale.setScalar(growth); curve.material.opacity = 1 - collapse; }
    }

    inferno.visible = s.kind === "inferno" && p > .19 && p < .95;
    if (inferno.visible) { inferno.position.set(sign * 2.1, 0, 0); const ignition = smooth(span(p, .19, .42)), burn = 1 - span(p, .82, .98); flamePlumes.forEach((m, i) => { const a = i * TAU / 9, r = 1.55 + Math.sin(i * 4.1 + time * .3) * .2; m.position.set(Math.cos(a) * r, 1.4 + Math.sin(time * 1.7 + i) * .14 * scale, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; m.scale.set(ignition, ignition * (1 + intensity * .65), 1); m.visible = i < 9 * countScale; }); fireMaterial.uniforms.time.value = time; fireMaterial.uniforms.strength.value = .70 * burn; furnaceBands.forEach((m, i) => { m.position.y = .05 + i * .12 + pulse(p, .52 + i * .11, .10) * 1.5; m.scale.setScalar(ignition * (1 + span(p, .74, .96) * 2)); m.material.opacity = burn * .72; }); }

    storm.visible = ["thunder", "rift"].includes(s.kind) && p > .19 && p < .95;
    if (storm.visible) {
      const stormStrength = span(p, .19, .40) * (1 - span(p, .86, .98)); storm.position.set(sign * 2.1, 0, 0); stormCloudMaterial.opacity = stormStrength * .56; stormClouds.forEach((m, i) => { m.visible = s.kind === "thunder"; m.position.x = (i - 3) * 1.1 + Math.sin(time * .17 + i) * .12 * scale; });
      const strikeTimes = (animation.contacts ?? [[.33], [.52]]).map(([at]) => at);
      const strike = Math.max(...strikeTimes.map(at => pulse(p, at, .034)), pulse(p, finalHit, .043));
      bolt.visible = s.kind === "thunder" && strike > .03;
      const positions = lightningGeometry.attributes.position.array;
      for (let i = 0; i < 14; i++) { const y = 6.2 - i * .42, nextY = y - .42; const x = Math.sin(i * 15.2 + Math.floor(p * 120)) * (.19 + y * .06), nextX = Math.sin((i + 1) * 15.2 + Math.floor(p * 120)) * (.19 + nextY * .06); positions.set([x, y, -.2, nextX, nextY, -.2], i * 6); } lightningGeometry.attributes.position.needsUpdate = true; bolt.material.opacity = .50 + strike * .50;
      thunderRings.forEach((m, i) => { m.visible = s.kind === "thunder"; m.position.set(0, .6 + i * .9, -.25); m.rotation.set(.6 + Math.sin(time * .5 + i) * .12, .2, time * .35 * scale); m.scale.setScalar(.15 + stormStrength * .8); m.material.opacity = stormStrength * .3 + strike * .5; });
      rift.visible = s.kind === "rift"; rift.position.set(.1 * sign, 2.9, -1.4); rift.scale.setScalar(.2 + stormStrength); rift.rotation.z = sign * .18; riftMaterial.uniforms.time.value = time; riftMaterial.uniforms.strength.value = stormStrength;
      riftSky.visible = s.kind === "rift" && s.world === "void"; riftSky.material.uniforms.time.value = time;
    }

    skyWeapons.visible = ["meteor", "constellation", "eclipse"].includes(s.kind) && p > .18 && p < .94;
    if (skyWeapons.visible) {
      const skyStrength = span(p, .18, .38) * (1 - span(p, .83, .97)); skyWeapons.position.set(sign * 1.2, .1, 0);
      const nodes = [];
      for (let i = 0; i < 14; i++) { const a = i * 2.399, r = 1.7 + (i % 4) * .52, pos = [Math.cos(a) * r, 3.6 + Math.sin(a) * r * .54, -2.1 - (i % 3) * .18]; nodes.push(pos); dummy.position.set(...pos); dummy.rotation.set(0, time * .4 * scale, 0); dummy.scale.setScalar(skyStrength * (1 + pulse(p, .37 + i * .023, .024) * 1.4)); dummy.updateMatrix(); constellationNodes.setMatrixAt(i, dummy.matrix); } constellationNodes.instanceMatrix.needsUpdate = true;
      const linePositions = constellationGeometry.attributes.position.array; for (let i = 0; i < 13; i++) linePositions.set([...nodes[i], ...nodes[i + 1]], i * 6); constellationGeometry.attributes.position.needsUpdate = true;
      constellationNodes.visible = constellationLines.visible = s.kind === "constellation"; constellationLines.material.opacity = skyStrength * .7;
      meteorBodies.visible = meteorTails.visible = s.kind !== "constellation"; meteorBodies.count = meteorTails.count = Math.floor(20 * countScale);
      for (let i = 0; i < meteorBodies.count; i++) { const launch = .34 + (i % 7) * .043, flight = span(p, launch, launch + .22), x = Math.sin(i * 17.1) * 2.0, z = Math.cos(i * 7.3) * 1.3; dummy.position.set(x + sign * (1 - flight) * 3, .35 + (1 - flight) * (5 + i % 4), z); dummy.rotation.set(flight * 2, i, -sign * .6); dummy.scale.setScalar(flight > 0 && flight < 1 ? .55 + i % 3 * .22 : 0); dummy.updateMatrix(); meteorBodies.setMatrixAt(i, dummy.matrix); dummy.position.y += .75; dummy.position.x += sign * .3; dummy.rotation.z = sign * -.4; dummy.updateMatrix(); meteorTails.setMatrixAt(i, dummy.matrix); } meteorBodies.instanceMatrix.needsUpdate = meteorTails.instanceMatrix.needsUpdate = true;
      eclipseDisc.visible = eclipseCorona.visible = s.kind === "eclipse"; eclipseDisc.scale.setScalar(.2 + skyStrength * .8); eclipseCorona.scale.setScalar(.2 + skyStrength * .8); eclipseCorona.rotation.z = time * .18 * scale;
    }
    alternateSets.update({ s, frame, animation, time, low, reduced });
    return { hideEnvironment: s.world === "space" || s.world === "void", world: s.world ?? "arena" };
  }

  return {
    root, update, reset,
    dispose() {
      clearEchoes();
      root.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      scene.remove(root); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    },
  };
}
