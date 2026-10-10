import { battleSoundProfile } from "./audioProfile.js";
let context,
  master,
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
function audioContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain();
    master.gain.value = audioEnabled ? volume : 0;
    master.connect(context.destination);
  }
  context.resume().catch(() => {});
  if (ambientRequested && !ambient) setAmbience(true, ambientFloor);
  return context;
}
export function configureAudio(percent, enabled = true) {
  volume = Math.max(0, Math.min(1, percent / 100));
  audioEnabled = enabled;
  if (context && master)
    master.gain.setTargetAtTime(audioEnabled ? volume : 0, context.currentTime, 0.02);
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
    const impact = now + (finalAttempt.duration / 1000) * 0.43;
    anticipation = { start: now, impact, quiet: Math.max(now, impact - 0.22) };
    ambient.gain.cancelScheduledValues(now);
    ambient.gain.setValueAtTime(battleMix.musicGain, now);
    ambient.gain.linearRampToValueAtTime(
      battleMix.musicGain * 1.25,
      anticipation.quiet - 0.04,
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
) {
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.01);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
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
  const base = [55, 65.406, 73.416, 82.407, 61.735, 58.27][(level - 1) % 6];
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = battleMix.cutoff;
  filter.Q.value = 0.7;
  filter.connect(ambient);
  musicFilter = filter;
  musicNodes.push(filter);
  [1, 1.5, 2.002].forEach((ratio, i) => {
    const osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = i ? "sine" : "triangle";
    osc.frequency.value = base * ratio;
    gain.gain.value = i ? 0.014 : 0.027;
    osc.connect(gain);
    gain.connect(filter);
    osc.start();
    musicNodes.push(osc, gain);
  });
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
              (anticipation.quiet - anticipation.start),
          ),
        )
      : 0;
    const quiet =
      anticipation && now >= anticipation.quiet && now < anticipation.impact;
    const intensity = Math.min(1.4, battleMix.intensity + build * 0.45);
    const bpm = battleMix.bpm + build * 40;
    if (context.state === "running" && !quiet) {
      const pattern = [0, 7, 12, 7, 0, 7, 15, 12];
      const pitch = base * 4 * Math.pow(2, pattern[step % 8] / 12);
      note(
        pitch,
        now,
        0.22,
        0.018 + intensity * 0.02,
        intensity > 0.7 ? "triangle" : "sine",
        filter,
      );
      if (step % 4 === 0)
        note(base, now, 0.17, 0.03 + intensity * 0.04, "triangle", filter);
      if (intensity > 0.65 && step % 2 === 1)
        note(pitch * 2, now + 60 / bpm / 4, 0.11, 0.014, "sine", filter);
      step++;
    }
    musicTimer = setTimeout(pulse, 60000 / bpm / 2);
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
