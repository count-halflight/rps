import assert from 'node:assert/strict';
import {mkdir,writeFile}from'node:fs/promises';
import {spawnSync}from'node:child_process';
import {launchBrowser,delay}from'./browser.mjs';
import {ATTACK_CATALOG}from'../src/game/attackCatalog.js';
import{newRun,WEAPONS,counterFor}from'../src/game/engine.js';
import{inspectCatalog}from'./choreography-proof.mjs';
const url=process.env.TEST_URL||'http://127.0.0.1:5173/';
const report=inspectCatalog();assert.equal(report.collisions.length,0,'near-identical timelines');
const list=process.env.CAPTURE_SAMPLE?ATTACK_CATALOG.filter(s=>s.id===process.env.CAPTURE_SAMPLE):ATTACK_CATALOG;
await mkdir('artifacts/choreography/frames',{recursive:true});await mkdir('public/proof',{recursive:true});
const b=await launchBrowser();const records=[];
try{
 await b.call('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});
 console.log('START');await b.navigate(`${url}?proof=1`);await b.waitFor("document.querySelector('.start-button')");
 await b.evaluate("localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'full',liveDossiers:false,music:false,volume:0}));localStorage.removeItem('trinity-save-v1');");
 console.log('PREFS');await b.reload();await b.waitFor("document.querySelector('.start-button')");await b.click('.start-button');await b.waitFor("document.querySelector('.character-select .three-arena')?.dataset.frameAsset==='loaded'",60000);console.log('SELECT');await b.click('.fighter-confirm');
 await b.waitFor("document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",60000);
 console.log('LOADED');
 // The real App runs under a manually advanced presentation clock. Audio is muted.
 await b.evaluate(`(()=>{let clock=performance.now(),id=0,raf=new Map(),timers=new Map();
 performance.now=()=>clock;window.requestAnimationFrame=f=>{raf.set(++id,f);return id};window.cancelAnimationFrame=i=>raf.delete(i);
 window.setTimeout=(f,ms=0,...args)=>{timers.set(++id,{at:clock+ms,f:()=>f(...args)});return id};window.clearTimeout=i=>timers.delete(i);
 window.__advance=ms=>{const end=clock+ms;let n=0;while(n++<1000){const tasks=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at);if(!tasks.length)break;const [i,t]=tasks[0];timers.delete(i);clock=Math.max(clock,t.at);t.f();}clock=end;const q=[...raf.values()];raf.clear();document.querySelector('.game-surface .three-arena')?.__captureRender?.(clock);return clock;};window.__clock=()=>clock;})()`);
 await delay(50);await b.evaluate('__advance(0)');
 for(const s of list){
  const r=newRun(417+records.length,null,s.character);r.encounterSeen=true;r.charge=100;r.enemy.confidence=100;
  const enemy=WEAPONS.find(w=>counterFor(w.id,r.enemy.district.reverse).id===s.weapon);r.enemy.signal=WEAPONS.indexOf(enemy);
  if(s.final)r.enemy.hp=1;else{r.enemy.hp=9999;r.enemy.maxHp=9999;}
  await b.evaluate(`window.dispatchEvent(new CustomEvent('trinity:proof-run',{detail:${JSON.stringify(r)}}))`);await delay(30);await b.evaluate('__advance(0)');
  await b.click(`.weapon-card:nth-child(${WEAPONS.findIndex(w=>w.id===s.weapon)+1})`);await delay(20);
  await b.evaluate('__advance(600)');await delay(20);await b.evaluate('__advance(450)');await delay(20);
  assert.equal(await b.evaluate("!!document.querySelector('.attack-card')"),true,s.id+' opening');
  await b.click(`.attack-card:nth-child(${s.variant+1})`);
  await b.waitFor(`document.querySelector('.game-surface .three-arena')?.__captureState?.().animation?.title===${JSON.stringify(s.title)}`);
  await b.evaluate('__advance(0)');await delay(50);await b.evaluate('__advance(0)');
  let last=0;const paths=[];
  for(const [label,p]of [['anticipation',.13],['travel',.30],['impact',s.impact],['recovery',.88]]){
   const ms=s.duration*p-last;await b.evaluate(`__advance(${ms})`);await delay(100);last=s.duration*p;
   await b.evaluate('__advance(0)');
   const path=`artifacts/choreography/frames/${s.id}-${label}.png`;await b.screenshot(path);paths.push({label,path,progress:p});
   const cinematic=await b.evaluate("document.querySelector('.game-surface .three-arena').dataset.cinematic");assert.notEqual(cinematic,'idle',s.id+' '+label);
   const progress=await b.evaluate("Number(document.querySelector('.game-surface .three-arena').dataset.progress)");assert.ok(Math.abs(progress-p)<.002,s.id+' '+label+' clock '+progress);
  }
  await b.evaluate(`__advance(${s.duration-last+100})`);await delay(20);
  records.push({id:s.id,title:s.title,character:s.character,frames:paths});console.log('CAPTURE',s.id);
 }
 assert.equal(b.errors.length,0,JSON.stringify(b.errors));
}catch(e){console.error('BROWSER',b.errors,b.requests.filter(r=>r.status>=400));console.error(await b.evaluate('document.body.innerText.slice(0,1200)'));throw e;}finally{await b.close();}
await writeFile('artifacts/choreography/captures.json',JSON.stringify(records,null,2));
await writeFile('public/proof/captures.json',JSON.stringify({sequences:records.length,totalFrames:records.reduce((n,r)=>n+r.frames.length,0),method:'Real hand and attack controls; the development-only presentation clock stepped to four fixed beats.',captures:records.map(r=>({...r,frames:r.frames.map(({label,progress})=>({label,progress})),sheet:r.character+'.png'}))},null,2));
await writeFile('public/proof/distances.json',JSON.stringify(report,null,2));
await writeFile('public/proof/distances.csv','sequence_a,sequence_b,pose_distance,camera_distance,combined_distance\n'+report.table.map(r=>[r.a,r.b,r.pose,r.camera,r.combined].join(',')).join('\n'));
const sheets=spawnSync('python3',['scripts/contact-sheets.py'],{stdio:'inherit'});if(sheets.status)process.exitCode=sheets.status;
