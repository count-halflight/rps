import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createRiggedFighter} from '../src/components/riggedFighter.js';
import {COMBAT_MOMENTS,combatMomentPresentation,evaluateCombatMoment,combatMomentContactSheetTimes,kitGuard,kitBrace} from '../src/game/combatMoments.js';
import {SEQUENCE_MANIFEST,IMPLEMENTED_SEQUENCES} from '../src/game/sequences/index.js';
const numbers=value=>typeof value==='number'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(numbers):[];
const assets=new Map();
async function asset(id){
 if(!assets.has(id))assets.set(id,readFile(new URL(`../public/models/${id}-human.glb`,import.meta.url)).then(bytes=>
  createTexturedGltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')));
 return assets.get(id);
}
async function actor(model,height,style){
 const source=await asset(model),fighter=createRiggedFighter(source,'#83ffd6',style);
 fighter.root.scale.setScalar(height/fighter.standingHeight);return{fighter,source};
}
function apply(fighter,sample,time){
 fighter.root.position.fromArray(sample.root.pos);fighter.root.rotation.set(0,sample.root.yaw,0);fighter.pose(sample.pose,time);
}

test('Shared combat moments preserve attack count and publish exact visual deadlines without resolving a hand',()=>{
 assert.equal(SEQUENCE_MANIFEST.length,65);assert.equal(IMPLEMENTED_SEQUENCES.length,4);
 assert.equal(COMBAT_MOMENTS.length,8);
 for(const s of COMBAT_MOMENTS){
  const duration=s.kind==='reveal'?1200:s.kind==='defeat'?3000:s.kind==='item'||s.kind==='clash'?1000:600;
  const p=combatMomentPresentation(s.id);assert.equal(p.duration,duration);assert.equal(p.commitAt,duration/1000);
  assert.equal(evaluateCombatMoment(s.id,duration/1000).finished,true);assert.equal(evaluateCombatMoment(s.id,-1).progress,0);
  assert.ok(!SEQUENCE_MANIFEST.some(a=>a.id===s.id));
  const times=combatMomentContactSheetTimes(s.id);assert.equal(times.length,12);assert.equal(times[0],0);assert.equal(times.at(-1),duration/1000);
 }
 for(const t of [.26,.27,.54,.80]){
  const f=evaluateCombatMoment('combat.reveal',t,{playerHand:'paper',enemyHand:'rock'});
  assert.equal(f.reveal.enemyHand,null);assert.equal(f.reveal.outcome,null);
 }
 const signs=evaluateCombatMoment('combat.reveal',.81,{playerHand:'paper',enemyHand:'rock',outcome:'win'});
 assert.equal(signs.reveal.playerHand,'paper');assert.equal(signs.reveal.enemyHand,'rock');assert.equal(signs.reveal.resultVisible,false);
 assert.equal(evaluateCombatMoment('combat.reveal',.90,{outcome:'draw'}).reveal.outcome,'draw');
});
test('Shared moments scrub deterministically, mirror world-space actors and keep reduced motion on one camera',()=>{
 for(const s of COMBAT_MOMENTS)for(const options of [{},{reduced:true},{mirrored:true},{outcome:'loss',playerCharacter:'vex',enemyCharacter:'nyx'},{actorSide:'enemy',defeatedSide:'enemy',bossId:'bulwark',enemyCharacter:'kuro'}]){
  for(let i=0;i<=40;i++){
   const f=evaluateCombatMoment(s.id,s.duration*i/40000,options);assert.ok(numbers(f).every(Number.isFinite),`${s.id} ${i}`);
   for(const side of ['player','enemy'])for(const q of Object.values(f[side].pose.boneQuaternions))assert.ok(Math.abs(Math.hypot(...q)-1)<1e-8);
   assert.equal(f.flash,0);
  }
  const a=evaluateCombatMoment(s.id,s.duration*.4/1000,options);evaluateCombatMoment(s.id,s.duration*.9/1000,options);
  assert.deepEqual(evaluateCombatMoment(s.id,s.duration*.4/1000,options),a);
 }
 for(const s of COMBAT_MOMENTS){
  const normal=evaluateCombatMoment(s.id,.4),mirror=evaluateCombatMoment(s.id,.4,{mirrored:true});
  for(const side of ['player','enemy'])assert.ok(Math.abs(normal[side].root.pos[0]+mirror[side].root.pos[0])<1e-8);
  const a=evaluateCombatMoment(s.id,.05,{reduced:true}),b=evaluateCombatMoment(s.id,s.duration*.9/1000,{reduced:true});
  assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.target,b.target);assert.equal(a.shake,0);
 }
});
test('Draw clash has a real physical hold while item results and defeat fade respect their own visual clocks',()=>{
 const contact=evaluateCombatMoment('combat.clash',.40),hold=evaluateCombatMoment('combat.clash',.44);
 assert.deepEqual(contact.player,hold.player);assert.deepEqual(contact.enemy,hold.enemy);assert.ok(hold.unscaledSeconds>contact.unscaledSeconds);
 assert.ok(contact.hitStopped);assert.ok(!evaluateCombatMoment('combat.clash',.48).hitStopped);
 assert.ok(contact.fx.some(f=>f.id==='SPARKS'));assert.equal(contact.kind,'clash');
 for(const item of ['medkit','coolant','battery','scan']){
  const a=evaluateCombatMoment(`item.${item}`,.41),b=evaluateCombatMoment(`item.${item}`,.42),end=evaluateCombatMoment(`item.${item}`,1);
  assert.equal(a.item.applied,false);assert.equal(b.item.applied,true);assert.equal(b.item.commitReady,false);assert.equal(end.item.commitReady,true);
 }
 assert.equal(evaluateCombatMoment('combat.defeat',1).fade,0);
 assert.equal(evaluateCombatMoment('combat.defeat',3).fade,1);
 assert.ok(evaluateCombatMoment('combat.defeat',1).defeat.held);
 assert.equal(new Set(['echo','cinder','nyx','vex','kuro'].map(c=>JSON.stringify(kitBrace(c)))).size,5);
});
test('The third reveal throw produces a literal fist, open palm or two extended fingers in the production Echo skeleton',async()=>{
 const {fighter,source}=await actor('echo',1.72,'blades');
 const curls=()=>fighter.digits.R.slice(1).map(digit=>digit[1].quaternion.angleTo(source.scene.getObjectByName(digit[1].name).quaternion));
 for(const hand of ['rock','paper','scissors']){
  for(const t of [.27,.54]){apply(fighter,evaluateCombatMoment('combat.reveal',t,{playerHand:hand}).player,t);
   assert.ok(curls().every(c=>c>1),'both preparation throws remain a fully closed fist');}
  apply(fighter,evaluateCombatMoment('combat.reveal',.90,{playerHand:hand}).player,.90);
  const fingers=curls();
  if(hand==='rock')assert.ok(fingers.every(c=>c>1),'rock curls all four fingers');
  if(hand==='paper')assert.ok(fingers.every(c=>c<.06),'paper extends all four fingers');
  if(hand==='scissors'){assert.ok(fingers.slice(0,2).every(c=>c<.06),'index and middle stay extended');assert.ok(fingers.slice(2).every(c=>c>1),'ring and little finger remain curled');}
  assert.equal(fighter.weaponState().blades[1],false,'the throwing hand does not retain a blade');
 }
 fighter.pose(kitGuard('echo'),1.3);assert.equal(fighter.weaponState().blades[1],true,'normal guard restores the hand equipment');
});
test('Actual metre-scale fighter rigs stay planted through shared throws, skids, items and a lowered defeat hold',async()=>{
 const kits=[['echo','echo',1.72,'blades'],['cinder','brawler',1.9,'brawler'],['nyx','nyx',1.82,'mage'],['vex','vex',1.70,'archer'],['kuro','ronin',1.88,'glaive']];
 const point=new THREE.Vector3();
 for(const [character,model,height,style]of kits){
  const {fighter}=await actor(model,height,style);fighter.pose(kitGuard(character),0);
  const floor=fighter.feet.map(foot=>foot.getWorldPosition(point).y),standingHead=fighter.head.getWorldPosition(point).y;
  for(const id of ['combat.reveal','combat.clash','item.medkit','item.coolant','item.battery','item.scan','combat.defeat'])for(const reduced of [false,true]){
   for(const t of id==='combat.defeat'?[.15,.78,1.6,2.6]:id==='combat.reveal'?[.27,.54,.81,1.1]:id==='combat.clash'?[.40,.44,.70,1]:[.25,.42,.75,1]){
    const frame=evaluateCombatMoment(id,t,{playerCharacter:character,playerHeight:height,reduced});apply(fighter,frame.player,t);
    fighter.feet.forEach((foot,i)=>assert.ok(Math.abs(foot.getWorldPosition(point).y-floor[i])<.003,`${character} ${id} ${t} ankle remains planted`));
    if(id==='combat.defeat'&&t>=.78)assert.ok(fighter.head.getWorldPosition(point).y<standingHead-.45,'defeat physically lowers the full body');
   }
  }
 }
});
