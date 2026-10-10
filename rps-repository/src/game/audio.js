import { battleSoundProfile } from "./audioProfile.js";
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
function audioContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain();
    master.gain.value = audioEnabled ? volume : 0;
    master.connect(context.destination);
    if (context.createAnalyser) {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(analyser);
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
  };
}
function noise(time, duration, amplitude, frequency, destination = master) {
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
  filter.type = "highpass";
  filter.frequency.value = frequency;
  gain.gain.value = amplitude;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
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
    const impact =
      now + (finalAttempt.duration / 1000) * (finalAttempt.impactAt ?? 0.64);
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
  const bass = [0, 0, 7, 0, 3, 3, 10, 7, 0, 0, 7, 12, 5, 5, 7, 3];
  const lead = [12, 19, 15, 22, 19, 15, 10, 7, 12, 15, 19, 24, 22, 19, 15, 10];
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
    const intensity = Math.min(1.4, battleMix.intensity + build * 0.6 + bossLayer*.09),
      bpm = 108 + battleMix.intensity * 34 + build * 48;
    const tick = 60 / bpm / 2;
    if (context.state === "running" && !quiet) {
      // An original sixteen-bar arrangement: drums, bass, chords and a lead.
      if (step % 2 === 0 || (intensity > 0.65 && step % 8 === 7))
        kick(now, filter, 0.28 + intensity * 0.08);
      if (step % 8 === 2 || step % 8 === 6) {
        noise(now, 0.18, 0.18, 1000, filter);
        note(185, now, 0.08, 0.035, "triangle", filter);
      }
      noise(now, 0.045, step % 2 ? 0.035 : 0.025, 5500, filter);
      if (intensity > 0.45) noise(now + tick / 2, 0.026, 0.025, 6200, filter);
      const frequency = base * Math.pow(2, bass[step % 16] / 12);
      note(frequency, now, 0.22, 0.105, "sawtooth", filter);
      note(frequency / 2, now, 0.24, 0.06, "sine", filter);
      if (step % 16 === 0) {
        const chord = [0, 3, 7, 10];
        chord.forEach((n, i) =>
          note(
            base * 2 * Math.pow(2, n / 12),
            now + i * 0.018,
            tick * 13,
            0.018,
            "triangle",
            filter,
          ),
        );
      }
      if (step % 2 === 0 || intensity > 0.4) {
        const n =
          lead[(Math.floor(step / 2) + Math.floor((level - 1) / 6) * 3) % 16];
        note(
          base * 4 * Math.pow(2, n / 12),
          now,
          0.2,
          0.025 + intensity * 0.025,
          "triangle",
          filter,
        );
      }
      if (build > 0.2) noise(now, 0.04, 0.035 + build * 0.07, 2200, filter);
      if(bossLayer&&step%4===0){note(base/2,now,.4,.08,'triangle',filter);noise(now,.08,.04+bossLayer*.015,700,filter);}
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
// Original weapon voices: attack timings come from the same authored timeline
// as pose/camera. Each recipe layers a transient, body and pitched tail.
export function playChoreography(a,enabled){
 if(!enabled)return;
 try{
  audioContext();const start=context.currentTime,impact=start+a.duration*a.impactAt/1000;
  const recipe=a.vfx||'',hash=[...recipe].reduce((n,c)=>n+c.charCodeAt(0),0);
  const pitch=1+(hash%13-6)*.018,style=a.style;
  noise(start+.05,.14,.045,style==='brawler'?350:1300);
  note((style==='mage'?260:style==='archer'?160:92)*pitch,start+.12,.30,.03,'triangle');
  const travel=start+a.duration*.30/1000;
  noise(travel,.22,.06,style==='glaive'?900:1900);
  noise(impact,a.finisher?.35:.16,a.finisher?.24:.13,style==='blades'?2400:style==='archer'?3200:450);
  note((style==='mage'?196:style==='archer'?390:style==='blades'?180:58)*pitch,impact,a.finisher?.65:.25,.10,style==='mage'?'sine':'triangle');
  if(style==='blades'||style==='glaive')note(720*pitch,impact+.015,.13,.04,'triangle');
  if(a.finisher)kick(impact,master,.36);
 }catch{}
}

export function playStinger(rival,enabled){
 if(!enabled)return;try{audioContext();const now=context.currentTime,root=[82.4,65.4,110,98,73.4,61.7][rival.district||0];
 const intervals=rival.boss?[0,7,3,12]:rival.elite?[0,3,10]:[0,7];
 intervals.forEach((n,i)=>note(root*Math.pow(2,n/12),now+i*.11,rival.boss?.65:.3,.08,'triangle'));
 if(rival.boss)noise(now+.1,.4,.08,500);else if(rival.elite)kick(now,master,.18);
 }catch{}
}
