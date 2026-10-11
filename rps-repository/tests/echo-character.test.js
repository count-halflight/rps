import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createRiggedFighter } from "../src/components/riggedFighter.js";
import { FACIAL_TARGETS, facialExpressionWeights } from "../src/components/facialExpressions.js";

let echoAsset;
function loadEcho() {
  echoAsset ??= readFile(new URL("../public/models/echo-human.glb", import.meta.url))
    .then((bytes) => createTexturedGltfLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
    ));
  return echoAsset;
}

function faceMeshes(root) {
  const meshes = [];
  root.traverse((object) => {
    if (object.isMesh && object.morphTargetDictionary) meshes.push(object);
  });
  return meshes;
}

function assertFiniteWeights(weights) {
  assert.deepEqual(Object.keys(weights), FACIAL_TARGETS);
  for (const [target, value] of Object.entries(weights)) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1,
      `${target} must remain a finite influence in [0, 1]`);
  }
}

test("facial expressions reset, clamp malformed inputs, and keep each pose independent", () => {
  const input = { expression: { hurt: 2, grit: -3, smirk: NaN, shout: Infinity },
    face: { browUp: 0.45, missingTarget: 1 }, blink: -1 };
  const weights = facialExpressionWeights(input, Infinity);
  assertFiniteWeights(weights);
  assert.equal(weights.hurt, 1);
  assert.equal(weights.grit, 0);
  assert.equal(weights.smirk, 0);
  assert.equal(weights.shout, 0);
  assert.equal(weights.browUp, 0.45);
  assert.equal(weights.blink, 0);
  assert.ok(Number.isNaN(input.expression.smirk), "input expression is not mutated");
  weights.hurt = 0.4;
  const next = facialExpressionWeights({}, 1);
  assert.equal(next.hurt, 0, "the next neutral pose does not retain a hit expression");
  assert.notEqual(next, weights);
  for (const pose of [null, false, "hurt", { expression: "unknown" },
    { face: { blink: undefined, hurt: "1" } }, { expressionIntensity: Infinity }]) {
    for (const time of [NaN, Infinity, -Infinity, -0.15, 1e6]) {
      assertFiniteWeights(facialExpressionWeights(pose, time));
    }
  }
});

test("facial expression aliases and the brief eyelid blink support explicit cinematic overrides", () => {
  const focus = facialExpressionWeights({ expression: "focus", blink: 0 }, 1);
  assert.ok(focus.browDown > 0 && focus.grit > 0);
  assert.ok(facialExpressionWeights({ expression: "win" }, 1).smirk > 0);
  assert.ok(facialExpressionWeights({ expression: "hurt" }, 1).hurt > 0);
  assert.ok(facialExpressionWeights({ expression: "shout" }, 1).shout > 0);
  assert.equal(facialExpressionWeights({ expression: " BROWUP " }, 1).browUp, 1);
  assert.deepEqual(facialExpressionWeights({ expression: "calm" }, 1),
    facialExpressionWeights({ expression: "neutral" }, 1));
  assert.equal(facialExpressionWeights({ expression: "shout", expressionIntensity: 0.25 }, 1).shout, 0.25);
  for (const time of [0.15, 4.95, 9.75]) {
    assert.ok(facialExpressionWeights({}, time).blink > 0.999, "the lids fully close at the blink apex");
  }
  for (const time of [0, 0.3, 2, 4.7]) assert.equal(facialExpressionWeights({}, time).blink, 0);
  assert.equal(facialExpressionWeights({ face: { blink: 0 } }, 0.15).blink, 0);
  assert.equal(facialExpressionWeights({ face: { blink: 1 }, blink: 0.4 }, 1).blink, 0.4);
  assert.equal(facialExpressionWeights({ expression: "shout", face: { shout: 0 } }, 1).shout, 0);
});

test("the shipped Echo GLB retains seven distinct nonempty facial deformation targets", async () => {
  const gltf = await loadEcho();
  gltf.scene.updateMatrixWorld(true);
  const meshes = faceMeshes(gltf.scene);
  assert.ok(meshes.length, "the production GLB contains facial morph targets");
  const fingerprints = new Set();
  for (const target of FACIAL_TARGETS) {
    let moved = 0, peak = 0;
    const fingerprint = [];
    for (const mesh of meshes) {
      const index = mesh.morphTargetDictionary[target];
      if (index === undefined) continue;
      const base = mesh.geometry.getAttribute("position");
      const shape = mesh.geometry.morphAttributes.position?.[index];
      assert.ok(shape, `${target} has geometry, not just a dictionary entry`);
      assert.equal(shape.count, base.count, `${target} has one offset per base vertex`);
      // Meshopt stores positions in quantized mesh coordinates. Its node
      // scale must be applied before comparing deformation in metres.
      const linearTransform = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
      for (let vertex = 0; vertex < shape.count; vertex++) {
        const components = [0, 1, 2].map((axis) => shape.getComponent(vertex, axis)
          - (mesh.geometry.morphTargetsRelative ? 0 : base.getComponent(vertex, axis)));
        const delta = new THREE.Vector3(...components).applyMatrix3(linearTransform).toArray();
        assert.ok(delta.every(Number.isFinite), `${target} has finite geometry offsets`);
        const distance = Math.hypot(...delta);
        if (distance > 0.00005) moved++;
        peak = Math.max(peak, distance);
        if (distance > 0.00005) fingerprint.push(vertex, ...delta.map((n) => Math.round(n * 1e6)));
      }
    }
    assert.ok(moved >= 8, `${target} visibly moves a facial region (${moved} vertices)`);
    assert.ok(peak > 0.00025 && peak < 0.15,
      `${target} deformation remains visible and within face scale (${peak} m)`);
    fingerprints.add(JSON.stringify(fingerprint));
  }
  assert.equal(fingerprints.size, FACIAL_TARGETS.length, "each expression deforms different geometry");
});

test("Echo expressions change cloned actor faces without mutating their rival or source asset", async () => {
  const gltf = await loadEcho();
  const player = createRiggedFighter(gltf, "#83ffd6", "blades");
  const rival = createRiggedFighter(gltf, "#d6779f", "blades");
  const sourceFaces = faceMeshes(gltf.scene);
  const playerFaces = faceMeshes(player.model);
  const rivalFaces = faceMeshes(rival.model);
  assert.equal(playerFaces.length, sourceFaces.length);
  assert.equal(rivalFaces.length, sourceFaces.length);
  const sourceWeights = sourceFaces.map((mesh) => [...mesh.morphTargetInfluences]);
  rival.pose({ expression: "calm", blink: 0 }, 1);
  const rivalWeights = rivalFaces.map((mesh) => [...mesh.morphTargetInfluences]);
  player.pose({ expression: "hurt", blink: 0 }, 1);
  let hurtApplied = false;
  for (let i = 0; i < playerFaces.length; i++) {
    const source = sourceFaces[i], actor = playerFaces[i], other = rivalFaces[i];
    assert.notEqual(actor.morphTargetInfluences, other.morphTargetInfluences);
    assert.notEqual(actor.morphTargetInfluences, source.morphTargetInfluences);
    assert.deepEqual(other.morphTargetInfluences, rivalWeights[i]);
    assert.deepEqual(source.morphTargetInfluences, sourceWeights[i]);
    assert.ok(actor.morphTargetInfluences.every(Number.isFinite));
    const hurt = actor.morphTargetDictionary.hurt;
    if (hurt !== undefined) {
      assert.ok(actor.morphTargetInfluences[hurt] > 0.8);
      hurtApplied = true;
    }
  }
  assert.ok(hurtApplied, "pose applies the expression to actual GLB geometry");
  assert.equal(typeof player.setExpression, "function");
  player.setExpression("win", 1);
  for (const mesh of playerFaces) {
    const index = mesh.morphTargetDictionary.smirk;
    if (index !== undefined) assert.ok(mesh.morphTargetInfluences[index] > 0.8);
  }
  player.pose({ expression: "calm", blink: 1 }, 1);
  for (const mesh of playerFaces) {
    for (const target of FACIAL_TARGETS) {
      const index = mesh.morphTargetDictionary[target];
      if (index !== undefined) assert.equal(mesh.morphTargetInfluences[index], target === "blink" ? 1 : 0);
    }
  }
});

test("Echo's real sculpted eyelids occlude the seated corneas at a full blink", async () => {
  const gltf=await loadEcho(),fighter=createRiggedFighter(gltf);
  const cast=(side,blink)=>{
    fighter.pose({blink,headYaw:0},1);fighter.root.updateMatrixWorld(true);
    fighter.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    const eye=fighter.model.getObjectByName('eye'+side).getWorldPosition(new THREE.Vector3());
    return new THREE.Raycaster(eye.add(new THREE.Vector3(0,0,.2)),new THREE.Vector3(0,0,-1))
      .intersectObject(fighter.root,true);
  };
  for(const side of ['L','R']){
    const open=cast(side,0);
    assert.equal(open[0].object.material.name,'Pupil','the neutral pupil is visible through its anatomical socket');
    const closed=cast(side,1);
    const lid=closed.find(h=>h.object.material.name==='Skin');
    const cornea=closed.find(h=>h.object.material.name==='Pupil');
    assert.ok(lid&&cornea&&lid.distance<cornea.distance,'actual lid geometry moves in front of the iris');
    assert.equal(cornea.object.visible,true,'blinking does not fake closure by hiding or removing the eye');
    assert.ok(!cornea.object.morphTargetDictionary,'the seated eyeball does not retract during a blink');
  }
});

test("Echo's reverse short blades stay in both palms and disappear into their sheaths", async () => {
  const gltf = await loadEcho();
  const fighter = createRiggedFighter(gltf, "#83ffd6", "blades");
  fighter.pose({ bladeState: "drawn", drawProgress: 1, blink: 0 }, 1);
  const ready = fighter.weaponState();
  assert.equal(ready.reverseGrip, true);
  assert.deepEqual(ready.blades, [true, true]);
  assert.deepEqual(ready.sheaths, [false, false]);
  const segments = fighter.weaponSegments();
  assert.equal(segments.length, 2);
  for (const [base, tip] of segments) {
    const length = base.distanceTo(tip);
    assert.ok(length >= 0.3 && length <= 0.55, `Echo holds a short blade (${length} m)`);
    const localBase = fighter.body.worldToLocal(base.clone());
    const localTip = fighter.body.worldToLocal(tip.clone());
    assert.ok(localTip.y < localBase.y - 0.2, "the blade points down from a reverse grip at rest");
  }

  fighter.root.position.set(2.1, 0.3, -3);
  fighter.root.rotation.y = 1.7;
  fighter.root.scale.setScalar(0.85);
  for (const pose of [
    { handL: [0.34, 1.66, 0.31], handR: [-0.27, 1.53, 0.38] },
    { handL: [0.52, 1.37, 0.49], handR: [-0.5, 1.6, 0.3], torsoYaw: 0.35 },
    { handL: [0.29, 1.89, 0.3], handR: [-0.33, 1.81, 0.21], torsoPitch: -0.2 },
  ]) {
    fighter.pose({ ...pose, bladeState: "drawn", drawProgress: 1, blink: 0 }, 2);
    fighter.root.updateMatrixWorld(true);
    const grips = fighter.gripPoints();
    assert.equal(grips.bladeGrips.length, 2);
    for (const [index, palm] of [grips.leftPalm, grips.rightPalm].entries()) {
      assert.ok(palm.toArray().every(Number.isFinite));
      assert.ok(palm.distanceTo(grips.bladeGrips[index]) < 0.02,
        `blade ${index} stays attached to its gripping palm while the actor moves`);
    }
    for (const segment of fighter.weaponSegments()) {
      assert.ok(segment.every((point) => point.toArray().every(Number.isFinite)));
    }
  }

  fighter.pose({ bladeState: "sheathed", drawProgress: 0, blink: 0 }, 3);
  const sheathed = fighter.weaponState();
  assert.deepEqual(sheathed.blades, [false, false]);
  assert.deepEqual(sheathed.sheaths, [true, true]);
  assert.equal(sheathed.drawProgress, 0);
  assert.equal(fighter.weaponSegments().length, 0, "sheathed blades cannot create visible attack trails");
  fighter.pose({ bladeState: "drawn", drawProgress: 1, blink: 0 }, 3.5);
  assert.deepEqual(fighter.weaponState().blades, [true, true]);
  assert.deepEqual(fighter.weaponState().sheaths, [false, false]);
  assert.equal(fighter.weaponSegments().length, 2);
  for (const [raw, expected] of [[-2, 0], [0.5, 0.5], [2, 1], [NaN, 0], [Infinity, 0]]) {
    fighter.pose({ bladeState: "drawing", drawProgress: raw, blink: 0 }, 4);
    assert.equal(fighter.weaponState().drawProgress, expected);
    for (const segment of fighter.weaponSegments()) {
      assert.ok(segment.every((point) => point.toArray().every(Number.isFinite)));
    }
  }
  fighter.pose({ bladeState: "drawn", grip: "forward", blink: 0 }, 4.5);
  assert.equal(fighter.weaponState().reverseGrip, false);
  for (const [base, tip] of fighter.weaponSegments()) {
    assert.ok(fighter.body.worldToLocal(tip.clone()).y > fighter.body.worldToLocal(base.clone()).y,
      "an explicit forward-grip pose reverses blade direction");
  }
});

test("the actual finger rig throws a fist, open palm and split two-finger sign without retaining a weapon", async () => {
  const gltf=await loadEcho();
  const fighter=createRiggedFighter(gltf,'#83ffd6','blades');
  const rival=createRiggedFighter(gltf,'#d6779f','blades');
  const sample=()=>fighter.digits.R.map(digit=>digit.map(b=>b.quaternion.clone()));
  for(const side of ['L','R']){
    assert.equal(fighter.digits[side].length,5);
    for(const digit of fighter.digits[side])for(const bone of digit)assert.ok(bone?.isBone,'every sign uses real anatomical digit bones');
  }
  const pose={rpsHand:'R',handSignProgress:1,bladeState:'drawn',blink:0};
  fighter.pose({...pose,handSign:'paper'},1);const paper=sample();
  assert.deepEqual(fighter.weaponState().blades,[true,false]);
  fighter.pose({...pose,handSign:'rock'},1);const rock=sample();
  for(let digit=1;digit<5;digit++)assert.ok(rock[digit][1].angleTo(paper[digit][1])>.9,'the fist curls all four fingers');
  fighter.pose({...pose,handSign:'scissors'},1);const scissors=sample();
  for(const digit of [1,2])assert.ok(scissors[digit][1].angleTo(paper[digit][1])<1e-6,'scissors extends index and middle');
  for(const digit of [3,4])assert.ok(scissors[digit][1].angleTo(paper[digit][1])>.9,'scissors tucks ring and pinky');
  assert.ok(scissors[2][0].angleTo(paper[2][0])>.12,'the two extended fingers spread apart');
  fighter.pose({...pose,handSign:'rock',handSignProgress:0},1);const start=sample();
  fighter.pose({...pose,handSign:'rock',handSignProgress:.5},1);const half=sample();
  assert.ok(half[1][1].angleTo(start[1][1])>0&&half[1][1].angleTo(start[1][1])<rock[1][1].angleTo(start[1][1]),'sign progress interpolates the actual finger rotations');
  fighter.pose({...pose,handSign:'rock',handSignProgress:Infinity},1);
  assert.ok(sample().flat().every(q=>q.toArray().every(Number.isFinite)));
  rival.pose({blink:0},1);
  const before=rival.digits.R[1][1].quaternion.clone();
  fighter.pose({...pose,handSign:'scissors'},1);
  assert.ok(before.angleTo(rival.digits.R[1][1].quaternion)<1e-6,'the rival does not share digit animation state');
  fighter.pose({bladeState:'drawn',blink:0},1);
  assert.deepEqual(fighter.weaponState().blades,[true,true],'leaving the reveal restores held weapons');
});

test("boss weapon modes replace inherited equipment and restore normal gear without touching the source", async () => {
  const source=await loadEcho(),actor=createRiggedFighter(source,'#83ffd6','blades');
  actor.pose({bladeState:'drawn',blink:0},1);
  assert.equal(actor.weaponSegments().length,2);
  for(const mode of ['shield-hammer','gauntlets']){
    actor.setWeaponMode(mode);actor.pose({bladeState:'drawn',blink:0},1);
    assert.equal(actor.weaponMode,mode);assert.equal(actor.weaponSegments().length,0);
    for(const group of Object.values(actor.weaponGroups).flat())assert.equal(group.visible,false);
  }
  actor.setWeaponMode('normal');actor.pose({bladeState:'drawn',blink:0},1);
  assert.equal(actor.weaponSegments().length,2);
  const sourceColors=[];source.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])sourceColors.push(m.color.toArray());});
  const clothing=[];actor.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/^(Tailored jacket|Shirt|Woven trousers|Leather|Boot sole)\b/.test(m.name))clothing.push([m,m.color.clone()]);});
  actor.equipAppearance({id:'echo',color:'#83ffd6'});
  const texturedCoats=clothing.filter(([material])=>/jacket/i.test(material.name)&&material.map);
  assert.ok(texturedCoats.length,'the production coat has its authored albedo');
  for(const [material,color] of texturedCoats)assert.ok(material.color.equals(color),'equipping a player preserves the textured coat albedo instead of crushing it with the legacy tint');
  const hair=[];actor.model.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).every(m=>/^Hair(?: strands)?\b/.test(m.name)))hair.push([o,o.visible]);});
  assert.ok(hair.length,'the source has independently controlled hair surfaces');
  actor.equipAppearance({id:'bulwark',boss:true,model:'bulwark',color:'#b6bfc4'});
  assert.equal(actor.weaponMode,'shield-hammer');
  for(const [material] of clothing)assert.ok(material.color.r<.025&&material.color.g<.025&&material.color.b<.025);
  for(const [mesh] of hair)assert.equal(mesh.visible,false);
  actor.equipAppearance({});
  assert.equal(actor.weaponMode,'normal');
  for(const [material,color] of clothing)assert.ok(material.color.equals(color));
  for(const [mesh,visible] of hair)assert.equal(mesh.visible,visible);
  const after=[];source.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])after.push(m.color.toArray());});
  assert.deepEqual(after,sourceColors);
  actor.disposeAppearance();
});

test("Echo locks planted ankles to the world floor and releases them for a leap", async () => {
  const fighter=createRiggedFighter(await loadEcho(),"#83ffd6","blades");
  fighter.pose({footLock:[1,1],floorY:0,blink:0},1);
  const floor=fighter.feet.map(foot=>foot.getWorldPosition(new THREE.Vector3()).y);
  fighter.root.position.y=-.35;
  fighter.pose({footLock:[1,1],floorY:0,blink:0},1);
  fighter.feet.forEach((foot,index)=>assert.ok(
    Math.abs(foot.getWorldPosition(new THREE.Vector3()).y-floor[index])<.002,
    "a planted ankle remains above the same floor as the pelvis crouches",
  ));
  fighter.root.position.y=.65;
  fighter.pose({footLock:[0,0],blink:0},1);
  fighter.feet.forEach((foot,index)=>assert.ok(
    foot.getWorldPosition(new THREE.Vector3()).y>floor[index]+.5,
    "an airborne foot moves with the actor instead of staying on the floor",
  ));
});

test("anatomical height metadata calibrates authored IK targets and real metre scaling", async () => {
  const expected={echo:2.10,brawler:2.25,ronin:2.20,nyx:2.05,vex:2.12};
  for(const [id,height] of Object.entries(expected)){
    const bytes=await readFile(new URL(`../public/models/${id}-human.glb`,import.meta.url));
    const gltf=await createTexturedGltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const actor=createRiggedFighter(gltf,'#83ffd6','brawler');
    assert.ok(Math.abs(actor.standingHeight-height)<1e-6);
    assert.ok(actor.eyeHeight>height*.85&&actor.eyeHeight<height);
    const hand=[.29,1.64,.25];
    actor.pose({handL:hand,blink:0},0);
    const authored=actor.hands[0].getWorldPosition(new THREE.Vector3());
    actor.pose({handL:hand.map(v=>v*height/2.10),handLSpace:'native',blink:0},0);
    assert.ok(actor.hands[0].getWorldPosition(new THREE.Vector3()).distanceTo(authored)<1e-6,
      'authored coordinates and equivalent native grip corrections agree');
    actor.root.scale.setScalar(1.90/actor.standingHeight);
    actor.pose({footLock:[1,1],floorY:0,blink:0},0);
    const y=actor.feet[0].getWorldPosition(new THREE.Vector3()).y;
    actor.root.position.y=-.25;actor.pose({footLock:[1,1],floorY:0,blink:0},0);
    assert.ok(Math.abs(actor.feet[0].getWorldPosition(new THREE.Vector3()).y-y)<.002,
      'world floor locks survive real metre actor scaling');
  }
});

test("Echo uses authored body quaternions once and scrubs secondary motion deterministically", async () => {
  const fighter=createRiggedFighter(await loadEcho(),"#83ffd6","blades");
  fighter.pose({reduced:true,blink:0},0);
  const spine=fighter.model.getObjectByName("spine02"),head=fighter.head;
  const spineRest=spine.quaternion.clone(),headRest=head.quaternion.clone();
  const torso=new THREE.Quaternion().setFromEuler(new THREE.Euler(.22,-.1,.07));
  const neck=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12,.31,0));
  const pose={boneQuaternions:{spine02:torso.toArray(),head:neck.toArray()},
    torsoPitch:9,headPitch:9,headYaw:9,blink:0};
  fighter.pose(pose,1);
  assert.ok(spine.quaternion.angleTo(spineRest.clone().multiply(torso))<1e-6);
  assert.ok(head.quaternion.angleTo(headRest.clone().multiply(neck))<1e-6);
  const names=["echo_ponytail1","echo_ponytail2","echo_ponytail3","echo_jacket_tail"];
  const sample=()=>names.map(name=>fighter.model.getObjectByName(name).quaternion.clone());
  const first=sample();fighter.pose(pose,1);
  sample().forEach((q,index)=>assert.ok(q.angleTo(first[index])<1e-6));
  fighter.pose(pose,2.1);
  assert.ok(sample().some((q,index)=>q.angleTo(first[index])>.02));
  fighter.pose({...pose,reduced:true},1);const quiet=sample();
  fighter.pose({...pose,reduced:true},4);
  sample().forEach((q,index)=>assert.ok(q.angleTo(quiet[index])<1e-6));
});
