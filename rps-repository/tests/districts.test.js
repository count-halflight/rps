import test from "node:test";
import assert from "node:assert/strict";
import { newRun, levelFor, resolveTurn } from "../src/game/engine.js";
const floor = (level, seed = 1) => {
  const run = newRun(seed);
  run.level = level;
  run.enemy = levelFor(seed, level);
  run.enemy.ability = null;
  run.enemy.signal = 2;
  run.enemy.confidence = 100;
  return run;
};
test("district modifiers agree with the combat feedback and resource changes", () => {
  const rainy = floor(1),
    hot = floor(2);
  const rainResult = resolveTurn(rainy, "rock"),
    heatResult = resolveTurn(hot, "rock");
  assert.equal(rainResult.heat, 2);
  assert.equal(heatResult.heat, 10);
  const garden = floor(5);
  garden.hp = 50;
  const restored = resolveTurn(garden, "scissors");
  assert.equal(restored.result.healing, 8);
  assert.equal(restored.hp, 58);
  garden.hp = 100;
  const capped = resolveTurn(garden, "scissors");
  assert.equal(capped.hp, 100);
  assert.equal(capped.result.healing, 0);
  const market = floor(4);
  market.enemy.hp = 1;
  assert.equal(resolveTurn(market, "rock").result.bounty, 300);
  const tide = resolveTurn(floor(6), "rock");
  assert.equal(tide.enemy.confidence, 45);
});
test("later anomalies increase the stated damage or charge without breaking bounds", () => {
  let compression, flux;
  for (let seed = 0; seed < 100; seed++) {
    const run = floor(7, seed);
    if (run.enemy.district.anomaly === "Compression") compression = run;
    if (run.enemy.district.anomaly === "Flux surge") flux = run;
  }
  assert.ok(compression && flux);
  assert.equal(resolveTurn(compression, "rock").result.damage, 29);
  assert.equal(resolveTurn(flux, "rock").charge, 40);
  compression.upgrades.armor = 1000;
  assert.equal(resolveTurn(compression, "paper").result.incoming, 2);
});
