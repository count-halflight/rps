import test from "node:test";
import assert from "node:assert/strict";
import { dailyDate, dailySeed } from "../src/game/daily.js";
import { newRun, levelFor, loadSave } from "../src/game/engine.js";
test("the daily circuit is reproducible across players and changes at UTC midnight", () => {
  const day = dailyDate(new Date("2026-10-10T23:59:59Z"));
  const nextDay = dailyDate(new Date("2026-10-11T00:00:00Z"));
  assert.equal(day, "2026-10-10");
  assert.equal(nextDay, "2026-10-11");
  assert.notEqual(dailySeed(day), dailySeed(nextDay));
  assert.deepEqual(levelFor(dailySeed(day), 20), levelFor(dailySeed(day), 20));
  assert.ok(dailySeed(day) >= 0 && dailySeed(day) < 2 ** 32);
  const run = newRun(dailySeed(day), day);
  assert.deepEqual(loadSave({ getItem: () => JSON.stringify(run) }), run);
});
