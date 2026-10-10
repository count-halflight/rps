import assert from "node:assert/strict";
import { launchBrowser } from "./browser.mjs";
import { newRun } from "../src/game/engine.js";
const b = await launchBrowser(),
  url = process.env.TEST_URL || "http://127.0.0.1:3001/";
try {
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
  console.log("PASS All five fighter assets are cached");
  const r = newRun(37, null, "vex");
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
  console.log(
    "PASS Entry page, fonts, scripts, arena, and fighters load offline",
  );
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
  console.log("PASS Earned attacks and saving work offline");
  assert.equal(b.errors.filter((e) => e.exceptionDetails).length, 0);
} finally {
  await b.close();
}
