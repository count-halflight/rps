import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, delay } from "./browser.mjs";
import {
  newRun,
  counterFor,
  upgradeChoices,
  random,
} from "../src/game/engine.js";
const url = process.env.TEST_URL || "http://127.0.0.1:3001";
const duration = Number(process.env.SOAK_MINUTES || 60) * 60000;
const browser = await launchBrowser();
const started = Date.now(),
  samples = [],
  report = {
    started: new Date(started).toISOString(),
    url,
    exchanges: 0,
    floorsCleared: 0,
    runs: 0,
    maxFloor: 1,
    samples,
  };
let sampleAt = 0,
  profile = 0;
const state = () =>
  browser.evaluate('JSON.parse(localStorage.getItem("trinity-save-v1"))');
const persist = async () => {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    process.env.SOAK_REPORT || "artifacts/browser-soak.json",
    JSON.stringify(
      {
        ...report,
        elapsedMinutes: Number(((Date.now() - started) / 60000).toFixed(2)),
        errors: browser.errors,
        requests: browser.requests,
      },
      null,
      2,
    ),
  );
};
try {
  await browser.call("Performance.enable");
  await browser.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.navigate(url);
  await browser.waitFor('document.querySelector(".engage-button")');
  await browser.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(newRun(116)))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'auto',liveDossiers:false,motion:'system'}));`,
  );
  await browser.reload();
  await browser.waitFor('document.querySelector(".engage-button")');
  if (process.env.SOAK_SOUND === "1") {
    await browser.click('.site-header [aria-label="Enable sound"]');
    report.audioEnabled = true;
  }
  while (Date.now() - started < duration) {
    const run = await state();
    report.maxFloor = Math.max(report.maxFloor, run.level);
    if (run.phase === "defeat") {
      await browser.evaluate(
        'document.querySelector(".defeat-modal .primary-button")?.click()',
      );
      await browser.waitFor(
        'JSON.parse(localStorage.getItem("trinity-save-v1")).phase === "ready"',
      );
      report.runs++;
      continue;
    }
    if (run.phase === "upgrade") {
      const choices = upgradeChoices(run);
      const scored = choices
        .map((u) => ({
          ...u,
          score:
            u.id === "capacity"
              ? run.hp / run.maxHp < 0.6
                ? 22
                : 10
              : u.id === "power"
                ? 12
                : u.id === "armor"
                  ? run.upgrades.armor < 5
                    ? 14
                    : 4
                  : u.id === "coolant"
                    ? run.upgrades.coolant < 2
                      ? 11
                      : 3
                    : run.upgrades.battery < 2
                      ? 9
                      : 2,
        }))
        .sort((a, b) => b.score - a.score);
      await browser.evaluate(
        `document.querySelectorAll('.upgrade-grid button')[${choices.findIndex((u) => u.id === scored[0].id)}].click()`,
      );
      await browser.waitFor(
        `JSON.parse(localStorage.getItem('trinity-save-v1')).level === ${run.level + 1}`,
      );
      report.floorsCleared++;
      continue;
    }
    if (run.credits >= 80 && run.hp < run.maxHp * 0.7 && !run.repairUsed)
      await browser.evaluate(
        'document.querySelectorAll(".utility-row button")[1].click()',
      );
    if (
      run.charge >= 30 &&
      !run.scanUsed &&
      (run.enemy.boss || run.enemy.confidence < 75)
    )
      await browser.evaluate(
        'document.querySelectorAll(".utility-row button")[0].click()',
      );
    const current = await state();
    const weapon = counterFor(
      current.scanned || ["rock", "paper", "scissors"][current.enemy.signal],
      current.enemy.district.reverse,
    ).id;
    const stance =
      current.charge >= 70 && current.heat < 50 && current.enemy.hp > 25
        ? "overdrive"
        : current.hp < current.maxHp * 0.5 || current.enemy.confidence < 65
          ? "guard"
          : "strike";
    await browser.evaluate(
      `document.querySelectorAll('.weapon-card')[${["rock", "paper", "scissors"].indexOf(weapon)}].click();document.querySelectorAll('.stance-control button')[${["strike", "guard", "overdrive"].indexOf(stance)}].click();`,
    );
    await browser.waitFor(
      `document.querySelectorAll('.weapon-card')[${["rock", "paper", "scissors"].indexOf(weapon)}].getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.stance-control button')[${["strike", "guard", "overdrive"].indexOf(stance)}].getAttribute('aria-pressed') === 'true'`,
    );
    await browser.evaluate("document.querySelector('.engage-button').click()");
    await browser.waitFor(
      `JSON.parse(localStorage.getItem('trinity-save-v1')).turn === ${current.turn + 1}`,
      10000,
    );
    report.exchanges++;
    assert.equal(
      browser.errors.length,
      0,
      "Browser errors appeared during sustained play",
    );
    assert.equal(
      await browser.evaluate(
        "document.documentElement.scrollWidth <= innerWidth",
      ),
      true,
      "Layout overflowed during sustained play",
    );
    if (Date.now() - sampleAt > 300000) {
      sampleAt = Date.now();
      const metrics = (await browser.call("Performance.getMetrics")).metrics;
      const sample = {
        minute: Number(((Date.now() - started) / 60000).toFixed(1)),
        floor: current.level,
        exchanges: report.exchanges,
        heapMB: Number(
          (
            metrics.find((m) => m.name === "JSHeapUsedSize").value / 1048576
          ).toFixed(1),
        ),
        render: await browser.evaluate(
          '({...document.querySelector(".arena-render").dataset})',
        ),
      };
      samples.push(sample);
      await persist();
      console.log(JSON.stringify(sample));
      const sizes = [
        [1280, 900],
        [390, 844],
        [768, 1024],
        [1440, 1080],
      ];
      profile = (profile + 1) % sizes.length;
      await browser.call("Emulation.setDeviceMetricsOverride", {
        width: sizes[profile][0],
        height: sizes[profile][1],
        deviceScaleFactor: 1,
        mobile: profile === 1,
      });
    }
  }
  report.finished = new Date().toISOString();
  await persist();
  console.log(JSON.stringify({ ...report, samples: undefined }));
} finally {
  await persist();
  await browser.close();
}
