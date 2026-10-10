import { levelFor, random } from "./engine.js";
const origins = {
  adaptive: [
    "A courier who memorized every shortcut through the flooded transit lines. Reading a shoulder is easier than reading traffic.",
    "A former sparring coach who keeps a battered notebook of the city's champions. Your name is on a blank page.",
    "A basement surgeon with borrowed reflex implants. Every clean counter pays for another patient upstairs.",
    "A salvage diver who fights in boots still stained with dock water. Every opponent has a rhythm. Every rhythm has a gap.",
  ],
  aggressive: [
    "A foundry worker fighting to buy the crew's shuttered furnace. The last shift left copper burns.",
    "An exiled pit champion fighting for a way back into the league. The old manager still won’t answer the phone.",
    "A loading-dock brawler who gave up heavy machinery for heavier bets. Nobody in the market accepts an IOU anymore.",
    "A street racer with a wrecked bike and a debt at every district gate. Winning is the only road left open.",
  ],
  methodical: [
    "A retired fencing instructor who counts every breath before moving. The count never changes. The tempo does.",
    "A night-shift archivist who studies old duel recordings between rounds. A hundred small observations become one opening.",
    "A shrine keeper fighting to pay the electricity bill. The last working lights flicker whenever a train passes.",
    "A rail-switch operator whose hands still move to the rhythm of passing trains. Hesitation was expensive on the tracks.",
  ],
};
const taunts = {
  adaptive: [
    "Your shoulder gives you away.",
    "That worked once. Try it again.",
    "You pause after a clean counter.",
    "I remember that hand.",
  ],
  aggressive: [
    "You have two hands. Use them.",
    "Keep your shield up.",
    "The next one is mine.",
    "Still standing? Good.",
  ],
  methodical: [
    "Your timing changed.",
    "There is an order to these things.",
    "One breath. One opening.",
    "Three choices. Choose carefully.",
  ],
};
const apexStories = {
  thermal:
    "A foundry champion whose illegal reflex implants run hot. The crew packed ice into the collar before this fight.",
  siphon:
    "A retired ringside medic. Knows where a hit hurts, and how to keep fighting through one.",
  plating:
    "A bodyguard wearing overlapping ceramic armor under the coat. Ordinary attacks meet a wall; heavy attacks can crack it.",
  redline:
    "A racer with a second pulse regulator beside the heart. Falling behind brings the forbidden regulator online.",
  blackout:
    "A former signal runner carrying a stolen jammer. The antenna on the coat turns every forecast into a rumor.",
  mirror:
    "An academy deserter who spent years studying champions. The last move you used is already in the notebook.",
};
export function localDossier(seed, level) {
  const enemy = levelFor(seed, level),
    rng = random(seed + level * 3571);
  return {
    name: enemy.name,
    title: enemy.ability
      ? enemy.ability.name
      : `${enemy.district.zone} irregular`,
    story: enemy.ability
      ? apexStories[enemy.ability.id]
      : origins[enemy.pattern][
          Math.floor(rng() * origins[enemy.pattern].length)
        ],
    taunt:
      taunts[enemy.pattern][Math.floor(rng() * taunts[enemy.pattern].length)],
    pattern: enemy.pattern,
    source: "local",
  };
}
