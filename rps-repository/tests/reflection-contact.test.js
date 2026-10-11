import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createTexturedGltfLoader} from './helpers/texturedGltfLoader.js';
import {createRiggedFighter} from '../src/components/riggedFighter.js';
import {ECHO_REFLECTION_POSES,ECHO_REFLECTION_FAMILIES,echoReflectionPose,evaluateSequence,ECHO_REFLECTION_TIMES} from '../src/game/sequences/index.js';

let fixture;
async function actor(){
  if(!fixture)fixture=(async()=>{
    const bytes=await readFile(new URL('../public/models/echo-human.glb',import.meta.url));
    const asset=await createTexturedGltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    return createRiggedFighter(asset,'#83ffd6','blades');
  })();
  return fixture;
}
const midpoint=(fighter,family)=>{
  const edge=fighter.weaponSegments()[family.primaryBlade];
  return edge[0].clone().lerp(edge[1],family.contactFraction);
};

test('All eight reflection families have genuinely different measured windup, contact and follow-through blade poses',async()=>{
  const fighter=await actor();fighter.root.position.set(0,0,0);fighter.root.rotation.set(0,0,0);fighter.root.scale.setScalar(1);
  assert.equal(ECHO_REFLECTION_POSES.length,24);
  for(const family of ECHO_REFLECTION_FAMILIES){
    const points=[];
    for(let phase=0;phase<3;phase++){
      const definition=ECHO_REFLECTION_POSES[family.index*3+phase];
      fighter.pose(definition.pose,0);points.push(midpoint(fighter,family));
      assert.equal(fighter.weaponState().reverseGrip,true);assert.equal(fighter.weaponSegments().length,2);
    }
    assert.ok(points[0].distanceTo(points[1])>.15,`${family.id} loads before the blade reaches contact`);
    assert.ok(points[1].distanceTo(points[2])>.15,`${family.id} has a real blade follow-through`);
    assert.ok(points[1].distanceTo(new THREE.Vector3(...family.bladeAnchor))<.00001,`${family.id} calibrated anchor matches the real production edge`);
  }
});

test('The real short-blade edge meets every authored world contact in normal and mirrored metre-scale staging',async()=>{
  const fighter=await actor();
  for(const targetHeight of [1.70,2.20])for(const outcome of ['win','loss'])for(let index=0;index<24;index++){
    const time=ECHO_REFLECTION_TIMES[index]+.12*.43;
    const frame=evaluateSequence('ECHO-AF',time,{actorHeight:1.72,targetHeight,outcome});
    const reflection=frame.finale.reflections[index],family=ECHO_REFLECTION_FAMILIES[index%8];
    fighter.root.scale.setScalar(1.72/fighter.standingHeight);
    fighter.root.position.fromArray(reflection.root);fighter.root.rotation.set(0,reflection.yaw,0);
    fighter.pose(reflection.pose,0);
    const edge=midpoint(fighter,family),point=new THREE.Vector3(...reflection.contactPoint);
    assert.ok(edge.distanceTo(point)<.0001,`contact ${index} ${outcome} targetHeight${targetHeight}: physical edge lands on the prescribed plane`);
    assert.ok(reflection.contact&&reflection.active);assert.equal(reflection.poseBlend,0);
    const held=evaluateSequence('ECHO-AF',ECHO_REFLECTION_TIMES[index]+.12*.56,{actorHeight:1.72,targetHeight,outcome}).finale.reflections[index];
    assert.deepEqual(held.root,reflection.root,'the brief contact hold stays at the physical cutting plane');
    assert.equal(held.poseBlend,0,'the contact silhouette stays loaded before follow-through');
  }
});

test('Opposing reflection paths descend into contact and leave tangentially without changing the finale schedule',()=>{
  for(const index of [2,14]){
    const entry=echoReflectionPose(index,0),contact=echoReflectionPose(index,.43),follow=echoReflectionPose(index,.95);
    assert.ok(entry.root[1]>contact.root[1]+.8,'the airborne approach descends before the blade reaches the target');
    assert.ok(contact.root[1]<.15,'contact does not preserve the former metre-high floating root');
    assert.ok(Math.hypot(entry.root[0],entry.root[2])>3);
    assert.ok(Math.hypot(contact.root[0],contact.root[2])<1);
    assert.ok(Math.hypot(follow.root[0]-contact.root[0],follow.root[2]-contact.root[2])>1.5);
    assert.equal(contact.poseBankA,(index%8)*3+1);assert.equal(contact.poseBankB,(index%8)*3+2);
  }
  for(const [time,act]of [[0,1],[2.5,2],[5.5,3],[9,4],[12.5,5]])assert.equal(evaluateSequence('ECHO-AF',time).finale.act,act);
  assert.equal(ECHO_REFLECTION_TIMES.length,24);assert.ok(Math.abs(ECHO_REFLECTION_TIMES.at(-1)-8.62)<1e-9);
});
