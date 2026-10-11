import { FIGHTERS, fighterFor } from './fighters.js';

// This stream is presentation only. Never use it to generate an engine enemy,
// a forecast, damage, rewards, or a saved combat field.
const KITS = FIGHTERS.map(fighter => fighter.id);
export const RIVAL_NAMES = Object.freeze({
  echo: ['Rill Vane', 'Asha Slip', 'Dara Edge', 'Kest Nacre', 'Iris Pell', 'Nell Shard', 'Mara Flint', 'Vera Sheath'],
  cinder: ['Orin Brask', 'Tarn Knuckle', 'Holt Char', 'Bram Cask', 'Dessa Coal', 'Pell Forge', 'Merr Ash', 'Ivo Anvil'],
  nyx: ['Liora Facet', 'Anwen Fold', 'Sivra Tessell', 'Oriel Wisp', 'Uma Lens', 'Della Refract', 'Sere Loom', 'Eira Vell'],
  vex: ['Reed Fletch', 'Mira Nock', 'Tallis Quill', 'Fenn Shaft', 'Lark Spoke', 'Rhea Range', 'Hali Feather', 'Neri Point'],
  kuro: ['Rook Halberd', 'Isla Pike', 'Toma Reed', 'Varr Pole', 'Vara Storm', 'Keld Reach', 'Ouma Sweep', 'Gareth Gale'],
});

export const RIVAL_PALETTES = Object.freeze([
  { id: 'oxblood', color: '#c44650', shadow: '#25141b', metal: '#b69a91', hue: 354 },
  { id: 'kiln', color: '#d26e30', shadow: '#271811', metal: '#b4a08b', hue: 23 },
  { id: 'brass', color: '#b5a448', shadow: '#232017', metal: '#b8b6a0', hue: 51 },
  { id: 'citron', color: '#a4bd30', shadow: '#202518', metal: '#a6aaa0', hue: 71 },
  { id: 'malachite', color: '#3ba95b', shadow: '#10231b', metal: '#99b1a8', hue: 138 },
  { id: 'verdigris', color: '#288f72', shadow: '#10251f', metal: '#acb7ad', hue: 163 },
  { id: 'petrol', color: '#2199b5', shadow: '#11232b', metal: '#9dacb5', hue: 191 },
  { id: 'cobalt', color: '#4d8cdb', shadow: '#151d30', metal: '#b0b7c3', hue: 213 },
  { id: 'iris', color: '#6767d6', shadow: '#1b1932', metal: '#b0adbf', hue: 240 },
  { id: 'amethyst', color: '#9c52cb', shadow: '#271530', metal: '#baabc2', hue: 277 },
  { id: 'orchid', color: '#c24791', shadow: '#2c1524', metal: '#c3a7b6', hue: 324 },
  { id: 'copper', color: '#bf7853', shadow: '#281c18', metal: '#b1a29b', hue: 21 },
]);

const outfitParts = {
  echo: [['cape', 'mask', 'runner'], ['vest', 'visor', 'courier'], ['coat', 'paint', 'blade-keeper']],
  cinder: [['vest', 'plates', 'pit-fighter'], ['apron', 'visor', 'furnace-hand'], ['coat', 'collar', 'breaker']],
  nyx: [['veil', 'rings', 'survey'], ['cape', 'visor', 'glass-keeper'], ['hood', 'collar', 'prism-weaver']],
  vex: [['vest', 'scarf', 'scout'], ['hood', 'visor', 'lookout'], ['coat', 'antenna', 'range-keeper']],
  kuro: [['coat', 'plates', 'pole-guard'], ['cape', 'mask', 'storm-keeper'], ['vest', 'rings', 'crossing-guard']],
};
const titles = {
  echo: ['Underpass runner', 'Mirror courier', 'Knife keeper'],
  cinder: ['Pit fighter', 'Furnace hand', 'Street breaker'],
  nyx: ['Vault surveyor', 'Glass keeper', 'Prism weaver'],
  vex: ['Night scout', 'Roof lookout', 'Range keeper'],
  kuro: ['Pole guard', 'Storm keeper', 'Crossing guard'],
};
const taunts = {
  echo: ['Keep your eyes on both hands.', 'One opening is enough.', 'You blinked.'],
  cinder: ['Keep your feet under you.', 'Put your guard up.', 'The floor holds. Do you?'],
  nyx: ['Watch the angle.', 'Every line meets somewhere.', 'There is room for one more.'],
  vex: ['Stand wherever you like.', 'I have the distance.', 'The next one is yours.'],
  kuro: ['Hold your line.', 'Too close.', 'The rain will clear the blade.'],
};

function boss(id, name, title, weapon, scale, cue, signature, motif, phaseNames, dissolve) {
  return Object.freeze({
    id, model: id, name, title, weapon, scale, cue, signature,
    signatureId: signature.toLowerCase().replaceAll(' ', '-'),
    telegraph: Object.freeze({ duration: 1, motif }), dissolve,
    phases: Object.freeze(phaseNames.map((phaseName, i) => Object.freeze({ at: [1, .66, .33][i], name: phaseName }))),
  });
}
export const BOSS_PROFILES = Object.freeze({
  thermal: boss('crucible-9', 'CRUCIBLE-9', 'The Smelt Saint', 'Ladle scythe', 1.65, 'furnace', 'Pour', 'ladle', ['Furnace vows', 'Burning robes', 'Open furnace'], 'ash'),
  siphon: boss('sable', 'SABLE', 'The Siphon Matron', 'Siphon-needle rapier', 1.6, 'siphon', 'Drain', 'cables', ['Tethered lights', 'Red threads', 'Six cable arms'], 'ribbon'),
  plating: boss('bulwark', 'BULWARK', 'Warden Ironveil', 'Tower-shield hammer', 1.7, 'siege', 'Bastion slam', 'plates', ['Siege shell', 'Split shield', 'Iron exposed'], 'shatter'),
  redline: boss('redline', 'REDLINE', 'Revenant Kestrel', 'Heartline blades', 1.5, 'heartbeat', 'Triple lunge', 'heart', ['Quiet pulse', 'Open vents', 'Redline heart'], 'ash'),
  blackout: boss('cipher', 'CIPHER', 'The Static Wraith', 'Signal shear', 1.6, 'static', 'Desync', 'signal-tear', ['False signal', 'Three echoes', 'Signal tear'], 'shatter'),
  mirror: boss('onyx', 'ONYX', 'The Hollow Mirror', 'Mirror edge', 1.65, 'mirror', 'Echo move', 'last-hand', ['Black glass', 'Your negative', 'Living reflection'], 'slice'),
});
const bossTaunts = {
  'crucible-9': 'The fire keeps its vows.', sable: 'Every light has a debt.', bulwark: 'The gate holds.',
  redline: 'Listen to the second beat.', cipher: 'You saw the other one.', onyx: 'I have already seen your hand.',
};

function stream(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), n | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(items, seed, bag, salt) {
  const out = items.slice(), rng = stream((seed ^ salt ^ Math.imul(bag + 1, 0x9e3779b1)) >>> 0);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function bagItem(items, seed, floor, salt) {
  const index = floor - 1, bag = Math.floor(index / items.length);
  const current = shuffled(items, seed, bag, salt);
  // Swapping the first two slots preserves the last slot, so the previous
  // raw bag's last slot is also its final last slot. No recursive RNG stream.
  if (bag > 0 && current[0] === shuffled(items, seed, bag - 1, salt).at(-1)) {
    [current[0], current[1]] = [current[1], current[0]];
  }
  return current[index % items.length];
}
function hueFor(color) {
  const value = String(color).replace('#', ''), parts = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  const hi = Math.max(...parts), lo = Math.min(...parts), d = hi - lo;
  if (!Number.isFinite(d) || d === 0) return null;
  const [r, g, b] = parts;
  const h = hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// The HUD/wardrobe notches follow the art brief at 66% and 33%. The engine's
// existing phaseFor remains 65% and 30% for damage, signatures and saved runs.
export function visualPhaseFor(enemy) {
  if (!enemy?.boss || !(enemy.maxHp > 0)) return 0;
  const health = enemy.hp / enemy.maxHp;
  return health <= .33 ? 2 : health <= .66 ? 1 : 0;
}

export function rivalProfile(seed, level, legacyEnemy = {}, player) {
  const floor = Math.max(1, Math.floor(level));
  const kit = bagItem(KITS, seed >>> 0, floor, 0x5eedca11);
  const kitFighter = fighterFor(kit);
  const rng = stream((seed ^ 0xa714c9e3 ^ Math.imul(floor, 131)) >>> 0);
  const outfit = Math.floor(rng() * 3), head = Math.floor(rng() * 4), accessory = Math.floor(rng() * 2);
  const playerColor = typeof player === 'string' ? fighterFor(player).color : player?.color;
  const playerHue = playerColor ? hueFor(playerColor) : null;
  const palettes = RIVAL_PALETTES.filter(p => playerHue === null || Math.min(Math.abs(p.hue - playerHue), 360 - Math.abs(p.hue - playerHue)) > 24);
  const palette = bagItem(palettes, seed >>> 0, floor, 0xd1e6a771);
  const isBoss = legacyEnemy.boss ?? floor % 5 === 0;
  const tier = isBoss ? 'boss' : floor % 5 === 3 || legacyEnemy.elite ? 'miniboss' : floor % 5 === 2 ? 'elite' : 'grunt';
  const abilityId = typeof legacyEnemy.ability === 'string' ? legacyEnemy.ability : legacyEnemy.ability?.id;
  const bossProfile = isBoss ? BOSS_PROFILES[abilityId] : null;
  const [layer, detail, theme] = outfitParts[kit][outfit];
  const personality = legacyEnemy.pattern ?? legacyEnemy.rival?.personality ?? 'methodical';
  const personalityKind = ['aggressive', 'aggressor'].includes(personality) ? 'BRUTE' : ['adaptive', 'mimic', 'patient', 'bluffer'].includes(personality) ? 'MIMIC' : 'CLOCKWORK';
  const name = bossProfile?.name ?? RIVAL_NAMES[kit][Math.floor(rng() * RIVAL_NAMES[kit].length)];
  const title = bossProfile?.title ?? (tier === 'miniboss' ? `${titles[kit][outfit]} · gatekeeper` : titles[kit][outfit]);
  const selectedTaunts = bossProfile ? [bossTaunts[bossProfile.id]] : taunts[kit].slice();
  return {
    id: bossProfile?.id ?? `rival-${kit}-${floor}`, bossId: bossProfile?.id ?? null, bossProfile,
    kit, character: kit, name, title, weapon: bossProfile?.weapon ?? kitFighter.weapon,
    serial: legacyEnemy.serial ?? `MK.${String(100 + Math.floor(rng() * 899))}`,
    look: { outfit, head, accessory, variant: outfit * 8 + head * 2 + accessory },
    wardrobe: { layer, detail, theme }, lookSeed: (seed + Math.imul(floor, 283)) >>> 0,
    palette, color: palette.color, tier, boss: isBoss, elite: tier === 'elite' || tier === 'miniboss',
    scale: bossProfile?.scale ?? (tier === 'miniboss' ? 1.25 : tier === 'elite' ? 1.1 : 1),
    personality, personalityKind, personalityInfo: legacyEnemy.rival?.personalityInfo,
    entrance: { duration: isBoss ? 5 : 2.6, cue: bossProfile?.cue ?? kit, taunt: selectedTaunts[0], skippable: true },
    taunt: selectedTaunts[0], taunts: selectedTaunts,
    model: bossProfile?.model, signature: bossProfile?.signature, signatureId: bossProfile?.signatureId,
    telegraph: bossProfile?.telegraph, phases: bossProfile?.phases ?? [], phase: visualPhaseFor(legacyEnemy),
    phaseDuration: 3, dissolve: bossProfile?.dissolve,
  };
}
