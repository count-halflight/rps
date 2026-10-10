import test from "node:test";
import assert from "node:assert/strict";
import {
  resourceProjection,
  resourceRates,
  pulseIntegral,
  pulseRate,
  riemannSum,
} from "../src/game/calculus.js";
import { newRun, levelFor, resolveTurn } from "../src/game/engine.js";
test("the calculus lab projects the exact combat heat and charge across districts, upgrades, and apex protocols", () => {
  for (let level = 1; level <= 35; level++)
    for (const stance of ["strike", "guard", "overdrive"]) {
      const run = newRun(0);
      run.level = level;
      run.enemy = levelFor(0, level);
      run.charge = 80;
      run.heat = 60;
      run.upgrades.coolant = 1;
      run.upgrades.battery = 2;
      const projection = resourceProjection(run, stance),
        result = resolveTurn(run, "rock", stance);
      assert.equal(projection.heat, result.heat);
      assert.equal(projection.charge, result.charge);
      assert.ok(Number.isFinite(resourceRates(run, stance).heat));
    }
});
test("integrated pulse work equals damage and Riemann sums converge to the exact integral", () => {
  for (const damage of [4, 23, 46, 125]) {
    assert.equal(pulseIntegral(damage, 0), 0);
    assert.equal(pulseIntegral(damage), damage);
    assert.equal(pulseRate(damage, 0), 0);
    assert.equal(pulseRate(damage, 1), 0);
    assert.ok(
      Math.abs(riemannSum(damage, 64) - damage) <
        Math.abs(riemannSum(damage, 8) - damage),
    );
    const time = 0.37,
      epsilon = 1e-6;
    const derivative =
      (pulseIntegral(damage, time + epsilon) -
        pulseIntegral(damage, time - epsilon)) /
      (2 * epsilon);
    assert.ok(Math.abs(derivative - pulseRate(damage, time)) < 1e-5);
  }
});
