import test from 'node:test';
import assert from 'node:assert/strict';
import { ambienceForFloor, battleSoundProfile } from '../src/game/audioProfile.js';
import { presentationForSequenceId } from '../src/game/sequences/index.js';

test('quiet district textures share danger muffling and cinematic silence and stop with their transport', async () => {
  const previousWindow = globalThis.window, previousSetTimeout = globalThis.setTimeout, previousClearTimeout = globalThis.clearTimeout;
  const timers = new Map(), sources = [], nodes = [];
  let serial = 0;
  class Param {
    value = 0;
    events = [];
    setValueAtTime(value, at) { this.events.push({ method: 'set', value, at }); this.value = value; }
    linearRampToValueAtTime(value, at) { this.events.push({ method: 'ramp', value, at }); }
    exponentialRampToValueAtTime(value, at) { this.events.push({ method: 'exponential', value, at }); }
    setTargetAtTime(value, at) { this.events.push({ method: 'target', value, at }); }
    cancelScheduledValues(at) { this.events.push({ method: 'cancel', at }); }
  }
  const node = () => {
    const value = {
      gain: new Param(), frequency: new Param(), Q: new Param(), pan: new Param(), links: [],
      connect(other) { this.links.push(other); },
      disconnect() { this.disconnected = true; },
    };
    nodes.push(value);
    return value;
  };
  const source = () => {
    const value = { ...node(), stops: [], start(at) { this.startedAt = at; }, stop(at) { this.stops.push(at); } };
    sources.push(value);
    return value;
  };
  class Context {
    sampleRate = 8000;
    currentTime = 0;
    state = 'running';
    destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createStereoPanner() { return node(); }
    createOscillator() { return source(); }
    createBufferSource() { return source(); }
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      return { sampleRate, getChannelData() { return data; } };
    }
  }
  globalThis.window = { AudioContext: Context };
  globalThis.setTimeout = (callback, delay) => { const id = ++serial; timers.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  const audio = await import('../src/game/audio.js?district-ambience-test');
  try {
    await audio.unlockAudio();
    const signatures = [], names = [];
    for (let floor = 1; floor <= 6; floor++) {
      audio.setBattleAudio(1, 1);
      audio.setAmbience(true, floor);
      const loop = sources.filter(candidate => candidate.loop).at(-1);
      assert.ok(loop && loop.startedAt === 0);
      const data = loop.buffer.getChannelData(0), palette = ambienceForFloor(floor);
      const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
      assert.ok(rms > .01 && rms < .3, `${palette.name} must have restrained, nonzero texture energy`);
      assert.ok(data.every(value => Number.isFinite(value) && Math.abs(value) <= .700001));
      assert.ok(Math.abs(data.reduce((sum, value) => sum + value, 0) / data.length) < 1e-6);
      signatures.push(JSON.stringify([...data].filter((value, index) => index % 997 === 0).map(value => value.toFixed(5))));
      names.push(audio.audioSnapshot().ambience);
      assert.equal(names.at(-1), palette.name);
      const color = loop.links[0], textureGain = color.links[0], musicFilter = textureGain.links[0];
      assert.equal(color.type, palette.filter);
      assert.equal(color.frequency.value, palette.cutoff);
      assert.ok(palette.gain > 0 && palette.gain <= .03);
      assert.equal(musicFilter.type, 'lowpass');
      audio.setBattleAudio(.1, .2);
      assert.ok(musicFilter.frequency.events.some(event => event.method === 'target'
        && event.value === battleSoundProfile(.1, .2).cutoff));

      const musicBody = musicFilter.links[0], ambientBus = musicBody.links[0];
      audio.playChoreography({ ...presentationForSequenceId('ECHO-SF'), id: `ambience-silence-${floor}` }, true);
      assert.ok(ambientBus.gain.events.some(event => event.value === .0001 && Math.abs(event.at - 4.4) < 1e-8),
        'The scene texture must pass through the actual finisher silence bus');
      audio.cancelSequenceAudio();
      audio.setAmbience(false);
      assert.equal(loop.stops.length, 1, 'Stopping or pausing must stop the looping buffer');
      assert.ok(loop.disconnected && color.disconnected && textureGain.disconnected && musicFilter.disconnected);
      assert.equal(audio.audioSnapshot().ambience, null);
      assert.equal(audio.audioSnapshot().playing, false);
      assert.equal(timers.size, 0, 'Stopping must release pulse, heartbeat and cinematic timers');
    }
    assert.equal(new Set(signatures).size, 6);
    assert.equal(new Set(names).size, 6);
    assert.deepEqual(ambienceForFloor(7), ambienceForFloor(1));
    assert.deepEqual(ambienceForFloor(Number.NaN), ambienceForFloor(1));
    audio.setAmbience(true, 6);
    const resumed = sources.filter(candidate => candidate.loop).at(-1);
    assert.equal(resumed.stops.length, 0, 'Resuming starts a fresh usable texture');
    audio.setAmbience(false);
    assert.equal(resumed.stops.length, 1);
  } finally {
    audio.cancelSequenceAudio(); audio.setAmbience(false);
    globalThis.setTimeout = previousSetTimeout; globalThis.clearTimeout = previousClearTimeout;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});
