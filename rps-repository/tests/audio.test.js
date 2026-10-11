import test from "node:test";
import assert from "node:assert/strict";
import { battleSoundProfile } from "../src/game/audioProfile.js";
test("enemy damage increases musical intensity while player damage muffles music and accelerates the heartbeat", () => {
  const calm = battleSoundProfile(1, 1),
    pressure = battleSoundProfile(0.1, 1),
    danger = battleSoundProfile(0.1, 0.1);
  assert.ok(pressure.bpm > calm.bpm);
  assert.ok(pressure.musicGain > calm.musicGain);
  assert.equal(pressure.cutoff, calm.cutoff);
  assert.ok(danger.cutoff < pressure.cutoff);
  assert.equal(calm.heartbeatGain, 0);
  assert.ok(danger.heartbeatGain > 0);
  assert.ok(danger.heartbeatBpm > calm.heartbeatBpm);
  assert.equal(battleSoundProfile(1, .45).heartbeatGain, 0);
  assert.equal(battleSoundProfile(1, .30).heartbeatGain, 0);
  assert.ok(battleSoundProfile(1, .299).heartbeatGain > 0);
  for (const profile of [calm, pressure, danger, battleSoundProfile(-1, 99)])
    assert.ok(Object.values(profile).every(Number.isFinite));
});
