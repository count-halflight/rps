import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_MOMENTS,ANATOMICAL_HEIGHTS,sceneMomentPresentation,evaluateSceneMoment,sceneMomentContactSheetTimes} from '../src/game/sceneMoments.js';
import {SEQUENCE_MANIFEST,IMPLEMENTED_SEQUENCES} from '../src/game/sequences/index.js';
const numbers=value=>typeof value==='number'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(numbers):[];

test('Nine ancillary floor moments preserve the65 attack registry and exact intro/phase deadlines',()=>{
 assert.equal(SCENE_MOMENTS.length,9);assert.equal(SEQUENCE_MANIFEST.length,65);assert.equal(IMPLEMENTED_SEQUENCES.length,4);
 assert.equal(ANATOMICAL_HEIGHTS.bulwark,2.2);
 for(const s of SCENE_MOMENTS){
  assert.equal(s.duration,s.kind==='entrance'?2300:s.kind==='boss-intro'?5000:3000);
  assert.ok(!SEQUENCE_MANIFEST.some(a=>a.id===s.id));
  const p=sceneMomentPresentation(s.id),end=evaluateSceneMoment(s.id,p.duration/1000);
  assert.equal(end.finished,true);assert.equal(end.progress,1);assert.equal(end.actor.x,0);assert.equal(end.actor.y,0);
  assert.equal(evaluateSceneMoment(s.id,-2).progress,0);
  assert.equal(evaluateSceneMoment(s.id,p.duration/1000+10).progress,1);
 }
});
test('Every rival kit walks in on a distinct pose/root trajectory and finishes in its own guard',()=>{
 const paths=new Set(),guards=new Set();
 for(const s of SCENE_MOMENTS.filter(s=>s.kind==='entrance')){
  const initial=evaluateSceneMoment(s.id,0),final=evaluateSceneMoment(s.id,2.3);
  assert.ok(initial.root.pos[0]>=4,'rival begins visibly outside its combat mark');
  assert.equal(final.root.pos[0],1.6);assert.equal(final.actorSide,'enemy');
  paths.add(JSON.stringify([.3,.7,1.2,1.7,2].map(t=>{const f=evaluateSceneMoment(s.id,t);return[f.actor.x,f.actor.y,f.actor.z,f.actor.handL,f.actor.handR,f.camera,f.fov];})));
  guards.add(JSON.stringify([final.actor.handL,final.actor.handR,final.actor.torsoPitch]));
  assert.ok(evaluateSceneMoment(s.id,1.7).card.opacity>.7);
 }
 assert.equal(paths.size,5);assert.equal(guards.size,5);
});
test('All scene moments remain finite and deterministic under mirrored, reduced and physical-height variants',()=>{
 for(const s of SCENE_MOMENTS)for(const options of [{},{mirrored:true},{side:'player'},{reduced:true},{actorHeight:2.2,actorEyeHeight:2.03},{phase:1,brokenPlates:3}]){
  const p=sceneMomentPresentation(s.id,options);
  for(let i=0;i<=45;i++){
   const elapsed=p.duration*i/45000,f=evaluateSceneMoment(s.id,elapsed,options);
   assert.ok(numbers(f).every(Number.isFinite),`${s.id} at ${elapsed}`);
   assert.ok(f.root.pos[0]>=-7&&f.root.pos[0]<=7);
   assert.ok(f.wardrobe.phase>=0&&f.wardrobe.phase<=2);assert.ok(f.wardrobe.brokenPlates>=0&&f.wardrobe.brokenPlates<=6);
   assert.equal(f.flash,0);for(const effect of f.fx)assert.ok(effect.opacity<=.6);
   for(const q of Object.values(f.actor.boneQuaternions))assert.ok(Math.abs(Math.hypot(...q)-1)<1e-8);
  }
  const checkpoint=evaluateSceneMoment(s.id,p.duration*.4/1000,options);
  evaluateSceneMoment(s.id,p.duration*.95/1000,options);
  assert.deepEqual(evaluateSceneMoment(s.id,p.duration*.4/1000,options),checkpoint);
 }
});
test('Mirroring inverts actor roots and cameras together while reduced motion keeps a fixed view',()=>{
 for(const s of SCENE_MOMENTS){
  const a=evaluateSceneMoment(s.id,.75),b=evaluateSceneMoment(s.id,.75,{mirrored:true});
  assert.ok(Math.abs(a.root.pos[0]+b.root.pos[0])<1e-8);assert.ok(Math.abs(a.root.yaw+b.root.yaw)<1e-8);
  assert.ok(Math.abs(a.camera[0]+b.camera[0])<1e-8);assert.ok(Math.abs(a.target[0]+b.target[0])<1e-8);
  assert.deepEqual(a.actor.handL,b.actor.handL);assert.notEqual(a.actorSide,b.actorSide);
  const p=sceneMomentPresentation(s.id,{reduced:true}),first=evaluateSceneMoment(s.id,.1,{reduced:true}),last=evaluateSceneMoment(s.id,p.duration*.9/1000,{reduced:true});
  assert.ok(p.duration<=(s.kind==='entrance'?1700:3000));assert.deepEqual(first.camera,last.camera);assert.deepEqual(first.target,last.target);
  assert.equal(first.shake,0);assert.equal(first.bars,0);
 }
});
test('Bulwark plants his shield with a held impact and then rotates his six plates without changing phase',()=>{
 const plant=evaluateSceneMoment('bulwark.intro',2.25),hold=evaluateSceneMoment('bulwark.intro',2.30);
 assert.equal(plant.actorHeight,2.2);assert.ok(plant.actor.y<-.25);
 assert.deepEqual(plant.actor.footLock,[1,1]);assert.equal(plant.hitStopped,true);assert.deepEqual(plant.actor,hold.actor);
 assert.ok(plant.fx.some(f=>f.id==='SHOCKRING'));assert.ok(plant.sfx.some(s=>s.id==='shield-plant'));
 const plates=evaluateSceneMoment('bulwark.intro',3.25);assert.equal(plates.wardrobe.plateRotation,1);assert.equal(plates.wardrobe.signatureWarning,true);assert.equal(plates.wardrobe.phase,0);
 assert.ok(plates.lights.drain>.8,'intro practicals stay drained while armour is revealed');
 assert.equal(evaluateSceneMoment('bulwark.intro',5).wardrobe.signatureWarning,false);
});
test('Bulwark phase transitions stage split gauntlets and stripped agility only at their authored moments',()=>{
 const pre=evaluateSceneMoment('bulwark.phase1',1.449),split=evaluateSceneMoment('bulwark.phase1',1.45),p2=evaluateSceneMoment('bulwark.phase1',3);
 assert.equal(pre.wardrobe.phase,0);assert.equal(split.wardrobe.phase,1);assert.equal(split.wardrobe.shieldSplit,1);assert.equal(split.wardrobe.brokenPlates,2);
 assert.equal(split.actor.weaponMode,'gauntlets');assert.equal(p2.actor.weaponMode,'gauntlets');
 const shed=evaluateSceneMoment('bulwark.phase2',1.1);assert.equal(shed.wardrobe.phase,2);assert.equal(shed.wardrobe.brokenPlates,6);
 const left=evaluateSceneMoment('bulwark.phase2',1.4),right=evaluateSceneMoment('bulwark.phase2',1.7);
 assert.ok(left.actor.z>0&&right.actor.z<0);assert.ok(left.actor.x<0&&right.actor.x>0);
});
test('A plate-break moment shatters exactly one available plate and never overflows six',()=>{
 assert.equal(evaluateSceneMoment('bulwark.plate-break',.499,{brokenPlates:3}).wardrobe.brokenPlates,3);
 const hit=evaluateSceneMoment('bulwark.plate-break',.5,{brokenPlates:3});assert.equal(hit.wardrobe.brokenPlates,4);assert.equal(hit.wardrobe.breakOne,true);
 const exhausted=evaluateSceneMoment('bulwark.plate-break',3,{brokenPlates:6});assert.equal(exhausted.wardrobe.brokenPlates,6);assert.equal(exhausted.wardrobe.breakOne,false);
 assert.ok(hit.fx.some(f=>f.style==='single-plate'));assert.ok(hit.actor.torsoPitch<-.5);
});
test('Ancillary twelve-frame exports retain all deadlines and scale into their reduced presentations',()=>{
 for(const s of SCENE_MOMENTS)for(const options of [{},{reduced:true}]){
  const p=sceneMomentPresentation(s.id,options),times=sceneMomentContactSheetTimes(s.id,12,options);
  assert.equal(times.length,12);assert.equal(times[0],0);assert.ok(Math.abs(times.at(-1)-p.duration/1000)<1e-8);
  assert.ok(times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=p.duration/1000&&(i===0||t>times[i-1])));
  for(const hit of s.hitTimes)assert.ok(times.some(t=>Math.abs(t-hit*p.duration/s.duration)<1e-8));
 }
});
test('Reviewed scene moments frame metre-scale guards closely and keep entrance tracking intact',()=>{
 for(const s of SCENE_MOMENTS){
  const last=evaluateSceneMoment(s.id,s.duration/1000);
  assert.ok(Math.abs(last.camera[2]-6.37)<1e-8);assert.equal(last.fov,35);
  const fixed=evaluateSceneMoment(s.id,.5,{reduced:true});assert.equal(fixed.camera[2],7);assert.equal(fixed.fov,40);
 }
 const approach=evaluateSceneMoment('bulwark.intro',.9),plant=evaluateSceneMoment('bulwark.intro',2.25);
 assert.ok(approach.target[0]>plant.target[0],'the entrance camera still follows the approaching rival');
 assert.ok(plant.camera[2]<5.1,'shield planting remains a readable close full-body shot');
});
