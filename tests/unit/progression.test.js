// @ts-check
import { describe, expect, it } from 'vitest';
import { fishCatalog } from '../../src/content/fish.js';
import { levelCatalog } from '../../src/content/levels.js';
import { upgradeCatalog } from '../../src/content/upgrades.js';
import {
  bankRun,
  canEatFish,
  compilePlayerStats,
  eatFish,
  purchaseUpgrade,
  reconcileUnlocks,
} from '../../src/domain/progression/progression.js';
import { fleeVector, getFishBehavior } from '../../src/domain/progression/fish-behaviors.js';
import { createDefaultProfile } from '../../src/domain/save/profile.js';

describe('progression', () => {
  it('uses inclusive size boundaries and has no score for an oversized fish', () => {
    expect(canEatFish(1, fishCatalog[0])).toBe(true);
    expect(canEatFish(1, fishCatalog[2])).toBe(false);
    const round = { score: 0, coinsEarned: 0, fishEaten: 0, fishCountsById: {} };
    expect(eatFish(round, fishCatalog[2], 1)).toBe(round);
    expect(eatFish(round, fishCatalog[0], 1)).toMatchObject({
      score: 1,
      coinsEarned: 1,
      fishEaten: 1,
    });
  });
  it('unlocks Reef at exactly 100 and never removes an earned unlock', () => {
    const at99 = reconcileUnlocks(
      { ...createDefaultProfile(), lifetimeFishEaten: 99 },
      levelCatalog,
    );
    expect(at99.unlockedLevelIds).not.toContain('coral-reef');
    const at100 = reconcileUnlocks({ ...at99, lifetimeFishEaten: 100 }, levelCatalog);
    expect(at100.unlockedLevelIds).toContain('coral-reef');
    expect(
      reconcileUnlocks({ ...at100, lifetimeFishEaten: 0 }, levelCatalog).unlockedLevelIds,
    ).toContain('coral-reef');
  });
  it('banks separate permanent records and coins', () => {
    const profile = bankRun(
      createDefaultProfile(),
      { levelId: 'sunny-lagoon', score: 12, coinsEarned: 12, fishEaten: 4 },
      levelCatalog,
    );
    expect(profile).toMatchObject({
      coins: 12,
      lifetimeScore: 12,
      lifetimeFishEaten: 4,
      bestScoreByLevel: { 'sunny-lagoon': 12 },
    });
  });
  it('requires funds, consumes exact cost, and cannot duplicate a rank purchase', () => {
    const boost = upgradeCatalog[0];
    expect(purchaseUpgrade(createDefaultProfile(), boost, upgradeCatalog)).toMatchObject({
      ok: false,
      reason: 'insufficient-funds',
    });
    const bought = purchaseUpgrade({ ...createDefaultProfile(), coins: 25 }, boost, upgradeCatalog);
    expect(bought).toMatchObject({ ok: true, profile: { coins: 0, upgradeRanks: { boost: 1 } } });
    expect(
      purchaseUpgrade(/** @type {any} */ (bought.profile), boost, upgradeCatalog),
    ).toMatchObject({ ok: false, reason: 'insufficient-funds' });
  });
  it('stops at maximum rank and compiles stats idempotently', () => {
    const maxed = { ...createDefaultProfile(), upgradeRanks: { growth: 2, boost: 2 } };
    expect(purchaseUpgrade(maxed, upgradeCatalog[0], upgradeCatalog)).toMatchObject({
      ok: false,
      reason: 'maximum-rank',
    });
    const once = compilePlayerStats(maxed, upgradeCatalog);
    expect(compilePlayerStats(maxed, upgradeCatalog)).toEqual(once);
    expect(once).toMatchObject({
      sizeTier: 3,
      visualScale: 1.5,
      collisionRadius: 44,
      boostMultiplier: 1.9,
      boostDurationMs: 1200,
      boostCooldownMs: 4000,
    });
  });
  it('uses stable behavior identifiers and produces a pure flee vector', () => {
    expect(getFishBehavior('flee')).toMatchObject({ id: 'flee' });
    expect(getFishBehavior('missing')).toBeNull();
    expect(fleeVector({ x: 3, y: 0 }, { x: 0, y: 0 }, 10)).toEqual({ x: 10, y: 0 });
    expect(fleeVector({ x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toEqual({ x: 0, y: 0 });
  });
  it('rejects invalid tiers and unmet or unknown prerequisites', () => {
    expect(canEatFish(1.5, fishCatalog[0])).toBe(false);
    const gated = { ...upgradeCatalog[0], prerequisiteIds: ['growth'] };
    expect(
      purchaseUpgrade({ ...createDefaultProfile(), coins: 100 }, gated, upgradeCatalog),
    ).toMatchObject({
      ok: false,
      reason: 'prerequisite',
    });
    expect(
      purchaseUpgrade(
        { ...createDefaultProfile(), coins: 100 },
        { ...gated, prerequisiteIds: ['gone'] },
        upgradeCatalog,
      ),
    ).toMatchObject({ ok: false });
  });
  it('accepts completed prerequisites, retains existing records, and ignores unknown effects', () => {
    const gated = { ...upgradeCatalog[0], prerequisiteIds: ['growth'] };
    const eligible = {
      ...createDefaultProfile(),
      coins: 25,
      upgradeRanks: { growth: 2, boost: 0 },
    };
    expect(purchaseUpgrade(eligible, gated, upgradeCatalog)).toMatchObject({ ok: true });
    expect(
      bankRun(
        { ...createDefaultProfile(), bestScoreByLevel: { 'sunny-lagoon': 50 } },
        { levelId: 'sunny-lagoon', score: 12, coinsEarned: 12, fishEaten: 0 },
        levelCatalog,
      ).bestScoreByLevel,
    ).toEqual({ 'sunny-lagoon': 50 });
    expect(
      compilePlayerStats(createDefaultProfile(), [
        { ...upgradeCatalog[0], effectId: 'retired-effect' },
      ]),
    ).toMatchObject({ sizeTier: 1, boostDurationMs: 0 });
  });
});
