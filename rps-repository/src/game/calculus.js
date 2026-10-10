export const clampResource = (value) => Math.max(0, Math.min(100, value));
export function resourceRates(run, stance) {
  return {
    heat:
      (stance === "overdrive" ? 38 : stance === "guard" ? 4 : 14) +
      (run.enemy.ability?.id === "thermal" ? 10 : 0) -
      run.enemy.district.cooling -
      run.upgrades.coolant * 6,
    charge:
      (stance === "overdrive" ? -40 : stance === "guard" ? 22 : 14) +
      run.upgrades.battery * 6 +
      (run.enemy.district.chargeBonus || 0),
  };
}
export function resourceProjection(run, stance, time = 1) {
  const rates = resourceRates(run, stance);
  return {
    heat: clampResource(run.heat + rates.heat * time),
    charge: clampResource(run.charge + rates.charge * time),
  };
}
// A normalized pulse: integrating 6D t(1-t) from 0 to 1 gives exactly D impact.
export function pulseRate(damage, time) {
  const t = Math.max(0, Math.min(1, time));
  return 6 * damage * t * (1 - t);
}
export function pulseIntegral(damage, time = 1) {
  const t = Math.max(0, Math.min(1, time));
  return damage * (3 * t * t - 2 * t * t * t);
}
export function riemannSum(damage, slices) {
  return Array.from(
    { length: slices },
    (_, i) => pulseRate(damage, (i + 0.5) / slices) / slices,
  ).reduce((total, area) => total + area, 0);
}
