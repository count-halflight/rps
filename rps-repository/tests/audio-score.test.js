import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreForFloor, scoreSection, choreographySoundProfile } from '../src/game/audioProfile.js';

test('each district has an original score, with fresh variations on later floors', () => {
  const themes = Array.from({ length: 6 }, (_, index) => scoreForFloor(index + 1));
  assert.equal(new Set(themes.map(theme => theme.name)).size, 6);
  assert.equal(new Set(themes.map(theme => JSON.stringify([theme.scale, theme.chords, theme.bass, theme.lead, theme.kick, theme.snare]))).size, 6);
  themes.forEach((theme, index) => {
    const repeat = scoreForFloor(index + 7);
    assert.equal(repeat.name, theme.name);
    assert.equal(repeat.variation, theme.variation + 1);
    assert.ok(theme.bpm >= 80 && theme.bpm <= 150);
  });
  assert.equal(scoreForFloor(Number.NaN).name, themes[0].name);
});

test('scores develop through contrasting sections and every finisher has its own sound', () => {
  assert.deepEqual([0, 2, 8, 12, 16, 24].map(bar => scoreSection(bar).name),
    ['intro', 'verse', 'lift', 'breakdown', 'reprise', 'finale']);
  assert.equal(scoreSection(28).name, 'intro');
  assert.ok(scoreSection(12).drums < scoreSection(8).drums);
  const finals = ['echo', 'cinder', 'nyx', 'vex', 'kuro'].flatMap(character =>
    ['rock', 'paper', 'scissors'].flatMap(hand => ['final', 'final-alt'].map(ending =>
      choreographySoundProfile({ sequenceId: `${character}.${hand}.${ending}`, finisher: true }))));
  assert.equal(new Set(finals.map(profile => profile.voice)).size, 30);
  assert.ok(finals.every(profile => profile.root > 20 && Number.isFinite(profile.weight)));
});

test('the audio graph plays different district arrangements and changes phrases over time', async () => {
  const realWindow = globalThis.window, realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  let clock = 0, notes = [], pending = new Map(), nextId = 0;
  class Param {
    value = 0;
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
    setTargetAtTime() {}
    cancelScheduledValues() {}
  }
  const node = () => ({ gain: new Param(), frequency: new Param(), Q: new Param(), pan: new Param(), connect() {}, disconnect() {} });
  class Context {
    get currentTime() { return clock; }
    state = 'running';
    destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createStereoPanner() { return node(); }
    createOscillator() {
      const oscillator = node();
      oscillator.start = time => notes.push({ time, frequency: Math.round(oscillator.frequency.value), type: oscillator.type || 'sine' });
      oscillator.stop = () => {};
      return oscillator;
    }
  }
  globalThis.window = { AudioContext: Context };
  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextId;
    pending.set(id, { callback, at: clock + delay / 1000 });
    return id;
  };
  globalThis.clearTimeout = id => pending.delete(id);
  const audio = await import('../src/game/audio.js');
  try {
    audio.playTone('select', true);
    const signatures = [];
    for (let floor = 1; floor <= 6; floor++) {
      audio.setAmbience(false);
      clock = 0; notes = []; pending.clear();
      audio.setBattleAudio(1, 1);
      audio.setAmbience(true, floor);
      while (pending.size) {
        const [id, next] = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (next.at > 34) break;
        pending.delete(id); clock = next.at; next.callback();
      }
      const signature = (start, end) => JSON.stringify(notes.filter(note => note.time >= start && note.time < end)
        .map(note => [Math.round((note.time - start) * 100), note.frequency, note.type]));
      signatures.push(signature(0, 8));
      assert.notEqual(signature(0, 8), signature(16, 24));
      assert.ok(notes.length > 100, `Floor ${floor} should play a layered score`);
      assert.equal(audio.audioSnapshot().score, scoreForFloor(floor).name);
    }
    assert.equal(new Set(signatures).size, 6);
  } finally {
    audio.setAmbience(false);
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
  }
});
