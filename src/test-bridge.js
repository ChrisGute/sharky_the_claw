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
    artProbe: () => {
      const scene = game.scene.getScene('play');
      /** @param {string} textureKey */
      const dimensions = (textureKey) => {
        const frame = scene.textures.getFrame(textureKey);
        return { width: frame.realWidth, height: frame.realHeight };
      };
      return {
        shark: dimensions('shark'),
        fish: Object.fromEntries(
          fishCatalog.map((fish) => [fish.textureKey, dimensions(fish.textureKey)]),
        ),
      };
    },
    sharkHeadingProbe: () => {
      const scene = game.scene.getScene('play');
      const body = scene.shark.body;
      const probe = (x, y) => {
        body.setVelocity(0, 0);
        scene.shark.setRotation(0).setFlipX(false);
        scene.target = { x: scene.shark.x + x, y: scene.shark.y + y };
        scene.updatePlayer(16, scene.gameplayMs);
        return { rotation: scene.shark.rotation, flipped: scene.shark.flipX };
      };
      return {
        rightDown: probe(100, 100),
        rightUp: probe(100, -100),
        leftDown: probe(-100, 100),
        leftUp: probe(-100, -100),
      };
    },
    animationProbe: () => {
      const scene = game.scene.getScene('play');
      const fish = scene.fishGroup.getChildren().find((candidate) => candidate.active);
      if (!fish) throw new Error('No active fish for animation probe');
      scene.target = { x: scene.shark.x, y: scene.shark.y };
      scene.updatePlayer(16, 0);
      const sharkStart = { x: scene.shark.scaleX, y: scene.shark.scaleY };
      scene.updatePlayer(16, 90);
      const sharkLater = { x: scene.shark.scaleX, y: scene.shark.scaleY };
      fish.runtimeId = 0;
      scene.updateFish(0, 0);
      const fishStart = fish.rotation;
      scene.updateFish(0, 180);
      return { sharkStart, sharkLater, fishStart, fishLater: fish.rotation };
    },
    grant: (coins) => app.profiles.transact((profile) => ({ ...profile, coins })),
    buy: (upgradeId) => app.buy(upgradeId),
    level: (id) => app.selectLevel(id),
  };
}
