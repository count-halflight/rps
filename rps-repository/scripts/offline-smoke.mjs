import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { launchBrowser,delay } from "./browser.mjs";
import { newRun } from "../src/game/engine.js";
const b = await launchBrowser(),
  url = process.env.TEST_URL || "http://127.0.0.1:3001/";
const checks=[],pass=s=>{checks.push(s);console.log('PASS',s);};
const meter=()=>b.evaluate(`new Promise(resolve=>{let peak=0,n=0;const timer=setInterval(()=>{for(const c of window.__audio)for(const a of c.__meters){const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);peak=Math.max(peak,Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length));}if(++n===12){clearInterval(timer);resolve({peak,state:window.__audio[0]?.state});}},80);})`);
try {
  await mkdir('artifacts',{recursive:true});
  await b.call('Page.addScriptToEvaluateOnNewDocument',{source:`{const Native=window.AudioContext;window.__audio=[];window.AudioContext=class extends Native{constructor(...args){super(...args);this.__meters=[];window.__audio.push(this);}createAnalyser(){const a=super.createAnalyser();this.__meters.push(a);return a;}};}`});
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await b.navigate(url);
  await b.waitFor("document.querySelector('.start-button')");
  await b.waitFor("navigator.serviceWorker.controller", 40000);
  const report = await b.evaluate(
    `(async()=>{const names=await caches.keys(),c=await caches.open(names.find(n=>n.startsWith('trinity-'))),files=(await c.keys()).map(r=>new URL(r.url).pathname);return {files};})()`,
  );
  for (const name of ["echo", "ronin", "brawler", "nyx", "vex"])
    assert.ok(
      report.files.some((f) => f.endsWith(`/models/${name}-human.glb`)),
    );
  pass("All five fighter assets are cached");
  const r = newRun(37, null, "vex");
  r.encounterSeen=true;
  r.enemy.signal = 2;
  r.enemy.confidence = 100;
  await b.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(r))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'reduced',liveDossiers:false}));`,
  );
  await b.call("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await b.reload();
  await b.waitFor("document.querySelector('.start-button')");
  await b.click(".start-button");
  await b.waitFor(
    "document.querySelector('.three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  pass("Entry page, fonts, scripts, arena, and fighters load offline");
  const audio=await meter();assert.equal(audio.state,'running');assert.ok(audio.peak>.005,`Offline music RMS ${audio.peak}`);
  await b.click('[aria-label="Mute sound"]');await delay(150);
  assert.ok((await meter()).peak<.0005,'Mute must silence the real output');
  await b.click('[aria-label="Enable sound"]');assert.ok((await meter()).peak>.005,'Music must resume');
  pass('Original music plays offline; mute and resume change the measured output');
  await b.click('.game-surface .fullscreen-button');await b.waitFor('document.fullscreenElement');await b.key('f','KeyF');await b.waitFor('!document.fullscreenElement');
  pass('Real fullscreen enters and exits in the production build');
  await b.click(".weapon-card");
  await b.waitFor("document.querySelector('.attack-card')");
  await b.click(".attack-card");
  await b.waitFor(
    "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
  );
  assert.equal(
    await b.evaluate(
      "JSON.parse(localStorage.getItem('trinity-save-v1')).character",
    ),
    "vex",
  );
  pass("Earned attacks and saving work offline");
  assert.equal(b.errors.filter((e) => e.exceptionDetails).length, 0);
  await writeFile('artifacts/offline-report.json',JSON.stringify({checks,audio,cachedAssets:report.files,exceptions:b.errors.filter(e=>e.exceptionDetails)},null,2));
} finally {
  await b.close();
}
