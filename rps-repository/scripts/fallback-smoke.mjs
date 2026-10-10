import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser} from './browser.mjs';
import {newRun,chooseReward,rewardChoices} from '../src/game/engine.js';
import {routeChoices} from '../src/game/routes.js';
const b=await launchBrowser(),checks=[],url=process.env.TEST_URL||'http://127.0.0.1:5173/';
const read=()=>b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
const pass=s=>{checks.push(s);console.log('PASS',s);};
async function fixture(run){
 run.encounterSeen=true;
 await b.evaluate(`localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'reduced',music:false,liveDossiers:false}));`);
 await b.reload();await b.waitFor("document.querySelector('.start-button')");await b.click('.start-button');
}
try{
 await mkdir('artifacts',{recursive:true});
 await b.call('Page.addScriptToEvaluateOnNewDocument',{source:"{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};}"});
 await b.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await b.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await b.navigate(url);await b.waitFor("document.querySelector('.start-button')");
 const run=newRun(7);run.enemy.signal=2;run.enemy.confidence=100;
 await fixture(run);await b.waitFor("document.querySelector('.fallback-arena')");
 await b.touch('.weapon-card');await b.waitFor("document.querySelector('.attack-card')");await b.touch('.attack-card');
 await b.waitFor("JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1");
 assert.ok((await read()).enemy.hp<run.enemy.hp);pass('Touch combat works when WebGL is unavailable');
 for(const route of ['normal','elite','rest','shop','event']){
  const seed=Array.from({length:100},(_,i)=>i).find(seed=>routeChoices({seed,level:1}).some(r=>r.id===route));
  const won={...newRun(seed),phase:'upgrade'};won.enemy.hp=0;
  const next=chooseReward(won,rewardChoices(won)[0].id);next.credits=0;
  await fixture(next);await b.waitFor(`document.querySelector('.route-${route}')`);await b.touch(`.route-${route}`);
  if(['rest','shop','event'].includes(route)){
   await b.waitFor("document.querySelector('.room-leave')");
   if(route==='shop')assert.ok(await b.evaluate("[...document.querySelectorAll('.room-actions button')].every(b=>b.disabled)"));
   await b.touch('.room-leave');
  }
  await b.waitFor("document.querySelector('.weapon-card')");assert.equal((await read()).level,2);assert.equal((await read()).hp,(await read()).maxHp);
  const bounds=await b.evaluate("[...document.querySelectorAll('.weapon-card')].map(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;})");assert.ok(bounds.every(Boolean));
  pass(`${route} door reaches the next fight with full health and usable phone controls`);
 }
 assert.equal(b.errors.filter(e=>e.exceptionDetails).length,0,JSON.stringify(b.errors));assert.equal(b.requests.length,0,JSON.stringify(b.requests));
 await writeFile('artifacts/fallback-report.json',JSON.stringify({checks,exceptions:[],requests:b.requests},null,2));
}finally{await b.close();}
