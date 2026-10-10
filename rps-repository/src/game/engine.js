import { resourceProjection } from "./calculus.js";
export const WEAPONS = [
  {
    id: "rock",
    name: "Seismic",
    type: "Rock",
    tag: "Kinetic gauntlet",
    color: "#63e8cf",
    beats: "scissors",
    description: "Crushes pulse blades",
  },
  {
    id: "paper",
    name: "Veil",
    type: "Paper",
    tag: "Phase shield",
    color: "#9cabff",
    beats: "rock",
    description: "Absorbs kinetic force",
  },
  {
    id: "scissors",
    name: "Razor",
    type: "Scissors",
    tag: "Twin pulse blades",
    color: "#ffc580",
    beats: "paper",
    description: "Cuts through the veil",
  },
];
export const STANCES = [
  { id: "strike", name: "Strike", hint: "Balanced damage · +14 charge" },
  { id: "guard", name: "Guard", hint: "Half incoming damage · +22 charge" },
  {
    id: "overdrive",
    name: "Overdrive",
    hint: "Double damage · costs 40 charge",
  },
];
export const APEX_PROTOCOLS = [
  {
    id: "thermal",
    name: "Thermal rupture",
    detail:
      "Every exchange adds 10 extra heat. Guard and coolant keep the frame stable.",
  },
  {
    id: "siphon",
    name: "Siphon lattice",
    detail:
      "A losing exchange repairs 12 hostile integrity. Commit when the signal is strong.",
  },
  {
    id: "plating",
    name: "Reactive plating",
    detail:
      "Successful counters deal 20% less damage. Overdrive bypasses the plating.",
  },
  {
    id: "redline",
    name: "Redline core",
    detail:
      "At or below half integrity, this frame deals 30% more damage. Finish it decisively.",
  },
  {
    id: "blackout",
    name: "Signal blackout",
    detail:
      "Forecast accuracy is capped at 55%. Save your deep scan for a decisive strike.",
  },
  {
    id: "mirror",
    name: "Mirror protocol",
    detail:
      "Its next signal always counters your previous weapon. Avoid repeating instincts.",
  },
];
export const DISTRICTS = [
  {
    name: "The rain district",
    background: "afterlight-arena",
    zone: "Crosswalk 09",
    color: "#63e8cf",
    modifier: "Rainfall",
    detail: "Coolant rain clears 12 heat per turn.",
    cooling: 12,
  },
  {
    name: "Ember foundry",
    background: "ember-foundry",
    zone: "Furnace 42",
    color: "#ffaa73",
    modifier: "Heatwave",
    detail: "Hot air clears only 4 heat per turn.",
    cooling: 4,
  },
  {
    name: "The prism vault",
    background: "prism-vault",
    zone: "Sector 17",
    color: "#c0a3ff",
    modifier: "Inversion",
    detail: "The counter cycle is reversed. Read your weapons.",
    cooling: 10,
    reverse: true,
  },
  {
    name: "Ghost market",
    background: "ghost-market",
    zone: "Stall 88",
    color: "#f8bce0",
    modifier: "Bounty",
    detail: "Victories award 50% more credits.",
    cooling: 10,
    bounty: 1.5,
  },
  {
    name: "Signal garden",
    background: "signal-garden",
    zone: "Uplink 03",
    color: "#b2ec6e",
    modifier: "Feedback",
    detail: "A draw restores 8 integrity.",
    cooling: 10,
    healTie: true,
  },
  {
    name: "The black tide",
    background: "black-tide",
    zone: "Dock 61",
    color: "#76c8ff",
    modifier: "Static",
    detail: "Enemy signals are less reliable.",
    cooling: 10,
    static: true,
  },
];
export const UPGRADES = [
  {
    id: "power",
    name: "Impact amplifier",
    kind: "Offense",
    detail: "+5 counter damage before protocol bonuses.",
    icon: "power",
  },
  {
    id: "armor",
    name: "Ceramic subdermal",
    kind: "Defense",
    detail: "Reduce incoming damage by 3. Losing hits deal at least 2.",
    icon: "armor",
  },
  {
    id: "capacity",
    name: "Second heart",
    kind: "Survival",
    detail: "+20 max integrity. Recover 35 integrity.",
    icon: "heart",
  },
  {
    id: "coolant",
    name: "Cryo circulation",
    kind: "Thermal",
    detail: "Clear 6 extra heat every turn.",
    icon: "coolant",
  },
  {
    id: "battery",
    name: "Flux capacitor",
    kind: "Energy",
    detail: "Generate 6 more charge every turn.",
    icon: "battery",
  },
];
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function levelFor(seed, level) {
  const rng = random(seed + level * 7919);
  const district = { ...DISTRICTS[(level - 1) % DISTRICTS.length] };
  if (level > 6) {
    const anomaly = ["Compression", "Signal bleed", "Flux surge"][
      Math.floor(rng() * 3)
    ];
    district.anomaly = anomaly;
    if (anomaly === "Compression") {
      district.amplify = 1.25;
      district.detail += " Both frames deal 25% more damage.";
    }
    if (anomaly === "Signal bleed") {
      district.signalPenalty = 12;
      district.detail += " Signal accuracy drops by 12 points.";
    }
    if (anomaly === "Flux surge") {
      district.chargeBonus = 6;
      district.detail += " Every exchange generates 6 extra charge.";
    }
    district.modifier += ` / ${anomaly.toLowerCase()}`;
  }
  const names = [
    "Kuro",
    "Nyx",
    "Vanta",
    "Hollow",
    "Wraith",
    "Mako",
    "Cipher",
    "Vex",
    "Onyx",
    "Sable",
  ];
  const frames = ["Ronin", "Specter", "Sentinel", "Revenant", "Warden"];
  const boss = level % 5 === 0;
  const ability = boss
    ? APEX_PROTOCOLS[
        (Math.floor(level / 5) - 1 + (seed % APEX_PROTOCOLS.length)) %
          APEX_PROTOCOLS.length
      ]
    : null;
  const maxHp = 58 + level * 7 + (boss ? 28 : 0) + Math.floor(rng() * 10);
  const favorite = Math.floor(rng() * 3);
  return {
    level,
    district,
    boss,
    ability,
    name: `${names[Math.floor(rng() * names.length)]} ${frames[Math.floor(rng() * frames.length)]}`,
    serial: `MK.${String(Math.floor(rng() * 899) + 100)}`,
    maxHp,
    hp: maxHp,
    damage: 14 + Math.floor(level * 1.4) + (boss ? 7 : 0),
    favorite,
    signal: favorite,
    confidence:
      (ability?.id === "blackout" ? 55 : district.static ? 45 : 76) -
      (district.signalPenalty || 0),
    pattern: ["adaptive", "aggressive", "methodical"][Math.floor(rng() * 3)],
  };
}
export function newRun(
  seed = Math.floor(Math.random() * 2 ** 30),
  challenge = null,
) {
  return {
    version: 1,
    seed,
    challenge,
    level: 1,
    turn: 0,
    phase: "ready",
    hp: 100,
    maxHp: 100,
    charge: 20,
    heat: 0,
    credits: 0,
    combo: 0,
    bestCombo: 0,
    wins: 0,
    enemy: levelFor(seed, 1),
    upgrades: { power: 0, armor: 0, capacity: 0, coolant: 0, battery: 0 },
    history: [],
    scanned: null,
    repairUsed: false,
    scanUsed: false,
    result: null,
  };
}
export const weaponFor = (id) => WEAPONS.find((w) => w.id === id);
export function counterFor(id, reverse = false) {
  return WEAPONS.find((w) =>
    reverse ? weaponFor(id).beats === w.id : w.beats === id,
  );
}
export function damageFor(run, outcome, stance = "strike") {
  const win = outcome === "win",
    tie = outcome === "draw";
  const base = 23 + run.upgrades.power * 5 + Math.min(run.combo, 4) * 3;
  return Math.max(
    1,
    Math.round(
      (win ? base : tie ? 10 : 4) *
        (stance === "overdrive" ? 2 : stance === "guard" ? 0.72 : 1) *
        (run.heat >= 75 ? 0.7 : 1) *
        (win && run.enemy.ability?.id === "plating" && stance !== "overdrive"
          ? 0.8
          : 1) *
        (run.enemy.district.amplify || 1),
    ),
  );
}
export function resolveTurn(run, weaponId, stance = "strike") {
  if (
    run.phase !== "ready" ||
    !weaponFor(weaponId) ||
    !STANCES.some((s) => s.id === stance) ||
    (stance === "overdrive" && (run.charge < 40 || run.heat >= 75))
  )
    return run;
  const rng = random(run.seed + run.level * 1031 + run.turn * 997);
  const enemy = { ...run.enemy };
  const confidence = enemy.confidence / 100;
  const enemyIndex =
    rng() < confidence
      ? enemy.signal
      : (enemy.signal + 1 + Math.floor(rng() * 2)) % 3;
  const enemyWeapon = WEAPONS[enemyIndex];
  const win =
    counterFor(enemyWeapon.id, enemy.district.reverse).id === weaponId;
  const tie = enemyWeapon.id === weaponId;
  const outcome = tie ? "draw" : win ? "win" : "loss";
  const combo = win ? run.combo + 1 : 0;
  const damage = damageFor(run, outcome, stance);
  const incoming = Math.max(
    win ? 0 : tie ? 0 : 2,
    Math.round(
      (win ? 0 : tie ? 6 : enemy.damage) *
        (stance === "guard" ? 0.5 : 1) *
        (enemy.ability?.id === "redline" && enemy.hp <= enemy.maxHp / 2
          ? 1.3
          : 1) *
        (enemy.district.amplify || 1),
    ) -
      run.upgrades.armor * 3,
  );
  enemy.hp = Math.max(0, enemy.hp - damage);
  const enemyHealing =
    !win && !tie && enemy.hp > 0 && enemy.ability?.id === "siphon"
      ? Math.min(12, enemy.maxHp - enemy.hp)
      : 0;
  enemy.hp += enemyHealing;
  const hp = Math.min(
    run.maxHp,
    Math.max(0, run.hp - incoming + (tie && enemy.district.healTie ? 8 : 0)),
  );
  const phase = hp <= 0 ? "defeat" : enemy.hp <= 0 ? "upgrade" : "ready";
  const bounty =
    phase === "upgrade"
      ? Math.round(
          (120 + run.level * 20 + (enemy.boss ? 100 : 0)) *
            (enemy.district.bounty || 1),
        )
      : 0;
  const signalRoll = rng();
  enemy.signal =
    enemy.ability?.id === "mirror"
      ? WEAPONS.indexOf(counterFor(weaponId, enemy.district.reverse))
      : enemy.pattern === "methodical"
        ? (enemy.signal + 1) % 3
        : enemy.pattern === "adaptive" && signalRoll < 0.65
          ? WEAPONS.indexOf(counterFor(weaponId, enemy.district.reverse))
          : signalRoll < 0.55
            ? enemy.favorite
            : Math.floor(rng() * 3);
  enemy.confidence =
    (enemy.district.static
      ? 45
      : enemy.ability?.id === "blackout"
        ? 55
        : enemy.pattern === "methodical"
          ? 90
          : 68 + Math.floor(rng() * 18)) - (enemy.district.signalPenalty || 0);
  const result = {
    outcome,
    stance,
    playerWeapon: weaponId,
    enemyWeapon: enemyWeapon.id,
    damage,
    incoming,
    enemyHealing,
    healing:
      tie && enemy.district.healTie
        ? Math.min(8, Math.max(0, hp - (run.hp - incoming)))
        : 0,
    combo,
    bounty,
    id: run.turn + 1,
  };
  const projected = resourceProjection(run, stance);
  return {
    ...run,
    turn: run.turn + 1,
    phase,
    hp,
    enemy,
    combo,
    bestCombo: Math.max(run.bestCombo, combo),
    wins: run.wins + (win ? 1 : 0),
    charge: projected.charge,
    heat: projected.heat,
    credits: run.credits + bounty + (win ? 15 : 0),
    scanned: null,
    history: [result, ...run.history].slice(0, 5),
    result,
  };
}
export function scanSignal(run) {
  if (run.phase !== "ready" || run.charge < 30 || run.scanned || run.scanUsed)
    return run;
  const rng = random(run.seed + run.level * 1031 + run.turn * 997);
  const index =
    rng() < run.enemy.confidence / 100
      ? run.enemy.signal
      : (run.enemy.signal + 1 + Math.floor(rng() * 2)) % 3;
  return {
    ...run,
    charge: run.charge - 30,
    scanUsed: true,
    scanned: WEAPONS[index].id,
  };
}
export function repairFrame(run) {
  if (
    run.phase !== "ready" ||
    run.credits < 80 ||
    run.hp >= run.maxHp ||
    run.repairUsed
  )
    return run;
  return {
    ...run,
    credits: run.credits - 80,
    hp: Math.min(run.maxHp, run.hp + 30),
    repairUsed: true,
  };
}
export function chooseUpgrade(run, id) {
  if (run.phase !== "upgrade" || !UPGRADES.some((u) => u.id === id)) return run;
  const maxHp = run.maxHp + (id === "capacity" ? 20 : 0);
  return {
    ...run,
    upgrades: { ...run.upgrades, [id]: run.upgrades[id] + 1 },
    level: run.level + 1,
    phase: "ready",
    maxHp,
    hp: Math.min(maxHp, run.hp + (id === "capacity" ? 35 : 20)),
    charge: Math.min(100, run.charge + 10),
    heat: Math.max(0, run.heat - 35),
    combo: run.combo,
    enemy: levelFor(run.seed, run.level + 1),
    scanned: null,
    repairUsed: false,
    scanUsed: false,
    result: null,
    history: [],
  };
}
export function upgradeChoices(run) {
  const rng = random(run.seed + run.level * 919);
  return [...UPGRADES]
    .map((u) => ({ ...u, rank: rng() }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
}
export function loadSave(storage) {
  try {
    const data = JSON.parse(storage.getItem("trinity-save-v1"));
    if (
      !data ||
      data.version !== 1 ||
      !Number.isInteger(data.seed) ||
      data.seed < 0 ||
      data.seed >= 2 ** 32 ||
      !Number.isSafeInteger(data.level) ||
      data.level < 1 ||
      !["ready", "upgrade", "defeat"].includes(data.phase)
    )
      return null;
    const base = newRun(data.seed),
      generated = levelFor(data.seed, data.level);
    if (
      ![
        "hp",
        "maxHp",
        "charge",
        "heat",
        "credits",
        "turn",
        "combo",
        "bestCombo",
        "wins",
      ].every((k) => Number.isFinite(data[k]) && data[k] >= 0)
    )
      return null;
    if (
      data.hp > data.maxHp ||
      data.maxHp < 100 ||
      data.charge > 100 ||
      data.heat > 100 ||
      !data.enemy ||
      !Number.isFinite(data.enemy.hp) ||
      data.enemy.hp < 0 ||
      data.enemy.hp > generated.maxHp ||
      !data.upgrades ||
      !Object.keys(base.upgrades).every(
        (k) => Number.isInteger(data.upgrades[k]) && data.upgrades[k] >= 0,
      )
    )
      return null;
    if (
      ![0, 1, 2].includes(data.enemy.signal) ||
      !Number.isFinite(data.enemy.confidence) ||
      data.enemy.confidence < 0 ||
      data.enemy.confidence > 100
    )
      return null;
    if (data.phase === "ready" && (data.hp === 0 || data.enemy.hp === 0))
      return null;
    if (data.phase === "upgrade" && (data.enemy.hp !== 0 || data.hp === 0))
      return null;
    if (data.phase === "defeat" && data.hp !== 0) return null;
    const validResult = (r) =>
      r &&
      ["win", "draw", "loss"].includes(r.outcome) &&
      weaponFor(r.playerWeapon) &&
      weaponFor(r.enemyWeapon) &&
      ["damage", "incoming", "combo", "bounty", "id"].every(
        (k) => Number.isFinite(r[k]) && r[k] >= 0,
      );
    if (data.result && !validResult(data.result)) return null;
    if (data.scanned && !weaponFor(data.scanned)) return null;
    return {
      ...base,
      ...data,
      challenge:
        typeof data.challenge === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.challenge)
          ? data.challenge
          : null,
      enemy: {
        ...generated,
        hp: data.enemy.hp,
        signal: data.enemy.signal,
        confidence: data.enemy.confidence,
      },
      upgrades: Object.fromEntries(
        Object.keys(base.upgrades).map((k) => [k, data.upgrades[k]]),
      ),
      history: Array.isArray(data.history)
        ? data.history.filter(validResult).slice(0, 5)
        : [],
    };
  } catch {
    return null;
  }
}
