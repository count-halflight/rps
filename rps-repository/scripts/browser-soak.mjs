import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";
import {
  newRun,
  counterFor,
  upgradeChoices,
  WEAPONS,
} from "../src/game/engine.js";
const b = await launchBrowser(),
  url = process.env.TEST_URL || "http://127.0.0.1:5173/",
  started = Date.now(),
  duration = Number(process.env.SOAK_MINUTES || 10) * 60000;
const report = {
    started: new Date(started).toISOString(),
    exchanges: 0,
    floorsCleared: 0,
    runs: 0,
    maxFloor: 1,
    samples: [],
  },
  read = () =>
    b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
try {
  await b.call("Performance.enable");
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await b.navigate(url);
  await b.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(newRun(116)))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'reduced',liveDossiers:false}));`,
  );
  await b.reload();
  await b.waitFor("document.querySelector('.start-button')");
  await b.click(".start-button");
  await b.waitFor(
    "document.querySelector('.three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  while (Date.now() - started < duration) {
    const r = await read();
    report.maxFloor = Math.max(report.maxFloor, r.level);
    if (r.phase === "defeat") {
      await b.click('[aria-label="You fell"] .primary-button');
      await b.waitFor("document.querySelector('.fighter-confirm')");
      await b.click(".fighter-confirm");
      await b.waitFor(
        "document.querySelector('.three-arena')?.dataset.frameAsset==='loaded'",
        30000,
      );
      report.runs++;
      continue;
    }
    if (r.phase === "upgrade") {
      const choices = upgradeChoices(r),
        index = choices.findIndex(
          (u) => u.id === (r.hp < r.maxHp * 0.5 ? "capacity" : "power"),
        );
      await b.click(
        `.upgrade-grid button:nth-child(${Math.max(0, index) + 1})`,
      );
      await b.waitFor(
        `JSON.parse(localStorage.getItem('trinity-save-v1')).level===${r.level + 1}`,
      );
      report.floorsCleared++;
      continue;
    }
    const hand = counterFor(
      WEAPONS[r.enemy.signal].id,
      r.enemy.district.reverse,
    ).id;
    await b.click(
      `.weapon-card:nth-child(${WEAPONS.findIndex((w) => w.id === hand) + 1})`,
    );
    await b.waitFor(
      `document.querySelector('.attack-card') || JSON.parse(localStorage.getItem('trinity-save-v1')).turn===${r.turn + 1}`,
    );
    if (await b.evaluate("!!document.querySelector('.attack-card')")) {
      if (r.hp < r.maxHp * 0.45 && r.inventory.medkit) {
        await b.click(".bag-button");
        await b.click(".item-card");
      } else if (r.heat > 65 && r.inventory.coolant) {
        await b.click(".bag-button");
        await b.click(".item-card:nth-child(2)");
      } else
        await b.click(
          `.attack-card:nth-child(${r.charge >= 40 && r.heat < 55 ? 3 : 1})`,
        );
    }
    await b.waitFor(
      `JSON.parse(localStorage.getItem('trinity-save-v1')).turn===${r.turn + 1}`,
    );
    report.exchanges++;
    if (report.exchanges % 8 === 0) {
      const metrics = await b.call("Performance.getMetrics");
      report.samples.push({
        turn: report.exchanges,
        heap: metrics.metrics.find((x) => x.name === "JSHeapUsedSize")?.value,
      });
      console.log(
        `Played ${report.exchanges} turns; best floor ${report.maxFloor}`,
      );
    }
  }
  assert.ok(report.exchanges > 0);
  assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
  assert.equal(b.requests.length, 0, JSON.stringify(b.requests));
  console.log("PASS Sustained play", JSON.stringify(report));
} finally {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    process.env.SOAK_REPORT || "artifacts/browser-soak.json",
    JSON.stringify(
      {
        ...report,
        elapsedMinutes: (Date.now() - started) / 60000,
        errors: b.errors,
        requests: b.requests,
      },
      null,
      2,
    ),
  );
  await b.close();
}
