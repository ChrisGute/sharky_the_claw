// @ts-check
import { levelCatalog } from '../../content/levels.js';
import { upgradeCatalog } from '../../content/upgrades.js';

const sharkUrl = new URL('../../assets/shark.svg', import.meta.url).href;

/** Semantic overlay UI. Canvas gameplay remains underneath this deliberately. */
export class GameUi {
  /** @param {import('../../app/app-context.js').AppContext} app */
  constructor(app) {
    this.app = app;
    app.ui = this;
    this.root = document.querySelector('#ui-root');
    if (!this.root) throw new Error('Missing game UI root');
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.hudState = {};
    this.showTitle();
  }
  /** @param {Event} event */
  onClick(event) {
    const button = /** @type {HTMLButtonElement|null} */ (
      /** @type {Element} */ (event.target).closest('button[data-action]')
    );
    if (!button) return;
    event.stopPropagation();
    const action = button.dataset.action;
    if (action === 'levels') this.showLevels();
    if (action === 'title') this.showTitle();
    if (action === 'reload') window.location.reload();
    if (action === 'play') window.dispatchEvent(new Event('sharky:start'));
    if (action === 'shop') this.showShop();
    if (action === 'resume') window.dispatchEvent(new Event('sharky:resume'));
    if (action === 'pause') window.dispatchEvent(new Event('sharky:pause'));
    if (action === 'mute') {
      this.app.toggleMuted();
      this.renderHud(this.hudState);
    }
    if (action === 'boost') window.dispatchEvent(new Event('sharky:boost'));
    if (action === 'reset-request') this.showResetConfirmation(this.app.requestReset());
    if (action === 'reset-confirm') {
      this.app.confirmReset(button.dataset.confirmation || '');
      this.showTitle();
    }
    if (action === 'buy') {
      const result = this.app.buy(button.dataset.upgradeId || '');
      this.showShop(
        result.ok ? 'Upgrade equipped for the next round!' : this.reason(result.reason),
      );
    }
    if (action === 'level') {
      this.app.selectLevel(button.dataset.levelId || 'sunny-lagoon');
      this.showReady();
    }
  }
  /** @param {string|undefined} reason */
  reason(reason) {
    return reason === 'insufficient-funds'
      ? 'Catch more fish for that upgrade.'
      : 'That upgrade is already maxed.';
  }
  clear() {
    this.hudState = {};
    this.root.replaceChildren();
  }
  /** @param {string} html */
  panel(html) {
    this.hudState = {};
    this.root.innerHTML = `<section class="menu-panel">${html}</section>`;
  }
  showTitle() {
    const profile = this.app.profile;
    this.panel(
      `<div class="brand-lockup"><img src="${sharkUrl}" alt="" width="154" height="96"><div><p class="eyebrow">A reef-sized adventure</p><h1>Sharky<br><span>the Claw</span></h1></div></div><p class="tagline">Swim fast. Snack smart. Grow into the reef's friendliest legend.</p><div class="profile-strip"><span><strong>${profile.lifetimeScore}</strong> lifetime score</span><span><strong>${profile.coins}</strong> coins</span><span><strong>${profile.lifetimeFishEaten}</strong> fish caught</span></div><button class="primary-action" data-action="levels">Dive in</button><button data-action="shop">Shark Shop</button><button class="quiet-action" data-action="reset-request">Reset progress</button>`,
    );
  }
  showLevels() {
    const profile = this.app.profile;
    const cards = levelCatalog
      .map((level) => {
        const locked = !profile.unlockedLevelIds.includes(level.id);
        const progress = Math.min(profile.lifetimeFishEaten, level.unlock.lifetimeFishEaten);
        return `<button class="level-card level-${level.palette}" data-action="level" data-level-id="${level.id}" ${locked ? 'disabled' : ''}><span class="level-icon" aria-hidden="true">${level.palette === 'reef' ? '🪸' : '☀️'}</span><span><strong>${level.displayName}</strong><small>${locked ? `${progress}/${level.unlock.lifetimeFishEaten} fish to unlock` : 'Ready to explore'}</small></span><span class="level-status">${locked ? '🔒' : '→'}</span></button>`;
      })
      .join('');
    this.panel(
      `<p class="eyebrow">Pick an adventure</p><h1>Choose your water</h1><div class="choice-list">${cards}</div><button class="quiet-action" data-action="title">Back to title</button>`,
    );
  }
  showReady() {
    const level = this.app.level;
    const stats = this.app.stats;
    this.panel(
      `<p class="eyebrow">Next dive</p><h1>${level.displayName}</h1><div class="ready-tips"><p><span aria-hidden="true">🦈</span><strong>Move</strong><small>Point, drag, or use arrow keys</small></p><p><span aria-hidden="true">🐟</span><strong>Snack</strong><small>Catch fish at tier ${stats.sizeTier} or smaller</small></p><p><span aria-hidden="true">⚡</span><strong>Boost</strong><small>${stats.boostDurationMs ? 'Use the button or Space' : 'Unlock it in the Shark Shop'}</small></p></div><button class="primary-action" data-action="play">Start dive</button><button class="quiet-action" data-action="levels">Choose another</button>`,
    );
  }
  showDiveLoading() {
    this.panel(
      `<img class="loading-shark" src="${sharkUrl}" alt="" width="154" height="96"><p class="eyebrow">Preparing the reef</p><h1>Making waves…</h1><p>Your dive is starting.</p>`,
    );
  }
  showShop(note = '') {
    const profile = this.app.profile;
    const cards = upgradeCatalog
      .map((upgrade) => {
        const rank = profile.upgradeRanks[upgrade.track] || 0;
        const next = upgrade.ranks[rank];
        const label = next ? `Buy ${next.cost} coins` : 'Maximum rank';
        const effect =
          upgrade.track === 'growth'
            ? 'Grow big enough to eat larger fish.'
            : 'Burst ahead when the meter is ready.';
        const state = !next ? 'maxed' : profile.coins >= next.cost ? 'affordable' : 'locked';
        return `<article class="upgrade-card ${state}"><div class="upgrade-icon" aria-hidden="true">${upgrade.track === 'growth' ? '🦈' : '⚡'}</div><div><p class="eyebrow">${upgrade.track} · rank ${rank}/${upgrade.maxRank}</p><h2>${upgrade.displayName}</h2><p>${effect}</p></div><button data-action="buy" data-upgrade-id="${upgrade.id}" ${next && profile.coins >= next.cost ? '' : 'disabled'}>${label}</button></article>`;
      })
      .join('');
    this.panel(
      `<p class="eyebrow">Permanent upgrades</p><h1>Shark Shop</h1><p class="coins"><span aria-hidden="true">●</span> ${profile.coins} coins</p><p class="shop-note" aria-live="polite">${note}</p><div class="upgrade-list">${cards}</div><button class="quiet-action" data-action="title">Back to title</button>`,
    );
  }
  renderHud(state = {}) {
    this.hudState = { ...this.hudState, ...state };
    const muted = this.app.profile.settings.muted;
    const seconds = Math.ceil((this.hudState.remainingMs ?? 20000) / 1000);
    let hud = this.root.querySelector('.hud');
    if (!hud) {
      this.root.innerHTML = `<section class="hud" aria-label="Round status"><div class="hud-cluster"><p class="level-name" data-hud="level"></p><p class="score-pill"><span>Score</span><strong data-hud="score" data-testid="score">0</strong></p><p class="catch-pill"><span>Catch</span><strong data-hud="catch">0</strong></p><p class="timer-pill"><span>Time</span><strong data-hud="timer" data-testid="timer">20</strong><small>s</small></p></div><p class="stun-status" data-hud="stun" role="status" hidden><span aria-hidden="true">💫</span> Stunned!</p><div class="hud-actions"><button class="icon-button" data-action="pause" aria-label="Pause game">Ⅱ</button><button class="icon-button" data-action="mute" aria-label="${muted ? 'Turn sound on' : 'Mute sound'}" aria-pressed="${muted}">${muted ? '🔇' : '🔊'}</button></div><button class="boost" data-action="boost"><span aria-hidden="true">⚡</span><strong>Boost</strong><small data-hud="boost">locked</small></button></section>`;
      hud = this.root.querySelector('.hud');
    }
    if (!hud) return;
    const set = (name, value) => {
      const node = hud.querySelector(`[data-hud="${name}"]`);
      if (node) node.textContent = String(value);
    };
    set('level', this.hudState.levelName ?? 'Sunny Lagoon');
    set('score', this.hudState.score ?? 0);
    set('catch', this.hudState.fishEaten ?? 0);
    set('timer', seconds);
    set('boost', this.hudState.boostLabel ?? 'locked');
    const timer = hud.querySelector('.timer-pill');
    timer?.classList.toggle('urgent', seconds <= 5);
    const stun = /** @type {HTMLElement|null} */ (hud.querySelector('[data-hud="stun"]'));
    if (stun) stun.hidden = !this.hudState.stunned;
    const boost = /** @type {HTMLButtonElement|null} */ (hud.querySelector('.boost'));
    if (boost) boost.disabled = !this.hudState.boostReady;
    const mute = /** @type {HTMLButtonElement|null} */ (hud.querySelector('[data-action="mute"]'));
    if (mute) {
      mute.textContent = muted ? '🔇' : '🔊';
      mute.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
      mute.setAttribute('aria-pressed', String(muted));
    }
  }
  showPause(reason = 'Paused') {
    this.panel(
      `<div class="pause-icon" aria-hidden="true">${reason === 'Rotate device' ? '↻' : 'Ⅱ'}</div><p class="eyebrow">Dive paused</p><h1>${reason}</h1><p>${reason === 'Rotate device' ? 'Turn back to landscape to continue.' : 'Your shark and the whole reef are waiting safely.'}</p><button class="primary-action" data-action="resume" ${reason === 'Rotate device' ? 'disabled' : ''}>Resume dive</button>`,
    );
  }
  showReloadRequired() {
    this.panel(
      '<h1>Progress changed</h1><p>Your progress changed in another tab. Reload to use the newest save.</p><button data-action="reload">Reload</button>',
    );
  }
  /** @param {string} confirmation */
  showResetConfirmation(confirmation) {
    this.panel(
      `<h1>Reset progress?</h1><p>This removes this shark's saved coins, upgrades, and records.</p><button data-action="reset-confirm" data-confirmation="${confirmation}">Yes, reset</button><button data-action="title">Keep progress</button>`,
    );
  }
  showResults(summary, unlocked = []) {
    const reef = unlocked.includes('coral-reef')
      ? '<p class="celebrate">Coral Reef unlocked!</p>'
      : '';
    const profile = this.app.profile;
    const best = profile.bestScoreByLevel[summary.levelId] ?? summary.score;
    const progress = Math.min(profile.lifetimeFishEaten, 100);
    this.panel(
      `<p class="eyebrow">Dive complete</p><h1>Fin-tastic!</h1><div class="result-score"><span>Score</span><strong>${summary.score}</strong><small>${summary.score >= best ? 'Personal best!' : `Best ${best}`}</small></div><div class="result-grid"><p><span>Fish caught</span><strong>${summary.fishEaten}</strong></p><p><span>Coins earned</span><strong>+${summary.coinsEarned}</strong></p><p><span>Total coins</span><strong>${profile.coins}</strong></p></div>${reef}<div class="reef-progress"><span><strong>Coral Reef</strong><small>${progress}/100 fish</small></span><progress value="${progress}" max="100">${progress}%</progress></div><button class="primary-action" data-action="play">Dive again</button><button data-action="shop">Visit Shark Shop</button><button class="quiet-action" data-action="levels">Change level</button>`,
    );
  }
}
