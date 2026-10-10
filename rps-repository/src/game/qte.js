// Presentation inputs use the same monotonic clock as the attack timeline.
// They never reroll an earned hand or turn a knockout into a hidden loss.
export const QTE_CHARGE_PER_HIT = 3;

export function createQteTrack(cues, duration, enabled = true) {
  if (!enabled) return [];
  return cues.map(cue => ({
    ...cue,
    opensAt: Math.round(cue.at * duration),
    closesAt: Math.round(cue.end * duration),
    status: 'pending',
  }));
}

export function activeQte(track, elapsed) {
  return track.find(cue => cue.status === 'pending' && elapsed >= cue.opensAt && elapsed < cue.closesAt) || null;
}

export function expireQtes(track, elapsed) {
  return track.map(cue => cue.status === 'pending' && elapsed >= cue.closesAt
    ? { ...cue, status: 'missed', resolvedAt: cue.closesAt }
    : cue);
}

export function pressQte(track, key, elapsed) {
  const current = expireQtes(track, elapsed);
  const cue = activeQte(current, elapsed);
  if (!cue) return { track: current, result: null };
  const status = String(key) === cue.key ? 'hit' : 'missed';
  return {
    track: current.map(entry => entry.id === cue.id ? { ...entry, status, resolvedAt: elapsed } : entry),
    result: { id: cue.id, status },
  };
}

export function qteScore(track, completed = false) {
  if (!track.length) return 1;
  const resolved = completed ? track : track.filter(cue => cue.status !== 'pending');
  if (!resolved.length) return 1;
  return resolved.filter(cue => cue.status === 'hit').length / resolved.length;
}

export function qteCharge(track) {
  return track.filter(cue => cue.status === 'hit').length * QTE_CHARGE_PER_HIT;
}
