// @ts-check

/** @typedef {'ready'|'active'|'settling'|'finished'} RoundPhase */
/** @typedef {{ levelId: string, seed: number, durationMs: number, remainingMs: number, phase: RoundPhase, score: number, coinsEarned: number, fishEaten: number, fishCountsById: Record<string, number>, boostUses: number, endedReason?: string, settled: boolean }} RoundState */
/** @param {{ levelId: string, seed: number, durationMs?: number }} config @returns {RoundState} */
export function createRound(config) {
  const durationMs = config.durationMs ?? 20000;
  return {
    levelId: config.levelId,
    seed: config.seed,
    durationMs,
    remainingMs: durationMs,
    phase: 'ready',
    score: 0,
    coinsEarned: 0,
    fishEaten: 0,
    fishCountsById: {},
    boostUses: 0,
    settled: false,
  };
}
/** @param {RoundState} round @returns {RoundState} */
export function startRound(round) {
  return round.phase === 'ready' ? { ...round, phase: 'active' } : round;
}
/** Uses gameplay delta verbatim: no timer clamp permits extra playing time. @param {RoundState} round @param {number} gameplayDeltaMs @returns {RoundState} */
export function advanceRound(round, gameplayDeltaMs) {
  if (round.phase !== 'active') return round;
  const remainingMs = Math.max(0, round.remainingMs - Math.max(0, gameplayDeltaMs));
  return remainingMs === 0
    ? { ...round, remainingMs, phase: 'settling', endedReason: 'time' }
    : { ...round, remainingMs };
}
/** @param {RoundState} round @param {{ id: string, scoreValue: number, coinValue: number, sizeTier: number }} fish @param {number} sharkTier @returns {RoundState} */
export function recordEat(round, fish, sharkTier) {
  if (round.phase !== 'active' || sharkTier < fish.sizeTier) return round;
  return {
    ...round,
    score: round.score + fish.scoreValue,
    coinsEarned: round.coinsEarned + fish.coinValue,
    fishEaten: round.fishEaten + 1,
    fishCountsById: {
      ...round.fishCountsById,
      [fish.id]: (round.fishCountsById[fish.id] ?? 0) + 1,
    },
  };
}
/** @param {RoundState} round @returns {RoundState} */
export function recordBoostUse(round) {
  return round.phase === 'active' ? { ...round, boostUses: round.boostUses + 1 } : round;
}
/** @typedef {{ levelId: string, seed: number, durationMs: number, score: number, coinsEarned: number, fishEaten: number, fishCountsById: Record<string, number>, boostUses: number, endedReason: string }} RunSummary */
/** Idempotently turns a stopped round into immutable settlement data. @param {RoundState} round @returns {{ round: RoundState, summary: Readonly<RunSummary>|null }} */
export function finishRound(round) {
  if (round.settled) return { round, summary: null };
  /** @type {RoundState} */
  const stopped = {
    ...round,
    phase: 'finished',
    settled: true,
    endedReason: round.endedReason ?? 'quit',
  };
  return {
    round: stopped,
    summary: Object.freeze({
      levelId: stopped.levelId,
      seed: stopped.seed,
      durationMs: stopped.durationMs,
      score: stopped.score,
      coinsEarned: stopped.coinsEarned,
      fishEaten: stopped.fishEaten,
      fishCountsById: stopped.fishCountsById,
      boostUses: stopped.boostUses,
      endedReason: stopped.endedReason ?? 'quit',
    }),
  };
}
