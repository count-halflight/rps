import test from "node:test";
import assert from "node:assert/strict";
import {
  newRun,
  openingFor,
  resolveTurn,
  useEarnedItem,
  loadSave,
  chooseUpgrade,
  floorSupply,
} from "../src/game/engine.js";
import { FIGHTERS } from "../src/game/fighters.js";
const fixed = (character) => {
  const r = newRun(79, null, character);
  r.enemy.signal = 2;
  r.enemy.confidence = 100;
  return r;
};
test("an RPS opening changes nothing until its attack or item is selected", () => {
  const r = fixed("echo"),
    before = structuredClone(r),
    opening = openingFor(r, "rock");
  assert.equal(opening.outcome, "win");
  assert.deepEqual(r, before);
  assert.deepEqual(openingFor(r, "rock"), opening);
  assert.equal(resolveTurn(r, "rock").result.enemyWeapon, opening.enemyWeapon);
  const restored = loadSave({ getItem: () => JSON.stringify(r) });
  assert.equal(restored.turn, 0);
  assert.deepEqual(openingFor(restored, "rock"), opening);
});
test("all five characters retain their starting stats and inventory through saving and upgrades", () => {
  for (const f of FIGHTERS) {
    const r = fixed(f.id);
    assert.equal(r.hp, f.hp);
    assert.equal(r.charge, f.charge);
    assert.deepEqual(loadSave({ getItem: () => JSON.stringify(r) }), r);
    r.enemy.hp = 1;
    const victory = resolveTurn(r, "rock"),
      supply = floorSupply(victory).id;
    const next = chooseUpgrade(victory, "capacity");
    assert.equal(next.character, f.id);
    assert.equal(next.maxHp, f.hp + 20);
    assert.equal(next.inventory[supply], r.inventory[supply] + 1);
  }
});
test("items consume a winning action and one item, without a hidden attack or bounty", () => {
  for (const id of ["medkit", "coolant", "battery"]) {
    const r = fixed("nyx");
    r.hp = 40;
    r.heat = 60;
    r.charge = 30;
    r.enemy.hp = 1;
    r.combo = 3;
    const next = useEarnedItem(r, "rock", id);
    assert.equal(next.turn, r.turn + 1);
    assert.equal(next.inventory[id], r.inventory[id] - 1);
    assert.equal(next.phase, "ready");
    assert.equal(next.enemy.hp, 1);
    assert.equal(next.result.damage, 0);
    assert.equal(next.result.bounty, 0);
    assert.equal(next.credits, r.credits + 15);
    assert.equal(next.combo, 0);
    assert.equal(next.hp, id === "medkit" ? 75 : 40);
    assert.equal(next.heat, id === "coolant" ? 20 : 60);
    assert.equal(next.charge, id === "battery" ? 65 : 30);
  }
});
test("floor rewards keep a full item stack at five without reducing other supplies", () => {
  const run = fixed("echo");
  run.enemy.hp = 1;
  run.inventory = { medkit: 5, coolant: 5, battery: 5 };
  const victory = resolveTurn(run, "rock");
  const next = chooseUpgrade(victory, "power");
  assert.equal(next.level, run.level + 1);
  assert.deepEqual(next.inventory, run.inventory);
});
test("invalid, empty, unnecessary and losing-turn items spend nothing", () => {
  const r = fixed("echo");
  for (const id of ["invalid", "medkit", "coolant"])
    assert.strictEqual(useEarnedItem(r, "rock", id), r);
  assert.strictEqual(
    useEarnedItem(
      { ...r, inventory: { ...r.inventory, battery: 0 } },
      "rock",
      "battery",
    ).turn,
    0,
  );
  assert.strictEqual(useEarnedItem(r, "paper", "battery"), r);
  assert.strictEqual(useEarnedItem(r, "scissors", "battery"), r);
});
test("old saves migrate to Echo, while invalid character and item data are rejected", () => {
  const r = newRun(93),
    read = (data) => loadSave({ getItem: () => JSON.stringify(data) }),
    legacy = structuredClone(r);
  delete legacy.character;
  delete legacy.inventory;
  assert.equal(read(legacy).character, "echo");
  assert.deepEqual(read(legacy).inventory, r.inventory);
  assert.equal(read({ ...r, character: "unknown" }), null);
  assert.equal(read({ ...r, inventory: { ...r.inventory, medkit: -1 } }), null);
});
