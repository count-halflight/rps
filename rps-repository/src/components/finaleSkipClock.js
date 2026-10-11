export const FINALE_SKIP_WAIT = 2000;
export const FINALE_SKIP_HOLD = 2000;

export function finaleSkipReady(elapsed, paused = false) {
  return !paused && Number.isFinite(elapsed) && elapsed >= FINALE_SKIP_WAIT;
}

export function finaleHoldProgress(now, holdStartedAt) {
  if (holdStartedAt === null || !Number.isFinite(now) || !Number.isFinite(holdStartedAt)) return 0;
  return Math.max(0, Math.min(1, (now - holdStartedAt) / FINALE_SKIP_HOLD));
}
