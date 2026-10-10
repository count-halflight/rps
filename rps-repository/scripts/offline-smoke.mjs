import assert from "node:assert/strict";
import { launchBrowser, delay } from "./browser.mjs";
const browser = await launchBrowser();
const url = process.env.TEST_URL || "http://127.0.0.1:3001";
try {
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.navigate(url);
  await browser.waitFor('document.querySelector(".engage-button")');
  await browser.waitFor("navigator.serviceWorker.controller", 40000);
  const cacheReport = await browser.evaluate(
    '(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith("trinity-")));return {name:names[0],files:(await cache.keys()).length};})()',
  );
  assert.ok(cacheReport.files > 20);
  console.log("PASS Offline cache is active", cacheReport);
  await browser.call("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
  await browser.waitFor(
    'document.querySelector(".arena-render")?.dataset.frameAsset === "loaded"',
    25000,
  );
  console.log(
    "PASS Entry page, fonts, scripts, arena, and original model load offline",
  );
  const initial = await browser.evaluate(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn',
  );
  await browser.click(".weapon-card:nth-child(2)");
  await browser.click(".engage-button");
  await browser.waitFor(
    `JSON.parse(localStorage.getItem("trinity-save-v1")).turn === ${initial + 1}`,
  );
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".arena-backdrop") !== null',
    ),
    true,
  );
  console.log("PASS Combat and progress saving work offline");
  assert.equal(
    browser.errors.filter((error) => error.exceptionDetails).length,
    0,
  );
  await browser.call("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
} finally {
  await browser.close();
}
