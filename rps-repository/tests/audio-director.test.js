import test from 'node:test';
import assert from 'node:assert/strict';
import { sequenceAudioPlan, reflectionCueTimes, FINALE_AUDIO_PALETTES, sceneMomentAudioPresentation, combatMomentAudioPresentation, CINEMATIC_MIX } from '../src/game/sequenceAudioDirector.js';
import { presentationForSequenceId, ECHO_REFLECTION_TIMES } from '../src/game/sequences/index.js';
import { SCENE_MOMENTS, sceneMomentPresentation } from '../src/game/sceneMoments.js';
import { COMBAT_MOMENTS, combatMomentPresentation } from '../src/game/combatMoments.js';

test('authored audio keeps delayed damage cues and all 24 finale contacts on the actual timeline', () => {
  const quick = sequenceAudioPlan(presentationForSequenceId('ECHO-S0'));
  assert.equal(quick.cues.find(cue => cue.id === 'draw').at, .416);
  assert.equal(quick.cues.find(cue => cue.id === 'light-cut').at, .65);
  assert.equal(quick.impact, .65);
  const final = sequenceAudioPlan(presentationForSequenceId('ECHO-SF'));
  assert.equal(final.silence.end - final.silence.at, .5);
  assert.ok(final.duck >= Math.pow(10, -9 / 20) && final.duck <= Math.pow(10, -6 / 20));
  const finale = sequenceAudioPlan(presentationForSequenceId('ECHO-AF'));
  assert.deepEqual(finale.cues.find(cue => cue.id === 'afterlight-reflections').times, [...ECHO_REFLECTION_TIMES]);
  assert.deepEqual(reflectionCueTimes({ at: 5.5, end: 8.85 }), [...ECHO_REFLECTION_TIMES]);
  assert.equal(finale.cues.find(cue => cue.id === 'sheath-click').at, 8.78);
  assert.equal(finale.cues.find(cue => cue.id === 'afterlight-bloom').at, 9);
  assert.equal(finale.cues.find(cue => cue.id === 'afterlight-chord').at, 12.5);
  assert.equal(new Set(Object.values(FINALE_AUDIO_PALETTES).map(palette => palette.root)).size, 5);
  assert.equal(finale.gain, CINEMATIC_MIX.finaleGain);
  assert.ok(finale.gain >= 3 && finale.gain <= 3.3);
});

test('short and reduced audio preserve authored acts and contacts without lengthening the cinematic', () => {
  for (const id of ['ECHO-S0', 'ECHO-S2', 'ECHO-SF', 'ECHO-AF']) {
    const full = presentationForSequenceId(id), short = presentationForSequenceId(id, { reduced: true });
    const plan = sequenceAudioPlan(short), factor = short.duration / full.duration;
    assert.equal(plan.duration, short.duration / 1000);
    for (const [index, cue] of plan.cues.entries()) {
      assert.ok(Math.abs(cue.at - full.sfx[index].at * factor) < 1e-8);
      assert.ok(cue.at >= 0 && cue.at <= plan.duration);
      if (cue.end !== undefined) assert.ok(cue.end <= plan.duration);
    }
    assert.ok(plan.cues.some(cue => cue.at > 0));
  }
});

test('entrances and armour changes use authored seconds and compress their cue envelopes with the scene', () => {
  assert.equal(SCENE_MOMENTS.length, 9);
  const intro = sequenceAudioPlan(sceneMomentPresentation('bulwark.intro'));
  assert.deepEqual(intro.cues.map(cue => [cue.id, cue.at, cue.end]),
    [['iron-step', .9, 1.06], ['iron-step', 1.6, 1.78], ['shield-plant', 2.25, 2.52]]);
  assert.deepEqual(sequenceAudioPlan(sceneMomentPresentation('bulwark.phase2')).cues.map(cue => [cue.id, cue.at]),
    [['armour-shed', 1.1], ['quick-brace', 1.9]]);
  assert.equal(new Set(SCENE_MOMENTS.filter(moment => moment.kind === 'entrance')
    .map(moment => sceneMomentAudioPresentation(moment.id).style)).size, 5);
  for (const moment of SCENE_MOMENTS) {
    const full = sequenceAudioPlan(sceneMomentPresentation(moment.id));
    const short = sequenceAudioPlan(sceneMomentPresentation(moment.id, { reduced: true }));
    assert.ok(full.authored && full.cues.length > 0, `${moment.id} needs its own cue sheet`);
    assert.equal(full.tier, 1, 'Scene staging must not borrow an attack finisher');
    assert.equal(full.silence, null);
    full.cues.forEach((cue, index) => {
      assert.ok(Math.abs(short.cues[index].at - cue.at * short.scale) < 1e-8);
      assert.ok(Math.abs(short.cues[index].end - cue.end * short.scale) < 1e-8);
    });
  }
});

test('shared combat audio preserves three hidden throws, item commits and the defeat light-out order', () => {
  assert.equal(COMBAT_MOMENTS.length, 8);
  const reveal = sequenceAudioPlan(combatMomentPresentation('combat.reveal', {
    playerHand: 'paper', enemyHand: 'rock', outcome: 'win',
  }));
  assert.deepEqual(reveal.cues.map(cue => [cue.id, cue.at]),
    [['reveal-thud', .27], ['reveal-thud', .54], ['reveal-thud', .81], ['totem-contact', .9]]);
  assert.equal(reveal.cues.at(-1).outcome, 'win');
  assert.ok(Math.abs(reveal.impact - .9) < 1e-8);
  for (const item of ['medkit', 'coolant', 'battery', 'scan']) {
    const plan = sequenceAudioPlan(combatMomentPresentation(`item.${item}`));
    assert.equal(plan.cues.length, 1);
    assert.equal(plan.cues[0].at, .42);
    assert.equal(plan.cues[0].end, .94);
    assert.equal(plan.tier, 1);
  }
  const defeat = sequenceAudioPlan(combatMomentPresentation('combat.defeat'));
  assert.deepEqual(defeat.cues.filter(cue => cue.id === 'street-light-out').map(cue => cue.at), [.18, .5, .92, 1.25]);
  assert.deepEqual(defeat.cues.filter(cue => cue.id === 'defeat-low-tone').map(cue => [cue.at, cue.end]), [[1.25, 2.65]]);
  assert.ok(defeat.duck < .5);
  assert.equal(combatMomentAudioPresentation('combat.brace', { playerCharacter: 'nyx' }).style, 'mage');
  const stale = combatMomentPresentation('combat.brace');
  assert.equal(combatMomentAudioPresentation('combat.brace', { ...stale, playerCharacter: 'nyx' }).character, 'nyx');
  assert.equal(combatMomentAudioPresentation('combat.brace', { ...stale, playerCharacter: 'nyx' }).style, 'mage');
  assert.equal(combatMomentAudioPresentation('item.medkit', { actorSide: 'enemy', enemyCharacter: 'vex' }).style, 'archer');
});

test('skip, mute and replacement cancel future clips while later attacks and music remain usable', async () => {
  const originalWindow = globalThis.window, originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  let clock = 0, serial = 0;
  const scheduled = new Map(), sources = [], params = [];
  class Param {
    value = 0;
    record(method, value, time) {
      assert.ok(Number.isFinite(value), `${method} requires a finite parameter`);
      assert.ok(Number.isFinite(time) && time >= 0, `${method} requires a valid audio deadline`);
      params.push({ method, value, time }); this.value = value;
    }
    setValueAtTime(value, time) { this.record('set', value, time); }
    linearRampToValueAtTime(value, time) { this.record('ramp', value, time); }
    exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
    setTargetAtTime(value, time) { this.record('target', value, time); }
    cancelScheduledValues(time) { assert.ok(time >= 0); }
  }
  const node = () => ({ gain: new Param(), frequency: new Param(), Q: new Param(), pan: new Param(), connect() {}, disconnect() {} });
  const source = kind => {
    const value = { ...node(), kind, stops: [], start(time) { assert.ok(time >= 0); this.at = time; }, stop(time) { this.stops.push(time); } };
    sources.push(value); return value;
  };
  class Context {
    get currentTime() { return clock; }
    sampleRate = 8000; state = 'running'; destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createStereoPanner() { return node(); }
    createOscillator() { return source('tone'); }
    createBufferSource() { return source('noise'); }
    createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData() { return data; } }; }
  }
  globalThis.window = { AudioContext: Context };
  globalThis.setTimeout = (callback, delay) => { const id = ++serial; scheduled.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => scheduled.delete(id);
  const audio = await import('../src/game/audio.js?audio-director-fixture');
  try {
    audio.configureAudio(60, true); await audio.unlockAudio();
    audio.setAmbience(true, 6);
    const music = sources.map(voice => ({ voice, stopCount: voice.stops.length })), before = sources.length;
    audio.playChoreography({ ...presentationForSequenceId('ECHO-AF'), id: 'finale-1' }, true);
    assert.equal(audio.audioSnapshot().sequenceGain, CINEMATIC_MIX.finaleGain);
    const finale = sources.slice(before);
    assert.ok(finale.length > 100, 'The finale should schedule its own multi-act stem');
    const contacts = finale.filter(voice => voice.kind === 'noise').map(voice => voice.at);
    ECHO_REFLECTION_TIMES.forEach(at => assert.ok(contacts.some(time => Math.abs(time - at) < 1e-8), `Missing reflection strike at ${at}`));
    assert.ok(finale.some(voice => Math.abs(voice.at - 12.5) < 1e-8), 'The epilogue chord must be deliberately delayed');
    audio.playTone('win', true, 12);
    clock = 1.2; audio.cancelChoreography();
    assert.equal(audio.audioSnapshot().sequenceId, null);
    assert.ok(finale.filter(voice => voice.at > clock).every(voice => voice.stops.at(-1) <= clock));
    assert.ok(music.every(({ voice, stopCount }) => voice.stops.length === stopCount), 'Cancel must not stop ordinary music voices');

    audio.configureAudio(60, false);
    const mutedCount = sources.length;
    audio.playChoreography({ ...presentationForSequenceId('ECHO-S0'), id: 'muted' }, true);
    assert.equal(sources.length, mutedCount);
    audio.configureAudio(60, true); clock = 2;
    audio.playChoreography({ ...presentationForSequenceId('ECHO-S0'), id: 'quick-2' }, true);
    assert.ok(sources.slice(mutedCount).some(voice => Math.abs(voice.at - 2.65) < 1e-8));
    audio.cancelSequenceAudio('finale-1');
    assert.equal(audio.audioSnapshot().sequenceId, 'quick-2', 'An old cleanup cannot cancel the replacement');
    audio.configureAudio(0, true);
    assert.equal(audio.audioSnapshot().sequenceId, null, 'Moving volume to zero must also cancel queued effects');

    audio.configureAudio(60, true); clock = 3;
    const silenceBefore = params.length;
    audio.playChoreography({ ...presentationForSequenceId('ECHO-SF'), id: 'finisher-3' }, true);
    const silence = params.slice(silenceBefore);
    assert.ok(silence.some(event => event.value === .0001 && Math.abs(event.time - 7.4) < 1e-8));
    assert.ok(silence.some(event => event.value === CINEMATIC_MIX.attackGain && Math.abs(event.time - 7.9) < 1e-8));
    const replaced = sources.filter(voice => voice.at > clock);
    audio.playChoreography({ ...presentationForSequenceId('ECHO-S2'), id: 'overdrive-4' }, true);
    assert.ok(replaced.every(voice => voice.stops.at(-1) <= clock));
    assert.equal(audio.audioSnapshot().sequenceId, 'overdrive-4');

    audio.cancelSequenceAudio(); clock = 20;
    const lateBefore = sources.length;
    audio.playChoreography({ ...presentationForSequenceId('ECHO-AF'), id: 'late', startedAt: performance.now() - 10000 }, true);
    const late = sources.slice(lateBefore);
    assert.ok(late.length > 0 && late.every(voice => voice.at >= clock), 'Late mounting must catch up without invalid or replayed past deadlines');
    assert.ok(late.every(voice => voice.at >= 22.49), 'Expired heartbeats and reflection strikes must not replay');
    assert.equal(audio.audioSnapshot().state, 'running');

    for (const [index, moment] of SCENE_MOMENTS.entries()) {
      clock = 30 + index * 10;
      const beforeMoment = sources.length, id = `moment-${index}`;
      audio.playSceneMomentAudio(moment.id, { id, reduced: true, side: 'player' });
      const clips = sources.slice(beforeMoment);
      assert.equal(audio.audioSnapshot().sequenceId, id);
      assert.ok(clips.length > 2, `${moment.id} must schedule layered material sounds`);
      const plan = sequenceAudioPlan(sceneMomentPresentation(moment.id, { reduced: true }));
      plan.cues.forEach(cue => assert.ok(clips.some(voice => Math.abs(voice.at - clock - cue.at) < 1e-8),
        `${moment.id} is missing its ${cue.id} contact`));
      audio.cancelSequenceAudio(id);
      assert.ok(clips.every(voice => voice.stops.at(-1) <= clock), 'Skipping a scene must stop its future footsteps and armour clips');
    }
    const beforeSilentMoment = sources.length;
    audio.playSceneMomentAudio('bulwark.intro', { id: 'silent-moment', sound: false });
    assert.equal(sources.length, beforeSilentMoment);
    assert.equal(audio.audioSnapshot().sequenceId, null);

    const itemVoices = [];
    for (const [index, moment] of COMBAT_MOMENTS.entries()) {
      clock = 130 + index * 10;
      const beforeMoment = sources.length, id = `combat-moment-${index}`;
      const options = { id, playerCharacter: 'echo', enemyCharacter: 'nyx', playerHand: 'paper', enemyHand: 'rock', outcome: 'win' };
      if (index === 0) audio.playChoreography(combatMomentPresentation(moment.id, options), true);
      else audio.playCombatMomentAudio(moment.id, options);
      const clips = sources.slice(beforeMoment), plan = sequenceAudioPlan(combatMomentPresentation(moment.id, options));
      assert.equal(audio.audioSnapshot().sequenceId, id);
      assert.ok(clips.length >= 2, `${moment.id} must schedule its own sound layers`);
      plan.cues.forEach(cue => assert.ok(clips.some(voice => Math.abs(voice.at - clock - cue.at) < 1e-8),
        `${moment.id} is missing ${cue.id} at ${cue.at}`));
      if (moment.kind === 'item') itemVoices.push(JSON.stringify(clips.map(voice => [voice.kind, voice.at - clock, voice.frequency.value])));
      audio.cancelSequenceAudio(id);
      assert.ok(clips.every(voice => voice.stops.at(-1) <= clock));
    }
    assert.equal(new Set(itemVoices).size, 4, 'Each item needs a different audible material or envelope');
    const revealSignature = (options, at) => {
      clock = at;
      const beforeReveal = sources.length;
      audio.playCombatMomentAudio('combat.reveal', { id: `alias-${at}`, outcome: 'win', ...options });
      return JSON.stringify(sources.slice(beforeReveal).map(voice => [voice.kind, Math.round((voice.at - clock) * 10000), voice.frequency.value]));
    };
    assert.equal(revealSignature({ playerHand: 'paper', enemyHand: 'rock' }, 220),
      revealSignature({ playerWeapon: 'paper', enemyWeapon: 'rock' }, 230),
      'Existing engine weapon fields must retain the actual hand material');
    audio.cancelSequenceAudio();
    const beforeMutedCombat = sources.length;
    audio.playCombatMomentAudio('combat.reveal', { sound: false });
    assert.equal(sources.length, beforeMutedCombat);
  } finally {
    audio.cancelSequenceAudio(); audio.setAmbience(false);
    globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});
