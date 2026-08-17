// @ts-check

/** @typedef {{fishId: string, weight: number}} SpawnEntry */
/** @typedef {{id: string, displayName: string, order: number, durationMs: number, unlock: Readonly<{lifetimeFishEaten: number}>, palette: string, musicKey: string|null, initialFish: number, maxAlive: number, replacementIntervalMs: number, minEdibleRatio: number, spawnEntries: readonly SpawnEntry[]}} LevelDefinition */

/** @type {readonly LevelDefinition[]} */
export const levelCatalog = Object.freeze(
  [
    {
      id: 'sunny-lagoon',
      displayName: 'Sunny Lagoon',
      order: 1,
      durationMs: 20000,
      unlock: Object.freeze({ lifetimeFishEaten: 0 }),
      palette: 'lagoon',
      musicKey: null,
      initialFish: 15,
      maxAlive: 18,
      replacementIntervalMs: 650,
      minEdibleRatio: 0.6,
      spawnEntries: Object.freeze([
        Object.freeze({ fishId: 'minnow', weight: 55 }),
        Object.freeze({ fishId: 'sardine', weight: 35 }),
        Object.freeze({ fishId: 'pufferfish', weight: 10 }),
      ]),
    },
    {
      id: 'coral-reef',
      displayName: 'Coral Reef',
      order: 2,
      durationMs: 20000,
      unlock: Object.freeze({ lifetimeFishEaten: 100 }),
      palette: 'reef',
      musicKey: null,
      initialFish: 17,
      maxAlive: 20,
      replacementIntervalMs: 550,
      minEdibleRatio: 0.6,
      spawnEntries: Object.freeze([
        Object.freeze({ fishId: 'anchovy', weight: 45 }),
        Object.freeze({ fishId: 'parrotfish', weight: 30 }),
        Object.freeze({ fishId: 'golden-fish', weight: 15 }),
        Object.freeze({ fishId: 'grouper', weight: 10 }),
      ]),
    },
  ].map((level) => Object.freeze(level)),
);

export const levelIds = Object.freeze(new Set(levelCatalog.map((level) => level.id)));
