// @ts-check
import { levelCatalog } from '../content/levels.js';
import { upgradeCatalog } from '../content/upgrades.js';
import { bankRun, compilePlayerStats, purchaseUpgrade } from '../domain/progression/progression.js';
import { ProfileService } from '../domain/save/profile-service.js';
import { AudioSystem } from '../runtime/audio/audio-system.js';

/** The small application boundary shared by DOM views and Phaser scenes. */
export class AppContext {
  constructor() {
    this.profiles = new ProfileService(window.localStorage);
    this.selectedLevelId = 'sunny-lagoon';
    this.lastSummary = null;
    this.ui = null;
    this.reloadRequested = false;
    this.audio = new AudioSystem(() => this.profile.settings.muted);
    this.stopWatchingStorage = this.profiles.observeStorageEvents(window, () => {
      this.reloadRequested = true;
      window.dispatchEvent(new Event('sharky:pause'));
      this.ui?.showReloadRequired();
    });
  }
  get profile() {
    return this.profiles.get();
  }
  /** @param {string} levelId */
  selectLevel(levelId) {
    this.selectedLevelId = levelId;
  }
  get level() {
    return levelCatalog.find((level) => level.id === this.selectedLevelId) ?? levelCatalog[0];
  }
  get stats() {
    return compilePlayerStats(this.profile, upgradeCatalog);
  }
  /** @param {import('../domain/round/round-controller.js').RunSummary} summary */
  bank(summary) {
    this.lastSummary = summary;
    let before = this.profile;
    const transaction = this.profiles.bankOnce(`${summary.levelId}:${summary.seed}`, (current) =>
      bankRun(current, summary, levelCatalog),
    );
    const profile = transaction.profile;
    return {
      profile,
      unlocked: profile.unlockedLevelIds.filter((id) => !before.unlockedLevelIds.includes(id)),
    };
  }
  /** @param {string} upgradeId */
  buy(upgradeId) {
    const upgrade = upgradeCatalog.find((entry) => entry.id === upgradeId);
    if (!upgrade) return { ok: false, reason: 'unknown-upgrade' };
    let result;
    this.profiles.transact((current) => {
      result = purchaseUpgrade(current, upgrade, upgradeCatalog);
      return result.profile;
    });
    return result;
  }
  toggleMuted() {
    this.profiles.transact((profile) => ({
      ...profile,
      settings: { ...profile.settings, muted: !profile.settings.muted },
    }));
  }
  requestReset() {
    return this.profiles.requestReset();
  }
  /** @param {string} confirmation */
  confirmReset(confirmation) {
    return this.profiles.confirmReset(confirmation);
  }
}

export const app = new AppContext();
