import test from 'node:test';
import assert from 'node:assert/strict';
import { createQteTrack, activeQte, pressQte, expireQtes, qteScore, qteCharge } from '../src/game/qte.js';
import { ATTACK_CATALOG } from '../src/game/attackCatalog.js';
import { cinematicCue } from '../src/game/cinematics.js';
const cues=[{id:'launch',key:'2',at:.3,end:.42,label:'Launch'},{id:'return',key:'1',at:.56,end:.7,label:'Drive down'}];
test('QTE windows use an exclusive deadline; early and late inputs cannot score',()=>{
 const track=createQteTrack(cues,10000);
 assert.equal(activeQte(track,2999),null);
 assert.equal(pressQte(track,'2',2999).result,null);
 assert.equal(pressQte(track,'2',4200).result,null);
 assert.equal(expireQtes(track,4200)[0].status,'missed');
 assert.equal(activeQte(track,5600).id,'return');
});
test('A correct prompt awards charge only once and cannot answer the next prompt early',()=>{
 let result=pressQte(createQteTrack(cues,10000),'2',3500);
 assert.equal(result.result.status,'hit');assert.equal(qteCharge(result.track),3);
 result=pressQte(result.track,'2',3550);assert.equal(result.result,null);assert.equal(qteCharge(result.track),3);
 result=pressQte(result.track,'1',6000);assert.equal(qteCharge(result.track),6);assert.equal(qteScore(result.track,true),1);
});
test('Wrong keys fail the active cue; unanswered cues settle as missed without a softlock',()=>{
 const wrong=pressQte(createQteTrack(cues,10000),'3',3500);
 assert.equal(wrong.result.status,'missed');assert.equal(qteScore(wrong.track),0);
 const complete=expireQtes(wrong.track,10000);
 assert.ok(complete.every(cue=>cue.status==='missed'));assert.equal(qteCharge(complete),0);assert.equal(qteScore(complete,true),0);
});
test('Auto-play and reduced motion have no timed prompts or hidden charge reward',()=>{
 const track=createQteTrack(cues,1700,false);
 assert.deepEqual(track,[]);assert.equal(qteScore(track),1);assert.equal(qteCharge(track),0);
});
test('All player attacks have readable input windows that close before damage',()=>{
 for(const attack of ATTACK_CATALOG){
  const prompts=cinematicCue(attack.id);
  assert.equal(prompts.length,attack.final?2:1,attack.id);
  for(const cue of prompts){assert.ok(['1','2','3'].includes(cue.key));assert.ok(cue.end<attack.impact);assert.ok((cue.end-cue.at)*attack.duration>=650,attack.id+' input window');}
 }
});
