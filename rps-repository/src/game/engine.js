import { resourceProjection } from "./calculus.js";
import { FIGHTERS, fighterFor, inventoryFor, ITEM_TYPES } from "./fighters.js";
import { encounterFor, phaseFor, signatureWarning } from './rivals.js';
import { PERKS, perkFor, perkTotals, addPerk } from './perks.js';
import { routeChoices } from './routes.js';
export const WEAPONS = [
  {
    id: "rock",
    name: "Rock",
    type: "Rock",
    tag: "Kinetic gauntlet",
    color: "#63e8cf",
    beats: "scissors",
    description: "Rock beats scissors.",
  },
  {
    id: "paper",
    name: "Paper",
    type: "Paper",
    tag: "Phase shield",
    color: "#9cabff",
    beats: "rock",
    description: "Paper beats rock.",
  },
  {
    id: "scissors",
    name: "Scissors",
    type: "Scissors",
    tag: "Twin pulse blades",
    color: "#ffc580",
    beats: "paper",
    description: "Scissors beat paper.",
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
    name: "Overheating",
    detail:
      "Every turn adds 10 extra heat. Safe attacks, bracing, and coolant help you cool down.",
  },
  {
    id: "siphon",
    name: "Life steal",
    detail:
      "The rival restores up to 12 health whenever it hits you.",
  },
  {
    id: "plating",
    name: "Armour",
    detail:
      "Your attacks deal 20% less damage. Heavy attacks break through.",
  },
  {
    id: "redline",
    name: "Second wind",
    detail:
      "At half health or less, the rival deals 30% more damage.",
  },
  {
    id: "blackout",
    name: "Jammer",
    detail:
      "Unreliable tells. Use a scan to see the rival’s next hand.",
  },
  {
    id: "mirror",
    name: "Counterreader",
    detail:
      "The tell changes to counter your last hand. Mix up your choices.",
  },
];
export function abilityDetail(enemy){
  const phase=phaseFor(enemy);
  if(enemy.ability?.id==='thermal')return `Each exchange adds ${10+6*phase} heat before cooling and guard effects.`;
  if(enemy.ability?.id==='siphon')return `Successful hits restore up to ${12+4*phase} rival health.`;
  if(enemy.ability?.id==='plating')return `Ordinary attacks lose ${Math.round((1-[.8,.72,.62][phase])*100)}% damage. Heavy attacks break through.`;
  return enemy.ability?.detail||'';
}
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
    detail: "A draw restores 8 health.",
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
    name: "Weapon upgrade",
    kind: "Offense",
    detail: "+5 damage before attack bonuses.",
    icon: "power",
  },
  {
    id: "armor",
    name: "Body armour",
    kind: "Defense",
    detail: "Reduce incoming damage by 3. Losing hits deal at least 2.",
    icon: "armor",
  },
  {
    id: "capacity",
    name: "More health",
    kind: "Survival",
    detail: "+20 max health.",
    icon: "heart",
  },
  {
    id: "coolant",
    name: "Better cooling",
    kind: "Thermal",
    detail: "Clear 6 extra heat every turn.",
    icon: "coolant",
  },
  {
    id: "battery",
    name: "Bigger battery",
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
export function levelFor(seed, level, route = 'normal') {
  const rng = random(seed + level * 7919);
  const district = { ...DISTRICTS[(level - 1) % DISTRICTS.length] };
  if (level > 6) {
    const anomaly = ["Compression", "Signal bleed", "Flux surge"][
      Math.floor(rng() * 3)
    ];
    district.anomaly = anomaly;
    if (anomaly === "Compression") {
      district.amplify = 1.25;
      district.detail += " Both fighters deal 25% more damage.";
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
  const rival = encounterFor(seed,level,route), {boss,elite} = rival;
  const ability = boss || elite ? APEX_PROTOCOLS.find(a=>a.id===rival.ability) : null;
  const maxHp = 58 + level * 7 + (boss ? 45 : elite ? 24 : 0) + Math.floor(rng() * 10);
  const favorite = Math.floor(rng() * 3);
  return {
    level,
    district,
    boss,
    elite,
    rival,
    ability,
    name: rival.name,
    serial: `MK.${String(Math.floor(rng() * 899) + 100)}`,
    maxHp,
    hp: maxHp,
    damage: 14 + Math.floor(level * 1.4) + (boss ? 7 : elite ? 3 : 0),
    favorite,
    signal: favorite,
    confidence:
      (ability?.id === "blackout" ? 45 : district.static ? Math.min(45,rival.personalityInfo.reliability) : rival.personalityInfo.reliability) -
      (district.signalPenalty || 0),
    pattern: rival.personality,
  };
}
export function newRun(
  seed = Math.floor(Math.random() * 2 ** 30),
  challenge = null,
  character = "echo",
) {
  const fighter = fighterFor(character);
  return {
    version: 2,
    seed,
    challenge,
    character: fighter.id,
    inventory: inventoryFor(fighter.id),
    perks: {},
    routes: [],
    routeChoice: 'normal',
    encounterSeen: false,
    itemsUsed: 0,
    level: 1,
    turn: 0,
    fightTurn: 0,
    phase: "ready",
    hp: fighter.hp,
    maxHp: fighter.hp,
    charge: fighter.charge,
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
  if (!win) return 0;
  const p=perkTotals(run);
  const base =
    23 +
    fighterFor(run.character).power +
    run.upgrades.power * 5 +
    Math.min(run.combo, 4) * (3+(p.comboDamage||0)) + (p.damage||0) +
    ((run.fightTurn??run.turn)===0?p.openingDamage||0:0) + (run.enemy.hp<=run.enemy.maxHp*.30?p.closingDamage||0:0) +
    (run.heat<25?p.coldDamage||0:0) + (run.scanned?p.scanDamage||0:0) +
    (run.hp<run.maxHp*.4?p.lowDamage||0:0) + (run.enemy.boss?p.bossDamage||0:0);
  return Math.max(
    1,
    Math.round(
      (win ? base : tie ? 10 : 4) *
        (stance === "overdrive" ? 2 : stance === "guard" ? 0.72 : 1) *
        (run.heat >= 75 ? 0.7 : 1) *
        (win && run.enemy.ability?.id === "plating" && stance !== "overdrive"
          ? [0.8,0.72,0.62][phaseFor(run.enemy)]
          : 1) *
        (run.enemy.district.amplify || 1),
    ),
  );
}
export function tellReliabilityFor(run){return Math.min(100,run.enemy.confidence+(perkTotals(run).tellBoost||0));}
function enemyThrow(run,rng){
  const e=run.enemy;
  if(rng()<tellReliabilityFor(run)/100)return e.signal;
  const weights=e.rival?.personalityInfo.weights||[1,1,1];
  const other=[0,1,2].filter(i=>i!==e.signal),sum=weights[other[0]]+weights[other[1]];
  return rng()*sum<weights[other[0]]?other[0]:other[1];
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
  const enemyIndex = enemyThrow(run,rng), p=perkTotals(run), bossPhase=phaseFor(enemy);
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
      (win || tie ? 0 : enemy.damage) *
        (stance === "guard" ? 0.5 : 1) *
        (enemy.ability?.id === "redline" && enemy.hp <= enemy.maxHp / 2
          ? 1.3
          : 1) *
        (enemy.district.amplify || 1) * (enemy.boss?[1,1.1,1.25][bossPhase]:1) *
        (signatureWarning(run)?1.4:1) * (stance==='guard'?1-(p.guardReduction||0):1),
    ) -
      run.upgrades.armor * 3 - (p.armor||0) - (stance==='guard'?p.guardArmor||0:0),
  );
  const avoided=outcome==='loss'&&stance==='guard'&&p.dodge&&(run.turn+1)%4===0;
  const actualIncoming=avoided?0:incoming;
  enemy.hp = Math.max(0, enemy.hp - damage);
  const enemyHealing =
    !win && !tie && enemy.hp > 0 && enemy.ability?.id === "siphon"
      ? Math.min(12+(enemy.boss?bossPhase*4:0), enemy.maxHp - enemy.hp)
      : 0;
  enemy.hp += enemyHealing;
  const hp = Math.min(
    run.maxHp,
    Math.max(0, run.hp - actualIncoming + (tie ? (enemy.district.healTie ? 8 : 0)+(p.drawHeal||0) : win ? p.winHeal||0 : 0)),
  );
  const phase = hp <= 0 ? "defeat" : enemy.hp <= 0 ? "upgrade" : "ready";
  const bounty =
    phase === "upgrade"
      ? Math.round(
          (120 + run.level * 20 + (enemy.boss ? 100 : enemy.elite ? 70 : 0)) *
            (enemy.district.bounty || 1) * (1+(p.bounty||0)+(enemy.elite?p.eliteBounty||0:0)),
        )
      : 0;
  const signalRoll = rng();
  enemy.signal =
    enemy.ability?.id === "mirror"
      ? WEAPONS.indexOf(counterFor(weaponId, enemy.district.reverse))
      : enemy.pattern === "methodical"
        ? (enemy.signal + 1) % 3
      : enemy.pattern === 'mimic' && signalRoll<.8 ? WEAPONS.findIndex(w=>w.id===weaponId)
      : enemy.pattern === 'patient' && signalRoll<.75 ? WEAPONS.indexOf(counterFor(weaponId,enemy.district.reverse))
      : enemy.pattern === 'aggressor' && signalRoll<.70 ? 0
      : enemy.pattern === "adaptive" && signalRoll < 0.65
          ? WEAPONS.indexOf(counterFor(weaponId, enemy.district.reverse))
          : signalRoll < 0.55
            ? enemy.favorite
            : Math.floor(rng() * 3);
  enemy.confidence =
    (enemy.district.static
      ? 45
      : enemy.ability?.id === "blackout"
        ? 55-(enemy.boss?phaseFor(enemy)*10:0)
        : enemy.pattern === "methodical"
          ? 90
          : (enemy.rival?.personalityInfo.reliability || 76)) - (enemy.district.signalPenalty || 0);
  const result = {
    outcome,
    stance,
    playerWeapon: weaponId,
    enemyWeapon: enemyWeapon.id,
    damage,
    incoming: actualIncoming,
    avoided: Boolean(avoided),
    signature: Boolean(signatureWarning(run)&&outcome==='loss'),
    phaseChange: enemy.boss && enemy.hp>0 && phaseFor(enemy)>bossPhase ? {from:bossPhase,to:phaseFor(enemy)} : null,
    enemyHealing,
    healing: Math.max(0,hp-(run.hp-actualIncoming)),
    combo,
    bounty,
    id: run.turn + 1,
  };
  const projected = resourceProjection(run, stance,1,outcome);
  return {
    ...run,
    turn: run.turn + 1,
    fightTurn: (run.fightTurn??run.turn)+1,
    phase,
    hp,
    enemy,
    combo,
    bestCombo: Math.max(run.bestCombo, combo),
    wins: run.wins + (win ? 1 : 0),
    charge: Math.min(100,projected.charge+(run.scanned?p.scanRefund||0:0)),
    heat: projected.heat,
    credits: run.credits + bounty + (win ? 15+(p.winCredits||0) : 0),
    scanned: null,
    history: [result, ...run.history].slice(0, 5),
    result,
  };
}
// Looking at an opening never spends a turn, changes health, or rolls a new hand.
// The same seeded exchange is committed only when its action is chosen.
export function openingFor(run, weaponId) {
  if (run.phase !== "ready" || !weaponFor(weaponId)) return null;
  const next = resolveTurn(run, weaponId);
  return {
    playerWeapon: weaponId,
    enemyWeapon: next.result.enemyWeapon,
    outcome: next.result.outcome,
    turn: run.turn,
  };
}
export function itemAvailable(run, id) {
  if (!ITEM_TYPES.some((i) => i.id === id) || !(run.inventory?.[id] > 0))
    return false;
  return id === "medkit"
    ? run.hp < run.maxHp
    : id === "coolant"
      ? run.heat > 0
      : run.charge < 100;
}
export function useEarnedItem(run, weaponId, id) {
  if (openingFor(run, weaponId)?.outcome !== "win" || !itemAvailable(run, id))
    return run;
  const next = resolveTurn(run, weaponId),p=perkTotals(run);
  const healing=Math.min(35+(p.medkit||0),run.maxHp-run.hp);
  const result = {
    ...next.result,
    damage: 0,
    incoming: 0,
    bounty: 0,
    combo: 0,
    item: id,
    healing: id === "medkit" ? healing : 0,
    phaseChange: null,
    signature: false,
  };
  return {
    ...next,
    phase: "ready",
    enemy: { ...next.enemy, hp: run.enemy.hp },
    hp: Math.min(run.maxHp, run.hp + result.healing),
    charge: id === "battery" ? Math.min(100, run.charge + 35+(p.batteryItem||0)) : run.charge,
    heat: id === "coolant" ? Math.max(0, run.heat - 40-(p.coolantItem||0)) : run.heat,
    combo: 0,
    bestCombo: run.bestCombo,
    credits: run.credits + 15+(p.winCredits||0),
    itemsUsed: (run.itemsUsed||0)+1,
    inventory: { ...run.inventory, [id]: run.inventory[id] - (id==='medkit'&&p.medkitSave&&((run.itemsUsed||0)+1)%3===0?0:1) },
    result,
    history: [result, ...run.history].slice(0, 5),
  };
}
export function floorSupply(run) {
  return ITEM_TYPES[(run.seed + run.level) % ITEM_TYPES.length];
}
export function scanSignal(run) {
  const cost=Math.max(0,30-(perkTotals(run).scanDiscount||0));
  if (run.phase !== "ready" || run.charge < cost || run.scanned || run.scanUsed)
    return run;
  const rng = random(run.seed + run.level * 1031 + run.turn * 997);
  const index = enemyThrow(run,rng);
  return {
    ...run,
    charge: run.charge - cost,
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
export function chooseReward(run, id) {
  const upgrade=UPGRADES.find(u=>u.id===id),perk=perkFor(id),item=ITEM_TYPES.find(i=>`item:${i.id}`===id);
  if (run.phase !== "upgrade" || (!upgrade&&!perk&&!item)) return run;
  const maxHp = run.maxHp + (id === "capacity" ? 20 : 0);
  const supply = floorSupply(run).id;
  let next = {
    ...run,
    upgrades: upgrade?{ ...run.upgrades, [id]: run.upgrades[id] + 1 }:run.upgrades,
    phase: "route",
    maxHp,
    inventory: {
      ...(run.inventory || inventoryFor(run.character)),
      [supply]: Math.min(5, (run.inventory?.[supply] || 0) + 1),
    },
    hp: maxHp,
    charge: Math.min(100, run.charge + 10),
    heat: Math.max(0, run.heat - 35),
    combo: run.combo,
    scanned: null,
    repairUsed: false,
    scanUsed: false,
  };
  if(perk){next=addPerk(next,id);if(run.enemy.elite)next=addPerk(next,id);}
  if(item)next.inventory[item.id]=Math.min(5,next.inventory[item.id]+(run.enemy.elite?2:1));
  if(run.enemy.boss)next=addPerk(next,run.enemy.rival.reward);
  return next;
}
export function chooseRoute(run,id){
  if(run.phase!=='route'||!routeChoices(run).some(r=>r.id===id))return run;
  const level=run.level+1,room=['rest','shop','event'].includes(id);
  return {...run,level,routeChoice:id,phase:room?'room':'ready',enemy:levelFor(run.seed,level,id),
    routes:[...(run.routes||[]),{level,type:id}].slice(-20),encounterSeen:false,
    fightTurn:0,result:null,history:[]};
}
// Kept for old engine callers; the UI uses the explicit reward and route steps.
export function chooseUpgrade(run,id){
  if(!UPGRADES.some(u=>u.id===id))return run;
  const rewarded=chooseReward(run,id);
  return rewarded===run?run:chooseRoute(rewarded,'normal');
}
export function rewardChoices(run){
  const rng=random(run.seed+run.level*3137),frames=upgradeChoices(run),
    perks=PERKS.filter(p=>p.cap>1&&(run.perks?.[p.id]||0)<p.cap),
    supplies=ITEM_TYPES.filter(i=>(run.inventory?.[i.id]||0)<5);
  const perk=perks[Math.floor(rng()*perks.length)];
  const item=supplies[Math.floor(rng()*supplies.length)];
  return [{...frames[0],kind:'Frame upgrade'},
    perk?{...perk,detail:`${run.enemy.elite?'Gain 2 stacks. ':''}${perk.detail}`}:{...frames[1],kind:'Frame upgrade'},
    item?{...item,id:`item:${item.id}`,name:`${run.enemy.elite?2:1} ${item.name.toLowerCase()}`,kind:'Supply',icon:'heart'}:{...frames[2],kind:'Frame upgrade'}];
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
      ![1,2].includes(data.version) ||
      !Number.isInteger(data.seed) ||
      data.seed < 0 ||
      data.seed >= 2 ** 32 ||
      !Number.isSafeInteger(data.level) ||
      data.level < 1 ||
      !["ready", "upgrade", "route", "room", "defeat"].includes(data.phase)
    )
      return null;
    if (data.character && !FIGHTERS.some((f) => f.id === data.character))
      return null;
    const base = newRun(data.seed, null, data.character),
      generated = levelFor(data.seed, data.level, data.version===2?data.routeChoice:'normal');
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
      data.maxHp < fighterFor(data.character).hp ||
      data.charge > 100 ||
      data.heat > 100 ||
      !data.enemy ||
      !Number.isFinite(data.enemy.hp) ||
      (data.version===1&&(!Number.isFinite(data.enemy.maxHp)||data.enemy.maxHp<=0)) ||
      data.enemy.hp < 0 ||
      data.enemy.hp > (data.version===1?data.enemy.maxHp:generated.maxHp) ||
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
    if (["upgrade","route"].includes(data.phase) && (data.enemy.hp !== 0 || data.hp === 0))
      return null;
    if (data.phase === "defeat" && data.hp !== 0) return null;
    if(data.version===2&&data.perks&&Object.entries(data.perks).some(([id,n])=>!perkFor(id)||!Number.isInteger(n)||n<0||n>perkFor(id).cap))return null;
    if(data.version===2&&!['normal','elite','rest','event','shop'].includes(data.routeChoice||'normal'))return null;
    if(data.phase==='room'&&!['rest','event','shop'].includes(data.routeChoice))return null;
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
    if (
      data.inventory &&
      !ITEM_TYPES.every(
        (i) =>
          Number.isInteger(data.inventory[i.id]) &&
          data.inventory[i.id] >= 0 &&
          data.inventory[i.id] <= 5,
      )
    )
      return null;
    return {
      ...base,
      ...data,
      version: 2,
      perks: data.version===2 ? {...(data.perks||{})} : {},
      routeChoice: data.version===2 ? data.routeChoice||'normal' : 'normal',
      routes: Array.isArray(data.routes)?data.routes.filter(r=>Number.isSafeInteger(r.level)&&r.level>0&&['normal','elite','rest','event','shop'].includes(r.type)).slice(-20):[],
      fightTurn: Number.isSafeInteger(data.fightTurn)&&data.fightTurn>=0?data.fightTurn:0,
      itemsUsed: Number.isSafeInteger(data.itemsUsed)&&data.itemsUsed>=0?data.itemsUsed:0,
      encounterSeen: data.encounterSeen===true,
      character: base.character,
      inventory: data.inventory
        ? Object.fromEntries(
            ITEM_TYPES.map((i) => [i.id, data.inventory[i.id]]),
          )
        : base.inventory,
      challenge:
        typeof data.challenge === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.challenge)
          ? data.challenge
          : null,
      enemy: {
        ...generated,
        hp: data.version===1?Math.min(generated.maxHp,Math.round(generated.maxHp*data.enemy.hp/Math.max(1,data.enemy.maxHp))):data.enemy.hp,
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
