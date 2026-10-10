import test from 'node:test';import assert from 'node:assert/strict';
import{ATTACK_CATALOG,BOSS_SEQUENCES}from'../src/game/attackCatalog.js';import{POSE_KEYS,ROOT_PATHS}from'../src/game/poseKeys.js';import{CAMERA_RIGS}from'../src/game/cameraRigs.js';
import{attackPresentation,cinematicFrame}from'../src/game/cinematics.js';import{inspectCatalog}from'../scripts/choreography-proof.mjs';
test('all 75 timelines resolve authored geometry, shots and contact beats',()=>{
 assert.equal(ATTACK_CATALOG.length,75);assert.equal(new Set(ATTACK_CATALOG.map(s=>s.id)).size,75);
 for(const s of [...ATTACK_CATALOG,...BOSS_SEQUENCES]){
  assert.ok(POSE_KEYS[s.wind]&&POSE_KEYS[s.contact]&&ROOT_PATHS[s.path]&&CAMERA_RIGS[s.camera],s.id);
  const a={...attackPresentation(s.weapon,!!s.final,false,s.variant||0,s.character,s.id,s.finisherIndex||0),playerWeapon:s.weapon,outcome:'win',finalHit:!!s.final};
  for(let i=0;i<=40;i++){
   const f=cinematicFrame(a,a.duration*i/40000);assert.ok([...f.camera,...f.target,...f.attacker.handL,...f.attacker.handR,f.attacker.x,f.attacker.y].every(Number.isFinite),s.id);
  }
  const hit=cinematicFrame(a,a.duration*a.impactAt/1000);assert.ok(hit.impact>.999);assert.ok(hit.hitStopped);
  assert.equal(cinematicFrame(a,0).attacker.x,0);
 }
});
test('sampled root, wrist, weapon and camera paths reject near-identical attacks',()=>{const r=inspectCatalog();assert.equal(r.sequences,75);assert.equal(r.collisions.length,0);assert.ok(r.minimum>r.threshold);});
test('each defender reaction changes the physical response and reduced motion keeps the camera fixed',()=>{
 const reactions=new Map();for(const s of ATTACK_CATALOG){const a={...attackPresentation(s.weapon,s.final,false,s.variant,s.character,null,s.finisherIndex||0),playerWeapon:s.weapon,outcome:'win'};
 const f=cinematicFrame(a,a.duration*(a.impactAt+.10)/1000);reactions.set(s.reaction,JSON.stringify(f.defender));
 const reduced={...a,reduced:true};assert.deepEqual(cinematicFrame(reduced,.3).camera,cinematicFrame(reduced,1).camera);
 }assert.ok(new Set(reactions.values()).size>=6);
});
