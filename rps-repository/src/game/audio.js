import { battleSoundProfile, choreographySoundProfile, scoreForFloor, scoreSection } from "./audioProfile.js";
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
let musicInfo = { score: 'Rain on the line', section: 'intro', bar: 0 };
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
    rms,
    ...battleMix,
    ...musicInfo,
  };
}
function voiceRoute(node, destination, pan = 0) {
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
function noise(time, duration, amplitude, frequency, destination = master, pan = 0, band = "highpass") {
  if (!context.createBuffer) return;
  const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    ),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 5);
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
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    disconnectRoute();
  };
}
function kick(time, destination, amplitude = 0.25) {
  const osc = context.createOscillator(),
    g = context.createGain();
  osc.frequency.setValueAtTime(130, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
  g.gain.setValueAtTime(amplitude, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(g);
  g.connect(destination);
  osc.start(time);
  osc.stop(time + 0.23);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}
export function configureAudio(percent, enabled = true) {
  volume = Math.max(0, Math.min(1, percent / 100));
  audioEnabled = enabled;
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
  if (finalAttempt && lastAnticipationId !== finalAttempt.id) {
    lastAnticipationId = finalAttempt.id;
    const elapsed = Number.isFinite(finalAttempt.startedAt)
      ? Math.max(0, performance.now() - finalAttempt.startedAt) / 1000
      : 0;
    const impact =
      now + Math.max(0, (finalAttempt.duration / 1000) * (finalAttempt.impactAt ?? 0.64) - elapsed);
    anticipation = { start: now, impact, quiet: Math.max(now, impact - 0.22) };
    ambient.gain.cancelScheduledValues(now);
    ambient.gain.setValueAtTime(battleMix.musicGain, now);
    ambient.gain.linearRampToValueAtTime(
      battleMix.musicGain * 1.25,
      Math.max(now, anticipation.quiet - 0.04),
    );
    ambient.gain.linearRampToValueAtTime(0.0001, anticipation.quiet);
    ambient.gain.setValueAtTime(0.0001, impact);
    ambient.gain.linearRampToValueAtTime(
      battleMix.musicGain * 1.15,
      impact + 0.025,
    );
  } else if (!finalAttempt) {
    anticipation = null;
    lastAnticipationId = null;
    ambient.gain.cancelScheduledValues(now);
    ambient.gain.setTargetAtTime(battleMix.musicGain, now, 0.12);
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
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    disconnectRoute();
  };
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
  oscillator.onended = () => {
    oscillator.disconnect(); gain.disconnect(); disconnectRoute();
  };
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
  oscillator.onended = () => {
    oscillator.disconnect(); gain.disconnect(); disconnectRoute();
  };
}
function scaleNote(score, degree) {
  return score.scale[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12;
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
export function playTone(type, enabled, delay = 0) {
  if (!enabled) return;
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
      bpm = score.bpm + battleMix.intensity * 21 + build * 34 + bossLayer * 2;
    const tick = 60 / bpm / 2;
    if (context.state === "running" && !quiet) {
      const bar = Math.floor(step / 8), beat = step % 8;
      const cycle = Math.floor(bar / 28), section = scoreSection(bar);
      const variation = score.variation + cycle;
      const chordDegree = score.chords[(Math.floor(bar / 2) + variation) % score.chords.length];
      const chordOffset = scaleNote(score, chordDegree);
      musicInfo = { score: score.name, section: build > .2 ? 'finish build' : section.name, bar };
      scorePercussion(score, step, bar, now, tick, intensity, section, filter);
      const bassDegree = score.bass[(beat + (bar % 4 === 3 ? variation % 2 : 0)) % 8];
      if (bassDegree >= 0) {
        const frequency = base * Math.pow(2, (scaleNote(score, bassDegree) + chordOffset) / 12);
        const sync = beat % 2 ? tick * score.swing : 0;
        musicVoice(frequency, now + sync, tick * (score.voice === 'prism' ? 2.2 : .85), .062 * section.bass, score.bassWave, filter);
        musicVoice(frequency / 2, now + sync, tick * 1.1, .033 * section.bass, 'sine', filter);
      }
      if (beat === 0 && bar % 2 === 0) {
        score.chord.forEach((interval, index) =>
          musicVoice(base * 2 * Math.pow(2, (chordOffset + interval) / 12),
            now + index * .02, tick * 14, .015 * section.pads,
            score.voice === 'kiln' ? 'triangle' : 'sine', filter,
            (index - 1.5) * .24, true));
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
      if (bossLayer && beat % 4 === 0) {
        musicVoice(base / 2, now, .3, .04 + bossLayer * .008, 'triangle', filter);
        note(base * Math.pow(2, chordOffset / 12), now + .035, .23, .025, 'sawtooth', filter, -.3);
      }
      step++;
    }
    musicTimer = setTimeout(pulse, tick * 1000);
  };
  const heartbeat = () => {
    if (!ambient || !ambientRequested) return;
    if (context.state === "running" && battleMix.heartbeatGain > 0) {
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

let bossLayer=0;
export function setBossAudio(phase=0){bossLayer=Math.max(0,Math.min(3,phase));}
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
  if (!enabled) return;
  try {
    audioContext();
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
        if (time > impact - .23) return;
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
  }
}

export function playStinger(rival,enabled){
 if(!enabled)return;try{audioContext();const now=context.currentTime,root=[82.4,65.4,110,98,73.4,61.7][rival.district||0];
 const intervals=rival.boss?[0,7,3,12]:rival.elite?[0,3,10]:[0,7];
 intervals.forEach((n,i)=>note(root*Math.pow(2,n/12),now+i*.11,rival.boss?.65:.3,.08,'triangle'));
 if(rival.boss)noise(now+.1,.4,.08,500);else if(rival.elite)kick(now,master,.18);
 }catch{}
}
