import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, loadPreferences } from '../src/game/preferences.js';

const storage = value => ({ getItem: () => JSON.stringify(value) });

test('old preferences retain their values and gain safe cinematic defaults', () => {
  const old = { volume: 37, music: false, quality: 'low', motion: 'reduced', cinematicQte: false, skin: 'prism', liveDossiers: false };
  assert.deepEqual(loadPreferences(storage(old)), { ...old, reduceFlashes: true, cinematicLength: 'full', haptics: true });
});

test('new quality and accessibility choices round-trip without changing existing fields', () => {
  for (const quality of ['auto', 'high', 'medium', 'low']) {
    const choices = { ...DEFAULT_PREFERENCES, quality, reduceFlashes: false, cinematicLength: 'short', haptics: false };
    assert.deepEqual(loadPreferences(storage(choices)), choices);
  }
});

test('invalid settings cannot disable reduced flashes or invent a quality tier', () => {
  const loaded = loadPreferences(storage({ quality: 'ultra', cinematicLength: 5, reduceFlashes: 'false', haptics: 0, volume: 110 }));
  assert.equal(loaded.quality, 'auto');
  assert.equal(loaded.cinematicLength, 'full');
  assert.equal(loaded.reduceFlashes, true);
  assert.equal(loaded.haptics, true);
  assert.equal(loaded.volume, 100);
});

test('missing or malformed storage returns independent safe defaults', () => {
  const first = loadPreferences({ getItem: () => '{broken' });
  first.reduceFlashes = false;
  assert.deepEqual(loadPreferences(storage(null)), DEFAULT_PREFERENCES);
});
