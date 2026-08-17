// @ts-check
/** Development-only, no-PII bounded run diagnostics. */
export class DebugOverlay {
  /** @param {import('../../app/app-context.js').AppContext} app @param {Phaser.Game} game @param {string} buildSha */
  constructor(app, game, buildSha) {
    this.app = app;
    this.game = game;
    this.events = [];
    this.frameTimes = [];
    this.node = document.createElement('output');
    this.node.className = 'debug-overlay';
    document.body.append(this.node);
    this.timer = window.setInterval(() => this.render(buildSha), 500);
    /** @type {any} */ (window).__sharkyDiagnostics = () =>
      JSON.stringify({
        buildSha,
        renderer: game.renderer.type,
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
        events: this.events.slice(-30),
      });
  }
  /** @param {string} buildSha */
  render(buildSha) {
    const scene = /** @type {any} */ (this.game.scene.getScene('play'));
    this.node.textContent = `debug ${buildSha}\n${innerWidth}×${innerHeight} DPR ${devicePixelRatio}\nrenderer ${this.game.renderer.type}\nphase ${scene?.round?.phase ?? 'menu'} fish ${scene?.fishGroup?.countActive(true) ?? 0}\nshark tier ${scene?.stats?.sizeTier ?? 1} boost ${scene?.boostState ?? 'LOCKED'}\nsave v${this.app.profile.schemaVersion} r${this.app.profile.revision}`;
  }
  destroy() {
    clearInterval(this.timer);
    this.node.remove();
    delete (/** @type {any} */ (window).__sharkyDiagnostics);
  }
}
