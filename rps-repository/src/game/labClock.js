export function advanceLabClock(clock, delta, duration) {
  if (!clock.playing) return clock;
  const elapsed = clock.time + Math.max(0, Math.min(delta, .25)) * clock.rate;
  if (elapsed < duration) return { ...clock, time: elapsed };
  return clock.loop
    ? { ...clock, time: elapsed % duration }
    : { ...clock, time: duration, playing: false };
}

export function contactSheetTimes(duration, count = 12) {
  return Array.from({ length: count }, (_, i) => duration * (i + .35) / count);
}
