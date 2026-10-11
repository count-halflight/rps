export const FACIAL_TARGETS = Object.freeze([
  "blink", "browUp", "browDown", "smirk", "grit", "hurt", "shout",
]);

const PRESETS = Object.freeze({
  neutral: {},
  calm: {},
  focus: { browDown: 0.65, grit: 0.32 },
  win: { smirk: 0.85, browUp: 0.2 },
  victory: { smirk: 0.85, browUp: 0.2 },
  smirk: { smirk: 1, browUp: 0.18 },
  hurt: { hurt: 1, browDown: 0.42, grit: 0.35 },
  shout: { shout: 1, browDown: 0.48 },
  grit: { grit: 1, browDown: 0.6 },
  surprise: { browUp: 1, shout: 0.38 },
});

const clampWeight = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;

function apply(weights, values, intensity = 1) {
  if (!values || typeof values !== "object") return;
  for (const target of FACIAL_TARGETS) {
    if (Object.hasOwn(values, target)) {
      weights[target] = clampWeight(values[target]) * intensity;
    }
  }
}

// Each pose starts from a neutral face so a hit or victory never leaves a
// stale expression on the next turn. Direct face weights support cinematics.
export function facialExpressionWeights(p = {}, time = 0) {
  if (!p || typeof p !== "object") p = {};
  const seconds = typeof time === "number" && Number.isFinite(time) ? time : 0;
  const phase = ((seconds % 4.8) + 4.8) % 4.8;
  const weights = Object.fromEntries(FACIAL_TARGETS.map((target) => [target, 0]));
  weights.blink = Math.max(0, 1 - Math.abs(phase - 0.15) / 0.11);

  const intensity = Object.hasOwn(p, "expressionIntensity")
    ? clampWeight(p.expressionIntensity)
    : 1;
  if (typeof p.expression === "string") {
    const name = p.expression.trim().toLowerCase();
    if (Object.hasOwn(PRESETS, name)) apply(weights, PRESETS[name], intensity);
    else {
      const target = FACIAL_TARGETS.find((candidate) => candidate.toLowerCase() === name);
      if (target) weights[target] = intensity;
    }
  } else {
    apply(weights, p.expression, intensity);
  }
  apply(weights, p.face);
  if (Object.hasOwn(p, "blink")) weights.blink = clampWeight(p.blink);
  return weights;
}
