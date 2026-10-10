export const FIGHTERS = [
  {
    id: "echo",
    name: "Echo",
    weapon: "Twin blades",
    model: "echo",
    color: "#83ffd6",
    hp: 100,
    power: 0,
    charge: 20,
    style: "blades",
    description: "Fast footwork. Two blades. No wasted movement.",
    moves: {
      rock: ["Pommel strike", "Low sweep", "Crosscut"],
      paper: ["Blade feint", "Mirror step", "Blade storm"],
      scissors: ["Quick draw", "Rising cut", "Thousand cuts"],
    },
    finish: "Thousand cuts",
  },
  {
    id: "cinder",
    name: "Cinder",
    weapon: "Impact wraps",
    model: "brawler",
    color: "#ffa35d",
    hp: 120,
    power: 3,
    charge: 10,
    style: "brawler",
    description: "Takes a hit and gives it back harder.",
    moves: {
      rock: ["Straight punch", "Body blow", "Furnace fall"],
      paper: ["Palm strike", "Shoulder check", "Groundbreak"],
      scissors: ["Hook", "Uppercut", "Three-hit rush"],
    },
    finish: "Furnace fall",
  },
  {
    id: "nyx",
    name: "Nyx",
    weapon: "Prism staff",
    model: "nyx",
    color: "#ccb2ff",
    hp: 90,
    power: 0,
    charge: 40,
    style: "mage",
    description: "Starts charged. Keeps her distance.",
    moves: {
      rock: ["Prism bolt", "Crystal trap", "Shatter"],
      paper: ["Light wave", "Integral bloom", "Singularity"],
      scissors: ["Split beam", "Orbit cast", "Zero horizon"],
    },
    finish: "Singularity",
  },
  {
    id: "vex",
    name: "Vex",
    weapon: "Arc bow",
    model: "vex",
    color: "#ebcc83",
    hp: 95,
    power: 1,
    charge: 30,
    style: "archer",
    description: "A steady aim and a full quiver.",
    moves: {
      rock: ["Heavy arrow", "Piercing shot", "Meteor rain"],
      paper: ["Volley", "Ricochet", "Scattershot"],
      scissors: ["Quick shot", "Backflip shot", "Starfall"],
    },
    finish: "Meteor rain",
  },
  {
    id: "kuro",
    name: "Kuro",
    weapon: "Storm glaive",
    model: "ronin",
    color: "#ff8e83",
    hp: 110,
    power: 2,
    charge: 20,
    style: "glaive",
    description: "Long reach. Wide swings. A brutal finish.",
    moves: {
      rock: ["Thrust", "Vault strike", "Sky splitter"],
      paper: ["Low sweep", "Turning tide", "Storm wheel"],
      scissors: ["Cleaving cut", "Rising slash", "Heaven’s gate"],
    },
    finish: "Heaven’s gate",
  },
];
export const fighterFor = (id) =>
  FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
export const ITEM_TYPES = [
  {
    id: "medkit",
    name: "Medkit",
    detail: "Restore 35 health.",
    kind: "health",
  },
  { id: "coolant", name: "Coolant", detail: "Clear 40 heat.", kind: "heat" },
  { id: "battery", name: "Battery", detail: "Gain 35 charge.", kind: "charge" },
];
export function inventoryFor(character = "echo") {
  return {
    medkit: character === "cinder" ? 3 : 2,
    coolant: 1,
    battery: character === "nyx" ? 2 : 1,
  };
}
export const MOVE_STANCES = ["strike", "guard", "overdrive"];
export const rivalFighter = (level) =>
  FIGHTERS[[4, 1, 2, 3, 0][(level - 1) % 5]];
