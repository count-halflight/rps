import { fighterFor } from "./fighters.js";
export const ATTACKS = {
  rock: {
    name: "Faultline",
    finisher: "Citybreaker",
    color: "#83ffd6",
    moves: ["Knuckle rush", "Skyfall", "Faultline"],
  },
  paper: {
    name: "Phase bloom",
    finisher: "Zero horizon",
    color: "#d0bcff",
    moves: ["Integral bloom", "Gravity well", "Ribbon snare"],
  },
  scissors: {
    name: "Crossfade",
    finisher: "Last light",
    color: "#ffb35e",
    moves: ["Crosscut", "Ghost step", "Rising crescent"],
  },
};
const clamp = (v) => Math.max(0, Math.min(1, v));
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const vMix = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
export function attackPresentation(
  weapon,
  finisher = false,
  reduced = false,
  variant = 0,
  character = null,
) {
  const attack = ATTACKS[weapon];
  if (character) {
    const fighter = fighterFor(character),
      finals = {
        echo: ["Bladebreaker", "Mirror blades", "Thousand cuts"],
        cinder: ["Crater", "Discharge", "Furnace fall"],
        nyx: ["Shatter", "Integral collapse", "Singularity"],
        vex: ["Meteor rain", "Sky pin", "Starfall"],
        kuro: ["Storm hammer", "Tempest", "Heaven’s gate"],
      };
    return {
      finisher,
      reduced,
      variant: variant % 3,
      character: fighter.id,
      style: fighter.style,
      duration: reduced ? (finisher ? 1700 : 1100) : finisher ? 5400 : 2200,
      impactAt: finisher ? 0.64 : 0.55,
      revealAt: 0.04,
      title: finisher
        ? finals[fighter.id][["rock", "paper", "scissors"].indexOf(weapon)]
        : fighter.moves[weapon][variant % 3],
      color: fighter.color,
    };
  }
  return {
    finisher,
    reduced,
    variant: variant % 3,
    duration: reduced ? (finisher ? 1700 : 1100) : finisher ? 5400 : 2100,
    impactAt: finisher ? 0.64 : 0.55,
    revealAt: 0.22,
    title: finisher ? attack.finisher : attack.moves[variant % 3],
    color: attack.color,
  };
}
// These paths describe different body actions, not recoloured copies of a lunge.
export function cinematicFrame(animation, seconds) {
  const p = clamp(seconds / (animation.duration / 1000)),
    final = animation.finisher,
    hit = animation.impactAt ?? (final ? 0.64 : 0.55),
    reveal = animation.revealAt ?? 0.22;
  const weapon =
    animation.outcome === "loss"
      ? animation.enemyWeapon
      : animation.playerWeapon;
  const variant = animation.variant ?? 0;
  const windup =
    smooth(reveal, hit - 0.15, p) * (1 - smooth(hit - 0.15, hit, p));
  const release = smooth(hit, hit + 0.24, p),
    returnHome = smooth(final ? 0.91 : 0.78, 1, p);
  const contact = smooth(hit - 0.15, hit, p),
    action = 1 - returnHome;
  let x = 0,
    y = 0,
    z = 0,
    yaw = 0,
    body = 0,
    armL = -0.55,
    armR = -0.55,
    elbowL = -1.1,
    elbowR = -1.1,
    legL = 0.08,
    legR = -0.08,
    roll = 0;
  const impact = Math.max(0, 1 - Math.abs(p - hit) / 0.07);
  if (p >= reveal && animation.outcome !== "draw") {
    if (weapon === "rock") {
      if (final || variant === 1) {
        const leap =
          smooth(reveal + 0.07, hit - 0.08, p) *
          (1 - smooth(hit - 0.07, hit, p));
        y = (final ? 3.6 : 1.5) * leap;
        x = 3.2 * contact * action;
        body = -0.45 * leap + 0.65 * impact;
        armR = -2.8 * leap - 1.2 * impact;
        armL = -1.4 * leap;
        legL = -0.7 * leap;
        legR = 0.6 * leap;
      } else if (variant === 0) {
        x = 3.1 * contact * action;
        body = 0.35 * contact;
        armR = -0.55 - 1.3 * contact;
        elbowR = -1.1 + 1.05 * contact;
        armL = -0.8;
        yaw = -0.55 * windup + 0.6 * contact;
      } else {
        x = 1.5 * contact * action;
        y = -0.4 * windup;
        body = 0.9 * windup + 0.5 * impact;
        armR = -0.4 + 1.4 * windup - 2.2 * contact;
        elbowR = -0.2;
      }
    } else if (weapon === "paper") {
      y =
        (final ? 0.9 : variant === 1 ? 0.5 : 0.12) *
        Math.sin(Math.PI * smooth(reveal, 0.9, p));
      x = 0.3 * windup;
      armL = -1.6 * contact - 0.6;
      armR = -1.6 * contact - 0.6;
      elbowL = -0.4;
      elbowR = -0.4;
      yaw =
        variant === 2
          ? Math.PI * 2 * smooth(reveal, hit, p)
          : 0.15 * Math.sin(p * 8);
      body = -0.12 * contact;
    } else {
      if (final) {
        const first = smooth(0.27, 0.35, p),
          second = smooth(0.39, 0.47, p),
          third = smooth(hit - 0.09, hit, p);
        x = (3.7 * first - 3.2 * second + 4.4 * third) * action;
        z = Math.sin(p * 22) * 0.45 * (1 - returnHome);
        yaw = Math.sin(p * 31) * 0.6;
        armR = -1.5 - Math.sin(p * 42) * 0.8;
        armL = -1.8 + Math.sin(p * 42) * 0.8;
        elbowR = -0.2;
        body = 0.35;
      } else if (variant === 2) {
        x = 3.2 * contact * action;
        y = 1.2 * Math.sin(Math.PI * contact) * (1 - release);
        roll = Math.PI * 2 * contact;
        armL = -2.3;
        armR = -1.4;
        legL = -0.9;
        legR = 0.7;
      } else {
        x = (variant === 1 ? 4.8 : 3) * contact * action;
        z = (variant === 1 ? 0.7 : 0) * Math.sin(Math.PI * contact);
        yaw = (variant === 0 ? -1.4 : 0.8) * contact;
        armR = -1.5 - 0.9 * Math.sin(contact * Math.PI);
        armL = -1.3 + 1.2 * contact;
        elbowL = -0.3;
        elbowR = -0.2;
        body = 0.25;
      }
    }
    if (animation.style) {
      const hand = ["rock", "paper", "scissors"].indexOf(weapon),
        v = variant,
        travel = contact * action;
      // Each kit keeps its own fighting language across all three won hands.
      x = 0;
      y = 0;
      z = 0;
      yaw = 0;
      body = 0;
      roll = 0;
      armL = -0.6;
      armR = -0.6;
      elbowL = -0.9;
      elbowR = -0.9;
      legL = 0.08;
      legR = -0.08;
      if (animation.style === "blades") {
        x = (3.1 + v * 0.5) * travel;
        z = Math.sin(contact * Math.PI) * (hand - 1) * 0.5;
        yaw = (-0.7 + hand * 0.55) * contact;
        body = 0.2 * contact;
        armL = -1.7 + Math.sin(contact * Math.PI * (v + 1)) * 0.7;
        armR = -1.9 - Math.sin(contact * Math.PI * (hand + 1)) * 0.6;
        elbowL = -0.2;
        elbowR = -0.2;
        if (v === 1) {
          y = 0.8 * Math.sin(Math.PI * contact) * (1 - release);
          legL = -0.8 * contact;
          legR = 0.5 * contact;
        }
        if (final) {
          x =
            (3.8 * smooth(0.16, 0.27, p) -
              3.2 * smooth(0.3, 0.4, p) +
              3.8 * smooth(0.44, hit, p)) *
            action;
          z = Math.sin(p * 26) * (hand + 1) * 0.2;
          armL = -1.5 + Math.sin(p * 42) * 0.9;
          armR = -1.8 - Math.sin(p * 42) * 0.9;
          y = hand === 2 ? Math.sin(contact * Math.PI) * 1.3 : 0;
          yaw = Math.sin(p * 28) * 0.7;
        }
      } else if (animation.style === "brawler") {
        x = (hand === 1 ? 2.6 : 3.1) * travel;
        body = 0.3 * contact;
        armL = -1.1;
        armR = -0.8 - (1.2 + v * 0.25) * contact;
        elbowR = -1.2 + 1.15 * contact;
        yaw = -0.6 * windup + 0.8 * contact;
        if (hand === 2) {
          y = Math.sin(contact * Math.PI) * 0.35;
          armR = -0.8 - 2.3 * contact;
          body = -0.3 * contact;
        }
        if (v === 1) {
          body = 0.75 * windup;
          armL = -0.6 - 1.8 * contact;
          elbowL = -0.1;
        }
        if (v === 2) {
          armL = -1.2 - Math.sin(contact * Math.PI * 3) * 0.8;
          armR -= Math.sin(contact * Math.PI * 3 + Math.PI) * 0.5;
          body += 0.2 * windup;
        }
        if (final) {
          const jump =
            smooth(0.16, hit - 0.12, p) * (1 - smooth(hit - 0.1, hit, p));
          y = (hand === 0 ? 3.5 : hand === 1 ? 0.7 : 1.8) * jump;
          armL = -2.7 * jump - 1.5 * impact;
          armR = -2.8 * jump - 1.5 * impact;
          legL = -0.8 * jump;
          legR = 0.6 * jump;
          body = -0.4 * jump + impact * 0.7;
          if (hand === 2) {
            armL -= Math.sin(p * 60) * 0.7;
            armR += Math.sin(p * 60) * 0.7;
          }
        }
      } else if (animation.style === "mage") {
        x = 0.2 * windup;
        y =
          (final ? 1.15 : 0.15 + v * 0.15) *
          Math.sin(Math.PI * smooth(reveal, 0.94, p));
        armR = -2.1 * contact - 0.5;
        armL = -1.2 * contact - 0.4;
        elbowL = -0.25;
        elbowR = -0.2;
        body = -0.1 * contact;
        yaw = (hand === 2 ? Math.PI * 2 : hand === 1 ? 0.25 : -0.35) * contact;
        if (v === 1) yaw += Math.sin(p * 8) * 0.3;
        if (final) {
          yaw =
            hand === 2
              ? Math.PI * 4 * smooth(0.1, hit, p)
              : Math.sin(p * 6) * 0.3;
          armL = hand === 0 ? -0.8 : -2.3 * contact - 0.4;
          armR = -(hand === 0 ? 3.2 : 2.5) * contact - 0.4;
          z = 0.5 * Math.sin(p * Math.PI);
        }
      } else if (animation.style === "archer") {
        x = -(0.2 + v * 0.3) * travel;
        armL = -1.5 - 0.7 * contact;
        armR = -1.5 - 0.5 * windup;
        elbowL = -0.1;
        elbowR = -1.5 - 1 * windup;
        body = -0.1;
        legL = -0.25 * contact;
        legR = 0.25 * contact;
        yaw = -0.2 + hand * 0.14;
        z = (hand - 1) * 0.3 * contact;
        if (v === 1) {
          y = 0.65 * Math.sin(contact * Math.PI);
          roll = hand === 2 ? -Math.PI * 2 * contact : 0;
        }
        if (final) {
          y =
            (hand === 1 ? 1.3 : 2.7) * Math.sin(Math.PI * smooth(0.1, 0.92, p));
          armL = -2.3;
          armR = -2.1;
          elbowR = -2.3 * (1 - release);
          legL = -0.6;
          legR = 0.45;
          body = -0.2;
        }
      } else if (animation.style === "glaive") {
        x = (hand === 0 ? 2 : 2.6) * travel;
        armL = -1.7;
        armR = -1.9 - 0.6 * Math.sin(contact * Math.PI);
        elbowL = -0.3;
        elbowR = -0.25;
        yaw = (hand === 1 ? Math.PI * 2 : hand === 2 ? -1.8 : 0.4) * contact;
        body = 0.15 * contact;
        if (v === 1) {
          y = 1.5 * Math.sin(contact * Math.PI);
          legL = -0.7;
          legR = 0.6;
          roll = hand === 0 ? 0.5 * contact : 0;
        }
        if (v === 2) {
          x += 0.45 * travel;
          body = 0.55 * windup;
          y = -0.25 * windup;
          armL -= 0.6 * windup;
          armR -= 0.4 * contact;
          z = 0.3 * Math.sin(contact * Math.PI);
        }
        if (final) {
          yaw = (hand === 1 ? Math.PI * 5 : Math.PI * 2) * contact;
          y =
            (hand === 0 ? 3.2 : hand === 2 ? 2 : 0.3) *
            Math.sin(contact * Math.PI) *
            (1 - release);
          armR = -2.8 * windup - 1.5 * contact;
          armL = -2.2 * windup - 1.5 * contact;
          legL = -0.9 * windup;
          legR = 0.7 * windup;
        }
      }
      if (animation.reduced) {
        x *= 0.6;
        y *= 0.25;
        z *= 0.25;
        roll = 0;
        yaw *= 0.4;
      }
    }
  }
  const collapse = final && animation.finalHit ? smooth(hit + 0.04, 0.9, p) : 0;
  const base = [0, 3.1, 10.4],
    target = [0, 1.7, 0];
  let camera = base,
    look = target;
  if (
    !animation.reduced &&
    p > reveal &&
    p < 1 &&
    animation.outcome !== "draw"
  ) {
    const sign = animation.outcome === "loss" ? -1 : 1;
    let opening, contactCamera;
    if (animation.style === "archer") {
      opening = [-4.4, 2, 5];
      contactCamera = final ? [0, 5.4, 8] : [0.7, 2.6, 7];
    } else if (animation.style === "mage") {
      opening = [-3.3, 3.3, 5.7];
      contactCamera = final ? [0.5, 4.7, 6.8] : [0.7, 3.6, 6.4];
    } else if (weapon === "rock") {
      opening = [-3.8, 1.4, 5.2];
      contactCamera = final ? [1.4, 5.5, 7.8] : [1, 1.5, 5.6];
    } else if (weapon === "paper") {
      opening = [-2.5, 3.9, 6.5];
      contactCamera = final ? [0.2, 4.8, 5.8] : [1.5, 3.4, 6.4];
    } else {
      opening = [-4, 1.8, 4.9];
      contactCamera = final ? [3.8, 1.1, 5.4] : [2.5, 1.6, 6.1];
    }
    opening[0] *= sign;
    contactCamera[0] *= sign;
    camera = vMix(base, opening, smooth(reveal, reveal + 0.13, p));
    camera = vMix(camera, contactCamera, smooth(hit - 0.14, hit + 0.08, p));
    camera = vMix(camera, base, returnHome);
    look = vMix(target, [-1.6 * sign, 1.6, 0], smooth(reveal, reveal + 0.1, p));
    look = vMix(look, [1.1 * sign, 1.2, 0], smooth(hit - 0.15, hit + 0.05, p));
    look = vMix(look, target, returnHome);
    if (weapon === "rock" && (final || variant === 1) && p < hit - 0.08) {
      camera[1] += y * 0.55;
      look[1] += y * 0.65;
    }
  }
  return {
    progress: p,
    lunge: clamp(x / 4.9),
    impact,
    release,
    windup,
    collapse,
    camera,
    target: look,
    attacker: {
      x,
      y,
      z,
      yaw,
      body,
      armL,
      armR,
      elbowL,
      elbowR,
      legL,
      legR,
      roll,
    },
    weapon,
    contact,
    returnHome,
    revealed: p >= reveal,
    shock: smooth(hit, hit + 0.3, p) * (1 - smooth(hit + 0.3, 0.99, p)),
  };
}
