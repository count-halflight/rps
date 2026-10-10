import test from "node:test";
import assert from "node:assert/strict";
import {
  WEAPONS,
  newRun,
  levelFor,
  resolveTurn,
  counterFor,
  chooseUpgrade,
  upgradeChoices,
  loadSave,
} from "../src/game/engine.js";
const fixed = (weapon, level = 1) => {
  const run = newRun(42);
  run.level = level;
  run.enemy = levelFor(run.seed, level);
  run.enemy.signal = WEAPONS.findIndex((w) => w.id === weapon);
  run.enemy.confidence = 100;
  return run;
};
test("each weapon wins, draws and loses correctly in both counter cycles", () => {
  for (const level of [1, 3])
    for (const enemy of WEAPONS) {
      const run = fixed(enemy.id, level);
      const winning = counterFor(enemy.id, run.enemy.district.reverse).id;
      const losing = WEAPONS.find(
        (w) => w.id !== winning && w.id !== enemy.id,
      ).id;
      const win = resolveTurn(run, winning),
        draw = resolveTurn(run, enemy.id),
        loss = resolveTurn(run, losing);
      assert.equal(win.result.outcome, "win");
      assert.equal(win.hp, run.hp);
      assert.ok(win.enemy.hp < run.enemy.hp);
      assert.equal(draw.result.outcome, "draw");
      assert.ok(draw.hp < run.hp);
      assert.equal(loss.result.outcome, "loss");
      assert.ok(loss.hp < draw.hp);
    }
});
test("guard reduces incoming damage and generates more charge", () => {
  const run = fixed("paper"),
    strike = resolveTurn(run, "rock"),
    guard = resolveTurn(run, "rock", "guard");
  assert.ok(guard.result.incoming < strike.result.incoming);
  assert.ok(guard.charge > strike.charge);
});
test("overdrive requires charge, doubles damage, adds heat and locks when hot", () => {
  const run = fixed("scissors");
  assert.strictEqual(resolveTurn(run, "rock", "overdrive"), run);
  run.charge = 80;
  const normal = resolveTurn(run, "rock"),
    overdrive = resolveTurn(run, "rock", "overdrive");
  assert.equal(overdrive.result.damage, normal.result.damage * 2);
  assert.equal(overdrive.charge, 40);
  assert.ok(overdrive.heat > normal.heat);
  run.heat = 75;
  assert.strictEqual(resolveTurn(run, "rock", "overdrive"), run);
  assert.ok(resolveTurn(run, "rock").result.damage < normal.result.damage);
});
test("chain counters increase damage and cap the combo damage bonus", () => {
  const run = fixed("scissors");
  run.combo = 2;
  assert.ok(
    resolveTurn(run, "rock").result.damage >
      resolveTurn({ ...run, combo: 0 }, "rock").result.damage,
  );
  assert.equal(
    resolveTurn({ ...run, combo: 20 }, "rock").result.damage,
    resolveTurn({ ...run, combo: 5 }, "rock").result.damage,
  );
});
test("floor victory awards bounty and installing an augment advances and heals", () => {
  const run = fixed("scissors");
  run.hp = 50;
  run.enemy.hp = 1;
  const victory = resolveTurn(run, "rock");
  assert.equal(victory.phase, "upgrade");
  assert.ok(victory.result.bounty > 0);
  const next = chooseUpgrade(victory, "capacity");
  assert.equal(next.level, 2);
  assert.equal(next.phase, "ready");
  assert.equal(next.maxHp, 120);
  assert.equal(next.hp, 85);
  assert.equal(next.upgrades.capacity, 1);
  assert.equal(next.enemy.hp, next.enemy.maxHp);
  assert.equal(upgradeChoices(victory).length, 3);
  assert.equal(new Set(upgradeChoices(victory).map((u) => u.id)).size, 3);
  assert.strictEqual(chooseUpgrade(run, "power"), run);
  assert.strictEqual(chooseUpgrade(victory, "invalid"), victory);
});
test("defeat takes precedence over a simultaneous kill", () => {
  const run = fixed("paper");
  run.hp = 1;
  run.enemy.hp = 1;
  const result = resolveTurn(run, "rock");
  assert.equal(result.phase, "defeat");
  assert.equal(result.hp, 0);
  assert.equal(result.result.bounty, 0);
  assert.strictEqual(resolveTurn(result, "rock"), result);
});
test("procedural floors are reproducible, change districts and include apex encounters", () => {
  assert.deepEqual(levelFor(20, 22), levelFor(20, 22));
  assert.notDeepEqual(levelFor(20, 1), levelFor(20, 2));
  assert.equal(levelFor(20, 5).boss, true);
  assert.equal(levelFor(20, 6).boss, false);
  assert.ok(levelFor(20, 7).district.anomaly);
  assert.ok(levelFor(20, 500).maxHp > levelFor(20, 1).maxHp);
});
test("valid saves round-trip, invalid and unavailable saves recover safely", () => {
  const run = resolveTurn(fixed("scissors"), "rock");
  const storage = (value) => ({ getItem: () => JSON.stringify(value) });
  assert.deepEqual(loadSave(storage(run)), run);
  const deepRun = fixed("rock", 100001);
  assert.equal(loadSave(storage(deepRun)).level, 100001);
  assert.equal(loadSave({ getItem: () => "{" }), null);
  assert.equal(
    loadSave({
      getItem: () => {
        throw new Error("denied");
      },
    }),
    null,
  );
  assert.equal(loadSave(storage({ ...run, charge: 1000 })), null);
  assert.equal(
    loadSave(storage({ ...run, enemy: { ...run.enemy, signal: 12 } })),
    null,
  );
  assert.equal(
    loadSave(
      storage({ ...run, result: { ...run.result, playerWeapon: "invalid" } }),
    ),
    null,
  );
});
test("deep scan reveals the exact next weapon and spends charge once", async () => {
  const { scanSignal } = await import("../src/game/engine.js");
  const run = newRun(198);
  run.charge = 60;
  const scanned = scanSignal(run);
  assert.equal(scanned.charge, 30);
  assert.ok(WEAPONS.some((w) => w.id === scanned.scanned));
  assert.strictEqual(scanSignal(scanned), scanned);
  const result = resolveTurn(scanned, counterFor(scanned.scanned).id);
  assert.equal(result.result.outcome, "win");
  assert.equal(result.scanned, null);
  assert.ok(result.scanUsed);
  const spent = { ...result, charge: 60 };
  assert.strictEqual(scanSignal(spent), spent);
});
test("field repair costs credits and is limited to once per floor", async () => {
  const { repairFrame } = await import("../src/game/engine.js");
  const run = newRun(198);
  run.credits = 200;
  run.hp = 40;
  const repaired = repairFrame(run);
  assert.equal(repaired.hp, 70);
  assert.equal(repaired.credits, 120);
  assert.ok(repaired.repairUsed);
  assert.strictEqual(repairFrame(repaired), repaired);
  const poor = { ...run, credits: 79 };
  assert.strictEqual(repairFrame(poor), poor);
});
