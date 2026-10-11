import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLabClock, contactSheetTimes } from '../src/game/labClock.js';
test('Lab pause, slow motion, looping and completion use a bounded clock', () => {
  const paused = { time: 1, playing: false, rate: 1, loop: false };
  assert.equal(advanceLabClock(paused, .1, 4), paused);
  assert.equal(advanceLabClock({ ...paused, playing: true, rate: .1 }, .2, 4).time, 1.02);
  assert.deepEqual(advanceLabClock({ ...paused, time: 3.9, playing: true }, .2, 4), { ...paused, time: 4, playing: false });
  assert.ok(Math.abs(advanceLabClock({ ...paused, time: 3.9, playing: true, loop: true }, .2, 4).time - .1) < 1e-12);
  assert.equal(advanceLabClock({ ...paused, playing: true }, 30, 4).time, 1.25);
});
test('Twelve sheet beats cover anticipation, contact and recovery without resetting at the last frame', () => {
  const times = contactSheetTimes(15);
  assert.equal(times.length, 12);
  assert.ok(times[0] > 0 && times.at(-1) < 15);
  assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]));
});
