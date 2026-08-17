// @ts-check
import { describe, expect, it } from 'vitest';
import {
  PROFILE_BACKUP_KEY,
  PROFILE_STORAGE_KEY,
  createDefaultProfile,
  normalizeProfile,
} from '../../src/domain/save/profile.js';
import { ProfileService, loadProfile } from '../../src/domain/save/profile-service.js';

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}
describe('profile persistence', () => {
  it('loads missing defaults, backs up corrupt data, and preserves newer saves', () => {
    expect(loadProfile(memory())).toMatchObject({
      mode: 'persistent',
      profile: createDefaultProfile(),
    });
    const corrupt = memory({ [PROFILE_STORAGE_KEY]: '{bad' });
    expect(loadProfile(corrupt)).toMatchObject({ notice: 'recovered' });
    expect(corrupt.values.get(PROFILE_BACKUP_KEY)).toBe('{bad');
    const future = memory({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 99, coins: 40 }),
    });
    expect(loadProfile(future)).toMatchObject({ mode: 'memory', notice: 'future-version' });
    expect(future.values.get(PROFILE_STORAGE_KEY)).toContain('99');
  });
  it('writes once per transaction, increments revision, and falls back after storage errors', () => {
    const store = memory();
    const service = new ProfileService(store);
    expect(service.transact((profile) => ({ ...profile, coins: 3 }))).toMatchObject({
      coins: 3,
      revision: 1,
    });
    expect(JSON.parse(store.values.get(PROFILE_STORAGE_KEY) ?? '').coins).toBe(3);
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    const memoryOnly = new ProfileService(broken);
    expect(memoryOnly.transact((profile) => ({ ...profile, coins: 2 }))).toMatchObject({
      coins: 2,
    });
    expect(memoryOnly.mode).toBe('memory');
  });
  it('banks a run key only once, including after a reload', () => {
    const store = memory();
    const first = new ProfileService(store);
    expect(first.bankOnce('lagoon:7', (profile) => ({ ...profile, coins: 4 }))).toMatchObject({
      applied: true,
      profile: { coins: 4 },
    });
    const reloaded = new ProfileService(store);
    expect(reloaded.bankOnce('lagoon:7', (profile) => ({ ...profile, coins: 8 }))).toMatchObject({
      applied: false,
      profile: { coins: 4 },
    });
  });
  it('uses memory when storage is absent, notifies subscribers, and resets namespaced data', () => {
    expect(loadProfile(null)).toMatchObject({ mode: 'memory', notice: 'session-only' });
    const store = memory({ [PROFILE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 0, coins: 2 }) });
    const service = new ProfileService(store);
    const values = [];
    const unsubscribe = service.subscribe((profile) => values.push(profile.coins));
    service.transact((profile) => ({ ...profile, coins: 9 }));
    unsubscribe();
    service.reset();
    expect(values).toEqual([9]);
    expect(store.values.has(PROFILE_STORAGE_KEY)).toBe(false);
    expect(service.get().coins).toBe(0);
  });
  it('normalizes malformed profile fields without losing safe unknown ids', () => {
    const profile = normalizeProfile({
      revision: -1,
      coins: 'x',
      lifetimeScore: -2,
      lifetimeFishEaten: 1.2,
      bestScoreByLevel: { x: -1, good: 2 },
      unlockedLevelIds: ['other', '', 'other'],
      completedRunKeys: ['a', 2, 'a'],
      upgradeRanks: { boost: -1, custom: 3 },
      settings: { muted: 'yes', reducedEffects: 'bad' },
      tutorial: { movementSeen: 'yes' },
    });
    expect(profile).toMatchObject({
      revision: 0,
      coins: 0,
      bestScoreByLevel: { good: 2 },
      unlockedLevelIds: ['sunny-lagoon', 'other'],
      completedRunKeys: ['a'],
      upgradeRanks: { boost: 0, growth: 0, custom: 3 },
    });
  });
  it('recovers get and reset storage exceptions', () => {
    const broken = {
      getItem() {
        throw Error('no');
      },
      setItem() {},
      removeItem() {
        throw Error('no');
      },
    };
    expect(loadProfile(broken)).toMatchObject({ mode: 'memory' });
    const service = new ProfileService(memory());
    service.storage = /** @type {any} */ ({
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {
        throw Error('no');
      },
    });
    service.reset();
    expect(service.mode).toBe('memory');
  });
  it('normalizes non-objects and every supported valid optional field', () => {
    expect(normalizeProfile(null)).toEqual(createDefaultProfile());
    const profile = normalizeProfile({
      revision: 3,
      coins: 2,
      lifetimeScore: 4,
      lifetimeFishEaten: 5,
      bestScoreByLevel: null,
      unlockedLevelIds: null,
      completedRunKeys: null,
      upgradeRanks: null,
      settings: { muted: true, reducedEffects: 'off' },
      tutorial: { movementSeen: true, bumpSeen: true, boostSeen: true, shopSeen: true },
    });
    expect(profile).toMatchObject({
      revision: 3,
      coins: 2,
      lifetimeScore: 4,
      lifetimeFishEaten: 5,
      settings: { muted: true, reducedEffects: 'off' },
      tutorial: { movementSeen: true, bumpSeen: true, boostSeen: true, shopSeen: true },
    });
  });
  it('survives a backup-write failure and a later transaction-write failure', () => {
    const storage = {
      getItem() {
        return JSON.stringify({ coins: 1 });
      },
      setItem() {
        throw Error('blocked');
      },
      removeItem() {},
    };
    expect(loadProfile(storage)).toMatchObject({ mode: 'persistent', profile: { coins: 1 } });
    const service = new ProfileService(memory());
    service.storage = /** @type {any} */ (storage);
    service.transact((profile) => ({ ...profile, coins: 1 }));
    expect(service).toMatchObject({ mode: 'memory', notice: 'session-only' });
  });
  it('requests reload on newer storage revisions and requires reset confirmation', () => {
    const service = new ProfileService(memory());
    /** @type {(event: { key: string, newValue: string|null }) => void} */
    let listener;
    const target = {
      addEventListener(_type, callback) {
        listener = callback;
      },
      removeEventListener(_type, callback) {
        if (listener === callback) listener = undefined;
      },
    };
    const revisions = [];
    const stop = service.observeStorageEvents(target, (revision) => revisions.push(revision));
    listener({ key: PROFILE_STORAGE_KEY, newValue: JSON.stringify({ revision: 1 }) });
    listener({ key: 'unrelated', newValue: JSON.stringify({ revision: 9 }) });
    listener({ key: PROFILE_STORAGE_KEY, newValue: '{bad' });
    expect(revisions).toEqual([1]);
    stop();
    expect(listener).toBeUndefined();
    expect(service.confirmReset('wrong')).toBeNull();
    const confirmation = service.requestReset();
    service.transact((profile) => ({ ...profile, coins: 8 }));
    expect(service.confirmReset(confirmation)).toMatchObject({ coins: 0 });
    expect(service.confirmReset(confirmation)).toBeNull();
  });
});
