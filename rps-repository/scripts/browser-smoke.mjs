import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, delay } from "./browser.mjs";
import { newRun, levelFor, counterFor, WEAPONS } from "../src/game/engine.js";
import { FIGHTERS } from "../src/game/fighters.js";
const url = process.env.TEST_URL || "http://127.0.0.1:5173/",
  b = await launchBrowser(),
  checks = [];
const check = (n) => {
  checks.push(n);
  console.log("PASS", n);
};
const read = () =>
  b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
async function fixture(run, touch = false) {
  await b.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'reduced',liveDossiers:false}));`,
  );
  await b.reload();
  await b.waitFor("document.querySelector('.start-button')");
  await (touch ? b.touch(".start-button") : b.click(".start-button"));
  await b.waitFor(
    "document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
}
const choose = async (weapon) =>
  b.click(
    `.weapon-card:nth-child(${WEAPONS.findIndex((w) => w.id === weapon) + 1})`,
  );
async function finishTurn(turn) {
  await b.waitFor(
    `document.querySelector('.attack-card') || JSON.parse(localStorage.getItem('trinity-save-v1'))?.turn===${turn}`,
  );
  if (await b.evaluate("!!document.querySelector('.attack-card')"))
    await b.click(".attack-card");
  await b.waitFor(
    `JSON.parse(localStorage.getItem('trinity-save-v1')).turn===${turn}`,
  );
}
async function bounds(selectors, width, height) {
  const x = await b.evaluate(
    `(()=>{const buttons=[...document.querySelectorAll(${JSON.stringify(selectors)})].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});return {width:document.documentElement.scrollWidth,viewport:innerWidth,buttons};})()`,
  );
  assert.ok(x.width <= x.viewport + 1);
  for (const r of x.buttons)
    assert.ok(
      r.x >= -1 &&
        r.x + r.w <= width + 1 &&
        r.y >= 0 &&
        r.y + r.h <= height + 1,
      JSON.stringify({ width, height, r }),
    );
}
try {
  await mkdir("artifacts", { recursive: true });
  await b.call("Page.addScriptToEvaluateOnNewDocument", {
    source: `{const Native=window.AudioContext;window.__audio=[];window.AudioContext=class extends Native{constructor(...args){super(...args);this.__meters=[];window.__audio.push(this);}createAnalyser(){const a=super.createAnalyser();this.__meters.push(a);return a;}};}`,
  });
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await b.navigate(url);
  await b.evaluate(
    "localStorage.clear();localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'reduced',liveDossiers:false}));",
  );
  await b.reload();
  await b.click(".title-screen .fullscreen-button");
  await b.waitFor("document.fullscreenElement");
  await b.key("f", "KeyF");
  await b.waitFor("!document.fullscreenElement");
  check("Fullscreen button enters real fullscreen and F returns to the window");
  await b.click(".start-button");
  await b.waitFor(
    "document.querySelector('.character-select .three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  assert.equal(
    await b.evaluate("document.querySelectorAll('.fighter-choice').length"),
    5,
  );
  for (let i = 0; i < 5; i++) {
    await b.click(`.fighter-choice:nth-child(${i + 1})`);
    assert.equal(
      await b.evaluate(
        "document.querySelector('.fighter-details h2').textContent",
      ),
      FIGHTERS[i].name,
    );
  }
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    await b.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await delay(100);
    await bounds(".fighter-choice,.fighter-confirm", width, height);
  }
  await b.screenshot("artifacts/character-selection.png");
  await b.click(".fighter-choice:nth-child(3)");
  await b.click(".fighter-confirm");
  await b.waitFor(
    "document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  assert.equal((await read()).character, "nyx");
  assert.equal((await read()).maxHp, 90);
  assert.equal(
    await b.evaluate("document.querySelector('.site-header')"),
    null,
  );
  check(
    "Five live character previews select the correct fighter and fit desktop and mobile",
  );
  const audio = await b.evaluate(
    `new Promise(resolve=>{let peak=0,n=0;const timer=setInterval(()=>{for(const c of window.__audio)for(const a of c.__meters){const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);peak=Math.max(peak,Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length));}if(++n===12){clearInterval(timer);resolve({peak,state:window.__audio[0]?.state});}},80);})`,
  );
  assert.equal(audio.state, "running");
  assert.ok(audio.peak > 0.005, `music RMS ${audio.peak}`);
  check(
    `Actual music output starts from Play (peak RMS ${audio.peak.toFixed(4)})`,
  );
  await b.click('[aria-label="Mute sound"]');
  await delay(120);
  const muted = await b.evaluate(
    `(()=>{const a=window.__audio[0].__meters[0],x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);})()`,
  );
  assert.ok(muted < 0.0005);
  await b.click('[aria-label="Enable sound"]');
  check("Mute silences the actual output and audio resumes");
  const r = newRun(44);
  r.enemy.signal = 2;
  r.enemy.confidence = 100;
  await fixture(r);
  await choose("rock");
  await b.evaluate("document.querySelector('.weapon-card').click()");
  await b.waitFor("document.querySelector('.attack-card')");
  assert.equal((await read()).turn, 0);
  assert.equal((await read()).enemy.hp, r.enemy.hp);
  assert.equal(
    await b.evaluate("document.querySelector('.attack-card b').textContent"),
    "Pommel strike",
  );
  await b.click(".attack-card");
  await b.evaluate("document.querySelector('.attack-card')?.click()");
  await b.waitFor(
    "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
  );
  assert.equal((await read()).turn, 1);
  check(
    "RPS awards an opening without damage; a chosen attack commits exactly one turn",
  );
  await fixture(r);
  await choose("rock");
  await b.waitFor("document.querySelector('.attack-card')");
  await b.reload();
  await b.waitFor("document.querySelector('.start-button')");
  await b.click(".start-button");
  await b.waitFor("document.querySelector('.weapon-card')");
  assert.equal((await read()).turn, 0);
  check("Reloading an unspent opening resumes the same saved turn");
  await b.evaluate("document.activeElement.blur()");
  await b.key("1", "Digit1");
  await b.key(" ", "Space");
  await b.waitFor("document.querySelector('.attack-card')");
  await b.key("2", "Digit2");
  await b.waitFor(
    "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
  );
  assert.equal((await read()).result.stance, "guard");
  check("Keyboard plays a hand and chooses the earned attack");
  await b.key("Escape");
  await b.waitFor("document.querySelector('[role=dialog]')");
  assert.equal(await b.evaluate("document.querySelector('main').inert"), true);
  await b.key("Tab");
  assert.equal(
    await b.evaluate("!!document.activeElement.closest('[role=dialog]')"),
    true,
  );
  await b.key("Escape");
  await b.waitFor("!document.querySelector('[role=dialog]')");
  assert.equal(await b.evaluate("document.querySelector('main').inert"), false);
  check("Pause traps focus and restores controls");
  const items = newRun(71);
  items.hp = 45;
  items.charge = 60;
  items.enemy.signal = 2;
  items.enemy.confidence = 100;
  await fixture(items);
  await b.click(".mobile-tactics-toggle");
  await b.click(".utility-row button");
  assert.equal((await read()).charge, 30);
  await b.click(".mobile-tactics-toggle");
  await choose("rock");
  await b.waitFor("document.querySelector('.attack-card')");
  await b.click(".bag-button");
  await b.click(".item-card");
  await b.waitFor(
    "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
  );
  assert.equal((await read()).hp, 80);
  assert.equal((await read()).inventory.medkit, 1);
  assert.equal((await read()).enemy.hp, items.enemy.hp);
  check(
    "A medkit spends the opening, heals, and removes one item without attacking",
  );
  for (let i = 0; i < 5; i++) {
    const c = newRun(53, null, FIGHTERS[i].id);
    c.enemy.signal = 0;
    c.enemy.confidence = 100;
    await fixture(c);
    await choose("paper");
    await b.waitFor("document.querySelector('.attack-card')");
    assert.equal(
      await b.evaluate("document.querySelector('.attack-card b').textContent"),
      FIGHTERS[i].moves.paper[0],
    );
    await b.click(".attack-card");
    await b.waitFor(
      "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
    );
    assert.equal((await read()).character, FIGHTERS[i].id);
  }
  check("All five fighters use their own weapon-specific attacks");
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const r = newRun(19);
    r.level = level;
    r.enemy = levelFor(r.seed, level);
    r.enemy.signal = 2;
    r.enemy.confidence = 100;
    r.enemy.hp = 1;
    await fixture(r);
    await choose(counterFor("scissors", r.enemy.district.reverse).id);
    await b.waitFor("document.querySelector('.attack-card')");
    await b.click(".attack-card");
    await b.waitFor("document.querySelector('.upgrade-grid button')");
    await b.click(".upgrade-grid button");
    await b.waitFor(
      `JSON.parse(localStorage.getItem('trinity-save-v1')).level===${level + 1}`,
    );
  }
  check("All six districts finish a fight and grant the next upgrade and item");
  const dead = newRun(12);
  dead.hp = 1;
  dead.enemy.signal = 1;
  dead.enemy.confidence = 100;
  await fixture(dead);
  await choose("rock");
  await b.waitFor(
    `document.querySelector('[role=dialog][aria-label="You fell"]')`,
  );
  await b.click('[aria-label="You fell"] .primary-button');
  await b.waitFor("document.querySelector('.character-select')");
  await b.click(".fighter-confirm");
  await b.waitFor(
    "document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  assert.equal((await read()).hp, 100);
  check("Defeat returns to character selection for a fresh run");
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await b.call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await fixture(r, true);
  await b.touch(".weapon-card");
  await b.waitFor("document.querySelector('.attack-card')");
  await b.screenshot("artifacts/attack-menu-phone.png");
  await b.touch(".attack-card");
  await b.waitFor(
    "JSON.parse(localStorage.getItem('trinity-save-v1')).turn===1",
  );
  await b.screenshot("artifacts/revision-phone.png");
  check("Real phone touch plays the two-stage combat flow");
  await b.call("Emulation.setTouchEmulationEnabled", { enabled: false });
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 900],
  ]) {
    await b.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await delay(120);
    await bounds(".weapon-card", width, height);
    if (width === 844) await b.screenshot("artifacts/revision-landscape.png");
  }
  await b.screenshot("artifacts/revision-desktop.png");
  await fixture(r);
  await choose("rock");
  await b.waitFor("document.querySelector('.attack-card')");
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    await b.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await delay(100);
    await bounds(".attack-card,.bag-button", width, height);
  }
  check(
    "Hand and attack controls fit 320px phones, tablets, landscape, and desktop",
  );
  assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
  assert.equal(b.requests.length, 0, JSON.stringify(b.requests));
  check("No browser exceptions or failed asset requests");
  await writeFile(
    "artifacts/browser-report.json",
    JSON.stringify(
      { checks, audio, errors: b.errors, requests: b.requests },
      null,
      2,
    ),
  );
} catch (e) {
  await b.screenshot("artifacts/browser-failure.png").catch(() => {});
  await writeFile(
    "artifacts/browser-failure.json",
    JSON.stringify({ checks, error: e.message, errors: b.errors, requests: b.requests }, null, 2),
  );
  throw e;
} finally {
  await b.close();
}
