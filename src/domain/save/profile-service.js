// @ts-check
import {
  PROFILE_BACKUP_KEY,
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  cloneProfile,
  createDefaultProfile,
  normalizeProfile,
} from './profile.js';

/** @typedef {import('./profile.js').Profile} Profile */
/** @typedef {{ getItem(key: string): string|null, setItem(key: string, value: string): void, removeItem(key: string): void }} StorageLike */
/** @typedef {{ profile: Profile, mode: 'persistent'|'memory', notice?: 'recovered'|'session-only'|'future-version' }} LoadResult */

/** @param {unknown} parsed @returns {Profile} */
function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') return createDefaultProfile();
  const version = /** @type {Record<string, unknown>} */ (parsed).schemaVersion;
  if (version === undefined || version === 1) return normalizeProfile(parsed);
  throw new Error('Unsupported profile schema');
}

/**
 * Reads and migrates a profile without overwriting a save produced by a newer game.
 * @param {StorageLike | null | undefined} storage
 * @returns {LoadResult}
 */
export function loadProfile(storage) {
  if (!storage) return { profile: createDefaultProfile(), mode: 'memory', notice: 'session-only' };
  let raw;
  try {
    raw = storage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return { profile: createDefaultProfile(), mode: 'memory', notice: 'session-only' };
  }
  if (raw === null) return { profile: createDefaultProfile(), mode: 'persistent' };
  try {
    const parsed = JSON.parse(raw);
    const version =
      parsed && typeof parsed === 'object'
        ? /** @type {Record<string, unknown>} */ (parsed).schemaVersion
        : undefined;
    if (typeof version === 'number' && version > PROFILE_SCHEMA_VERSION)
      return { profile: createDefaultProfile(), mode: 'memory', notice: 'future-version' };
    if (version !== PROFILE_SCHEMA_VERSION) {
      try {
        storage.setItem(PROFILE_BACKUP_KEY, raw);
      } catch {
        // A readable profile can still be used if its backup cannot be written.
      }
    }
    return { profile: migrate(parsed), mode: 'persistent' };
  } catch {
    try {
      storage.setItem(PROFILE_BACKUP_KEY, raw);
    } catch {
      /* recovery can still use memory */
    }
    return { profile: createDefaultProfile(), mode: 'persistent', notice: 'recovered' };
  }
}

/** A transactional single-profile store; reducers must be pure and synchronous. */
export class ProfileService {
  /** @param {StorageLike | null | undefined} storage */
  constructor(storage) {
    const loaded = loadProfile(storage);
    this.storage = storage || null;
    this.profile = loaded.profile;
    this.mode = loaded.mode;
    this.notice = loaded.notice;
    this.resetConfirmation = null;
    /** @type {Set<(profile: Profile) => void>} */ this.listeners = new Set();
  }
  /** @returns {Profile} */ get() {
    return cloneProfile(this.profile);
  }
  /** @param {(profile: Profile) => Profile} reducer @returns {Profile} */
  transact(reducer) {
    const next = normalizeProfile(reducer(cloneProfile(this.profile)));
    next.revision = this.profile.revision + 1;
    if (this.mode === 'persistent' && this.storage) {
      try {
        this.storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        this.mode = 'memory';
        this.notice = 'session-only';
      }
    }
    this.profile = next;
    for (const listener of this.listeners) listener(this.get());
    return this.get();
  }
  /** Applies a completed run at most once across reloads. @param {string} runKey @param {(profile: Profile) => Profile} reducer */
  bankOnce(runKey, reducer) {
    if (this.profile.completedRunKeys.includes(runKey))
      return { applied: false, profile: this.get() };
    const profile = this.transact((current) => ({
      ...reducer(current),
      completedRunKeys: [...current.completedRunKeys, runKey].slice(-200),
    }));
    return { applied: true, profile };
  }
  /** @param {(profile: Profile) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /**
   * Watches another tab's profile writes. Newer revisions are deliberately not
   * merged: callers must pause play and ask the player to reload.
   * @param {{ addEventListener(type: string, listener: (event: {key?: string|null, newValue?: string|null}) => void): void, removeEventListener(type: string, listener: (event: {key?: string|null, newValue?: string|null}) => void): void }} target
   * @param {(revision: number) => void} requestReload
   */
  observeStorageEvents(target, requestReload) {
    const onStorage = (event) => {
      if (event.key !== PROFILE_STORAGE_KEY || !event.newValue) return;
      try {
        const candidate = JSON.parse(event.newValue);
        const revision = candidate?.revision;
        if (Number.isSafeInteger(revision) && revision > this.profile.revision)
          requestReload(revision);
      } catch {
        // A corrupt cross-tab notification cannot replace the current profile.
      }
    };
    target.addEventListener('storage', onStorage);
    return () => target.removeEventListener('storage', onStorage);
  }
  /** Begins an explicit two-step reset flow. @returns {string} */
  requestReset() {
    this.resetConfirmation = `reset:${this.profile.revision}`;
    return this.resetConfirmation;
  }
  /** @param {string} confirmation @returns {Profile|null} */
  confirmReset(confirmation) {
    if (!this.resetConfirmation || confirmation !== this.resetConfirmation) return null;
    this.resetConfirmation = null;
    return this.reset();
  }
  /** Removes this game's keys only. @returns {Profile} */
  reset() {
    if (this.mode === 'persistent' && this.storage) {
      try {
        this.storage.removeItem(PROFILE_STORAGE_KEY);
        this.storage.removeItem(PROFILE_BACKUP_KEY);
      } catch {
        this.mode = 'memory';
        this.notice = 'session-only';
      }
    }
    this.profile = createDefaultProfile();
    for (const listener of this.listeners) listener(this.get());
    return this.get();
  }
}
