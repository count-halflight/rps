const clamp = (value, fallback = 0) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const smooth = value => value * value * (3 - 2 * value);

export const CINEMATIC_ENVIRONMENT_DEFAULTS = Object.freeze({
  lightDrain: 0, relightWave: 0, ripple: 0, slice: 0, sky: 0, blackout: 0, warm: 0,
  focus: Object.freeze([0, 1.5, 0]), slicePlane: Object.freeze([.18, 1, .12, -4.5]),
});

/** Presentation state only. It never reads or advances combat/save randomness. */
export function normalizeEnvironmentCinematic(input = {}) {
  const state = {};
  for (const key of ['lightDrain', 'relightWave', 'ripple', 'slice', 'sky', 'blackout', 'warm']) state[key] = clamp(input?.[key]);
  state.focus = Array.from({ length: 3 }, (_, i) => Number.isFinite(input?.focus?.[i]) ? input.focus[i] : CINEMATIC_ENVIRONMENT_DEFAULTS.focus[i]);
  state.slicePlane = Array.from({ length: 4 }, (_, i) => Number.isFinite(input?.slicePlane?.[i]) ? input.slicePlane[i] : CINEMATIC_ENVIRONMENT_DEFAULTS.slicePlane[i]);
  const magnitude = Math.hypot(...state.slicePlane.slice(0, 3));
  if (magnitude < .0001) state.slicePlane = [...CINEMATIC_ENVIRONMENT_DEFAULTS.slicePlane];
  else state.slicePlane = state.slicePlane.map(value => value / magnitude);
  return state;
}

export function environmentLightState(options = {}, time = 0) {
  const ratio = clamp(options.rivalHpRatio, 1), player = clamp(options.playerHpRatio, 1);
  const cinematic = normalizeEnvironmentCinematic(options.cinematic);
  const stage = ratio > .75 ? 0 : ratio > .5 ? 1 : ratio > .25 ? 2 : ratio > 0 ? 3 : 4;
  const elapsed = Number.isFinite(options.defeatElapsed) ? Math.max(0, options.defeatElapsed) : 0;
  const relight = stage === 4 ? smooth(clamp((elapsed - .4) / 1.8)) : 0;
  const wave = Math.max(relight, cinematic.relightWave);
  const drain = (1 - cinematic.lightDrain * .92) * (1 - cinematic.blackout);
  const practical = [1, 1, 0, 0, 0][stage] * drain;
  const neon = [1, .88, .8, .055, 0][stage] * drain;
  const arenaStrength = Math.max([1, .74, .3, .09, 0][stage] * drain, wave * .8);
  return {
    stage, ratio, playerRatio: player, practical, neon, arenaStrength, relightWave: wave,
    blackout: (stage === 4 && elapsed < .4) || cinematic.blackout > .98,
    warm: Math.max(wave, cinematic.warm), drain: cinematic.lightDrain,
    fighterStrength: stage < 3 ? 1 : stage === 3 ? 1.2 : wave > 0 ? 1 : 0,
    playerPulse: player < .3 ? (.5 + .5 * Math.sin(time * 5.4)) * (1 - player / .3) : 0,
    desaturation: player < .3 ? (1 - player / .3) * .35 : 0,
    cinematic,
  };
}

/** Local practicals fade once; there is no large-area strobe or random flicker. */
export function fixtureLightFactor(state, index, position = [0, 0, 0], family = 'practical') {
  const ordinary = family === 'neon' ? state.neon : state.practical * (state.stage === 1 && index % 3 === 1 ? 0 : 1);
  const arrival = Math.min(.88, Math.hypot(position[0], position[2]) / 65);
  const wave = smooth(clamp((state.relightWave - arrival) / .12));
  return Math.max(ordinary, wave);
}
