import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, delay } from "./browser.mjs";
import { newRun } from "../src/game/engine.js";

const browser = await launchBrowser(),
  checks = [];
const url = process.env.TEST_URL || "http://127.0.0.1:3001";
const readSave = () =>
  browser.evaluate('JSON.parse(localStorage.getItem("trinity-save-v1"))');
const check = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const saved = newRun(421);
saved.hp = 20;
saved.charge = 66;
saved.credits = 240;
const fixture = async (run) => {
  await browser.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'system',liveDossiers:false}));`,
  );
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
};
try {
  await mkdir("artifacts", { recursive: true });
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await browser.navigate(url);
  await browser.waitFor('document.querySelector(".engage-button")');
  await fixture(saved);
  await browser.touch('.site-header [aria-label="Enable sound"]');
  await browser.waitFor('JSON.parse(localStorage.getItem("trinity-sound")) === true');
  await browser.touch(".tutorial-entry");
  await browser.waitFor('document.querySelector(".training-coach")');
  await browser.touch(".engage-button");
  await browser.waitFor(
    'document.querySelector(".training-coach h1").innerText.includes("Turn force")',
  );
  assert.deepEqual(await readSave(), saved);
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
  assert.equal(
    await browser.evaluate(
      'Boolean(document.querySelector(".training-coach"))',
    ),
    false,
  );
  assert.deepEqual(await readSave(), saved);
  check("Leaving training by reloading preserves the original run");
  await browser.touch(".tutorial-entry");
  await browser.waitFor('document.querySelector(".training-coach")');
  await browser.screenshot("artifacts/tutorial-phone.png");
  await browser.touch(".engage-button");
  await browser.waitFor(
    'document.querySelector(".training-coach h1").innerText.includes("Turn force")',
  );
  await browser.touch(".weapon-card:nth-child(2)");
  await browser.touch(".engage-button");
  await browser.waitFor(
    'document.querySelector(".training-coach h1").innerText.includes("Spend the charge")',
  );
  await browser.touch(".mobile-tactics-toggle");
  await browser.touch(".stance-control button:nth-of-type(3)");
  await browser.touch(".weapon-card:nth-child(3)");
  await browser.touch(".engage-button");
  await browser.waitFor(
    'document.querySelector(".training-coach h1").innerText.includes("Cinder")',
  );
  await browser.touch(".mobile-tactics-toggle");
  for (let turn = 0; turn < 7; turn++) {
    if (
      await browser.evaluate(
        'document.querySelector(".training-coach h1").innerText.includes("online")',
      )
    )
      break;
    const signal = await browser.evaluate(
      'document.querySelector(".signal-main strong").innerText',
    );
    const counter = { Razor: 1, Seismic: 2, Veil: 3 }[signal];
    await browser.touch(`.weapon-card:nth-child(${counter})`);
    await browser.touch(".engage-button");
    await browser.waitFor(
      '!document.querySelector(".engage-button").innerText.includes("Engaging")',
    );
  }
  assert.match(
    await browser.evaluate(
      'document.querySelector(".training-coach h1").innerText',
    ),
    /online/,
  );
  assert.deepEqual(await readSave(), saved);
  await browser.touch(".training-coach .primary-button");
  await browser.waitFor('!document.querySelector(".training-coach")');
  assert.deepEqual(await readSave(), saved);
  check(
    "Touch tutorial teaches three weapons, overdrive, and a boss without replacing progress",
  );

  await browser.touch(".mobile-tactics-toggle");
  await browser.touch(".lab-toggle");
  await browser.touch(".lab-tabs button:nth-child(2)");
  assert.match(
    await browser.evaluate('document.querySelector(".lab-lesson").innerText'),
    /integral/i,
  );
  await browser.touch(".slice-controls button:nth-child(3)");
  assert.equal(
    await browser.evaluate(
      'document.querySelectorAll(".lab-panel .integral-slice").length',
    ),
    64,
  );
  await browser.touch(".lab-tabs button:nth-child(3)");
  assert.match(
    await browser.evaluate('document.querySelector(".lab-lesson").innerText'),
    /75/,
  );
  await browser.screenshot("artifacts/calculus-phone.png");
  check(
    "Optional calculus lab switches concepts and changes the Riemann slice count",
  );

  await browser.call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const [weapon, index, signal, title] of [
    ["rock", 1, 2, "Citybreaker"],
    ["paper", 2, 0, "Event horizon"],
    ["scissors", 3, 1, "Last light"],
  ]) {
    const run = newRun(0);
    run.enemy.hp = 1;
    run.enemy.signal = signal;
    run.enemy.confidence = 100;
    await fixture(run);
    await browser.waitFor(
      'document.querySelector(".arena-render")?.dataset.frameAsset === "loaded"',
      25000,
    );
    await browser.click(`.weapon-card:nth-child(${index})`);
    await browser.waitFor(
      `document.querySelectorAll('.weapon-card')[${index - 1}].getAttribute('aria-pressed') === 'true'`,
    );
    const reveal = await browser.evaluate(`new Promise((resolve,reject)=>{
      let pending; const snapshot=()=>({title:document.querySelector('.cinematic-caption strong')?.innerText,reveal:document.querySelector('.cinematic-overlay')?.dataset.reveal,slices:document.querySelectorAll('.cinematic-integral .integral-slice').length,damage:Boolean(document.querySelector('.damage-feedback'))});
      const observer=new MutationObserver(()=>{const state=snapshot();if(state.reveal==='pending')pending=state;if(state.reveal==='confirmed'||state.reveal==='denied'){observer.disconnect();clearTimeout(timer);resolve({pending,revealed:state});}});
      observer.observe(document.querySelector('.battle-stage'),{subtree:true,childList:true,attributes:true});
      const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Missing cinematic reveal'));},7000);
      document.querySelector('.engage-button').click();
    })`);
    assert.equal(reveal.pending.title, title);
    assert.equal(reveal.pending.reveal, "pending");
    assert.equal(reveal.pending.damage, false);
    assert.equal(reveal.revealed.reveal, "confirmed");
    if (weapon === "paper") assert.equal(reveal.pending.slices, 24);
    await browser.screenshot(`artifacts/finisher-${weapon}.png`);
    await browser.waitFor('document.querySelector(".upgrade-modal")');
    assert.equal((await readSave()).phase, "upgrade");
  }
  check(
    "All three finishing cinematics resolve into victory, including Veil’s integral field",
  );
  const denied = newRun(0);
  denied.enemy.hp = 20;
  denied.enemy.signal = 1;
  denied.enemy.confidence = 100;
  await fixture(denied);
  await browser.waitFor(
    'document.querySelector(".arena-render")?.dataset.frameAsset === "loaded"',
    25000,
  );
  const attempt = await browser.evaluate(
    `new Promise((resolve,reject)=>{let pending=false;const o=new MutationObserver(()=>{const e=document.querySelector('.cinematic-overlay');if(e?.dataset.reveal==='pending')pending=true;if(e?.dataset.reveal==='denied'){o.disconnect();clearTimeout(t);resolve({pending,text:e.innerText,damage:Boolean(document.querySelector('.damage-feedback'))});}});o.observe(document.querySelector('.battle-stage'),{subtree:true,childList:true,attributes:true});const t=setTimeout(()=>reject(new Error('Missing denied reveal')),7000);document.querySelector('.engage-button').click();})`,
  );
  assert.equal(attempt.pending, true);
  assert.match(attempt.text, /intercepted/);
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn === 1',
  );
  assert.equal((await readSave()).phase, "ready");
  check(
    "A failed final attempt uses the same suspense and reveals the blocked result at impact",
  );
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  assert.equal(browser.requests.length, 0, JSON.stringify(browser.requests));
  await writeFile(
    "artifacts/training-smoke.json",
    JSON.stringify(
      { checks, errors: browser.errors, requests: browser.requests },
      null,
      2,
    ),
  );
} catch (error) {
  await browser.screenshot("artifacts/training-failure.png").catch(() => {});
  await writeFile(
    "artifacts/training-failure.json",
    JSON.stringify(
      {
        checks,
        failure: error.message,
        errors: browser.errors,
        requests: browser.requests,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
