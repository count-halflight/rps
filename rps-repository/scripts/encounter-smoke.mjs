import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay} from './browser.mjs';
import {newRun,levelFor,WEAPONS,counterFor} from '../src/game/engine.js';
const b=await launchBrowser(),url=process.env.TEST_URL||'http://127.0.0.1:5173/';
const records=[];
const read=()=>b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
async function fixture(run){
 await b.evaluate(`window.dispatchEvent(new CustomEvent('trinity:proof-run',{detail:${JSON.stringify(run)}}))`);
 await delay(50);await b.evaluate('__advance(0)');await delay(50);await b.evaluate('__advance(0)');
}
async function opening(run){
 const hand=counterFor(WEAPONS[run.enemy.signal].id,run.enemy.district.reverse).id;
 await b.click(`.weapon-card:nth-child(${WEAPONS.findIndex(w=>w.id===hand)+1})`);
 await delay(40);await b.evaluate('__advance(600)');await delay(40);await b.evaluate('__advance(450)');
 await b.waitFor("document.querySelector('.attack-card')");
 await b.click('.attack-card');await b.waitFor("document.querySelector('.three-arena')?.__captureState?.().animation");
 await b.evaluate('__advance(0)');
 const duration=await b.evaluate("document.querySelector('.three-arena').__captureState().animation.duration");
 await b.evaluate(`__advance(${duration+20})`);await delay(80);await b.evaluate('__advance(0)');
}
try{
 await mkdir('artifacts/encounters',{recursive:true});
 await b.call('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});
 await b.navigate(`${url}?proof=1`);await b.waitFor("document.querySelector('.start-button')");
 await b.evaluate("localStorage.clear();localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'full',music:false,volume:0,liveDossiers:false}));");
 await b.reload();await b.waitFor("document.querySelector('.start-button')");await b.click('.start-button');
 await b.waitFor("document.querySelector('.character-select .three-arena')?.dataset.frameAsset==='loaded'",60000);await b.click('.fighter-confirm');
 await b.waitFor("document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",60000);
 await b.evaluate(`(()=>{let clock=performance.now(),id=0,timers=new Map();performance.now=()=>clock;window.requestAnimationFrame=()=>++id;window.cancelAnimationFrame=()=>{};window.setTimeout=(f,ms=0,...args)=>{timers.set(++id,{at:clock+ms,f:()=>f(...args)});return id};window.clearTimeout=i=>timers.delete(i);window.__advance=ms=>{const end=clock+ms;for(let n=0;n<1000;n++){const tasks=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at);if(!tasks.length)break;const[i,t]=tasks[0];timers.delete(i);clock=Math.max(clock,t.at);t.f();}clock=end;document.querySelector('.game-surface .three-arena')?.__captureRender?.(clock);};})()`);
 for(const level of [25,20,15,10,5,30]){
  const run=newRun(173,null,'echo');run.level=level;run.enemy=levelFor(run.seed,level);run.encounterSeen=false;
  await fixture(run);await b.waitFor("document.querySelector('.boss-intro')");
  assert.equal(await b.evaluate("document.querySelector('.three-arena').__captureState().entrance.duration"),5000);
  await b.evaluate('__advance(1500)');await delay(80);await b.evaluate('__advance(0)');
  await b.screenshot(`artifacts/encounters/boss-${run.enemy.rival.id}.png`);await b.click('.encounter-intro button');
  await delay(40);assert.equal((await read()).encounterSeen,true);
  for(const fraction of [.65,.30]){
   const phase={...run,encounterSeen:true,charge:100,enemy:{...run.enemy,hp:Math.floor(run.enemy.maxHp*fraction)+1,confidence:100,signal:0}};
   await fixture(phase);await opening(phase);await b.waitFor("document.querySelector('.phase-intro')");
   assert.match(await b.evaluate("document.querySelector('.phase-intro').innerText"),new RegExp(fraction===.65?'Phase 2':'Phase 3'));
   await b.evaluate('__advance(200)');await delay(80);await b.evaluate('__advance(0)');
   await b.screenshot(`artifacts/encounters/phase-${run.enemy.rival.id}-${fraction}.png`);
  }
  const signature={...run,encounterSeen:true,fightTurn:4};await fixture(signature);
  assert.ok(await b.evaluate("!!document.querySelector('.signature-warning')"));
  records.push({name:run.enemy.rival.name,level,environment:await b.evaluate("document.querySelector('.three-arena').dataset.environment"),phases:2,intro:5000});
  console.log('PASS',run.enemy.rival.name,'intro, phases, signature');
 }
 for(const level of [13,8,3,28,23,18]){
  const run=newRun(173);run.level=level;run.enemy=levelFor(run.seed,level);run.encounterSeen=true;await fixture(run);
  assert.ok(await b.evaluate("!!document.querySelector('.elite-life .phase-marker')"));
  await b.screenshot(`artifacts/encounters/elite-${run.enemy.rival.district}.png`);
  console.log('PASS',run.enemy.rival.name,'elite model and health segment');
 }
 assert.equal(b.errors.length,0,JSON.stringify(b.errors));assert.equal(b.requests.length,0,JSON.stringify(b.requests));
 await writeFile('artifacts/encounters/report.json',JSON.stringify({records,errors:b.errors,requests:b.requests},null,2));
}catch(e){await b.screenshot('artifacts/encounters/failure.png').catch(()=>{});console.error(await b.evaluate('document.body.innerText'));throw e;}finally{await b.close();}
