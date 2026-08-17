// @ts-check

/** @typedef {{rank: number, cost: number, effect: Readonly<Record<string, number>>}} UpgradeRank */
/** @typedef {{id: string, displayName: string, track: string, effectId: string, maxRank: number, ranks: readonly UpgradeRank[], prerequisiteIds: readonly string[]}} UpgradeDefinition */

/** @type {readonly UpgradeDefinition[]} */
export const upgradeCatalog = Object.freeze(
  [
    {
      id: 'boost',
      displayName: 'Boost',
      track: 'boost',
      effectId: 'boost',
      maxRank: 2,
      ranks: Object.freeze([
        Object.freeze({
          rank: 1,
          cost: 25,
          effect: Object.freeze({
            multiplier: 1.6,
            durationMs: 1000,
            cooldownMs: 5000,
          }),
        }),
        Object.freeze({
          rank: 2,
          cost: 90,
          effect: Object.freeze({
            multiplier: 1.9,
            durationMs: 1200,
            cooldownMs: 4000,
          }),
        }),
      ]),
      prerequisiteIds: Object.freeze([]),
    },
    {
      id: 'growth',
      displayName: 'Growth',
      track: 'growth',
      effectId: 'growth',
      maxRank: 2,
      ranks: Object.freeze([
        Object.freeze({
          rank: 1,
          cost: 50,
          effect: Object.freeze({
            sizeTier: 2,
            visualScale: 1.25,
            collisionRadius: 34,
          }),
        }),
        Object.freeze({
          rank: 2,
          cost: 120,
          effect: Object.freeze({
            sizeTier: 3,
            visualScale: 1.5,
            collisionRadius: 44,
          }),
        }),
      ]),
      prerequisiteIds: Object.freeze([]),
    },
  ].map((upgrade) => Object.freeze(upgrade)),
);

export const upgradeIds = Object.freeze(new Set(upgradeCatalog.map((upgrade) => upgrade.id)));
