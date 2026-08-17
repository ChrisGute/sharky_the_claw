// @ts-check

/** @typedef {import('../save/profile.js').Profile} Profile */
/** @typedef {{ id: string, track: string, effectId: string, ranks: readonly { cost: number, effect: Record<string, number> }[], prerequisiteIds?: readonly string[] }} UpgradeDefinition */
/** @typedef {{ id: string, unlock?: { lifetimeFishEaten?: number } }} LevelDefinition */
/** @typedef {{ scoreValue: number, coinValue: number, sizeTier: number }} FishDefinition */

/** @param {Profile} profile @param {readonly LevelDefinition[]} levels */
export function reconcileUnlocks(profile, levels) {
  const unlocked = new Set(profile.unlockedLevelIds);
  for (const level of levels)
    if ((level.unlock?.lifetimeFishEaten ?? 0) <= profile.lifetimeFishEaten) unlocked.add(level.id);
  return { ...profile, unlockedLevelIds: [...unlocked] };
}

/** @param {number} sharkTier @param {FishDefinition} fish */
export function canEatFish(sharkTier, fish) {
  return Number.isInteger(sharkTier) && sharkTier >= fish.sizeTier;
}

/** @param {{ score: number, coinsEarned: number, fishEaten: number, fishCountsById: Record<string, number> }} round @param {FishDefinition} fish @param {number} sharkTier */
export function eatFish(round, fish, sharkTier) {
  if (!canEatFish(sharkTier, fish)) return round;
  return {
    score: round.score + fish.scoreValue,
    coinsEarned: round.coinsEarned + fish.coinValue,
    fishEaten: round.fishEaten + 1,
    fishCountsById: {
      ...round.fishCountsById,
      [/** @type {any} */ (fish).id]: (round.fishCountsById[/** @type {any} */ (fish).id] ?? 0) + 1,
    },
  };
}

/** @param {Profile} profile @param {{ levelId: string, score: number, coinsEarned: number, fishEaten: number }} summary @param {readonly LevelDefinition[]} levels */
export function bankRun(profile, summary, levels) {
  const best = Math.max(profile.bestScoreByLevel[summary.levelId] ?? 0, summary.score);
  return reconcileUnlocks(
    {
      ...profile,
      coins: profile.coins + summary.coinsEarned,
      lifetimeScore: profile.lifetimeScore + summary.score,
      lifetimeFishEaten: profile.lifetimeFishEaten + summary.fishEaten,
      bestScoreByLevel: { ...profile.bestScoreByLevel, [summary.levelId]: best },
    },
    levels,
  );
}

/** @param {Profile} profile @param {UpgradeDefinition} upgrade @param {readonly UpgradeDefinition[]} catalog */
export function purchaseUpgrade(profile, upgrade, catalog) {
  const rank = profile.upgradeRanks[upgrade.track] ?? 0;
  if (rank >= upgrade.ranks.length) return { ok: false, reason: 'maximum-rank', profile };
  for (const prerequisiteId of upgrade.prerequisiteIds ?? []) {
    const prerequisite = catalog.find((entry) => entry.id === prerequisiteId);
    if (
      !prerequisite ||
      (profile.upgradeRanks[prerequisite.track] ?? 0) < prerequisite.ranks.length
    )
      return { ok: false, reason: 'prerequisite', profile };
  }
  const cost = upgrade.ranks[rank].cost;
  if (profile.coins < cost) return { ok: false, reason: 'insufficient-funds', profile };
  return {
    ok: true,
    profile: {
      ...profile,
      coins: profile.coins - cost,
      upgradeRanks: { ...profile.upgradeRanks, [upgrade.track]: rank + 1 },
    },
  };
}

/** @typedef {{ sizeTier: number, visualScale: number, collisionRadius: number, moveSpeed: number, acceleration: number, arrivalRadius: number, boostMultiplier: number, boostDurationMs: number, boostCooldownMs: number }} PlayerStats */
/** @type {PlayerStats} */
const BASE_STATS = Object.freeze({
  sizeTier: 1,
  visualScale: 1,
  collisionRadius: 24,
  moveSpeed: 280,
  acceleration: 1600,
  arrivalRadius: 24,
  boostMultiplier: 1,
  boostDurationMs: 0,
  boostCooldownMs: 0,
});
/** @type {Record<string, (stats: PlayerStats, effect: Record<string, number>) => PlayerStats>} */
export const UPGRADE_EFFECTS = Object.freeze({
  growth: (s, effect) => ({
    ...s,
    sizeTier: effect.sizeTier,
    visualScale: effect.visualScale,
    collisionRadius: effect.collisionRadius,
  }),
  boost: (s, effect) => ({
    ...s,
    boostMultiplier: effect.multiplier,
    boostDurationMs: effect.durationMs,
    boostCooldownMs: effect.cooldownMs,
  }),
});
/** @param {Profile} profile @param {readonly UpgradeDefinition[]} catalog @returns {PlayerStats} */
export function compilePlayerStats(profile, catalog) {
  let stats = { ...BASE_STATS };
  for (const upgrade of catalog)
    for (
      let index = 0;
      index < Math.min(profile.upgradeRanks[upgrade.track] ?? 0, upgrade.ranks.length);
      index += 1
    ) {
      const effect = UPGRADE_EFFECTS[upgrade.effectId];
      if (effect) stats = effect(stats, upgrade.ranks[index].effect);
    }
  return stats;
}
