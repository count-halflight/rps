import test from 'node:test';
import assert from 'node:assert/strict';
import { finaleSkipReady, finaleHoldProgress } from '../src/components/finaleSkipClock.js';

test('finale skip unlocks after two seconds and locks while paused', () => {
  assert.equal(finaleSkipReady(1999), false);
  assert.equal(finaleSkipReady(2000), true);
  assert.equal(finaleSkipReady(2000, true), false);
  assert.equal(finaleSkipReady(NaN), false);
});

test('finale requires an uninterrupted two-second hold on the monotonic clock', () => {
  assert.equal(finaleHoldProgress(10000, null), 0);
  assert.equal(finaleHoldProgress(9000, 10000), 0);
  assert.equal(finaleHoldProgress(11000, 10000), .5);
  assert.equal(finaleHoldProgress(11999, 10000), .9995);
  assert.equal(finaleHoldProgress(12000, 10000), 1);
  assert.equal(finaleHoldProgress(15000, 10000), 1);
  assert.equal(finaleHoldProgress(12000, null), 0);
});
