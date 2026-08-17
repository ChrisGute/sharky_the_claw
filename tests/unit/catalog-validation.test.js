// @ts-check
import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/assets.js';
import { fishCatalog } from '../../src/content/fish.js';
import { levelCatalog } from '../../src/content/levels.js';
import { upgradeCatalog } from '../../src/content/upgrades.js';
import { assertValidCatalogs, validateCatalogs } from '../../src/domain/catalog/validate.js';

const good = () => structuredClone({ assetCatalog, fishCatalog, levelCatalog, upgradeCatalog });

describe('content catalog validation', () => {
  it('accepts the shipped catalogs', () => {
    expect(validateCatalogs(good())).toEqual([]);
    expect(() => assertValidCatalogs(good())).not.toThrow();
  });

  it('detects duplicate ids and missing assets', () => {
    const catalogs = /** @type {any} */ (good());
    catalogs.fishCatalog.push(structuredClone(catalogs.fishCatalog[0]));
    catalogs.fishCatalog[1].textureKey = 'does-not-exist';
    expect(validateCatalogs(catalogs).join('\n')).toMatch(/Duplicate fish id: minnow/);
    expect(validateCatalogs(catalogs).join('\n')).toMatch(/missing asset/);
  });

  it('rejects unknown references, bad weights, and levels without edible fish', () => {
    const catalogs = good();
    catalogs.levelCatalog[0].spawnEntries = [{ fishId: 'ghost', weight: -1 }];
    const diagnostics = validateCatalogs(catalogs).join('\n');
    expect(diagnostics).toMatch(/unknown fish: ghost/);
    expect(diagnostics).toMatch(/invalid weight/);
    expect(diagnostics).toMatch(/no edible fish/);
  });

  it('rejects illegal fish tiers and negative costs', () => {
    const catalogs = good();
    catalogs.fishCatalog[0].sizeTier = 0;
    catalogs.upgradeCatalog[0].ranks[0].cost = -1;
    const diagnostics = validateCatalogs(catalogs).join('\n');
    expect(diagnostics).toMatch(/illegal tier/);
    expect(diagnostics).toMatch(/negative or invalid cost/);
  });
  it('rejects malformed ids, fields, caps, missing music, and rank shapes', () => {
    const catalogs = /** @type {any} */ (good());
    catalogs.assetCatalog[0].id = '';
    catalogs.fishCatalog[0].collisionRadius = -1;
    catalogs.fishCatalog[0].behaviorId = '';
    catalogs.levelCatalog[0].musicKey = 'gone';
    catalogs.levelCatalog[0].initialFish = 99;
    catalogs.levelCatalog[0].minEdibleRatio = 2;
    catalogs.upgradeCatalog[0].maxRank = 3;
    const diagnostics = validateCatalogs(catalogs).join('\n');
    expect(diagnostics).toMatch(
      /invalid id|invalid collisionRadius|no behavior|missing asset|invalid fish caps|invalid edible ratio|invalid ranks/,
    );
  });

  it('rejects unknown and cyclic upgrade prerequisites', () => {
    const catalogs = good();
    catalogs.upgradeCatalog[0].prerequisiteIds = ['ghost'];
    catalogs.upgradeCatalog[1].prerequisiteIds = ['boost'];
    catalogs.upgradeCatalog[0].prerequisiteIds = ['growth'];
    const diagnostics = validateCatalogs(catalogs).join('\n');
    expect(diagnostics).toMatch(/unreachable/);
  });

  it('freezes the published catalog containers and nested authored entries', () => {
    expect(Object.isFrozen(fishCatalog)).toBe(true);
    expect(Object.isFrozen(fishCatalog[0])).toBe(true);
    expect(Object.isFrozen(levelCatalog[0].spawnEntries)).toBe(true);
    expect(Object.isFrozen(upgradeCatalog[0].ranks[0].effect)).toBe(true);
  });
  it('rejects missing registry entries, malformed level metadata, rank effects, and paths', () => {
    const catalogs = /** @type {any} */ (good());
    catalogs.fishCatalog[0].behaviorId = 'teleport';
    catalogs.upgradeCatalog[0].effectId = 'unknown-effect';
    catalogs.upgradeCatalog[0].ranks[0].effect = { multiplier: 'fast' };
    catalogs.levelCatalog[0].order = 0;
    catalogs.levelCatalog[0].durationMs = 0;
    catalogs.levelCatalog[0].unlock = { lifetimeFishEaten: -1 };
    const diagnostics = validateCatalogs(catalogs, { assetPathExists: () => false }).join('\n');
    expect(diagnostics).toMatch(/unknown behavior/);
    expect(diagnostics).toMatch(/unknown effect/);
    expect(diagnostics).toMatch(/non-numeric effect/);
    expect(diagnostics).toMatch(/invalid or duplicate order/);
    expect(diagnostics).toMatch(/invalid duration/);
    expect(diagnostics).toMatch(/invalid unlock/);
    expect(diagnostics).toMatch(/missing at path/);
  });
});
