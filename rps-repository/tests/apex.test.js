import test from "node:test";
import assert from "node:assert/strict";
import {
  newRun,
  levelFor,
  resolveTurn,
  counterFor,
  WEAPONS,
  loadSave,
} from "../src/game/engine.js";

function apex(id) {
  const seed = [
    "thermal",
    "siphon",
    "plating",
    "redline",
    "blackout",
    "mirror",
  ].indexOf(id);
  const run = newRun(seed);
  run.level = 5;
  run.enemy = levelFor(seed, 5);
  run.enemy.signal = 2;
  run.enemy.confidence = 100;
  return run;
}
test("six apex abilities introduce distinct combat decisions", () => {
  const thermal = apex("thermal");
  const next = resolveTurn(thermal, "rock");
  assert.equal(next.heat, 14 + 10 - thermal.enemy.district.cooling);
  const siphon = apex("siphon");
  siphon.enemy.hp = 50;
  const repaired = resolveTurn(siphon, "paper");
  assert.equal(repaired.enemy.hp, 58);
  assert.equal(repaired.result.enemyHealing, 12);
  siphon.enemy.hp = 1;
  assert.equal(resolveTurn(siphon, "paper").enemy.hp, 0);
  assert.equal(resolveTurn(siphon, "paper").result.enemyHealing, 0);
  const plated = apex("plating");
  plated.charge = 80;
  assert.equal(resolveTurn(plated, "rock").result.damage, 18);
  assert.equal(resolveTurn(plated, "rock", "overdrive").result.damage, 46);
  const redline = apex("redline");
  const above = resolveTurn(redline, "paper").result.incoming;
  redline.enemy.hp = Math.floor(redline.enemy.maxHp / 2);
  assert.ok(resolveTurn(redline, "paper").result.incoming > above);
  const blackout = apex("blackout");
  assert.ok(levelFor(blackout.seed, 5).confidence <= 55);
  assert.ok(resolveTurn(blackout, "rock").enemy.confidence <= 55);
  const mirror = apex("mirror");
  const mirrored = resolveTurn(mirror, "rock");
  assert.equal(WEAPONS[mirrored.enemy.signal].id, counterFor("rock", false).id);
});
test("boss saves reconstruct the same ability without trusting serialized rules", () => {
  const run = apex("thermal");
  run.enemy.ability = { id: "invented", detail: "invalid" };
  const restored = loadSave({ getItem: () => JSON.stringify(run) });
  assert.equal(restored.enemy.ability.id, "thermal");
});
