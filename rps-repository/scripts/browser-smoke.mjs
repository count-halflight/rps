import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, delay } from "./browser.mjs";
import { newRun, levelFor, counterFor } from "../src/game/engine.js";
const url = process.env.TEST_URL || "http://127.0.0.1:5173";
const browser = await launchBrowser();
const checks = [];
const readRun = () =>
  browser.evaluate('JSON.parse(localStorage.getItem("trinity-save-v1"))');
const fixture = async (run) => {
  await browser.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',liveDossiers:false,motion:'reduced'}));`,
  );
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
};
const check = (name, details = {}) => {
  checks.push({ name, ...details });
  console.log(`PASS ${name}`);
};
try {
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.navigate(url);
  await browser.waitFor('document.querySelector(".weapon-card")');
  await fixture(newRun(44));
  await browser.waitFor(
    'document.querySelector(".arena-render")?.dataset.frameAsset === "loaded"',
    25000,
  );
  check("Original 3D frame loads");
  await browser.click(".weapon-card:nth-child(3)");
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".weapon-card:nth-child(3)").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await browser.click(".engage-button");
  await browser.evaluate('document.querySelector(".engage-button").click()');
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn === 1',
  );
  assert.equal((await readRun()).turn, 1);
  check("Mouse combat resolves once, including rapid double clicks");
  const saved = await readRun();
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
  assert.deepEqual(await readRun(), saved);
  check("Run state survives a page reload");
  await browser.evaluate("document.activeElement?.blur()");
  await browser.key("2", "Digit2");
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".weapon-card:nth-child(2)").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await browser.key(" ", "Space");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn === 2',
  );
  check("Keyboard weapon selection and engagement work");
  await browser.key("Escape");
  await browser.waitFor('document.querySelector("[role=dialog]")');
  assert.equal(
    await browser.evaluate('document.querySelector("main").inert'),
    true,
  );
  assert.equal(
    await browser.evaluate("document.body.style.overflow"),
    "hidden",
  );
  assert.match(
    await browser.evaluate('document.querySelector("[role=dialog]").innerText'),
    /Take a breath/,
  );
  await browser.key("Tab");
  assert.equal(
    await browser.evaluate(
      'Boolean(document.activeElement.closest("[role=dialog]"))',
    ),
    true,
  );
  await browser.key("Escape");
  await browser.waitFor('!document.querySelector("[role=dialog]")');
  assert.equal(
    await browser.evaluate('document.querySelector("main").inert'),
    false,
  );
  check("Pause dialog opens, traps focus, and closes with Escape");
  const utilities = newRun(71);
  utilities.charge = 60;
  utilities.hp = 45;
  utilities.credits = 160;
  await fixture(utilities);
  await browser.click(".utility-row button:nth-of-type(1)");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).scanUsed',
  );
  assert.match(
    await browser.evaluate(
      'document.querySelector(".signal-likelihood").innerText',
    ),
    /100%/,
  );
  assert.equal((await readRun()).charge, 30);
  await browser.click(".utility-row button:nth-of-type(2)");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).repairUsed',
  );
  assert.equal((await readRun()).hp, 75);
  assert.equal((await readRun()).credits, 80);
  check("Scan and repair charge their stated costs");
  const winning = newRun(0);
  winning.enemy.hp = 1;
  winning.enemy.confidence = 100;
  winning.enemy.signal = 2;
  await fixture(winning);
  await browser.click(".weapon-card:nth-child(1)");
  await browser.click(".engage-button");
  await browser.waitFor('document.querySelector(".upgrade-modal")');
  await browser.click(".upgrade-grid button");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).level === 2',
  );
  assert.match(
    await browser.evaluate(
      'getComputedStyle(document.querySelector(".arena-backdrop")).backgroundImage',
    ),
    /ember-foundry/,
  );
  check("Victory awards an augment and enters a different district");
  const losing = newRun(10);
  losing.hp = 1;
  losing.enemy.confidence = 100;
  losing.enemy.signal = 1;
  await fixture(losing);
  await browser.click(".weapon-card:nth-child(1)");
  await browser.click(".engage-button");
  await browser.waitFor('document.querySelector(".defeat-modal")');
  await browser.click(".defeat-modal .primary-button");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).hp === 100',
  );
  assert.equal((await readRun()).level, 1);
  check("Defeat and restart preserve records and create a fresh run");
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
  await browser.evaluate("scrollTo(0,0)");
  assert.equal(
    await browser.evaluate(
      "document.documentElement.scrollWidth <= innerWidth",
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(
      'getComputedStyle(document.querySelector(".stance-control")).display',
    ),
    "none",
  );
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".engage-button").getBoundingClientRect().height >= 44',
    ),
    true,
  );
  await browser.touch(".mobile-tactics-toggle");
  assert.notEqual(
    await browser.evaluate(
      'getComputedStyle(document.querySelector(".stance-control")).display',
    ),
    "none",
  );
  await browser.touch(".stance-control button:nth-of-type(2)");
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".stance-control button:nth-of-type(2)").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await browser.touch(".mobile-tactics-toggle");
  await browser.touch(".weapon-card:nth-child(2)");
  await browser.touch(".engage-button");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn === 1',
  );
  check(
    "Phone layout has no overflow, large primary buttons, optional tactics, and working touch combat",
  );
  await browser.call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await browser.click(".settings-button");
  await browser.click(".setting-options button:nth-child(3)");
  await browser.click(".settings-modal .primary-button");
  await browser.waitFor(
    'document.querySelector(".arena-render")?.dataset.renderQuality === "light"',
  );
  assert.equal(
    await browser.evaluate(
      'JSON.parse(localStorage.getItem("trinity-preferences-v1")).quality',
    ),
    "low",
  );
  check("Graphics preference updates the renderer and saves");
  await browser.click(".site-header nav .nav-link:nth-child(2)");
  await browser.click(".daily-circuit button");
  await browser.click(".small-modal .primary-button");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).challenge',
  );
  const daily = await readRun();
  assert.match(daily.challenge, /^\d{4}-\d{2}-\d{2}$/);
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
  assert.equal((await readRun()).challenge, daily.challenge);
  check("Daily circuit starts through a clear reset prompt and persists");
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await browser.evaluate("scrollTo(0,0)");
  assert.equal(
    await browser.evaluate(
      "document.documentElement.scrollWidth <= innerWidth",
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(
      'document.querySelector(".engage-button").getBoundingClientRect().bottom <= innerHeight',
    ),
    true,
  );
  await browser.touch(".weapon-card:nth-child(1)");
  await browser.touch(".engage-button");
  await browser.waitFor(
    'JSON.parse(localStorage.getItem("trinity-save-v1")).turn === 1',
  );
  await mkdir("artifacts", { recursive: true });
  await browser.screenshot("artifacts/landscape.png");
  check(
    "Landscape phone keeps the arena and touch combat controls within the viewport",
  );
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await browser.call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: width < 650,
    });
    assert.equal(
      await browser.evaluate(
        "document.documentElement.scrollWidth <= innerWidth",
      ),
      true,
      `Layout overflows at ${width}`,
    );
  }
  check("Layout stays within the screen from 320px to 1440px");
  await mkdir("artifacts", { recursive: true });
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.evaluate("scrollTo(0,0)");
  await delay(400);
  await browser.screenshot("artifacts/phone.png");
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.evaluate("scrollTo(0,0)");
  await delay(400);
  await browser.screenshot("artifacts/desktop.png");
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  assert.equal(browser.requests.length, 0, JSON.stringify(browser.requests));
  check("No JavaScript errors or failed asset/API requests");
  await writeFile(
    "artifacts/browser-smoke.json",
    JSON.stringify(
      { url, checks, errors: browser.errors, requests: browser.requests },
      null,
      2,
    ),
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await browser.screenshot("artifacts/browser-failure.png").catch(() => {});
  await writeFile(
    "artifacts/browser-failure.json",
    JSON.stringify(
      {
        checks,
        failure: error.message,
        errors: browser.errors,
        requests: browser.requests,
        state: await readRun().catch(() => null),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
