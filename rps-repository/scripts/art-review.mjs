import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay} from './browser.mjs';
import {newRun,levelFor} from '../src/game/engine.js';
import {FIGHTERS} from '../src/game/fighters.js';
const url=process.env.TEST_URL||'http://127.0.0.1:4190/', b=await launchBrowser(),shots=[];
await mkdir('artifacts/art-upgrade',{recursive:true});
try{
 await b.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await b.navigate(url);await b.waitFor("document.querySelector('.start-button')");
 await b.evaluate(`localStorage.clear();localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:${JSON.stringify(process.env.ART_REVIEW_QUALITY||'low')},motion:'reduced',liveDossiers:false,cinematicQte:false,music:false}));`);
 await b.reload();await b.waitFor("document.querySelector('.title-art .three-arena')?.dataset.frameAsset==='loaded'",60000);await b.screenshot('artifacts/art-upgrade/title.png');
 await b.click('.start-button');await b.waitFor("document.querySelector('.character-select .three-arena')?.dataset.frameAsset==='loaded'",60000);
 for(let i=0;i<FIGHTERS.length;i++){
  await b.click(`.fighter-choice:nth-child(${i+1})`);await delay(400);
  const path=`artifacts/art-upgrade/${FIGHTERS[i].id}-selection.png`;await b.screenshot(path);shots.push(path);
 }
 for(let level=1;level<= (process.env.ART_REVIEW_FAST==='1'?0:6);level++){
  const run=newRun(518,null,FIGHTERS[(level-1)%5].id);run.level=level;run.enemy=levelFor(run.seed,level);run.encounterSeen=true;
  await b.evaluate(`localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});`);await b.reload();await b.waitFor("document.querySelector('.start-button')");await b.click('.start-button');
  await b.waitFor("document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",60000);await delay(250);
  const path=`artifacts/art-upgrade/district-${level}.png`;await b.screenshot(path);shots.push(path);
  assert.equal(await b.evaluate("document.querySelector('.health-side small').textContent.trim()"),`${run.hp} / ${run.maxHp}`);
 }
 assert.equal(b.errors.length,0,JSON.stringify(b.errors));assert.equal(b.requests.length,0,JSON.stringify(b.requests));
 await writeFile('artifacts/art-upgrade/report.json',JSON.stringify({quality:process.env.ART_REVIEW_QUALITY||'low',shots,errors:b.errors,missingAssets:b.requests},null,2));
 console.log(`PASS 5 fighter selections${process.env.ART_REVIEW_FAST==='1'?'':' and 6 district render captures with full starting health'}`);
}catch(error){console.error('BROWSER',b.errors,b.requests);throw error;}finally{await b.close();}
