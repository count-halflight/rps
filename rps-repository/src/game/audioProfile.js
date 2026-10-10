const ratio = (value) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
export function battleSoundProfile(enemyIntegrity = 1, playerIntegrity = 1) {
  const enemy = ratio(enemyIntegrity),
    player = ratio(playerIntegrity);
  const intensity = 1 - enemy;
  return {
    intensity,
    bpm: 84 + intensity * 72,
    musicGain: 0.45 + intensity * 0.4,
    cutoff: 220 + Math.pow(player, 1.7) * 3200,
    heartbeatBpm: 80 + (1 - player) * 65,
    heartbeatGain: player < 0.45 ? (1 - player / 0.45) * 0.075 : 0,
  };
}
