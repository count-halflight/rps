export const ATTACKS = {
  rock: {
    name: "Faultline",
    finisher: "Citybreaker",
    detail: "A seismic charge driven through the hostile core.",
    color: "#63e8cf",
  },
  paper: {
    name: "Phase bloom",
    finisher: "Event horizon",
    detail: "A containment field folds the rival into its own signal.",
    color: "#9cabff",
  },
  scissors: {
    name: "Crossfade",
    finisher: "Last light",
    detail: "Twin pulse blades sever the frame’s neural link.",
    color: "#ffc580",
  },
};

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, amount) => a + (b - a) * amount;
const vectorMix = (a, b, amount) =>
  a.map((value, i) => mix(value, b[i], amount));

export function attackPresentation(weapon, finisher = false, reduced = false) {
  const attack = ATTACKS[weapon];
  return {
    finisher,
    reduced,
    duration: reduced ? (finisher ? 1200 : 900) : finisher ? 3900 : 1250,
    title: finisher ? attack.finisher : attack.name,
    color: attack.color,
  };
}

// Wall-clock choreography keeps the impact and resolution aligned at every frame rate.
export function cinematicFrame(animation, seconds) {
  const progress = clamp(seconds / (animation.duration / 1000));
  const final = animation.finisher;
  const impactAt = final ? 0.43 : 0.4;
  const lunge =
    smooth(0.16, impactAt, progress) -
    smooth(final ? 0.74 : 0.54, 0.96, progress);
  const impact = Math.max(
    0,
    1 - Math.abs(progress - impactAt) / (final ? 0.16 : 0.14),
  );
  const release = smooth(impactAt, final ? 0.83 : 0.78, progress);
  const windup =
    smooth(0, 0.16, progress) * (1 - smooth(0.16, impactAt, progress));
  const collapse = final ? smooth(0.48, 0.85, progress) : 0;
  let camera = [0, 2.6, 9.6],
    target = [0, 1.35, 0];
  if (!animation.reduced && progress < 1) {
    const weapon = animation.playerWeapon;
    const opening =
      weapon === "paper"
        ? [-2.7, 3.5, 7.1]
        : weapon === "scissors"
          ? [-3.5, 1.8, 6.4]
          : [-2.7, 2.1, 6.3];
    const contact =
      weapon === "paper"
        ? [1.3, 3.4, 6.5]
        : weapon === "scissors"
          ? [1.8, 2.5, 6.3]
          : [1.3, 1.7, 6.4];
    if (progress < 0.2) {
      camera = vectorMix(camera, opening, smooth(0, 0.16, progress));
      target = vectorMix(target, [-1.5, 2.05, 0], smooth(0, 0.16, progress));
    } else if (progress < 0.52) {
      camera = vectorMix(opening, contact, smooth(0.2, impactAt, progress));
      target = vectorMix(
        [-1.5, 2.05, 0],
        [0.2, 1.9, 0],
        smooth(0.2, impactAt, progress),
      );
    } else {
      const ending = final ? [3.2, 3.6, 7.9] : [0, 2.6, 9.6];
      camera = vectorMix(contact, ending, smooth(0.52, 0.86, progress));
      target = vectorMix(
        [0.2, 1.9, 0],
        [0.5, 1.35, 0],
        smooth(0.52, 0.86, progress),
      );
      if (final) {
        camera = vectorMix(camera, [0, 2.6, 9.6], smooth(0.9, 1, progress));
        target = vectorMix(target, [0, 1.35, 0], smooth(0.9, 1, progress));
      }
    }
  }
  return { progress, lunge, impact, release, windup, collapse, camera, target };
}
