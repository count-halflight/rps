import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay} from './browser.mjs';
import {newRun,levelFor,WEAPONS,counterFor,resolveTurn} from '../src/game/engine.js';
import {attackPresentation,cinematicCue} from '../src/game/cinematics.js';
const b=await launchBrowser(), checks=[];
const check=name=>{checks.push(name);console.log('PASS',name);};
const url=process.env.TEST_URL||'http://127.0.0.1:5173/';
await mkdir('artifacts/cinematic-upgrade',{recursive:true});
try {
 await b.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await b.navigate(url+'?proof=1');await b.waitFor("document.querySelector('.start-button')");
 await b.evaluate("localStorage.clear();localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'system',cinematicQte:true,music:false,volume:0,liveDossiers:false}));");
 await b.reload();await b.click('.start-button');
 await b.waitFor("document.querySelector('.character-select .three-arena')?.dataset.frameAsset==='loaded'",60000);
 await b.screenshot('artifacts/cinematic-upgrade/selection.png');await b.click('.fighter-confirm');
 await b.waitFor("document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",60000);
 await b.evaluate(`(()=>{let clock=performance.now(),id=0,raf=new Map(),timers=new Map();performance.now=()=>clock;
 window.requestAnimationFrame=f=>{raf.set(++id,f);return id};window.cancelAnimationFrame=i=>raf.delete(i);
 window.setTimeout=(f,ms=0,...args)=>{timers.set(++id,{at:clock+ms,f:()=>f(...args)});return id};window.clearTimeout=i=>timers.delete(i);
 window.__advance=ms=>{const end=clock+ms;let n=0;while(n++<1000){const tasks=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at);if(!tasks.length)break;const[i,t]=tasks[0];timers.delete(i);clock=Math.max(clock,t.at);t.f();}clock=end;const q=[...raf.values()];raf.clear();q.forEach(f=>f(clock));return clock;};})()`);
 const advance=async ms=>{await b.evaluate(`__advance(${ms})`);await delay(35);await b.evaluate('__advance(0)');await delay(35);await b.evaluate("document.querySelector('.game-surface .three-arena')?.__captureRender?.(performance.now())");};
 const readAnimation=()=>b.evaluate("document.querySelector('.game-surface .three-arena').__captureState().animation");
 const readSave=()=>b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
 const intro=newRun(83,null,'echo');intro.level=5;intro.enemy=levelFor(intro.seed,5);intro.encounterSeen=false;
 await b.evaluate(`window.dispatchEvent(new CustomEvent('trinity:proof-run',{detail:${JSON.stringify(intro)}}))`);await delay(35);await advance(0);
 await b.waitFor("document.querySelector('.encounter-intro')");await b.key('Escape','Escape');await delay(35);
 assert.equal(await b.evaluate("!!document.querySelector('[role=dialog]')"),false,'Escape cannot pause an entrance while its timer runs');
 await advance(5100);assert.equal((await readSave()).encounterSeen,true);
 check('Entrances complete on schedule and cannot be paused by a hidden keyboard shortcut');
 async function start(character,hand,seed=91,final=true){
  const r=newRun(seed,null,character);r.encounterSeen=true;r.charge=50;r.enemy.hp=final?1:9999;r.enemy.maxHp=final?r.enemy.maxHp:9999;r.enemy.confidence=100;
  r.enemy.signal=WEAPONS.findIndex(w=>counterFor(w.id,r.enemy.district.reverse).id===hand);
  await b.evaluate(`window.dispatchEvent(new CustomEvent('trinity:proof-run',{detail:${JSON.stringify(r)}}))`);await delay(30);await advance(0);
  await b.screenshot(`artifacts/cinematic-upgrade/${character}-arena.png`);
  if(!await b.evaluate("!!document.querySelector('.tactics-drawer')"))await b.click('.mobile-tactics-toggle');
  await b.click(`.weapon-card:nth-child(${WEAPONS.findIndex(w=>w.id===hand)+1})`);await delay(30);
  assert.ok(await b.evaluate("[...document.querySelectorAll('.stance-control button,.utility-row button')].every(button=>button.disabled)"),'Rules and defence stay locked through the reveal');
  await advance(600);await advance(450);
  await b.click('.attack-card');await delay(35);await advance(0);
  const a=await readAnimation();assert.equal(a.finisher,final);assert.equal(a.qte.length,final?2:1);
  assert.ok(await b.evaluate("[...document.querySelectorAll('.stance-control button,.utility-row button')].every(button=>button.disabled)"),'Rules and defence cannot interrupt an attack');
  return {r,a,expected:resolveTurn(r,hand,'strike')};
 }
 for(const [character,hand,kind]of [['cinder','rock','orbital'],['nyx','paper','singularity'],['kuro','scissors','turbine']]){
  const {a,expected}=await start(character,hand);
  let elapsed=0;
  for(const [index,cue]of a.qte.entries()){
   const at=cue.opensAt+100;await advance(at-elapsed);elapsed=at;
   await b.waitFor("document.querySelector('.qte-target')");
   if(character==='cinder'&&index===0){await b.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await advance(0);await b.touch('.qte-target');}
   else await b.key(cue.key,`Digit${cue.key}`);
   await delay(35);assert.equal((await readAnimation()).qte[index].status,'hit');
   await advance(a.duration*.035);elapsed+=a.duration*.035;
   if(index===0){await b.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await advance(a.duration*.50-elapsed);elapsed=a.duration*.50;
    await b.screenshot(`artifacts/cinematic-upgrade/${kind}-world.png`);
    assert.equal(await b.evaluate("document.querySelector('.game-surface .three-arena').dataset.spectacle"),kind);
   }
  }
  assert.equal(await b.evaluate("document.querySelector('.damage-feedback')"),null,'damage stays hidden before impact');
  await advance(a.duration*a.impactAt+10-elapsed);elapsed=a.duration*a.impactAt+10;
  await b.screenshot(`artifacts/cinematic-upgrade/${kind}-impact.png`);
  assert.ok(await b.evaluate("!!document.querySelector('.damage-feedback')"));
  await advance(a.duration-elapsed+50);
  const saved=await readSave();assert.equal(saved.turn,1);assert.equal(saved.phase,'upgrade');
  assert.equal(saved.charge,Math.min(100,expected.charge+6));
  check(`${kind}: touch/keyboard QTEs, distinct world, delayed damage, exact charge reward, completed knockout`);
 }
 const {a,expected}=await start('cinder','rock',92);
 await advance(a.qte[0].opensAt+80);await b.key(a.qte[0].key==='1'?'2':'1');await delay(35);
 assert.equal((await readAnimation()).qte[0].status,'missed');
 await advance(a.duration+100);assert.equal((await readSave()).phase,'upgrade');assert.equal((await readSave()).charge,expected.charge);
 check('Wrong and unanswered prompts award no charge and cannot undo or softlock an earned knockout');
 const normal=await start('echo','scissors',93,false);
 await advance(normal.a.qte[0].opensAt+80);await b.key(normal.a.qte[0].key);await delay(35);
 assert.equal((await readAnimation()).qte[0].status,'hit');await advance(normal.a.duration+50);
 assert.equal((await readSave()).phase,'ready');assert.equal((await readSave()).turn,1);assert.equal((await readSave()).charge,normal.expected.charge+3);
 check('A normal attack uses its own timed prompt, awards exactly three charge and returns to playable combat');
 for(const character of ['echo','cinder','nyx','vex','kuro'])for(const hand of ['rock','paper','scissors'])for(const index of [0,1]){
  const presentation=attackPresentation(hand,true,false,0,character,null,index),cues=cinematicCue(presentation.sequenceId);
  assert.equal(cues.length,2);assert.ok(cues.every(cue=>cue.end<presentation.impactAt));
 }
 check('All thirty finisher prompt windows close before the final impact');
 assert.equal(b.errors.length,0,JSON.stringify(b.errors));assert.equal(b.requests.length,0,JSON.stringify(b.requests));
 await writeFile('artifacts/cinematic-upgrade/report.json',JSON.stringify({checks,errors:b.errors,missingAssets:b.requests},null,2));
}catch(error){console.error('BROWSER',b.errors,b.requests);throw error;}finally{await b.close();}
