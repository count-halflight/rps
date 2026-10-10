const ratio = (value) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
export function battleSoundProfile(enemyIntegrity = 1, playerIntegrity = 1) {
  const enemy = ratio(enemyIntegrity),
    player = ratio(playerIntegrity);
  const intensity = 1 - enemy;
  return {
    intensity,
    bpm: 84 + intensity * 72,
    musicGain: 0.8 + intensity * 0.65,
    cutoff: 220 + Math.pow(player, 1.7) * 3200,
    heartbeatBpm: 80 + (1 - player) * 65,
    heartbeatGain: player < 0.45 ? (1 - player / 0.45) * 0.075 : 0,
  };
}

// Original instrument palettes. The final blow and the preceding sequence use
// the same voice, rather than attaching one identical explosion to every move.
const FINAL_VOICES = {
  'echo.rock.final': { voice: 'breaker', root: 118, tail: [1, 2.67, 4.12], pan: -.45 },
  'echo.paper.final': { voice: 'mirror', root: 174, tail: [1, 1.5, 2.25], pan: .55 },
  'echo.scissors.final': { voice: 'flurry', root: 210, tail: [1, 2, 3.01], pan: 0 },
  'cinder.rock.final': { voice: 'orbital', root: 61, tail: [1, 1.5, 2, 3], pan: -.65 },
  'cinder.paper.final': { voice: 'overload', root: 73, tail: [1, 2, 3.98], pan: .4 },
  'cinder.scissors.final': { voice: 'tectonic', root: 43, tail: [1, 1.51, 2.08], pan: -.2 },
  'nyx.rock.final': { voice: 'crystal', root: 392, tail: [1, 1.26, 1.89], pan: .45 },
  'nyx.paper.final': { voice: 'void', root: 38, tail: [1, 2.03, 3.11], pan: 0 },
  'nyx.scissors.final': { voice: 'integral', root: 196, tail: [1, 1.25, 1.5, 2], pan: -.35 },
  'vex.rock.final': { voice: 'meteor', root: 82, tail: [1, 2.67, 4], pan: -.55 },
  'vex.paper.final': { voice: 'constellation', root: 330, tail: [1, 1.33, 2], pan: .6 },
  'vex.scissors.final': { voice: 'starfall', root: 247, tail: [1, 1.5, 2.25], pan: 0 },
  'kuro.rock.final': { voice: 'thunder', root: 49, tail: [1, 1.5, 2.01], pan: -.4 },
  'kuro.paper.final': { voice: 'rift', root: 146, tail: [1, 1.5, 2.82], pan: 0 },
  'kuro.scissors.final': { voice: 'turbine', root: 92, tail: [1, 2.23, 3.74], pan: .35 },
  'echo.rock.final-alt': { voice: 'timefracture', root: 220, tail: [1, 1.4, 2.1], pan: -.65 },
  'echo.paper.final-alt': { voice: 'guillotine', root: 103, tail: [1, 2.76, 4.32], pan: .5 },
  'echo.scissors.final-alt': { voice: 'threadmaze', root: 523, tail: [1, 1.26, 1.5], pan: -.4 },
  'cinder.rock.final-alt': { voice: 'railcannon', root: 55, tail: [1, 2, 3.11], pan: .4 },
  'cinder.paper.final-alt': { voice: 'suncore', root: 165, tail: [1, 1.25, 1.5, 2], pan: 0 },
  'cinder.scissors.final-alt': { voice: 'magnetic', root: 87, tail: [1, 2.01, 2.98], pan: -.55 },
  'nyx.rock.final-alt': { voice: 'cathedral', root: 294, tail: [1, 2.41, 3.86], pan: -.3 },
  'nyx.paper.final-alt': { voice: 'origami', root: 349, tail: [1, 1.5, 2.25], pan: .5 },
  'nyx.scissors.final-alt': { voice: 'gravitywell', root: 33, tail: [1, 1.48, 2.09], pan: 0 },
  'vex.rock.final-alt': { voice: 'tidal', root: 65, tail: [1, 1.51, 2.02], pan: -.55 },
  'vex.paper.final-alt': { voice: 'tether', root: 440, tail: [1, 2.04, 3.02], pan: .6 },
  'vex.scissors.final-alt': { voice: 'starlance', root: 659, tail: [1, 1.33, 2], pan: -.35 },
  'kuro.rock.final-alt': { voice: 'chronoblade', root: 185, tail: [1, 2.4, 3.68], pan: .4 },
  'kuro.paper.final-alt': { voice: 'serpent', root: 123, tail: [1, 1.5, 3], pan: -.6 },
  'kuro.scissors.final-alt': { voice: 'aurora', root: 262, tail: [1, 1.25, 1.89, 2.5], pan: 0 },
};
const STYLE_VOICES = {
  blades: { voice: 'blade', root: 168, tail: [1, 2.67], pan: -.4 },
  brawler: { voice: 'fist', root: 58, tail: [1, 1.52], pan: .25 },
  mage: { voice: 'spell', root: 262, tail: [1, 1.5, 2], pan: 0 },
  archer: { voice: 'arrow', root: 330, tail: [1, 2.04], pan: .5 },
  glaive: { voice: 'glaive', root: 110, tail: [1, 2.3, 3.9], pan: -.25 },
};

export function choreographySoundProfile(animation = {}) {
  const palette = FINAL_VOICES[animation.sequenceId] || STYLE_VOICES[animation.style] || STYLE_VOICES.blades;
  const recipe = animation.vfx || animation.sequenceId || '';
  const hash = [...recipe].reduce((value, letter) => value + letter.charCodeAt(0), 0);
  const pitch = 1 + ((hash % 13) - 6) * .018;
  return {
    ...palette,
    root: palette.root * pitch,
    // No palette or attack data is mutated while scheduling audio.
    tail: [...palette.tail],
    brightness: 600 + (hash % 9) * 260,
    weight: animation.finisher ? 1 : animation.variant === 2 ? .8 : .58,
  };
}

// Six original score charts. Notes are scale degrees; -1 is a deliberate rest.
// Eight eighth-note steps make a bar. Each theme has its own harmony, groove,
// instrumentation and phrasing instead of a transposed copy of one loop.
export const DISTRICT_SCORES = [
  {
    name: 'Rain on the line', root: 38, bpm: 102, swing: .12,
    scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 6], chord: [0, 3, 7, 10],
    bass: [0, -1, 0, 4, -1, 0, 2, -1], lead: [7, -1, 9, 8, 4, -1, 6, 4, 7, 11, -1, 9, 8, -1, 6, 4],
    kick: [0, 3, 6], snare: [2, 6], hats: [0, 1, 2, 3, 4, 5, 6, 7],
    bassWave: 'triangle', leadWave: 'sine', voice: 'rain',
  },
  {
    name: 'Red furnace', root: 41, bpm: 121, swing: 0,
    scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 1, 0, 5], chord: [0, 3, 7],
    bass: [0, 0, -1, 1, 0, 0, 4, -1], lead: [7, 7, -1, 8, 7, 4, -1, 3, 7, -1, 11, 8, 7, 4, 3, -1],
    kick: [0, 2, 4, 6], snare: [2, 6], hats: [0, 2, 3, 4, 6, 7],
    bassWave: 'sawtooth', leadWave: 'triangle', voice: 'kiln',
  },
  {
    name: 'Glass orbits', root: 39, bpm: 88, swing: .025,
    scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 2, 5, 4], chord: [0, 4, 7, 11],
    bass: [0, -1, -1, 4, -1, 2, -1, -1], lead: [7, -1, 11, -1, 9, -1, 8, 4, 7, 9, -1, 13, 11, -1, 9, -1],
    kick: [0, 5], snare: [4], hats: [0, 2, 5, 7],
    bassWave: 'sine', leadWave: 'sine', voice: 'prism',
  },
  {
    name: 'Lantern runners', root: 45, bpm: 113, swing: .18,
    scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 3, 5, 4], chord: [0, 3, 7, 9],
    bass: [0, -1, 2, -1, 4, 0, -1, 6], lead: [7, -1, 8, 11, -1, 9, 7, -1, 6, 4, -1, 7, 8, -1, 11, 9],
    kick: [0, 3, 5], snare: [2, 6], hats: [1, 2, 3, 5, 6, 7],
    bassWave: 'triangle', leadWave: 'triangle', voice: 'market',
  },
  {
    name: 'Roots in the wires', root: 36, bpm: 96, swing: .07,
    scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 5, 2, 0], chord: [0, 3, 7],
    bass: [0, -1, 0, -1, 4, -1, 2, 0], lead: [7, -1, 9, 7, -1, 4, 2, -1, 7, 9, 11, -1, 9, 7, -1, 4],
    kick: [0, 4, 7], snare: [3, 6], hats: [0, 3, 4, 6],
    bassWave: 'sine', leadWave: 'triangle', voice: 'root',
  },
  {
    name: 'Undertow', root: 35, bpm: 144, swing: .04,
    scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], chord: [0, 3, 7, 10],
    bass: [0, -1, 4, 0, -1, 6, 4, -1], lead: [11, 9, -1, 7, 8, -1, 9, 4, 7, -1, 11, 13, 11, 9, -1, 8],
    kick: [0, 3, 4], snare: [2, 6], hats: [0, 1, 2, 3, 4, 5, 6, 7],
    bassWave: 'sawtooth', leadWave: 'sine', voice: 'tide',
  },
];
const SCORE_SECTIONS = [
  { name: 'intro', bars: 2, drums: .65, bass: .8, lead: .55, pads: .8 },
  { name: 'verse', bars: 6, drums: .9, bass: 1, lead: .8, pads: .55 },
  { name: 'lift', bars: 4, drums: 1, bass: 1, lead: 1, pads: .65 },
  { name: 'breakdown', bars: 4, drums: .2, bass: .55, lead: .7, pads: 1 },
  { name: 'reprise', bars: 8, drums: 1, bass: 1, lead: 1, pads: .6 },
  { name: 'finale', bars: 4, drums: 1.1, bass: 1, lead: 1.1, pads: .7 },
];
export function scoreForFloor(floor = 1) {
  const level = Math.max(1, Math.floor(Number.isFinite(floor) ? floor : 1));
  return { ...DISTRICT_SCORES[(level - 1) % 6], variation: Math.floor((level - 1) / 6) };
}
export function scoreSection(bar = 0) {
  let current = ((Math.floor(bar) % 28) + 28) % 28;
  for (const section of SCORE_SECTIONS) {
    if (current < section.bars) return section;
    current -= section.bars;
  }
  return SCORE_SECTIONS[0];
}
