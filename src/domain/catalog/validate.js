// @ts-check

import { FISH_BEHAVIORS } from '../progression/fish-behaviors.js';
import { UPGRADE_EFFECTS } from '../progression/progression.js';

/** @typedef {{fishCatalog: readonly any[], levelCatalog: readonly any[], upgradeCatalog: readonly any[], assetCatalog: readonly any[]}} Catalogs */
/** @typedef {{ behaviorRegistry?: Record<string, unknown>, effectRegistry?: Record<string, unknown>, assetPathExists?: (path: string) => boolean }} ValidationOptions */

/** @param {string[]} errors @param {readonly any[]} entries @param {string} label */
function requireUniqueIds(errors, entries, label) {
  const found = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id)
      errors.push(`${label} has an invalid id`);
    else if (found.has(entry.id)) errors.push(`Duplicate ${label} id: ${entry.id}`);
    else found.add(entry.id);
  }
}

/** Validates static game content without importing runtime or Phaser code.
 * @param {Catalogs} catalogs @param {ValidationOptions} [options] @returns {string[]} diagnostic messages */
export function validateCatalogs(catalogs, options = {}) {
  const errors = [];
  const { fishCatalog, levelCatalog, upgradeCatalog, assetCatalog } = catalogs;
  requireUniqueIds(errors, fishCatalog, 'fish');
  requireUniqueIds(errors, levelCatalog, 'level');
  requireUniqueIds(errors, upgradeCatalog, 'upgrade');
  requireUniqueIds(errors, assetCatalog, 'asset');
  const assetIds = new Set(assetCatalog.map((item) => item.id));
  const behaviorRegistry = options.behaviorRegistry ?? FISH_BEHAVIORS;
  const effectRegistry = options.effectRegistry ?? UPGRADE_EFFECTS;
  for (const asset of assetCatalog) {
    if (typeof asset.path !== 'string' || !asset.path)
      errors.push(`Asset ${asset.id} has invalid path`);
    else if (options.assetPathExists && !options.assetPathExists(asset.path))
      errors.push(`Asset ${asset.id} is missing at path: ${asset.path}`);
  }
  const fishById = new Map(fishCatalog.map((fish) => [fish.id, fish]));
  const upgradeById = new Map(upgradeCatalog.map((upgrade) => [upgrade.id, upgrade]));
  for (const fish of fishCatalog) {
    if (!assetIds.has(fish.textureKey))
      errors.push(`Fish ${fish.id} references missing asset: ${fish.textureKey}`);
    if (!Number.isInteger(fish.sizeTier) || fish.sizeTier < 1)
      errors.push(`Fish ${fish.id} has illegal tier`);
    for (const field of ['collisionRadius', 'scoreValue', 'coinValue', 'baseSpeed', 'turnRate'])
      if (!(Number.isFinite(fish[field]) && fish[field] >= 0))
        errors.push(`Fish ${fish.id} has invalid ${field}`);
    if (typeof fish.behaviorId !== 'string' || !fish.behaviorId)
      errors.push(`Fish ${fish.id} has no behavior id`);
    else if (!behaviorRegistry[fish.behaviorId])
      errors.push(`Fish ${fish.id} references unknown behavior: ${fish.behaviorId}`);
  }
  const levelOrders = new Set();
  for (const level of levelCatalog) {
    if (level.musicKey !== null && !assetIds.has(level.musicKey))
      errors.push(`Level ${level.id} references missing asset: ${level.musicKey}`);
    if (!Number.isSafeInteger(level.order) || level.order < 1 || levelOrders.has(level.order))
      errors.push(`Level ${level.id} has invalid or duplicate order`);
    levelOrders.add(level.order);
    if (!Number.isSafeInteger(level.durationMs) || level.durationMs <= 0)
      errors.push(`Level ${level.id} has invalid duration`);
    if (
      !level.unlock ||
      !Number.isSafeInteger(level.unlock.lifetimeFishEaten) ||
      level.unlock.lifetimeFishEaten < 0
    )
      errors.push(`Level ${level.id} has invalid unlock`);
    if (
      !(
        Number.isInteger(level.initialFish) &&
        level.initialFish > 0 &&
        level.initialFish <= level.maxAlive
      )
    )
      errors.push(`Level ${level.id} has invalid fish caps`);
    if (
      !(
        Number.isFinite(level.minEdibleRatio) &&
        level.minEdibleRatio > 0 &&
        level.minEdibleRatio <= 1
      )
    )
      errors.push(`Level ${level.id} has invalid edible ratio`);
    let hasTierOne = false;
    for (const entry of level.spawnEntries || []) {
      const fish = fishById.get(entry.fishId);
      if (!fish) errors.push(`Level ${level.id} references unknown fish: ${entry.fishId}`);
      else if (fish.sizeTier === 1) hasTierOne = true;
      if (!(Number.isFinite(entry.weight) && entry.weight > 0))
        errors.push(`Level ${level.id} has invalid weight for ${entry.fishId}`);
    }
    if (!hasTierOne) errors.push(`Level ${level.id} has no edible fish for a tier-1 shark`);
  }
  for (const upgrade of upgradeCatalog) {
    if (
      !Number.isInteger(upgrade.maxRank) ||
      upgrade.maxRank < 1 ||
      upgrade.ranks.length !== upgrade.maxRank
    )
      errors.push(`Upgrade ${upgrade.id} has invalid ranks`);
    if (!effectRegistry[upgrade.effectId])
      errors.push(`Upgrade ${upgrade.id} references unknown effect: ${upgrade.effectId}`);
    for (const [index, rank] of upgrade.ranks.entries()) {
      if (!(Number.isFinite(rank.cost) && rank.cost >= 0))
        errors.push(`Upgrade ${upgrade.id} has negative or invalid cost`);
      if (!Number.isSafeInteger(rank.rank) || rank.rank !== index + 1)
        errors.push(`Upgrade ${upgrade.id} has invalid rank number`);
      if (!rank.effect || typeof rank.effect !== 'object')
        errors.push(`Upgrade ${upgrade.id} rank ${index + 1} has invalid effect`);
      else if (Object.values(rank.effect).some((value) => !Number.isFinite(value)))
        errors.push(`Upgrade ${upgrade.id} rank ${index + 1} has non-numeric effect`);
    }
    for (const prerequisiteId of upgrade.prerequisiteIds)
      if (!upgradeById.has(prerequisiteId))
        errors.push(`Upgrade ${upgrade.id} references unknown prerequisite: ${prerequisiteId}`);
  }
  const visiting = new Set();
  const visited = new Set();
  /** @param {string} id */
  const visit = (id) => {
    if (visiting.has(id)) {
      errors.push(`Upgrade prerequisites are unreachable: ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of upgradeById.get(id).prerequisiteIds) if (upgradeById.has(next)) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const upgrade of upgradeCatalog) visit(upgrade.id);
  return errors;
}

/** @param {Catalogs} catalogs @param {ValidationOptions} [options] */
export function assertValidCatalogs(catalogs, options) {
  const errors = validateCatalogs(catalogs, options);
  if (errors.length) throw new Error(`Invalid content catalog:\n${errors.join('\n')}`);
}
