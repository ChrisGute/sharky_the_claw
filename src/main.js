// @ts-check
import './styles.css';
import { app } from './app/app-context.js';
import { GameUi } from './runtime/ui/game-ui.js';
import { DebugOverlay } from './runtime/debug/debug-overlay.js';

const loadingUi = document.querySelector('#loading-ui');
const errorUi = document.querySelector('#error-ui');
const reloadButton = document.querySelector('#reload-button');
const buildSha = import.meta.env.VITE_BUILD_SHA || 'development';
/** @param {unknown} error */
function showError(error) {
  console.error('Game startup failed:', error);
  loadingUi?.setAttribute('hidden', '');
  errorUi?.removeAttribute('hidden');
}
reloadButton?.addEventListener('click', () => window.location.reload());
window.addEventListener('pointerdown', () => app.audio.activate(), { once: true });
window.addEventListener('keydown', () => app.audio.activate(), { once: true });
window.addEventListener('sharky:asset-error', () =>
  showError(new Error('An essential asset failed to load')),
);
window.addEventListener('error', (event) => showError(event.error));
window.addEventListener('unhandledrejection', (event) => showError(event.reason));
try {
  new GameUi(app);
  document.documentElement.dataset.buildSha = buildSha;
  let gamePromise;
  const createGame = () => {
    if (gamePromise) return gamePromise;
    gamePromise = (async () => {
      const [{ default: Phaser }, { BootScene }, { PlayScene }] = await Promise.all([
        import('phaser'),
        import('./scenes/BootScene.js'),
        import('./scenes/PlayScene.js'),
      ]);
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-shell',
        width: 1280,
        height: 720,
        backgroundColor: '#067b9e',
        zoom: Math.min(window.devicePixelRatio || 1, 2),
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, fixedStep: true } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [new BootScene(), new PlayScene(app)],
        callbacks: {
          postBoot: () => {
            loadingUi?.setAttribute('hidden', '');
            document.documentElement.dataset.gameReady = 'true';
            document.documentElement.dataset.buildSha = buildSha;
          },
        },
      });
      window.__sharkyGame = game;
      if (__E2E__) {
        const { installTestBridge } = await import('./test-bridge.js');
        installTestBridge(game, app);
        document.documentElement.dataset.e2eReady = 'true';
      }
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug'))
        new DebugOverlay(app, game, buildSha);
      return game;
    })();
    gamePromise.catch(showError);
    return gamePromise;
  };
  window.addEventListener('sharky:start', async () => {
    app.ui?.showDiveLoading();
    const game = await createGame();
    game.scene.start('play', { skipCountdown: false });
  });
  if (__E2E__) createGame();
  else {
    loadingUi?.setAttribute('hidden', '');
    document.documentElement.dataset.gameReady = 'true';
  }
} catch (error) {
  showError(error);
}
