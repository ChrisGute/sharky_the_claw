// @ts-check
import { fishCatalog } from './content/fish.js';

/** Test-only controls. This module is conditionally removed from production builds. */
export function installTestBridge(game, app) {
  window.__sharkyTest = {
    start: () => game.scene.start('play'),
    startActive: () => {
      game.scene.start('play', { skipCountdown: true });
    },
    /** @param {number} delta */
    advance: (delta) => game.scene.getScene('play').update(0, delta),
    pause: () => game.scene.getScene('play').pauseRound('Paused'),
    resume: () => game.scene.getScene('play').resumeRound(),
    boost: () => game.scene.getScene('play').triggerBoost(),
    state: () => {
      const scene = game.scene.getScene('play');
      return {
        round: scene.round,
        paused: scene.pausedByPage,
        boostState: scene.boostState,
        stunnedRemainingMs: Math.max(0, scene.stunnedUntil - scene.gameplayMs),
        audio: {
          paused: app.audio.paused,
          musicActive: Boolean(app.audio.musicTimer),
          contextState: app.audio.context?.state ?? 'unavailable',
        },
        sharkTexture: scene.shark?.texture?.key,
        sharkType: scene.shark?.type,
        activeFish: scene.fishGroup?.countActive(true) ?? 0,
        fishTextures: scene.fishGroup
          ?.getChildren()
          .filter((fish) => fish.active)
          .map((fish) => fish.texture?.key),
      };
    },
    /** @param {string} fishId */
    collide: (fishId) => {
      const scene = game.scene.getScene('play');
      const fish = fishCatalog.find((candidate) => candidate.id === fishId);
      if (!fish) throw new Error(`Unknown test fish: ${fishId}`);
      const sprite = scene.takeFishSprite(fish, scene.shark.x, scene.shark.y, scene.stats.sizeTier);
      sprite.fish = fish;
      sprite.runtimeId = scene.nextRuntimeId++;
      sprite.consumed = false;
      sprite.heading = 0;
      scene.collide(sprite);
    },
    /** @param {number} count */
    consumeExisting: (count) => {
      const scene = game.scene.getScene('play');
      let consumed = 0;
      for (const candidate of scene.fishGroup.getChildren()) {
        if (
          consumed >= count ||
          !candidate.active ||
          candidate.consumed ||
          candidate.fish.sizeTier > scene.stats.sizeTier
        )
          continue;
        scene.collide(candidate);
        consumed += 1;
      }
      return consumed;
    },
    edgeProbe: () => {
      const scene = game.scene.getScene('play');
      const sprite = scene.fishGroup.getChildren().find((candidate) => candidate.active);
      if (!sprite) throw new Error('No active fish for edge probe');
      sprite.setPosition(1, 300);
      sprite.heading = Math.PI;
      scene.updateFish(16, scene.gameplayMs);
      return {
        x: sprite.x,
        velocityX: sprite.body.velocity.x,
        minimumX: sprite.displayWidth / 2 + 8,
      };
    },
    directionProbe: () => {
      const scene = game.scene.getScene('play');
      const active = scene.fishGroup.getChildren().filter((candidate) => candidate.active);
      if (active.length < 2) throw new Error('Not enough active fish for direction probe');
      active[0].setPosition(250, 300);
      active[0].heading = 0;
      active[1].setPosition(1000, 480);
      active[1].heading = Math.PI;
      scene.updateFish(0, scene.gameplayMs);
      return {
        right: { velocityX: active[0].body.velocity.x, flipped: active[0].flipX },
        left: { velocityX: active[1].body.velocity.x, flipped: active[1].flipX },
      };
    },
    sharkHeadingProbe: () => {
      const scene = game.scene.getScene('play');
      const body = scene.shark.body;
      body.setVelocity(0, 0);
      scene.shark.setRotation(0).setFlipX(false);
      scene.target = { x: scene.shark.x + 100, y: scene.shark.y + 100 };
      scene.updatePlayer(16, scene.gameplayMs);
      const rightDown = { rotation: scene.shark.rotation, flipped: scene.shark.flipX };
      body.setVelocity(0, 0);
      scene.shark.setRotation(0).setFlipX(false);
      scene.target = { x: scene.shark.x - 100, y: scene.shark.y + 100 };
      scene.updatePlayer(16, scene.gameplayMs);
      return {
        rightDown,
        leftDown: { rotation: scene.shark.rotation, flipped: scene.shark.flipX },
      };
    },
    grant: (coins) => app.profiles.transact((profile) => ({ ...profile, coins })),
    buy: (upgradeId) => app.buy(upgradeId),
    level: (id) => app.selectLevel(id),
  };
}
