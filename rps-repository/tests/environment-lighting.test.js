import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentLightState, fixtureLightFactor, normalizeEnvironmentCinematic } from '../src/components/environmentLighting.js';

test('district power tracks the four precise remaining-health bands',()=>{
  for(const [ratio,stage] of [[1,0],[.76,0],[.75,1],[.51,1],[.5,2],[.26,2],[.25,3],[.01,3],[0,4]])assert.equal(environmentLightState({rivalHpRatio:ratio}).stage,stage);
  const first=environmentLightState({rivalHpRatio:.7});
  assert.deepEqual([0,1,2,3,4,5].map(i=>fixtureLightFactor(first,i)),[1,0,1,1,0,1]);
  const second=environmentLightState({rivalHpRatio:.4});
  assert.equal(fixtureLightFactor(second,0),0);assert.ok(fixtureLightFactor(second,0,[0,0,0],'neon')>.7);
  const critical=environmentLightState({rivalHpRatio:.1});assert.ok(critical.arenaStrength<.1);assert.ok(critical.neon<.06);assert.ok(critical.fighterStrength>=1);
});

test('defeat holds a 400ms blackout, then relights from the lane outwards without flicker',()=>{
  for(const elapsed of [0,.1,.399]){
    const light=environmentLightState({rivalHpRatio:0,defeatElapsed:elapsed});
    assert.equal(light.blackout,true);assert.equal(light.arenaStrength,0);assert.equal(fixtureLightFactor(light,0),0);
  }
  let previous=-1;
  for(let elapsed=.4;elapsed<=2.3;elapsed+=.025){
    const light=environmentLightState({rivalHpRatio:0,defeatElapsed:elapsed});
    assert.equal(light.blackout,false);assert.ok(light.relightWave>=previous);previous=light.relightWave;
    assert.ok(fixtureLightFactor(light,0,[0,0,0])>=fixtureLightFactor(light,0,[0,0,-40]));
  }
  const restored=environmentLightState({rivalHpRatio:0,defeatElapsed:2.3});assert.equal(fixtureLightFactor(restored,0,[0,0,-40]),1);assert.equal(restored.warm,1);
});

test('invalid cinematic values cannot poison lighting or produce an invalid cut plane',()=>{
  const state=normalizeEnvironmentCinematic({lightDrain:Infinity,ripple:2,slice:-1,sky:NaN,focus:[NaN,8,Infinity],slicePlane:[0,0,0,0]});
  assert.equal(state.lightDrain,0);assert.equal(state.ripple,1);assert.equal(state.slice,0);assert.deepEqual(state.focus,[0,8,0]);
  assert.ok(Math.hypot(...state.slicePlane.slice(0,3))>0);
  const plane=normalizeEnvironmentCinematic({slicePlane:[0,4,0,-20]}).slicePlane;assert.deepEqual(plane,[0,1,0,-5]);
  assert.deepEqual(environmentLightState({rivalHpRatio:NaN,playerHpRatio:NaN}),environmentLightState());
});

test('charge drains practical power and low player health adds bounded pulse information',()=>{
  const normal=environmentLightState(),charge=environmentLightState({cinematic:{lightDrain:1}});
  assert.ok(charge.arenaStrength<normal.arenaStrength*.1);assert.ok(charge.practical<normal.practical*.1);
  for(let t=0;t<3;t+=.01){const low=environmentLightState({playerHpRatio:.01},t);assert.ok(low.playerPulse>=0&&low.playerPulse<=1);assert.ok(low.desaturation<=.35);}
});
