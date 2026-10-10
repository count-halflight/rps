import test from 'node:test';import assert from 'node:assert/strict';
import{newRun,levelFor,resolveTurn,chooseReward,chooseRoute,rewardChoices,loadSave}from'../src/game/engine.js';
import{RIVALS,BOSSES,MINIBOSSES,encounterFor,phaseFor}from'../src/game/rivals.js';
import{PERKS,addPerk,perkTotals}from'../src/game/perks.js';import{routeChoices,roomAction}from'../src/game/routes.js';import{fighterFor}from'../src/game/fighters.js';

test('24 named rivals have coherent weapon identities and six original district guardians',()=>{
 assert.equal(RIVALS.length,24);assert.equal(new Set(RIVALS.map(r=>r.id)).size,24);
 assert.equal(new Set(RIVALS.map(r=>JSON.stringify([r.character,r.color,r.kit]))).size,24);
 for(let d=0;d<6;d++)assert.equal(RIVALS.filter(r=>r.district===d).length,4);
 assert.equal(BOSSES.length,6);assert.equal(MINIBOSSES.length,6);
 assert.equal(new Set(BOSSES.map(b=>b.model)).size,6);
 for(let l=1;l<61;l++){
  const r=encounterFor(424,l);assert.equal(r.weapon,r.boss?BOSSES[r.district].weapon:fighterFor(r.character).weapon);
  assert.equal(r.boss,l%5===0);assert.equal(r.elite,!r.boss&&l%5===3);
  assert.deepEqual(encounterFor(424,l),r);
 }
});
test('reward and route states round-trip and every room has a free exit to combat',()=>{
 const r=newRun(312);r.enemy.signal=2;r.enemy.confidence=100;r.enemy.hp=1;r.hp=1;
 const won=resolveTurn(r,'rock');assert.equal(won.phase,'upgrade');
 for(const reward of rewardChoices(won)){
  const rewarded=chooseReward(won,reward.id);assert.equal(rewarded.phase,'route');assert.equal(rewarded.hp,rewarded.maxHp);
  assert.deepEqual(loadSave({getItem:()=>JSON.stringify(rewarded)}),rewarded);
  for(const door of routeChoices(rewarded)){
   const next=chooseRoute(rewarded,door.id);assert.equal(next.level,2);assert.equal(next.hp,next.maxHp);
   assert.deepEqual(loadSave({getItem:()=>JSON.stringify(next)}),next);
   if(next.phase==='room')assert.equal(roomAction(next,'leave').phase,'ready');
  }
 }
});
test('38 perks have bounded real effects and retain stack limits',()=>{
 assert.ok(PERKS.length>=38);let r=newRun(3);
 for(const p of PERKS){for(let i=0;i<5;i++)r=addPerk(r,p.id);assert.equal(r.perks[p.id],p.cap);assert.ok(Object.keys(p.effects).length);}
 assert.ok(perkTotals(r).damage>0);assert.ok(perkTotals(r).cooling>0);
 assert.equal(loadSave({getItem:()=>JSON.stringify({...r,perks:{invented:1}})}),null);
});
test('version 1 saves migrate without losing player progress or the enemy health proportion',()=>{
 const r=newRun(42);r.version=1;r.hp=27;r.credits=120;r.enemy.hp=24;r.enemy.maxHp=69;delete r.perks;delete r.routes;
 const restored=loadSave({getItem:()=>JSON.stringify(r)});assert.equal(restored.version,2);assert.equal(restored.hp,27);assert.equal(restored.credits,120);
 assert.equal(restored.enemy.hp,Math.round(levelFor(42,1).maxHp*24/69));assert.deepEqual(restored.perks,{});
});
test('boss health thresholds activate phases and a victory grants the district reward',()=>{
 let r=newRun(42);r.level=5;r.enemy=levelFor(r.seed,5);assert.equal(phaseFor(r.enemy),0);
 r.enemy.hp=Math.floor(r.enemy.maxHp*.64);assert.equal(phaseFor(r.enemy),1);
 r.enemy.hp=1;r.enemy.signal=2;r.enemy.confidence=100;
 const won=resolveTurn(r,'rock');const reward=chooseReward(won,'power');assert.equal(reward.perks[r.enemy.rival.reward],1);
});
