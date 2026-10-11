import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createRiggedFighter} from '../src/components/riggedFighter.js';
import {evaluateSequence,presentationForSequenceId} from '../src/game/sequences/index.js';

async function fighter(model,height,style){
  const bytes=await readFile(new URL(`../public/models/${model}-human.glb`,import.meta.url));
  const asset=await createTexturedGltfLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const actor=createRiggedFighter(asset,'#b6bfc4',style);
  actor.root.scale.setScalar(height/actor.standingHeight);
  return actor;
}

test('Afterlight holds the real target in a lowered hurt pose with both ankles on the same world floor',async()=>{
  for(const [model,height,style,outcome]of [['ronin',2.2,'glaive','win'],['echo',1.72,'blades','loss']]){
    const actor=await fighter(model,height,style),point=new THREE.Vector3();
    actor.pose({footLock:[1,1],floorY:0,blink:0},0);
    const floor=actor.feet.map(foot=>foot.getWorldPosition(point).y);
    const standingHead=actor.head.getWorldPosition(point).y;
    for(const reduced of [false,true]){
      const options={targetHeight:height,outcome,reduced},duration=presentationForSequenceId('ECHO-AF',options).duration/1000;
      for(const originalTime of [0,.35,.5,2.5,5.5,8.62]){
        const frame=evaluateSequence('ECHO-AF',originalTime/15*duration,options),pose=frame.defender;
        actor.root.position.set((outcome==='loss'?-1:1)*(frame.origin+pose.x),pose.y,pose.z);
        actor.root.rotation.y=outcome==='loss'?Math.PI/2:-Math.PI/2;
        actor.pose({...pose,reduced},frame.physicalSeconds);
        assert.ok(pose.y<-.23,'the pelvis is lowered rather than frozen upright');
        assert.ok(actor.head.getWorldPosition(point).y<standingHead-.20,'a visibly wounded body remains below its standing height');
        actor.feet.forEach((foot,i)=>assert.ok(Math.abs(foot.getWorldPosition(point).y-floor[i])<.002,
          `${model} ankle ${i} stays on the measured floor at ${originalTime}s`));
      }
    }
  }
});
