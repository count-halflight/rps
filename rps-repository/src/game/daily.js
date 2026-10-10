export const dailyDate = (date = new Date()) => date.toISOString().slice(0, 10);
export function dailySeed(day = dailyDate()) {
  let hash = 2166136261;
  for (const character of `afterlight:${day}`)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export const dailyLabel = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
