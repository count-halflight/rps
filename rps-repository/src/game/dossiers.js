import { levelFor, random } from "./engine.js";
const origins = {
  adaptive: [
    "A discarded traffic-control frame from the upper ring. It still predicts collisions. These days, it causes them.",
    "A courier that survived nine years in the flooded transit lines. It learned to read a movement before the thought behind it.",
    "Its memory banks contain the last four seconds of every fight it has lost. Nothing else survived the rebuild.",
    "An abandoned rehearsal partner from a private combat academy. The academy burned. The lessons stayed.",
    "It once fitted prosthetic hands in a basement clinic. It knows exactly how much force a joint can take.",
    "A silent frame with a recorder behind each eye. Someone is buying the footage. Nobody knows who.",
    "The market calls it a copycat. The mechanics call it impossible. Its original chassis is long gone.",
    "A salvage diver carrying three incompatible combat cores. They disagree about everything except survival.",
  ],
  aggressive: [
    "A pit champion with a cracked restraint governor. The cooling fans on its back are welded open.",
    "Forged for furnace crews, then abandoned when the foundry closed. Its hands still glow with residual heat.",
    "A demolition frame rebuilt with stolen racing actuators. It has never learned what the brakes are for.",
    "It escaped a scrapyard compactor with half a torso. Every replacement plate came from the next opponent.",
    "The yellow marks on its fists are old loading-dock numbers. There are fresh dents underneath them.",
    "A former cargo escort from the black tide. It carries no cargo now. It still clears the road.",
    "Someone installed a combat core in a municipal snowplow. The city has not seen snow in eighty years.",
    "Its owner bet the entire workshop on one fight. That was six floors ago. The workshop is still waiting.",
  ],
  methodical: [
    "An orbital defense unit with obsolete targeting software. It follows a combat sequence written before the city existed.",
    "A collector of neural signatures. It measures every exchange, then files the result somewhere deep below the circuit.",
    "Built to sort medical glass, then taught to wield pulse blades. It handles both with the same unnerving care.",
    "A clocktower maintenance frame. Every strike arrives on a schedule only it can hear.",
    "It guards a vault that has been empty for thirty years. The circuit is just another inspection round.",
    "A ceremonial dueling frame from an extinct corporate dynasty. Its maker stamped a serial number inside every finger.",
    "The little brass counter in its chest tracks completed orders. Nobody has found a way to reset it.",
    "A retired rail-switch operator. It changes weapons the way it once changed tracks: cleanly, without hesitation.",
  ],
};
const taunts = {
  adaptive: [
    "You reach for the left arm when you are worried.",
    "That worked once. Try it again.",
    "Your last move told me more than your scanner did.",
    "Hold still. I am making a copy.",
    "You always hesitate after a clean counter.",
    "I have seen that shoulder twitch before.",
    "The first mistake was free.",
    "New frame. Familiar habits.",
  ],
  aggressive: [
    "Your coolant is leaking. Do not bother fixing it.",
    "I can hear the cheap bearings in your elbow.",
    "That plate looks expensive. I want it.",
    "Keep your shield up. I like the sound it makes.",
    "Somebody down there owes me a new fist.",
    "I was built to move things out of the way.",
    "You have two hands. Use them.",
    "The repair bay closes in ten minutes.",
  ],
  methodical: [
    "Seventeen milliseconds late. I can work with that.",
    "Exchange logged. Preparing the next.",
    "Your left actuator is drifting.",
    "There is an order to these things.",
    "I have completed this sequence before.",
    "Please remain inside the marked circle.",
    "Nothing personal. Just the next instruction.",
    "Three weapons. An acceptable number of variables.",
  ],
};
const apexStories = {
  thermal:
    "A furnace supervisor that rerouted its own cooling system into a weapon. The air around it tastes of hot copper.",
  siphon:
    "A hospital reclamation frame with its triage rules reversed. Every damaged circuit nearby is a spare part.",
  plating:
    "Built to protect a corporate heir. Its layered armor outlived the heir, the company, and most of the district.",
  redline:
    "Its reactor has a second governor hidden behind the first. The second was never meant to switch on.",
  blackout:
    "A signal-interception unit from a war nobody will name. Its arrival turns every scanner into a rumor.",
  mirror:
    "There is no factory mark on this frame. Its movements look borrowed. Some of them look uncomfortably like yours.",
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
