// @ts-check

/** @typedef {{ muted: boolean, reducedEffects: 'auto'|'on'|'off' }} Settings */
/** @typedef {{ movementSeen: boolean, bumpSeen: boolean, boostSeen: boolean, shopSeen: boolean }} Tutorial */
/** @typedef {{ schemaVersion: number, revision: number, coins: number, lifetimeScore: number, lifetimeFishEaten: number, bestScoreByLevel: Record<string, number>, unlockedLevelIds: string[], completedRunKeys: string[], upgradeRanks: Record<string, number>, settings: Settings, tutorial: Tutorial }} Profile */

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_STORAGE_KEY = 'sharkyTheClaw.profile';
export const PROFILE_BACKUP_KEY = `${PROFILE_STORAGE_KEY}.backup`;

/** @returns {Profile} */
export function createDefaultProfile() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    revision: 0,
    coins: 0,
    lifetimeScore: 0,
    lifetimeFishEaten: 0,
    bestScoreByLevel: {},
    unlockedLevelIds: ['sunny-lagoon'],
    completedRunKeys: [],
    upgradeRanks: { growth: 0, boost: 0 },
    settings: { muted: false, reducedEffects: 'auto' },
    tutorial: { movementSeen: false, bumpSeen: false, boostSeen: false, shopSeen: false },
  };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** @param {unknown} value @param {number} fallback */
function nonNegativeInt(value, fallback = 0) {
  return Number.isSafeInteger(value) && /** @type {number} */ (value) >= 0
    ? /** @type {number} */ (value)
    : fallback;
}
/** @param {unknown} value @param {boolean} fallback */
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Produces a safe schema-v1 profile while preserving IDs unknown to this build.
 * @param {unknown} candidate
 * @returns {Profile}
 */
export function normalizeProfile(candidate) {
  const defaults = createDefaultProfile();
  if (!isRecord(candidate)) return defaults;
  const best = isRecord(candidate.bestScoreByLevel) ? candidate.bestScoreByLevel : {};
  /** @type {Record<string, number>} */
  const bestScoreByLevel = {};
  for (const [levelId, score] of Object.entries(best))
    if (Number.isSafeInteger(score) && /** @type {number} */ (score) >= 0)
      bestScoreByLevel[levelId] = /** @type {number} */ (score);
  const ids = Array.isArray(candidate.unlockedLevelIds)
    ? [
        ...new Set(
          candidate.unlockedLevelIds.filter((id) => typeof id === 'string' && id.length > 0),
        ),
      ]
    : defaults.unlockedLevelIds;
  const completedRunKeys = Array.isArray(candidate.completedRunKeys)
    ? [...new Set(candidate.completedRunKeys.filter((key) => typeof key === 'string'))].slice(-200)
    : [];
  const ranks = isRecord(candidate.upgradeRanks) ? candidate.upgradeRanks : {};
  /** @type {Record<string, number>} */
  const upgradeRanks = {};
  for (const [track, rank] of Object.entries(ranks))
    if (Number.isSafeInteger(rank) && /** @type {number} */ (rank) >= 0)
      upgradeRanks[track] = /** @type {number} */ (rank);
  for (const [track, rank] of Object.entries(defaults.upgradeRanks))
    upgradeRanks[track] = nonNegativeInt(upgradeRanks[track], rank);
  const settings = isRecord(candidate.settings) ? candidate.settings : {};
  const reduced = settings.reducedEffects;
  const tutorial = isRecord(candidate.tutorial) ? candidate.tutorial : {};
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    revision: nonNegativeInt(candidate.revision),
    coins: nonNegativeInt(candidate.coins),
    lifetimeScore: nonNegativeInt(candidate.lifetimeScore),
    lifetimeFishEaten: nonNegativeInt(candidate.lifetimeFishEaten),
    bestScoreByLevel,
    unlockedLevelIds: ids.includes('sunny-lagoon') ? ids : ['sunny-lagoon', ...ids],
    completedRunKeys,
    upgradeRanks,
    settings: {
      muted: bool(settings.muted, false),
      reducedEffects:
        reduced === 'on' || reduced === 'off' || reduced === 'auto' ? reduced : 'auto',
    },
    tutorial: {
      movementSeen: bool(tutorial.movementSeen, false),
      bumpSeen: bool(tutorial.bumpSeen, false),
      boostSeen: bool(tutorial.boostSeen, false),
      shopSeen: bool(tutorial.shopSeen, false),
    },
  };
}

/** @param {Profile} profile */
export function cloneProfile(profile) {
  return structuredClone(profile);
}
