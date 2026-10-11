import { battleSoundProfile, choreographySoundProfile, scoreForFloor, scoreSection, ambienceForFloor } from "./audioProfile.js";
import { sequenceAudioPlan, sceneMomentAudioPresentation, combatMomentAudioPresentation } from './sequenceAudioDirector.js';
import { FIGHTERS } from './fighters.js';
let context,
  master,
  analyser,
  ambient,
  musicTimer,
  heartbeatTimer,
  musicFilter,
  musicNodes = [];
let battleMix = battleSoundProfile(),
  anticipation = null,
  lastAnticipationId;
let volume = 0.6;
let audioEnabled = true;
let ambientRequested = false,
  ambientFloor = 1;
let musicInfo = { score: 'Cathedral rain', section: 'intro', bar: 0 };
let ambientTexture = null;
let sequenceAudio = null, schedulingSequence = null, sequenceSerial = 0;
function audioContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain();
    master.gain.value = audioEnabled ? volume : 0;
    let output = master;
    if (context.createDynamicsCompressor) {
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = .006;
      limiter.release.value = .18;
      master.connect(limiter);
      output = limiter;
    }
    output.connect(context.destination);
    if (context.createAnalyser) {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      output.connect(analyser);
    }
  }
  context.resume().catch(() => {});
  if (ambientRequested && !ambient) setAmbience(true, ambientFloor);
  return context;
}
export function unlockAudio() {
  try {
    return audioContext().resume();
  } catch {
    return Promise.resolve();
  }
}
export function audioSnapshot() {
  let rms = 0;
  if (analyser) {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    rms = Math.sqrt(
      samples.reduce((sum, n) => sum + n * n, 0) / samples.length,
    );
  }
  return {
    state: context?.state || "uninitialized",
    enabled: audioEnabled,
    playing: Boolean(ambient),
    ambience: ambientTexture,
    rms,
    ...battleMix,
    ...musicInfo,
    sequenceId: sequenceAudio?.id || null,
    sequenceSources: sequenceAudio?.sources.size || 0,
    sequenceGain: sequenceAudio?.plan.gain || 0,
  };
}
function voiceRoute(node, destination, pan = 0) {
  if (destination === master && schedulingSequence) destination = schedulingSequence.bus;
  // Stereo panners are optional so old Safari and the no-audio fallback work.
  if (!context.createStereoPanner || !pan) {
    node.connect(destination);
    return () => {};
  }
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-.8, Math.min(.8, pan));
  node.connect(panner);
  panner.connect(destination);
  return () => panner.disconnect();
}
function sequenceSource(source, disconnect) {
  const owner = schedulingSequence;
  if (!owner) return disconnect;
  const entry = { source, disconnect, ended: false };
  owner.sources.add(entry);
  return () => {
    if (entry.ended) return;
    entry.ended = true;
    owner.sources.delete(entry);
    disconnect();
  };
}
export function cancelSequenceAudio(id = null) {
  const active = sequenceAudio;
  if (id !== null && active?.id !== id) return;
  if (active) {
    clearTimeout(active.endTimer);
    const now = context.currentTime;
    active.bus.gain.cancelScheduledValues(now);
    active.bus.gain.setValueAtTime(.0001, now);
    for (const entry of active.sources) {
      try { entry.source.stop?.(now); } catch {}
      if (!entry.ended) { entry.ended = true; entry.disconnect(); }
    }
    active.sources.clear();
    active.bus.disconnect();
    sequenceAudio = null;
  }
  anticipation = null;
  lastAnticipationId = null;
  if (context && ambient) {
    ambient.gain.cancelScheduledValues(context.currentTime);
    ambient.gain.setTargetAtTime(battleMix.musicGain, context.currentTime, .10);
  }
  if (context && musicFilter) {
    musicFilter.frequency.cancelScheduledValues(context.currentTime);
    musicFilter.frequency.setTargetAtTime(battleMix.cutoff, context.currentTime, .06);
  }
}
export const cancelChoreography = cancelSequenceAudio;
function noise(time, duration, amplitude, frequency, destination = master, pan = 0, band = "highpass", reverse = false) {
  if (!context.createBuffer) return;
  const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    ),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.exp(-(reverse ? 1 - i / data.length : i / data.length) * 5);
  const source = context.createBufferSource(),
    gain = context.createGain(),
    filter = context.createBiquadFilter();
  source.buffer = buffer;
  filter.type = band;
  filter.frequency.value = frequency;
  gain.gain.value = amplitude;
  source.connect(filter);
  filter.connect(gain);
  const disconnectRoute = voiceRoute(gain, destination, pan);
  source.start(time);
  source.onended = sequenceSource(source, () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    disconnectRoute();
  });
}
function kick(time, destination, amplitude = 0.25) {
  const osc = context.createOscillator(),
    g = context.createGain();
  osc.frequency.setValueAtTime(130, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
  g.gain.setValueAtTime(amplitude, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(g);
  const disconnectRoute = voiceRoute(g, destination);
  osc.start(time);
  osc.stop(time + 0.23);
  osc.onended = sequenceSource(osc, () => {
    osc.disconnect();
    g.disconnect();
    disconnectRoute();
  });
}
export function configureAudio(percent, enabled = true) {
  volume = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent / 100 : .6));
  audioEnabled = enabled;
  if (!enabled || volume === 0) cancelSequenceAudio();
  if (context && master)
    master.gain.setTargetAtTime(
      audioEnabled ? volume : 0,
      context.currentTime,
      0.02,
    );
}
export function setBattleAudio(
  enemyIntegrity,
  playerIntegrity,
  finalAttempt = null,
) {
  battleMix = battleSoundProfile(enemyIntegrity, playerIntegrity);
  if (!context) return;
  const now = context.currentTime;
  musicFilter?.frequency.setTargetAtTime(battleMix.cutoff, now, 0.2);
  if (!ambient) return;
  const active = sequenceAudio?.animation || finalAttempt;
  if (active) {
    const cueAnimation = active.tier ? active : { ...active, finisher: true };
    const key = sequenceAudio?.id || active.id || active.sequenceId;
    if (lastAnticipationId !== key) {
      const elapsed = Number.isFinite(active.startedAt) ? Math.max(0, performance.now() - active.startedAt) / 1000 : 0;
      cinematicMusic(cueAnimation, sequenceAudioPlan(cueAnimation), now - elapsed, key);
    }
  } else {
    anticipation = null;
    lastAnticipationId = null;
    ambient.gain.cancelScheduledValues(now);
    ambient.gain.setTargetAtTime(battleMix.musicGain, now, 0.12);
  }
}
function cinematicMusic(animation, plan, start, key) {
  if (!ambient) return;
  const now = context.currentTime, impact = Math.max(now, start + plan.impact);
  lastAnticipationId = key;
  ambient.gain.cancelScheduledValues(now);
  ambient.gain.setValueAtTime(battleMix.musicGain * plan.duck, now);
  if (plan.tier === 5) {
    // The finale owns a five-act stem; normal score and danger heartbeat wait.
    anticipation = { start, quiet: now, impact: Math.max(now, start + plan.duration), finale: true };
    ambient.gain.setValueAtTime(.0001, now);
    ambient.gain.setValueAtTime(.0001, Math.max(now, start + plan.duration));
  } else if (plan.tier >= 3) {
    const quiet = plan.silence ? Math.max(now, start + plan.silence.at) : impact;
    anticipation = { start, quiet, impact };
    ambient.gain.linearRampToValueAtTime(battleMix.musicGain * plan.duck * 1.25, Math.max(now, quiet - .055));
    if (plan.silence) {
      ambient.gain.linearRampToValueAtTime(.0001, quiet);
      ambient.gain.setValueAtTime(.0001, Math.max(now, start + plan.silence.end));
      ambient.gain.linearRampToValueAtTime(battleMix.musicGain * plan.duck, impact + .08);
    }
    ambient.gain.linearRampToValueAtTime(battleMix.musicGain, Math.max(impact + .081, start + plan.duration));
  } else anticipation = null;
  const inhale = plan.cues.find(cue => cue.id === 'inhale');
  if (inhale && musicFilter) {
    const begins = Math.max(now, start + inhale.at), ends = Math.max(begins + .005, start + (inhale.end ?? plan.impact));
    musicFilter.frequency.setValueAtTime(battleMix.cutoff, begins);
    musicFilter.frequency.linearRampToValueAtTime(Math.min(350, battleMix.cutoff), begins + Math.min(.1, (ends - begins) * .4));
    musicFilter.frequency.setValueAtTime(Math.min(350, battleMix.cutoff), ends);
    musicFilter.frequency.linearRampToValueAtTime(battleMix.cutoff, ends + .11);
  }
}
function note(
  frequency,
  time,
  duration,
  amplitude,
  waveform = "sine",
  destination = master,
  pan = 0,
) {
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain);
  const disconnectRoute = voiceRoute(gain, destination, pan);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.01);
  oscillator.onended = sequenceSource(oscillator, () => {
    oscillator.disconnect();
    gain.disconnect();
    disconnectRoute();
  });
}
function sweep(from, to, time, duration, amplitude, waveform = "sine", pan = 0) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(from, time);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + Math.min(.025, duration * .15));
  gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(gain);
  const disconnectRoute = voiceRoute(gain, master, pan);
  oscillator.start(time);
  oscillator.stop(time + duration + .01);
  oscillator.onended = sequenceSource(oscillator, () => {
    oscillator.disconnect(); gain.disconnect(); disconnectRoute();
  });
}
function musicVoice(frequency, time, duration, amplitude, waveform, destination, pan = 0, soft = false) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(.0001, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + (soft ? Math.min(.32, duration * .22) : .012));
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001, amplitude * (soft ? .6 : .35)), time + duration * .62);
  gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(gain);
  const disconnectRoute = voiceRoute(gain, destination, pan);
  oscillator.start(time); oscillator.stop(time + duration + .01);
  oscillator.onended = sequenceSource(oscillator, () => {
    oscillator.disconnect(); gain.disconnect(); disconnectRoute();
  });
}
function scaleNote(score, degree) {
  return score.scale[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12;
}
function gothicChord(score, base, chordOffset, time, tick, section, destination) {
  score.chord.forEach((interval, index) => {
    const frequency = base * 2 * Math.pow(2, (chordOffset + interval) / 12);
    const pan = (index - 1.5) * .24;
    // Open pipe partials and a slow bowed texture give the minor harmony a
    // cathedral body. District charts retain their different grooves/motifs.
    musicVoice(frequency, time + index * .02, tick * 14, .012 * section.pads, 'sine', destination, pan, true);
    musicVoice(frequency / 2, time + index * .02, tick * 14, .007 * score.organ * section.pads, 'sine', destination, -pan, true);
    musicVoice(frequency * 2, time + index * .02, tick * 12, .0035 * score.organ * section.pads, 'sine', destination, pan, true);
    musicVoice(frequency * .998, time + .12 + index * .025, tick * 13,
      .0045 * score.strings * section.pads, 'sawtooth', destination, -pan, true);
  });
}
function bossStem(score, base, chordOffset, beat, time, tick, destination) {
  if (!bossLayer) return;
  const voice = bossIdentity.toLowerCase(), frequency = base * Math.pow(2, chordOffset / 12);
  if (beat === 0) {
    musicVoice(frequency / 2, time, tick * 7, .026 + bossLayer * .005, 'triangle', destination, 0, true);
    const gong = /bulwark|plating|rail/.test(voice);
    const ratios = gong ? [1, 2.76, 4.3] : [1, 1.5, 2.01];
    ratios.forEach((ratio, index) => musicVoice(frequency * 2 * ratio, time + index * .01,
      gong ? tick * 5 : tick * 3, .017 / (index + 1), 'sine', destination, (index - 1) * .3));
  }
  if (bossLayer >= 2 && beat % 2 === 0) {
    const interval = [0, 7, 3, 7][Math.floor(beat / 2)];
    musicVoice(frequency * 2 * Math.pow(2, interval / 12), time, tick * .7,
      .018 + bossLayer * .004, 'sawtooth', destination, beat < 4 ? -.3 : .3);
  }
  if (/crucible|thermal|kiln/.test(voice) && beat % 4 === 0)
    noise(time, .20, .033, 370, destination, -.3, 'lowpass');
  if (/sable|siphon/.test(voice) && beat === 5)
    musicVoice(frequency * 3, time, tick * 2, .035, 'triangle', destination, .6, true);
  if (/cipher|blackout/.test(voice) && [1, 5, 7].includes(beat))
    noise(time, .035, .030, 2800, destination, beat < 4 ? -.6 : .6, 'bandpass');
  if (/onyx|mirror/.test(voice) && beat === 7)
    musicVoice(frequency * 3, time + tick * .3, tick * .6, .032, 'sine', destination, -.55);
  if (bossLayer === 3 && beat >= 6) {
    noise(time + tick * .5, .04, .024, 1100, destination, .4, 'bandpass');
    note(frequency, time + tick * .5, .09, .030, 'triangle', destination, -.4);
  }
}
function scorePercussion(score, step, bar, time, tick, intensity, section, destination) {
  const beat = step % 8, gain = section.drums;
  if (gain < .4) {
    if (beat === 0) noise(time, .23, .024, 5600, destination, .45);
    if (beat === 6) note(180, time, .12, .026, 'sine', destination, -.5);
    return;
  }
  const fill = bar % 4 === 3 && beat >= 6;
  const kickBeat = score.kick.includes(beat) || (intensity > .72 && beat === 7 && bar % 2 === 1);
  if (kickBeat) kick(time, destination, (.19 + intensity * .06) * gain);
  if (score.snare.includes(beat)) {
    const industrial = score.voice === 'kiln', soft = score.voice === 'prism';
    noise(time, soft ? .07 : .12, (soft ? .07 : industrial ? .14 : .11) * gain, industrial ? 1250 : 2000, destination, -.12);
    note(industrial ? 154 : 196, time, .08, .023 * gain, 'triangle', destination);
    if (score.voice === 'market') noise(time + .018, .08, .032 * gain, 2800, destination, .3);
  }
  if (score.hats.includes(beat)) {
    const hatTime = time + (beat % 2 ? tick * score.swing : 0);
    noise(hatTime, beat === 7 && bar % 2 ? .10 : .025, (.014 + (beat % 2 ? .008 : 0)) * gain, 6500, destination, beat % 2 ? -.35 : .35);
    if ((intensity > .65 || fill) && score.voice !== 'prism') noise(hatTime + tick * .5, .022, .013 * gain, 7300, destination, -.4);
  }
  if (score.voice === 'root' && [1, 3, 5, 7].includes(beat)) {
    note([164, 130, 98, 110][Math.floor(beat / 2)], time, .15, .055 * gain, 'sine', destination, beat < 4 ? -.5 : .5);
    noise(time, .04, .018 * gain, 850, destination, 0, 'lowpass');
  }
  if (score.voice === 'kiln' && [1, 5].includes(beat)) {
    note(630, time, .075, .017 * gain, 'sine', destination, .55);
    note(1450, time + .003, .065, .011 * gain, 'sine', destination, -.55);
  }
  if (score.voice === 'prism' && [3, 7].includes(beat)) {
    note(1040, time, .08, .027 * gain, 'sine', destination, beat === 3 ? -.6 : .6);
    note(1690, time, .055, .012 * gain, 'sine', destination);
  }
  if (fill && section.name !== 'intro') {
    note(118 - (beat - 6) * 22, time + tick * .5, .12, .03 * gain, 'sine', destination, -.3);
    noise(time + tick * .5, .045, .023 * gain, 1800, destination, .3);
  }
}

function districtAmbience(level, destination) {
  if (!context.createBuffer || !context.createBufferSource) return null;
  const palette = ambienceForFloor(level), rate = Math.min(22050, context.sampleRate);
  const buffer = context.createBuffer(1, rate * 8, rate), data = buffer.getChannelData(0);
  let seed = 0x51f15e + palette.texture.charCodeAt(0) * 7919, brown = 0, sum = 0;
  for (let index = 0; index < data.length; index++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1, time = index / rate;
    brown = brown * .995 + white * .045;
    const wave = .5 - Math.cos(time * Math.PI / 4) * .5;
    let value;
    switch (palette.texture) {
      case 'rain':
        value = white * (.24 + wave * .07) + brown * .15
          + Math.sin(time * Math.PI * 123) * .10 * wave * wave;
        break;
      case 'furnace':
        value = brown * (1.05 + wave * .35) + white * .12
          + Math.sin(time * Math.PI * 86) * .11;
        break;
      case 'vault':
        value = Math.sin(time * Math.PI * 114) * .12 + Math.sin(time * Math.PI * 228) * .06
          + Math.sin(time * Math.PI * 342) * .025 + brown * .08;
        break;
      case 'market':
        value = white * (.14 + .08 * wave) + brown * .24
          + Math.sin(time * Math.PI * 430 + Math.sin(time * 2.7) * 5) * .10
          + Math.sin(time * Math.PI * 654 + Math.sin(time * 1.9) * 4) * .06;
        break;
      case 'signal':
        value = white * (.025 + (Math.sin(time * Math.PI * 2.75) > .92 ? .24 : 0))
          + Math.sin(time * Math.PI * 246) * .018;
        break;
      default: {
        const horn = Math.max(0, Math.sin((time - 2.7) * Math.PI / 2.4));
        value = brown * (.28 + wave * 1.3) + white * .055
          + horn * horn * (Math.sin(time * Math.PI * 146) * .11 + Math.sin(time * Math.PI * 219) * .055);
      }
    }
    // A short feather at the wrap prevents a buffer seam; no samples or remote
    // sound files are needed. The private noise seed never touches combat RNG.
    const edge = Math.min(1, index / (rate * .08), (data.length - 1 - index) / (rate * .08));
    data[index] = value * edge; sum += data[index];
  }
  const mean = sum / data.length;
  let peak = 0;
  for (const value of data) peak = Math.max(peak, Math.abs(value - mean));
  const scale = peak > .7 ? .7 / peak : 1;
  for (let index = 0; index < data.length; index++) data[index] = (data[index] - mean) * scale;
  const source = context.createBufferSource(), color = context.createBiquadFilter(), gain = context.createGain();
  source.buffer = buffer; source.loop = true;
  color.type = palette.filter; color.frequency.value = palette.cutoff; color.Q.value = .6;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(palette.gain, context.currentTime + .12);
  source.connect(color); color.connect(gain); gain.connect(destination);
  source.start(context.currentTime);
  musicNodes.push(source, color, gain);
  return palette.name;
}
export function playTone(type, enabled, delay = 0) {
  if (!enabled) return;
  const previousSequence = schedulingSequence;
  if (delay > 0 && sequenceAudio) schedulingSequence = sequenceAudio;
  try {
    audioContext();
    const now = context.currentTime + delay;
    if (type === "select") {
      note(780, now, 0.045, 0.025, "triangle");
      note(390, now + 0.02, 0.055, 0.012);
      return;
    }
    if (type === "qte-hit") {
      note(880, now, .075, .023, "triangle");
      note(1320, now + .018, .05, .01, "sine");
      return;
    }
    if (type === "qte-miss") {
      note(160, now, .09, .025, "triangle");
      noise(now, .035, .015, 650, master, 0, "lowpass");
      return;
    }
    if (type === "rock") {
      note(74, now, 0.35, 0.18, "triangle");
      noise(now, 0.24, 0.12, 600);
      return;
    }
    if (type === "paper") {
      [196, 294, 392, 588].forEach((f, i) =>
        note(f, now + i * 0.09, 0.55, 0.035, "sine"),
      );
      return;
    }
    if (type === "scissors") {
      noise(now, 0.18, 0.13, 1700);
      noise(now + 0.22, 0.16, 0.09, 2500);
      note(1100, now, 0.13, 0.026, "triangle");
      return;
    }
    if (type === "engage") {
      note(110, now, 0.23, 0.1, "triangle");
      note(220, now + 0.06, 0.15, 0.035, "sawtooth");
      return;
    }
    if (type === "finisher") {
      note(48, now, 0.75, 0.17, "triangle");
      note(96, now + 0.03, 0.4, 0.09, "sawtooth");
      [196, 294, 392, 588, 784].forEach((frequency, i) =>
        note(frequency, now + 0.12 + i * 0.07, 0.65, 0.045, "sine"),
      );
      return;
    }
    const notes =
      type === "win"
        ? [330, 440, 660]
        : type === "loss"
          ? [150, 112]
          : type === "upgrade"
            ? [262, 392, 523, 784]
            : [294, 330];
    notes.forEach((frequency, index) =>
      note(
        frequency,
        now + index * 0.065,
        type === "upgrade" ? 0.45 : 0.23,
        type === "loss" ? 0.035 : 0.06,
        type === "loss" ? "triangle" : "sine",
      ),
    );
    if (type === "win") note(70, now, 0.16, 0.12, "triangle");
  } catch {
    /* Silent play remains available without Web Audio. */
  } finally {
    schedulingSequence = previousSequence;
  }
}
export function setAmbience(enabled, level = 1) {
  ambientRequested = enabled;
  ambientFloor = level;
  clearTimeout(musicTimer);
  clearTimeout(heartbeatTimer);
  musicTimer = null;
  musicNodes.forEach((node) => {
    try {
      node.stop?.();
    } catch {}
    node.disconnect();
  });
  musicNodes = [];
  ambient?.disconnect();
  ambient = null;
  musicFilter = null;
  ambientTexture = null;
  if (!enabled || !context) return;
  // Audio begins only after a user gesture has created the context.
  ambient = context.createGain();
  ambient.gain.value = battleMix.musicGain;
  ambient.connect(master);
  const score = scoreForFloor(level);
  const base = 440 * Math.pow(2, (score.root - 69) / 12);
  musicInfo = { score: score.name, section: 'intro', bar: 0 };
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = battleMix.cutoff;
  filter.Q.value = 0.7;
  const musicBody = context.createGain();
  musicBody.gain.value = 1.65;
  filter.connect(musicBody);
  musicBody.connect(ambient);
  musicFilter = filter;
  musicNodes.push(filter, musicBody);
  ambientTexture = districtAmbience(level, filter);
  let step = 0;
  const pulse = () => {
    if (!ambient || !ambientRequested) return;
    const now = context.currentTime;
    const build = anticipation
      ? Math.max(
          0,
          Math.min(
            1,
            (now - anticipation.start) /
              Math.max(.001, anticipation.quiet - anticipation.start),
          ),
        )
      : 0;
    const quiet =
      anticipation && now >= anticipation.quiet && now < anticipation.impact;
    const intensity = Math.min(1.3, battleMix.intensity + build * .6 + bossLayer * .09),
      bpm = (score.bpm + battleMix.intensity * 21 + build * 34 + bossLayer * 2)
        * (bossLayer >= 2 && /redline/.test(bossIdentity.toLowerCase()) ? 1.2 : 1);
    const tick = 60 / bpm / 2;
    if (context.state === "running" && !quiet) {
      const bar = Math.floor(step / 8), beat = step % 8;
      const cycle = Math.floor(bar / 28), section = scoreSection(bar);
      const variation = score.variation + cycle;
      const chordDegree = score.chords[(Math.floor(bar / 2) + variation) % score.chords.length];
      const chordOffset = scaleNote(score, chordDegree);
      musicInfo = { score: score.name, section: build > .2 ? 'finish build' : section.name, bar, scoreBpm: bpm };
      scorePercussion(score, step, bar, now, tick, intensity, section, filter);
      const bassDegree = score.bass[(beat + (bar % 4 === 3 ? variation % 2 : 0)) % 8];
      if (bassDegree >= 0) {
        const frequency = base * Math.pow(2, (scaleNote(score, bassDegree) + chordOffset) / 12);
        const sync = beat % 2 ? tick * score.swing : 0;
        musicVoice(frequency, now + sync, tick * (score.voice === 'prism' ? 2.2 : .85), .062 * section.bass, score.bassWave, filter);
        musicVoice(frequency / 2, now + sync, tick * 1.1, .033 * section.bass, 'sine', filter);
      }
      if (beat === 0 && bar % 2 === 0) {
        gothicChord(score, base, chordOffset, now, tick, section, filter);
      }
      // A call-and-response melody with alternate endings every four bars.
      const phrase = ((bar % 2) * 8 + beat + variation * 2 + (bar % 8 >= 4 ? 4 : 0)) % 16;
      const degree = score.lead[phrase];
      if (degree >= 0 && (section.name !== 'intro' || beat % 2 === 0)) {
        const octave = section.name === 'lift' || section.name === 'finale' ? 8 : 4;
        const frequency = base * octave * Math.pow(2, scaleNote(score, degree) / 12);
        const duration = tick * (score.voice === 'prism' ? 2.5 : score.voice === 'tide' ? 1.3 : .8);
        const pan = Math.sin((bar * 8 + beat) * .32) * .38;
        musicVoice(frequency, now + (beat % 2 ? tick * score.swing : 0), duration,
          (.020 + intensity * .014) * section.lead, score.leadWave, filter, pan);
        if (score.voice === 'prism' || score.voice === 'rain')
          musicVoice(frequency * 2.01, now + .012, duration * .65, .007 * section.lead, 'sine', filter, -pan);
        if (score.celesta > .4)
          musicVoice(frequency * 1.38, now + .006, duration * .45, .006 * score.celesta, 'sine', filter, -pan);
      }
      if ((section.name === 'reprise' || section.name === 'finale') && beat % 2 === 1) {
        const degree = score.lead[(15 - phrase + 16) % 16];
        if (degree >= 0) musicVoice(base * 2 * Math.pow(2, scaleNote(score, degree) / 12),
          now + tick * .5, tick * .8, .016, 'sine', filter, -.5);
      }
      if (build > .2) {
        noise(now, .035, .023 + build * .044, 2300, filter);
        if (build > .65) noise(now + tick * .5, .025, .025, 3700, filter, .3);
      }
      bossStem(score, base, chordOffset, beat, now, tick, filter);
      step++;
    }
    musicTimer = setTimeout(pulse, tick * 1000);
  };
  const heartbeat = () => {
    if (!ambient || !ambientRequested) return;
    const now = context.currentTime;
    const cinematicQuiet = anticipation && now >= anticipation.quiet && now < anticipation.impact;
    if (context.state === "running" && battleMix.heartbeatGain > 0 && !cinematicQuiet && !anticipation?.finale) {
      note(58, context.currentTime, 0.13, battleMix.heartbeatGain, "sine");
      note(
        47,
        context.currentTime + 0.13,
        0.18,
        battleMix.heartbeatGain * 0.7,
        "sine",
      );
    }
    heartbeatTimer = setTimeout(heartbeat, 60000 / battleMix.heartbeatBpm);
  };
  pulse();
  heartbeat();
}

let bossLayer = 0, bossIdentity = '';
export function setBossAudio(phase = 0, identity = '') {
  if (typeof phase === 'object' && phase) {
    identity = phase.id || phase.ability || phase.model || '';
    phase = phase.phase || 0;
  }
  bossLayer = Math.max(0, Math.min(3, Number.isFinite(phase) ? phase : 0));
  bossIdentity = bossLayer ? String(identity) : '';
}
function weaponContact(animation, palette, time, strength, pan, ordinal = 0) {
  const root = palette.root * (1 + ordinal * .025);
  if (animation.style === 'brawler') {
    kick(time, master, .13 * strength);
    noise(time, .10, .09 * strength, 650, master, pan, 'lowpass');
    note(root * 1.5, time + .012, .12, .025 * strength, 'triangle', master, pan);
  } else if (animation.style === 'mage') {
    palette.tail.forEach((ratio, index) =>
      note(root * ratio, time + index * .015, .20, .035 * strength / (index + 1), 'sine', master, pan));
    noise(time, .075, .028 * strength, 2300, master, pan);
  } else if (animation.style === 'archer') {
    sweep(root * 2.1, root * .8, time, .055, .04 * strength, 'triangle', pan);
    noise(time, .065, .06 * strength, 3200, master, pan);
    note(root * 2.04, time + .025, .14, .022 * strength, 'sine', master, -pan);
  } else {
    noise(time, .095, .075 * strength, animation.style === 'glaive' ? 1200 : 2500, master, pan);
    sweep(root * 5.5, root * 1.8, time, .065, .029 * strength, 'triangle', pan);
    note(root * 2.67, time + .008, .15, .018 * strength, 'sine', master, -pan);
    if (animation.style === 'glaive') note(root * .5, time, .18, .045 * strength, 'triangle');
  }
  const hand = animation.weapon || animation.playerWeapon || animation.enemyWeapon || animation.sequenceId?.split('.')[1];
  if (hand === 'rock') {
    note(48, time, .20, .036 * strength, 'sine');
    noise(time, .075, .040 * strength, 700, master, pan, 'bandpass');
  } else if (hand === 'paper') {
    noise(time, .13, .025 * strength, 1700, master, -pan, 'bandpass');
    noise(time + .03, .035, .022 * strength, 3100, master, pan);
  } else if (hand === 'scissors') {
    note(root * 4.12, time + .017, .16, .012 * strength, 'sine', master, -pan);
  }
}

function risingLayer(from, time, duration, amplitude, pan) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(from, time);
  oscillator.frequency.exponentialRampToValueAtTime(from * 2, time + duration);
  gain.gain.setValueAtTime(.0001, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + duration * .40);
  gain.gain.linearRampToValueAtTime(amplitude * .65, time + duration * .75);
  gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(gain);
  const disconnectRoute = voiceRoute(gain, master, pan);
  oscillator.start(time); oscillator.stop(time + duration + .01);
  oscillator.onended = sequenceSource(oscillator, () => {
    oscillator.disconnect(); gain.disconnect(); disconnectRoute();
  });
}
function shepardConvergence(time, duration, palette) {
  const part = duration / 3;
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let octave = 0; octave < 5; octave++) {
      const weight = Math.exp(-Math.pow((octave - 2) / 1.5, 2));
      risingLayer(palette.root / 4 * Math.pow(2, octave), time + cycle * part,
        part, (.012 + cycle * .004) * weight, (octave - 2) * .16);
    }
  }
}

function momentCue(cue, animation, time, span, pitch) {
  const side = ((animation.actorSide || animation.defeatedSide || animation.side) === 'player' ? -1 : 1) * (animation.mirrored ? -1 : 1);
  const pan = side * .35;
  // Each cue owns a different physical material; compressed previews preserve
  // those envelopes and contact offsets instead of replaying one generic hit.
  const duration = Math.min(1.5, span);
  const length = fraction => Math.max(.012, duration * fraction);
  const at = fraction => time + duration * fraction;
  const metal = (root, strength, spread = .4) => {
    [1, 2.76, 4.19].forEach((ratio, index) =>
      note(root * ratio * pitch, at(index * .06), length(.85 - index * .06),
        strength / (index + 1), 'sine', master, index % 2 ? -spread : spread));
  };
  switch (cue.id) {
    case 'reveal-thud': {
      const pulse = cue.pulseIndex || 0;
      // Three shared physical throws; no result sound leaks into these beats.
      [ -.42, .42 ].forEach(direction => {
        sweep(104 + pulse * 8, 57 + pulse * 3, time, length(.92), .030, 'sine', direction);
        noise(time, length(.50), .018, 540, master, direction, 'lowpass');
        noise(at(.06), length(.30), .012, 1450, master, direction, 'bandpass');
      });
      break;
    }
    case 'totem-contact': {
      const handMaterial = (hand, direction, strength) => {
        if (hand === 'paper') {
          noise(time, length(.94), .026 * strength, 1900, master, direction, 'bandpass');
          sweep(420 * pitch, 650 * pitch, time, length(.85), .017 * strength, 'sine', direction);
        } else if (hand === 'scissors') {
          note(840 * pitch, time, length(.95), .024 * strength, 'sine', master, direction);
          note(1720 * pitch, at(.06), length(.76), .011 * strength, 'sine', master, -direction);
          noise(time, length(.14), .023 * strength, 3200, master, direction);
        } else {
          sweep(115, 48, time, length(.92), .049 * strength, 'sine', direction);
          noise(time, length(.40), .031 * strength, 660, master, direction, 'lowpass');
        }
      };
      handMaterial(animation.playerHand || animation.playerWeapon || 'rock', -.45, cue.outcome === 'loss' ? .55 : 1);
      handMaterial(animation.enemyHand || animation.enemyWeapon || 'scissors', .45, cue.outcome === 'win' ? .55 : 1);
      if (cue.outcome === 'draw') note(310 * pitch, time, length(.85), .018, 'triangle');
      break;
    }
    case 'weapon-clash':
      noise(time, length(.38), .079, 2350, master, 0, 'bandpass');
      metal(265, .038, .6);
      note(78, time, length(.92), .045, 'sine');
      break;
    case 'double-skid':
      [ -.6, .6 ].forEach(direction => {
        noise(time, length(.95), .038, 690, master, direction, 'bandpass');
        sweep(128, 61, time, length(.85), .020, 'triangle', direction);
      });
      break;
    case 'guard-set': {
      const fighter = FIGHTERS.find(value => value.id === cue.character);
      const palette = choreographySoundProfile({ style: fighter?.style || animation.style });
      const cloth = ['brawler', 'archer'].includes(fighter?.style);
      noise(time, length(.45), cloth ? .030 : .020, cloth ? 900 : 2900, master, pan, 'bandpass');
      note(palette.root * (cloth ? 1.5 : 4.1), time, length(.95), .023,
        cloth ? 'triangle' : 'sine', master, pan);
      if (fighter?.style === 'mage') note(palette.root * 3, at(.15), length(.74), .013, 'sine', master, -pan);
      break;
    }
    case 'injector-pulse':
      noise(time, length(.045), .028, 2200, master, pan);
      sweep(185, 560, time, length(.88), .022, 'sine', pan);
      [0, 4, 7].forEach((interval, index) =>
        musicVoice(330 * Math.pow(2, interval / 12), at(index * .15), length(.70),
          .013 / (index + 1), 'sine', master, (index - 1) * .3, true));
      break;
    case 'coolant-hiss':
      noise(time, length(.98), .051, 1700, master, pan, 'bandpass');
      noise(time, length(.96), .025, 510, master, -pan, 'lowpass');
      sweep(480, 108, time, length(.94), .016, 'sine', pan);
      break;
    case 'battery-fill':
      sweep(155, 880, time, length(.94), .019, 'triangle', pan);
      musicVoice(208, time, length(.95), .016, 'sine', master, -pan, true);
      [0, .22, .44, .66].forEach((offset, index) =>
        note(390 * Math.pow(1.26, index), at(offset), length(.23), .012, 'sine', master, index % 2 ? -pan : pan));
      break;
    case 'scan-sweep':
      sweep(1160, 370, time, length(.95), .022, 'sine', -pan);
      noise(time, length(.12), .014, 2900, master, -pan, 'bandpass');
      [0, .29, .61].forEach((offset, index) =>
        note(840 + index * 120, at(offset), length(.19), .016, 'sine', master, index % 2 ? pan : -pan));
      break;
    case 'last-exhale':
      noise(time, length(.98), .037, 840, master, pan, 'bandpass');
      noise(time, length(.72), .012, 210, master, pan, 'lowpass');
      break;
    case 'street-light-out': {
      const fixture = cue.fixtureGroup || 0, direction = (fixture % 2 ? -.65 : .65) * side;
      noise(time, length(.15), .034, 3600, master, direction);
      sweep(1580 - fixture * 225, 210, time, length(.91), .025, 'triangle', direction);
      break;
    }
    case 'defeat-low-tone':
      musicVoice(46, time, length(.98), .034, 'sine', master, 0, true);
      musicVoice(61.4, time, length(.96), .011, 'sine', master, -.2, true);
      break;
    case 'blade-catch':
      noise(time, length(.22), .035, 3300, master, pan);
      note(690 * pitch, time, length(.85), .028, 'triangle', master, pan);
      note(1840 * pitch, at(.07), length(.65), .011, 'sine', master, -pan);
      break;
    case 'heel-thud':
      sweep(102, 48, time, length(.96), .051, 'sine', pan);
      noise(time, length(.6), .045, 410, master, pan, 'lowpass');
      noise(at(.11), length(.30), .014, 1200, master, -pan, 'bandpass');
      break;
    case 'fist-clap':
      noise(time, length(.30), .075, 1350, master, pan, 'bandpass');
      sweep(170, 71, time, length(.88), .048, 'triangle');
      [0, .22, .45].forEach((offset, index) =>
        noise(at(offset), length(.12), .012 / (index + 1), 3500 + index * 450, master, (index - 1) * .3));
      break;
    case 'prism-turn':
      sweep(410 * pitch, 820 * pitch, time, length(.97), .024, 'sine', pan);
      sweep(825 * pitch, 490 * pitch, time, length(.96), .010, 'sine', -pan);
      [0, 4, 7].forEach((interval, index) =>
        note(1230 * pitch * Math.pow(2, interval / 12), at(.14 + index * .18),
          length(.35), .009, 'sine', master, (index - 1) * .45));
      break;
    case 'staff-tap':
      note(176 * pitch, time, length(.75), .035, 'triangle', master, pan);
      noise(time, length(.28), .025, 730, master, pan, 'bandpass');
      note(1360 * pitch, at(.08), length(.85), .010, 'sine', master, -pan);
      break;
    case 'bow-nock':
      noise(time, length(.2), .019, 2550, master, pan);
      sweep(1120 * pitch, 260 * pitch, at(.06), length(.86), .037, 'triangle', -pan);
      note(520 * pitch, at(.22), length(.62), .012, 'sine', master, pan);
      break;
    case 'glaive-plant':
      sweep(100, 42, time, length(.96), .068, 'sine');
      noise(time, length(.40), .055, 860, master, pan, 'bandpass');
      metal(144, .025, pan);
      [0, .28, .54].forEach((offset, index) =>
        noise(at(offset), length(.1), .010, 3900 + index * 300, master, -pan));
      break;
    case 'iron-step':
      sweep(85, 32, time, length(.96), .082, 'sine');
      noise(time, length(.76), .068, 280, master, pan, 'lowpass');
      metal(132, .019, pan);
      noise(at(.17), length(.28), .018, 2200, master, -pan, 'bandpass');
      break;
    case 'shield-plant':
      sweep(118, 29, time, length(.94), .105, 'sine');
      noise(time, length(.7), .082, 450, master, 0, 'lowpass');
      metal(181, .044, .24);
      noise(at(.1), length(.24), .027, 3300, master, pan);
      break;
    case 'shield-split':
      noise(time, length(.30), .087, 1650, master, -.45, 'bandpass');
      sweep(360 * pitch, 84, time, length(.8), .056, 'triangle', .45);
      metal(245, .036, .65);
      [0, .16, .39, .64].forEach((offset, index) =>
        note((index % 2 ? 680 : 440) * pitch, at(offset), length(.24),
          .015, 'sine', master, index % 2 ? -.7 : .7));
      break;
    case 'armour-shed':
      note(59, time, length(.70), .054, 'sine');
      noise(time, length(.28), .048, 550, master, 0, 'lowpass');
      for (let index = 0; index < 7; index++) {
        const contact = at(index * .10), direction = index % 2 ? -.65 : .65;
        note((220 + index * 83) * pitch, contact, length(.28), .022 / (1 + index * .12), 'sine', master, direction);
        noise(contact, length(.09), .016, 2100 + index * 170, master, direction);
      }
      break;
    case 'quick-brace':
      noise(time, length(.34), .038, 660, master, pan, 'bandpass');
      noise(at(.16), length(.29), .024, 2200, master, -pan);
      note(94, at(.1), length(.78), .037, 'triangle');
      metal(310, .011, .2);
      break;
    case 'plate-fracture':
      noise(time, length(.18), .073, 3300, master, pan);
      sweep(250, 78, time, length(.45), .048, 'triangle', -pan);
      [0, .19, .4, .65].forEach((offset, index) =>
        note((570 - index * 88) * pitch, at(offset), length(.30),
          .023 / (index + 1), 'sine', master, index % 2 ? -.55 : .55));
      break;
    default:
      return false;
  }
  return true;
}
function authoredCue(cue, animation, plan, start) {
  const now = context.currentTime, scheduled = start + cue.at;
  if (cue.end === undefined && scheduled < now - .035) return;
  if (cue.end !== undefined && start + cue.end <= now) return;
  const time = Math.max(now, scheduled), end = Math.min(start + plan.duration, start + (cue.end ?? cue.at + .2));
  const span = Math.max(.025, end - time), palette = choreographySoundProfile(animation);
  const stamp = `${animation.sequenceId}:${cue.id}:${cue.index}`;
  const hash = [...stamp].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const pitch = 1 + (hash % 17 - 8) / 100;
  if (animation.momentId && momentCue(cue, animation, time, span, pitch)) return;
  const voice = { ...palette, root: palette.root * pitch };
  const pans = { 'cut-left': -.65, 'cut-right': .65, 'cut-high': .1, 'cut-low': -.2, 'cross-cut': .3,
    'spin-cut': -.55, 'final-pass': .55, 'reflection-left': -.7, 'reflection-water': .6,
    'reflection-window': -.45, 'reflection-sign': .45, 'reflection-cross': 0 };
  if (Object.hasOwn(pans, cue.id)) {
    weaponContact(animation, voice, time, .54, pans[cue.id], cue.index);
    return;
  }
  switch (cue.id) {
    case 'breath':
      noise(time, .11, .016, 1050, master, -.15, 'bandpass');
      break;
    case 'draw':
      noise(time, .085, .050, 2800, master, -.6);
      sweep(1050 * pitch, 420 * pitch, time, .075, .030, 'triangle', .45);
      break;
    case 'blade-coil':
      note(voice.root * 1.5, time, .30, .024, 'sine', master, -.4);
      sweep(voice.root, voice.root * 3, time + .025, .23, .014, 'sine', .4);
      break;
    case 'sheath-click':
      noise(time, .028, .043, 2300, master, .15);
      note(740 * pitch, time, .065, .024, 'triangle', master, .15);
      note(2110 * pitch, time + .008, .045, .012, 'sine', master, -.1);
      break;
    case 'light-cut':
      weaponContact(animation, voice, time, .82, .4);
      note(voice.root * 2.67, time + .045, .21, .018, 'sine', master, -.4);
      break;
    case 'light-drain':
      sweep(82, 330, time, .48, .025, 'sine', -.4);
      noise(time, .28, .017, 1800, master, .4, 'bandpass', true);
      break;
    case 'inhale':
      noise(time, span, .032, 950, master, -.25, 'lowpass', true);
      sweep(120, 55, time, span, .023, 'sine');
      break;
    case 'thousand-bloom':
      kick(time, master, .16);
      noise(time, .18, .09, 2600, master, .3);
      [1, 2.67, 4.12].forEach((ratio, index) => note(voice.root * ratio, time + index * .016, .38, .034 / (index + 1), 'sine', master, index % 2 ? -.4 : .4));
      break;
    case 'silence':
      // Gain automation is authored separately; silence does not create a clip.
      break;
    case 'afterlight-heartbeat':
      for (let beat = scheduled; beat < start + cue.end - .20; beat += .5) {
        if (beat < now) continue;
        note(58, beat, .13, .058, 'sine');
        note(47, beat + .13, .18, .039, 'sine');
      }
      break;
    case 'afterlight-convergence':
      shepardConvergence(time, span, plan.palette);
      break;
    case 'afterlight-reflections': {
      musicVoice(plan.palette.root * 1.5, time, span, .014, 'sine', master, 0, true);
      const reduced = animation.reduced || animation.short;
      cue.times.forEach((at, index) => {
        if (reduced && index % 3 !== 0) return;
        const contact = start + at;
        if (contact < now - .015) return;
        const pan = Math.sin(index * Math.PI * 2 / 24) * .72;
        const reflection = { ...voice, root: plan.palette.root * Math.pow(2, [0, 2, 3, 5, 7, 8, 10, 12][index % 8] / 12) };
        weaponContact(animation, reflection, Math.max(now, contact), .32, pan, index % 3);
      });
      break;
    }
    case 'afterlight-bloom':
      // The delayed consequence lands in near silence, not another explosion.
      note(plan.palette.root / 2, time, .18, .008, 'sine');
      note(plan.palette.root * 3, time + .03, .22, .0045, 'sine', master, -.3);
      break;
    case 'afterlight-chord':
      plan.palette.chord.forEach((interval, index) => {
        musicVoice(plan.palette.root * Math.pow(2, interval / 12), time + index * .018,
          Math.max(.05, span - index * .018), .027 / (1 + index * .15), 'sine', master,
          (index - 1.5) * .2, true);
        musicVoice(plan.palette.root * 2 * Math.pow(2, interval / 12), time + index * .018,
          Math.max(.05, span - index * .018), .009 / (index + 1), 'triangle', master,
          (1.5 - index) * .2, true);
      });
      break;
    default:
      // Future authored kit cues retain their fighter/hand timbre without
      // borrowing Echo's bespoke reflection or finale structure.
      if (cue.id.includes('hit') || cue.id.includes('cut')) weaponContact(animation, voice, time, .60, palette.pan);
      else noise(time, .08, .025, palette.brightness, master, palette.pan, 'bandpass');
  }
}

function finalArc(animation, palette, start, impact) {
  const length = impact - start, at = fraction => start + length * fraction;
  const ring = (time, root = palette.root, duration = .4, gain = .027, pan = palette.pan) =>
    palette.tail.forEach((ratio, index) => note(root * ratio, time + index * .018, duration, gain / (index + 1), 'sine', master, pan));
  switch (palette.voice) {
    case 'breaker':
      [0.17, .34, .58].forEach((fraction, index) => ring(at(fraction), 310 + index * 120, .24, .025, index % 2 ? -.65 : .65));
      noise(impact, .25, .12, 1800); ring(impact + .035, 480, .65, .04);
      break;
    case 'mirror':
      [.2, .39, .56, .71].forEach((fraction, index) => ring(at(fraction), 174 * (index % 2 ? 1.5 : 1), .42, .028, index % 2 ? -.7 : .7));
      sweep(690, 172, impact, .42, .065, 'triangle'); ring(impact, 348, .8, .045);
      break;
    case 'flurry':
      sweep(180, 1440, at(.22), length * .35, .022, 'triangle', -.5);
      noise(impact, .30, .10, 3000); ring(impact + .03, 560, .5, .037);
      break;
    case 'tectonic':
      noise(at(.3), .52, .055, 280, master, -.35, 'lowpass');
      sweep(74, 28, impact, .7, .16, 'sine'); noise(impact + .015, .55, .115, 530, master, .25, 'lowpass');
      break;
    case 'overload':
      [.2, .38, .55, .73].forEach((fraction, index) => {
        sweep(95 + index * 90, 360 + index * 180, at(fraction), .22, .035, 'sawtooth', index % 2 ? -.5 : .5);
        noise(at(fraction), .05, .025, 4100);
      });
      ring(impact, 147, .55, .055); noise(impact, .3, .11, 2000);
      break;
    case 'orbital':
      sweep(75, 1200, at(.16), length * .21, .046, 'triangle', -.55);
      [.46, .60, .73].forEach((fraction, index) => {
        sweep(850 - index * 160, 160, at(fraction), .2, .055, 'triangle', index % 2 ? -.7 : .7);
        ring(at(fraction), 220 + index * 70, .28, .026);
      });
      sweep(1200, 43, impact - .17, .42, .08, 'triangle');
      noise(impact, .55, .12, 450, master, 0, 'lowpass');
      break;
    case 'crystal':
      [.18, .29, .43, .62].forEach((fraction, index) => ring(at(fraction), 392 * Math.pow(1.26, index), .3, .03, (index - 1.5) * .4));
      noise(impact, .2, .095, 4100); ring(impact, 784, .9, .04);
      break;
    case 'integral':
      // Audible slices accumulate across the area, then resolve as one chord.
      for (let index = 0; index < 12; index++)
        note(196 * [1, 1.25, 1.5, 2][index % 4], at(.22 + index * .047), .18, .017, 'sine', master, -.65 + index / 11 * 1.3);
      sweep(294, 49, impact, .6, .10, 'sine'); ring(impact + .03, 196, .8, .045);
      break;
    case 'void':
      sweep(240, 25, at(.3), length * .48, .065, 'sine');
      noise(at(.46), length * .25, .032, 650, master, -.45, 'bandpass');
      // A low implosion, rather than another bright explosion.
      sweep(64, 24, impact, .65, .13, 'sine');
      sweep(280, 920, impact + .08, .27, .025, 'sine', .6);
      break;
    case 'meteor':
      [.30, .51, .69].forEach((fraction, index) => sweep(1200 + index * 180, 90, at(fraction), .28, .045, 'triangle', index % 2 ? -.65 : .65));
      noise(impact, .45, .13, 750, master, 0, 'lowpass'); ring(impact + .035, 246, .5, .033);
      break;
    case 'constellation':
      [.18, .33, .50, .67, .83].forEach((fraction, index) => ring(at(fraction), 330 * Math.pow(2, index / 12), .24, .03, Math.sin(index * 2) * .7));
      sweep(1600, 330, impact, .16, .08, 'triangle', .4); ring(impact + .025, 440, .75, .045);
      break;
    case 'starfall':
      sweep(980, 247, at(.3), length * .42, .04, 'sine', .6);
      [.52, .63, .75].forEach((fraction, index) => ring(at(fraction), 494 / (1 + index * .25), .28, .032, index % 2 ? -.5 : .5));
      ring(impact, 247, .95, .06); noise(impact, .24, .085, 2200);
      break;
    case 'thunder':
      noise(at(.37), .48, .065, 460, master, -.4, 'lowpass');
      sweep(120, 29, impact, .6, .12, 'triangle');
      noise(impact, .6, .12, 680, master, .4, 'lowpass'); ring(impact + .04, 147, .42, .025);
      break;
    case 'turbine':
      sweep(80, 860, at(.2), length * .57, .045, 'sawtooth', -.35);
      [0.41, .55, .70].forEach((fraction, index) => {
        noise(at(fraction), .10, .05, 1500 + index * 800, master, index % 2 ? -.7 : .7);
        ring(at(fraction), 184 + index * 92, .13, .028);
      });
      sweep(540, 36, impact, .27, .09, 'triangle'); noise(impact, .3, .115, 2100);
      break;
    case 'rift':
      ring(at(.2), 146, .65, .04, -.6); ring(at(.48), 219, .65, .04, .6);
      sweep(146, 1168, at(.5), length * .27, .033, 'sine');
      ring(impact, 292, .8, .045); noise(impact, .3, .08, 3400); sweep(180, 37, impact, .32, .07, 'triangle');
      break;
    case 'timefracture':
      for (let index = 0; index < 8; index++) {
        const time = at(.23 + index * .062);
        note(index % 2 ? 880 : 440, time, .025, .024, 'triangle', master, index % 2 ? -.6 : .6);
        if (index % 2 === 0) sweep(660, 220, time + .04, .14, .019, 'sine', -.4);
      }
      ring(impact, 220, .65, .045); noise(impact, .16, .09, 3200);
      break;
    case 'guillotine':
      sweep(180, 720, at(.27), .65, .032, 'triangle', -.65);
      ring(at(.48), 310, .24, .025, .65); ring(at(.67), 206, .22, .025, -.65);
      sweep(1600, 140, impact - .14, .18, .065, 'triangle');
      noise(impact, .19, .11, 2000); ring(impact + .014, 206, .65, .05);
      break;
    case 'threadmaze':
      for (let index = 0; index < 10; index++)
        ring(at(.22 + index * .052), 523 * [1, 1.12, 1.26, 1.5, 1.89][index % 5], .16, .016, Math.sin(index * 1.8) * .7);
      sweep(1569, 261, impact, .2, .045, 'sine'); ring(impact + .02, 523, .75, .036);
      break;
    case 'railcannon':
      [.24, .39, .54, .69].forEach((fraction, index) => {
        noise(at(fraction), .16, .04, 520 + index * 230, master, index % 2 ? -.6 : .6, 'bandpass');
        ring(at(fraction), 110 + index * 55, .18, .028);
      });
      sweep(220, 1320, at(.47), length * .27, .031, 'triangle');
      noise(impact, .38, .12, 780, master, .35, 'lowpass'); sweep(140, 34, impact, .5, .115, 'triangle');
      break;
    case 'suncore':
      [.24, .43, .62].forEach((fraction, index) => ring(at(fraction), 165 * (index + 1), .7, .025, index % 2 ? -.4 : .4));
      sweep(165, 660, at(.48), length * .3, .031, 'sine');
      ring(impact, 330, 1.05, .05); noise(impact, .36, .08, 2700); sweep(98, 33, impact, .5, .105, 'sine');
      break;
    case 'magnetic':
      [.24, .39, .55, .72].forEach((fraction, index) => {
        sweep(index % 2 ? 174 : 696, index % 2 ? 696 : 174, at(fraction), .27, .033, 'sine', index % 2 ? -.7 : .7);
        note(87, at(fraction), .12, .035, 'triangle');
      });
      ring(impact, 174, .52, .045); noise(impact, .28, .08, 900, master, -.3, 'bandpass');
      break;
    case 'cathedral':
      ring(at(.24), 294, .9, .035, -.6); ring(at(.48), 392, .8, .032, .6);
      ring(at(.7), 440, .6, .029);
      ring(impact, 147, 1.3, .065); noise(impact, .18, .055, 2700);
      break;
    case 'origami':
      for (let index = 0; index < 9; index++) {
        const time = at(.23 + index * .062);
        noise(time, .045, .021, 3500, master, index % 2 ? -.65 : .65);
        note(349 * [1, 1.5, 2.25][index % 3], time + .02, .14, .018, 'sine', master, Math.sin(index) * .6);
      }
      sweep(1047, 174, impact, .34, .057, 'sine'); ring(impact, 349, .7, .045);
      break;
    case 'gravitywell':
      [.24, .43, .62].forEach((fraction, index) => {
        sweep(264 / (index + 1), 33, at(fraction), .55, .046, 'sine', index % 2 ? .6 : -.6);
        noise(at(fraction), .27, .025, 360, master, 0, 'lowpass');
      });
      sweep(99, 24, impact, .7, .12, 'sine'); ring(impact + .08, 99, .55, .035);
      break;
    case 'tidal':
      [.23, .42, .62].forEach((fraction, index) => {
        noise(at(fraction), .42, .052, 1400 - index * 240, master, index % 2 ? .65 : -.65, 'lowpass');
        sweep(195, 65, at(fraction), .33, .032, 'sine');
      });
      noise(impact, .6, .09, 950, master, .4, 'lowpass'); ring(impact, 130, .65, .045);
      break;
    case 'tether':
      [.23, .37, .53, .68].forEach((fraction, index) => sweep(220 + index * 110, 440 + index * 110, at(fraction), .22, .034, 'triangle', index % 2 ? -.6 : .6));
      sweep(1320, 330, impact, .095, .085, 'triangle', .7);
      ring(impact + .018, 440, .6, .039); noise(impact, .09, .055, 4300);
      break;
    case 'starlance':
      sweep(330, 1977, at(.28), length * .35, .032, 'sine', -.5);
      [.47, .63, .76].forEach((fraction, index) => ring(at(fraction), 659 * (1 + index * .33), .22, .021, index % 2 ? .6 : -.6));
      sweep(1977, 165, impact, .24, .073, 'triangle'); ring(impact + .02, 659, .72, .038);
      break;
    case 'chronoblade':
      for (let index = 0; index < 7; index++) {
        const time = at(.25 + index * .07);
        note(index % 2 ? 740 : 370, time, .04, .018, 'sine', master, index % 2 ? -.4 : .4);
        if (index > 3) noise(time + .03, .04, .023, 3000, master, -.5);
      }
      ring(impact, 185, .6, .045);
      [0, .055, .12].forEach((delay, index) => noise(impact + delay, .07, .043, 2200 + index * 700, master, (index - 1) * .6));
      break;
    case 'serpent':
      [.24, .41, .59, .73].forEach((fraction, index) => {
        noise(at(fraction), .22, .025, 3100, master, index % 2 ? -.7 : .7, 'bandpass');
        sweep(index % 2 ? 246 : 123, index % 2 ? 123 : 369, at(fraction), .27, .031, 'sine', index % 2 ? .7 : -.7);
      });
      ring(impact, 246, .5, .045, -.55); ring(impact + .07, 369, .4, .034, .55);
      break;
    case 'aurora':
      [.24, .43, .62].forEach((fraction, index) => ring(at(fraction), 262 * [1, 1.25, 1.89][index], .8, .025, index % 2 ? -.65 : .65));
      sweep(262, 1310, at(.47), length * .29, .025, 'sine');
      ring(impact, 524, 1.1, .045); noise(impact, .24, .057, 4100);
      break;
    default:
      weaponContact(animation, palette, impact, .9, palette.pan);
      break;
  }
  // A restrained shared sub transient anchors the impact without masking
  // the distinct pitched and textured tails above it.
  kick(impact, master, ['void', 'tectonic', 'thunder'].includes(palette.voice) ? .17 : .13);
}

// Contacts are authored by the choreography module: every preliminary hit is
// sounded at its actual pose/contact time, including changes in direction.
export function playChoreography(animation, enabled) {
  cancelSequenceAudio();
  if (!enabled || !audioEnabled || volume === 0) return;
  const previousSequence = schedulingSequence;
  try {
    if (animation.momentId) animation = sceneMomentAudioPresentation(animation.momentId, animation);
    audioContext();
    const elapsed = Number.isFinite(animation.startedAt) ? Math.max(0, performance.now() - animation.startedAt) / 1000 : 0;
    const plan = sequenceAudioPlan(animation), bus = context.createGain();
    const active = {
      id: animation.id || `${animation.sequenceId || 'attack'}:${++sequenceSerial}`,
      animation, plan, bus, sources: new Set(), endTimer: null,
    };
    sequenceAudio = active; schedulingSequence = active;
    bus.gain.value = plan.gain; bus.connect(master);
    const origin = context.currentTime - elapsed;
    cinematicMusic(animation, plan, origin, active.id);
    if (plan.silence) {
      const now = context.currentTime, at = Math.max(now, origin + plan.silence.at), end = Math.max(at, origin + plan.silence.end);
      bus.gain.setValueAtTime(plan.gain, now);
      bus.gain.linearRampToValueAtTime(plan.gain, Math.max(now, at - .015));
      bus.gain.linearRampToValueAtTime(.0001, at);
      bus.gain.setValueAtTime(.0001, Math.max(at, end - .001));
      bus.gain.setValueAtTime(plan.gain, end);
    }
    active.endTimer = setTimeout(() => cancelSequenceAudio(active.id), Math.max(0, plan.duration - elapsed) * 1000 + 30);
    if (plan.authored) {
      plan.cues.forEach(cue => authoredCue(cue, animation, plan, origin));
      return;
    }
    const start = context.currentTime, length = animation.duration / 1000;
    const impact = start + length * animation.impactAt;
    const palette = choreographySoundProfile(animation);
    noise(start + .05, .10, .026, animation.style === 'brawler' ? 520 : 1800, master, -palette.pan);
    note(palette.root, start + .12, .25, .025, 'triangle', master, palette.pan);
    if (!animation.reduced) {
      const contacts = animation.contacts || [];
      contacts.forEach((contact, index) => {
        const fraction = Array.isArray(contact) ? contact[0] : contact.at;
        if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= animation.impactAt) return;
        const time = start + length * fraction;
        if (time > impact - (animation.finisher ? .5 : .23)) return;
        const pan = Math.max(-.75, Math.min(.75, Math.sin((index + .5) * 2.4) * .72));
        noise(Math.max(start, time - .075), .065, .032, palette.brightness, master, -pan);
        weaponContact(animation, palette, time, .62 * palette.weight, pan, index);
      });
      noise(start + length * .28, .14, .035, palette.brightness, master, palette.pan);
    }
    if (animation.finisher && !animation.reduced) finalArc(animation, palette, start, impact);
    else weaponContact(animation, palette, impact, palette.weight, palette.pan);
  } catch {
    // Combat remains playable when Web Audio is unavailable.
    cancelSequenceAudio();
  } finally {
    schedulingSequence = previousSequence;
  }
}

/** Entrances, transformations and armour breaks use the same skip-safe bus. */
export function playSceneMomentAudio(momentId, { sound = true, ...options } = {}) {
  const animation = sceneMomentAudioPresentation(momentId, options);
  playChoreography(animation, sound);
  return animation;
}

/** Shared reveals, clashes, items and defeat are ancillary, not attack IDs. */
export function playCombatMomentAudio(momentId, { sound = true, ...options } = {}) {
  const animation = combatMomentAudioPresentation(momentId, options);
  playChoreography(animation, sound);
  return animation;
}

export function playStinger(rival,enabled){
 if(!enabled)return;try{audioContext();const now=context.currentTime,root=[82.4,65.4,110,98,73.4,61.7][rival.district||0];
 const intervals=rival.boss?[0,7,3,12]:rival.elite?[0,3,10]:[0,7];
 intervals.forEach((n,i)=>note(root*Math.pow(2,n/12),now+i*.11,rival.boss?.65:.3,.08,'triangle'));
 if(rival.boss)noise(now+.1,.4,.08,500);else if(rival.elite)kick(now,master,.18);
 }catch{}
}
