// @ts-check
import Phaser from 'phaser';
import { assetCatalog } from '../content/assets.js';
import { fishCatalog } from '../content/fish.js';
import { createSeededRandom } from '../domain/random/seeded-random.js';
import {
  advanceRound,
  createRound,
  finishRound,
  recordBoostUse,
  recordEat,
  startRound,
} from '../domain/round/round-controller.js';
import { fleeVector } from '../domain/progression/fish-behaviors.js';
import { reducedEffects } from '../runtime/effects/effects-settings.js';

const WIDTH = 1280;
const HEIGHT = 720;
const HUD_BOTTOM = 100;
const BOOST_ZONE_LEFT = 1030;
const BOOST_ZONE_TOP = 520;
const FISH_EDGE_ZONE = 86;
const FISH_EDGE_PADDING = 8;
const FISH_SEPARATION_PADDING = 14;

/** @typedef {Phaser.GameObjects.Image & { fish?: any, runtimeId?: number, consumed?: boolean, bumpAt?: number, heading?: number, dashUntil?: number, dashCooldownUntil?: number, warning?: Phaser.GameObjects.Text }} FishSprite */

export class PlayScene extends Phaser.Scene {
  /** @param {import('../app/app-context.js').AppContext} app */
  constructor(app) {
    super('play');
    this.app = app;
  }
  preload() {
    for (const asset of assetCatalog)
      if (asset.type === 'image') this.load.svg(asset.id, asset.url);
  }
  /** @param {{skipCountdown?: boolean}} [options] */
  create(options = {}) {
    this.level = this.app.level;
    this.stats = this.app.stats;
    this.random = createSeededRandom(this.seed());
    this.round = createRound({
      levelId: this.level.id,
      seed: this.random.state,
      durationMs: this.level.durationMs,
    });
    this.nextRuntimeId = 1;
    this.nextSpawnAt = 0;
    this.gameplayMs = 0;
    this.pausedByPage = false;
    this.boostState = this.stats.boostDurationMs ? 'READY' : 'LOCKED';
    this.boostUntil = 0;
    this.cooldownUntil = 0;
    this.stunnedUntil = 0;
    this.stunBaseRotation = 0;
    this.stunTinted = false;
    this.nextHudAt = 0;
    this.effectsReduced = reducedEffects(this.app.profile.settings.reducedEffects);
    this.createEnvironment();
    this.shark = this.add
      .image(640, 410, 'shark')
      .setDisplaySize(114 * this.stats.visualScale, 71 * this.stats.visualScale)
      .setDepth(4);
    this.sharkBaseScale = { x: this.shark.scaleX, y: this.shark.scaleY };
    this.physics.add.existing(this.shark);
    const sharkBodyRadius = this.stats.collisionRadius / Math.abs(this.shark.scaleX);
    /** @type {any} */ (this.shark.body).setCircle(
      sharkBodyRadius,
      this.shark.width / 2 - sharkBodyRadius,
      this.shark.height / 2 - sharkBodyRadius,
    );
    /** @type {any} */ (this.shark.body).setCollideWorldBounds(true);
    this.target = { x: 640, y: 410 };
    this.keyboardActiveUntil = 0;
    this.fishGroup = this.physics.add.group();
    this.fishPool = [];
    this.physics.add.overlap(this.shark, this.fishGroup, (_, candidate) =>
      this.collide(/** @type {FishSprite} */ (candidate)),
    );
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.input.addPointer(1);
    this.input.on('pointerdown', (pointer) => this.point(pointer));
    this.input.on('pointermove', (pointer) => this.point(pointer));
    this.resumeHandler = () => {
      if (this.pausedByPage && this.landscape()) this.resumeRound();
    };
    this.boostHandler = () => this.triggerBoost();
    this.pauseHandler = () => this.pauseRound('Paused');
    window.addEventListener('sharky:resume', this.resumeHandler);
    window.addEventListener('sharky:boost', this.boostHandler);
    window.addEventListener('sharky:pause', this.pauseHandler);
    this.visibilityHandler = () => this.pauseRound('Paused');
    this.orientationHandler = () => {
      if (this.round.phase === 'active' && !this.landscape()) this.pauseRound('Rotate device');
      else if (this.pausedByPage && this.landscape()) this.app.ui?.showPause('Paused');
    };
    window.addEventListener('blur', this.visibilityHandler);
    window.addEventListener('resize', this.orientationHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.spawnInitial();
    this.renderHud();
    if (options.skipCountdown) this.begin();
    else this.countdown(3);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }
  createEnvironment() {
    const reef = this.level.palette === 'reef';
    const top = reef ? 0x052d5c : 0x087fa3;
    const bottom = reef ? 0x07597b : 0x0fb0bb;
    this.add.rectangle(640, 360, WIDTH, HEIGHT, top).setDepth(-10);
    this.add.rectangle(640, 530, WIDTH, 380, bottom, 0.48).setDepth(-9);
    this.caustics = [];
    if (!this.effectsReduced) {
      for (let index = 0; index < 9; index += 1) {
        const ripple = this.add
          .ellipse(
            this.random.int(80, 1200),
            this.random.int(130, 650),
            this.random.int(100, 230),
            this.random.int(18, 34),
          )
          .setStrokeStyle(5, 0xbafcff, 0.14)
          .setDepth(-7)
          .setRotation(this.random.next() * 0.5 - 0.25);
        this.caustics.push(ripple);
      }
    }
    this.bubbles = [];
    const bubbleCount = this.effectsReduced ? 8 : 24;
    for (let index = 0; index < bubbleCount; index += 1) {
      const bubble = this.add
        .circle(
          this.random.int(10, 1270),
          this.random.int(120, 710),
          this.random.int(3, 10),
          0xc7fbff,
          0.2,
        )
        .setStrokeStyle(2, 0xe9ffff, 0.34)
        .setDepth(-6);
      bubble.setData('speed', this.random.int(12, 38));
      this.bubbles.push(bubble);
    }
    const scenery = this.add.graphics().setDepth(-5);
    scenery.fillStyle(reef ? 0x06334b : 0x0b6d78, 0.75);
    scenery.fillRect(0, 665, WIDTH, 55);
    const coralColors = reef ? [0xff668f, 0xf49b63, 0x9d75e8] : [0xff836b, 0xffcc58, 0xa46ee9];
    for (let index = 0; index < (reef ? 16 : 10); index += 1) {
      const x = 25 + index * (WIDTH / (reef ? 15 : 9)) + this.random.int(-20, 20);
      const height = this.random.int(35, reef ? 105 : 78);
      scenery.lineStyle(this.random.int(9, 16), coralColors[index % coralColors.length], 0.9);
      scenery.beginPath();
      scenery.moveTo(x, 690);
      scenery.lineTo(x, 690 - height);
      scenery.lineTo(x - 14, 674 - height);
      scenery.moveTo(x, 670 - height / 2);
      scenery.lineTo(x + 20, 648 - height / 2);
      scenery.strokePath();
    }
  }
  seed() {
    const numbers = new Uint32Array(1);
    crypto.getRandomValues(numbers);
    return numbers[0];
  }
  landscape() {
    return window.innerWidth >= window.innerHeight;
  }
  /** @param {Phaser.Input.Pointer} pointer */
  point(pointer) {
    if (this.round.phase === 'active') {
      this.target.x = pointer.worldX;
      this.target.y = pointer.worldY;
    }
  }
  spawnInitial() {
    for (let n = 0; n < this.level.initialFish; n += 1) this.spawnFish();
  }
  countdown(number) {
    this.app.audio.play('countdown');
    const label = this.add
      .text(640, 350, String(number), { fontSize: '120px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({
      targets: label,
      scale: 1.4,
      alpha: 0,
      duration: 750,
      onComplete: () => {
        label.destroy();
        number > 1 ? this.countdown(number - 1) : this.begin();
      },
    });
  }
  begin() {
    this.round = startRound(this.round);
    void this.app.audio.resume().then(() => {
      if (this.round.phase === 'active' && !this.pausedByPage)
        this.app.audio.startMusic(this.level.palette);
    });
    this.renderHud();
  }
  /** @param {number} _time @param {number} delta */
  update(_time, delta) {
    if (this.round.phase !== 'active' || this.pausedByPage) return;
    if (document.hidden || !this.landscape()) {
      this.pauseRound(document.hidden ? 'Paused' : 'Rotate device');
      return;
    }
    this.round = advanceRound(this.round, delta);
    if (this.round.phase !== 'active') {
      this.settle();
      return;
    }
    this.gameplayMs += delta;
    const now = this.gameplayMs;
    this.updateEnvironment(delta, now);
    this.updatePlayer(delta, now);
    this.updateFish(delta, now);
    if (now >= this.nextSpawnAt && this.fishGroup.countActive(true) < this.level.maxAlive) {
      const active = this.fishGroup.countActive(true);
      const births = active < this.level.initialFish ? 2 : 1;
      for (let count = 0; count < births && active + count < this.level.maxAlive; count += 1)
        this.spawnFish();
      this.nextSpawnAt = now + this.level.replacementIntervalMs;
    }
    this.advanceBoost(now);
    if (now >= this.nextHudAt) {
      this.renderHud();
      this.nextHudAt = now + 100;
    }
  }
  renderHud() {
    this.app.ui?.renderHud({
      ...this.round,
      levelName: this.level.displayName,
      boostReady:
        this.round.phase === 'active' &&
        this.boostState === 'READY' &&
        this.gameplayMs >= this.stunnedUntil,
      boostLabel: this.boostState.toLowerCase(),
      stunned: this.gameplayMs < this.stunnedUntil,
    });
  }
  /** @param {number} delta @param {number} now */
  updateEnvironment(delta, now) {
    for (const [index, ripple] of this.caustics.entries()) {
      ripple.x += delta * (0.007 + index * 0.0005);
      ripple.alpha = 0.55 + Math.sin(now / 850 + index) * 0.35;
      if (ripple.x > WIDTH + 120) ripple.x = -120;
    }
    for (const bubble of this.bubbles) {
      bubble.y -= (bubble.getData('speed') * delta) / 1000;
      bubble.x += Math.sin(now / 700 + bubble.radius) * 0.08;
      if (bubble.y < HUD_BOTTOM) {
        bubble.y = HEIGHT + bubble.radius;
        bubble.x = this.random.int(10, 1270);
      }
    }
  }
  /** @param {number} delta @param {number} now */
  updatePlayer(delta, now) {
    const body = /** @type {any} */ (this.shark.body);
    if (now < this.stunnedUntil) {
      body.setAcceleration(0, 0);
      body.setVelocity(body.velocity.x * 0.94, body.velocity.y * 0.94);
      this.shark.setRotation(this.stunBaseRotation + Math.sin(now / 55) * 0.16);
      return;
    }
    if (this.stunTinted) {
      this.stunTinted = false;
      this.shark.clearTint();
    }
    const keys = /** @type {any} */ (this.keys);
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || keys.S.isDown) y += 1;
    if (x || y) {
      this.keyboardActiveUntil = now + 120;
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    } else if (now > this.keyboardActiveUntil) {
      const dx = this.target.x - this.shark.x;
      const dy = this.target.y - this.shark.y;
      const distance = Math.hypot(dx, dy);
      if (distance > this.stats.arrivalRadius) {
        x = dx / distance;
        y = dy / distance;
      }
    }
    const speed =
      this.stats.moveSpeed * (this.boostState === 'ACTIVE' ? this.stats.boostMultiplier : 1);
    body.setAcceleration(x * this.stats.acceleration, y * this.stats.acceleration);
    body.setMaxVelocity(speed, speed);
    if (!x && !y) {
      body.setAcceleration(0, 0);
      body.setVelocity(0, 0);
    }
    const velocity = body.velocity;
    const facingX = x || y ? x : velocity.x;
    const facingY = x || y ? y : velocity.y;
    this.orientShark(facingX, facingY);
    this.shark.setScale(
      this.sharkBaseScale.x * (1 + Math.sin(now / 180) * 0.018),
      this.sharkBaseScale.y * (1 - Math.sin(now / 180) * 0.018),
    );
    if (Phaser.Input.Keyboard.JustDown(keys.SPACE)) this.triggerBoost();
    if (delta > 100) body.setVelocity(body.velocity.x * 0.5, body.velocity.y * 0.5);
  }
  /** Rotates the shark so its illustrated head follows the steering vector. @param {number} x @param {number} y */
  orientShark(x, y) {
    if (Math.hypot(x, y) < 0.01) return;
    if (x < -0.01) this.shark.setFlipX(true);
    else if (x > 0.01) this.shark.setFlipX(false);
    const direction = Math.atan2(y, x);
    const targetRotation = this.shark.flipX
      ? Phaser.Math.Angle.Wrap(direction - Math.PI)
      : direction;
    this.shark.setRotation(Phaser.Math.Angle.RotateTo(this.shark.rotation, targetRotation, 0.18));
  }
  /** @param {number} delta @param {number} now */
  updateFish(delta, now) {
    for (const candidate of this.fishGroup.children) {
      const sprite = /** @type {FishSprite} */ (candidate);
      if (!sprite?.active || sprite.consumed) continue;
      const fish = sprite.fish;
      let heading = sprite.heading ?? 0;
      let speed = fish.baseSpeed;
      let velocityX;
      let velocityY;
      const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.shark.x, this.shark.y);
      if (fish.behaviorId === 'flee' && distance < 210) {
        const direction = fleeVector(sprite, this.shark, fish.baseSpeed);
        velocityX = direction.x;
        velocityY = direction.y;
      } else if (
        fish.behaviorId === 'dash' &&
        distance < fish.behaviorParams.approachDistance &&
        now >= (sprite.dashCooldownUntil ?? 0)
      ) {
        sprite.dashUntil = now + fish.behaviorParams.dashDurationMs;
        sprite.dashCooldownUntil = now + fish.behaviorParams.dashCooldownMs;
      }
      if (sprite.dashUntil && now < sprite.dashUntil) {
        const direction = fleeVector(sprite, this.shark, fish.behaviorParams.dashSpeed);
        speed = fish.behaviorParams.dashSpeed;
        velocityX = direction.x;
        velocityY = direction.y;
      } else if (velocityX === undefined || velocityY === undefined) {
        heading += (this.random.next() - 0.5) * fish.turnRate * (delta / 1000);
        velocityX = Math.cos(heading) * speed;
        velocityY = Math.sin(heading) * speed;
      }
      const steered = this.steerFish(sprite, velocityX, velocityY, speed);
      sprite.heading = Math.atan2(steered.y, steered.x);
      /** @type {any} */ (sprite.body).setVelocity(steered.x, steered.y);
      const velocity = /** @type {any} */ (sprite.body).velocity;
      if (Math.abs(velocity.x) > 4) sprite.setFlipX(velocity.x < 0);
      sprite.setRotation(Math.sin(now / 330 + (sprite.runtimeId ?? 0)) * 0.055);
      if (sprite.warning) {
        sprite.warning.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.6 - 12);
        sprite.warning.setScale(1 + Math.sin(now / 180) * 0.08);
      }
    }
  }
  /** Keeps fish separated and turns them inward before they touch a wall. @param {FishSprite} sprite @param {number} velocityX @param {number} velocityY @param {number} speed */
  steerFish(sprite, velocityX, velocityY, speed) {
    let x = velocityX;
    let y = velocityY;
    const halfWidth = sprite.displayWidth / 2 + FISH_EDGE_PADDING;
    const halfHeight = sprite.displayHeight / 2 + FISH_EDGE_PADDING;
    const minX = halfWidth;
    const maxX = WIDTH - halfWidth;
    const minY = HUD_BOTTOM + halfHeight;
    const maxY = HEIGHT - halfHeight;
    const clampedX = Phaser.Math.Clamp(sprite.x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(sprite.y, minY, maxY);
    if (clampedX !== sprite.x || clampedY !== sprite.y) {
      sprite.setPosition(clampedX, clampedY);
      /** @type {any} */ (sprite.body).reset(clampedX, clampedY);
    }
    if (sprite.x < minX + FISH_EDGE_ZONE)
      x += speed * 2.2 * (1 - (sprite.x - minX) / FISH_EDGE_ZONE);
    if (sprite.x > maxX - FISH_EDGE_ZONE)
      x -= speed * 2.2 * (1 - (maxX - sprite.x) / FISH_EDGE_ZONE);
    if (sprite.y < minY + FISH_EDGE_ZONE)
      y += speed * 2.2 * (1 - (sprite.y - minY) / FISH_EDGE_ZONE);
    if (sprite.y > maxY - FISH_EDGE_ZONE)
      y -= speed * 2.2 * (1 - (maxY - sprite.y) / FISH_EDGE_ZONE);

    for (const otherCandidate of this.fishGroup.children) {
      const other = /** @type {FishSprite} */ (otherCandidate);
      if (!other?.active || other === sprite || other.consumed) continue;
      const dx = sprite.x - other.x;
      const dy = sprite.y - other.y;
      const minimum =
        (Math.max(sprite.displayWidth, sprite.displayHeight) +
          Math.max(other.displayWidth, other.displayHeight)) /
          2 +
        FISH_SEPARATION_PADDING;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > 0 && distanceSquared < minimum * minimum) {
        const distance = Math.sqrt(distanceSquared);
        const strength = speed * 1.4 * (1 - distance / minimum);
        x += (dx / distance) * strength;
        y += (dy / distance) * strength;
      }
    }
    const length = Math.hypot(x, y) || 1;
    return { x: (x / length) * speed, y: (y / length) * speed };
  }
  spawnFish() {
    const sharkTier = this.stats.sizeTier;
    const alive = /** @type {FishSprite[]} */ ([]);
    for (const item of this.fishGroup.children)
      if (item?.active) alive.push(/** @type {FishSprite} */ (item));
    const edible = alive.filter((sprite) => sprite.fish.sizeTier <= sharkTier).length;
    const entries = this.level.spawnEntries.filter(
      (entry) =>
        alive.length === 0 ||
        edible / alive.length >= this.level.minEdibleRatio ||
        (fishCatalog.find((fish) => fish.id === entry.fishId)?.sizeTier ?? 9) <= sharkTier,
    );
    const pool = entries.length ? entries : this.level.spawnEntries;
    const fishId = this.random.weighted(
      pool.map((entry) => ({ value: entry.fishId, weight: entry.weight })),
    );
    const fish = fishCatalog.find((entry) => entry.id === fishId);
    if (!fish) return;
    let x = 80;
    let y = HUD_BOTTOM + 40;
    for (let tries = 0; tries < 100; tries += 1) {
      x = this.random.int(35, WIDTH - 35);
      y = this.random.int(HUD_BOTTOM + 25, HEIGHT - 35);
      if (this.safeSpawn(x, y)) break;
    }
    if (!this.safeSpawn(x, y))
      for (let gridY = HUD_BOTTOM + 40; gridY < HEIGHT - 30; gridY += 40)
        for (let gridX = 40; gridX < WIDTH - 30; gridX += 40)
          if (this.safeSpawn(gridX, gridY)) {
            x = gridX;
            y = gridY;
            gridY = HEIGHT;
            break;
          }
    const sprite = this.takeFishSprite(fish, x, y, sharkTier);
    sprite.fish = fish;
    sprite.runtimeId = this.nextRuntimeId++;
    sprite.consumed = false;
    sprite.heading = this.random.next() * Math.PI * 2;
  }
  /** @param {number} x @param {number} y */
  safeSpawn(x, y) {
    return (
      Phaser.Math.Distance.Between(x, y, this.shark.x, this.shark.y) >= 240 &&
      !(x >= BOOST_ZONE_LEFT && y >= BOOST_ZONE_TOP)
    );
  }
  /** @param {any} fish @param {number} x @param {number} y @param {number} sharkTier @returns {FishSprite} */
  takeFishSprite(fish, x, y, sharkTier) {
    let sprite = this.fishPool.pop();
    if (!sprite) {
      sprite = /** @type {FishSprite} */ (this.add.image(x, y, fish.textureKey));
      this.physics.add.existing(sprite);
      this.fishGroup.add(sprite);
      sprite.warning = this.add
        .text(x, y, '▲', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#fff3a6',
          stroke: '#8a3552',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(3);
    }
    sprite
      .setTexture(fish.textureKey)
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .clearTint();
    const size = fish.collisionRadius * (fish.id === 'pufferfish' ? 3.1 : 4.1);
    sprite.setDisplaySize(size, fish.id === 'pufferfish' ? size : size * 0.62).setDepth(2);
    sprite.warning?.setVisible(fish.sizeTier > sharkTier);
    const body = /** @type {any} */ (sprite.body);
    body.enable = true;
    const bodyRadius = fish.collisionRadius / Math.abs(sprite.scaleX);
    body.setCircle(bodyRadius, sprite.width / 2 - bodyRadius, sprite.height / 2 - bodyRadius);
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    body.setCollideWorldBounds(true);
    return sprite;
  }
  /** @param {FishSprite} fish */
  releaseFish(fish) {
    /** @type {any} */ (fish.body).setVelocity(0, 0);
    /** @type {any} */ (fish.body).enable = false;
    fish.consumed = false;
    fish.bumpAt = undefined;
    fish.dashUntil = undefined;
    fish.dashCooldownUntil = undefined;
    fish.setActive(false).setVisible(false);
    fish.warning?.setVisible(false);
    this.fishPool.push(fish);
    this.nextSpawnAt = Math.min(
      this.nextSpawnAt,
      this.gameplayMs + this.level.replacementIntervalMs / 2,
    );
  }
  /** @param {FishSprite} fish */
  collide(fish) {
    if (this.round.phase !== 'active' || fish.consumed) return;
    if (this.stats.sizeTier >= fish.fish.sizeTier) {
      fish.consumed = true;
      /** @type {any} */ (fish.body).enable = false;
      fish.setVisible(false);
      this.round = recordEat(this.round, fish.fish, this.stats.sizeTier);
      this.app.audio.play('eat');
      this.scorePopup(fish.x, fish.y, fish.fish.scoreValue);
      this.tweens.add({
        targets: this.shark,
        scaleX: '*=1.1',
        scaleY: '*=1.1',
        yoyo: true,
        duration: 90,
      });
      this.releaseFish(fish);
    } else if (
      this.gameplayMs >= this.stunnedUntil &&
      this.time.now - (fish.bumpAt ?? -Infinity) >= 600
    ) {
      fish.bumpAt = this.time.now;
      const away = fleeVector(fish, this.shark, 250);
      /** @type {any} */ (fish.body).setVelocity(away.x, away.y);
      /** @type {any} */ (this.shark.body).setVelocity(-away.x * 0.35, -away.y * 0.35);
      this.stunnedUntil = this.gameplayMs + 1000;
      this.stunBaseRotation = this.shark.rotation;
      this.stunTinted = true;
      this.shark.setTint(0xffa988);
      this.app.audio.play('bump');
      this.renderHud();
    }
  }
  /** @param {number} x @param {number} y @param {number} points */
  scorePopup(x, y, points) {
    const popup = this.add
      .text(x, y, `+${points}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fff3a6',
        stroke: '#07547c',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({
      targets: popup,
      y: y - 58,
      scale: 1.25,
      alpha: 0,
      duration: this.effectsReduced ? 280 : 650,
      onComplete: () => popup.destroy(),
    });
    this.renderHud();
  }
  triggerBoost() {
    if (
      this.round.phase !== 'active' ||
      this.boostState !== 'READY' ||
      this.gameplayMs < this.stunnedUntil
    )
      return;
    this.boostState = 'ACTIVE';
    this.app.audio.play('boost');
    this.boostUntil = this.gameplayMs + this.stats.boostDurationMs;
    this.round = recordBoostUse(this.round);
  }
  /** @param {number} now */
  advanceBoost(now) {
    if (this.boostState === 'ACTIVE' && now >= this.boostUntil) {
      this.boostState = 'COOLDOWN';
      this.cooldownUntil = now + this.stats.boostCooldownMs;
    }
    if (this.boostState === 'COOLDOWN' && now >= this.cooldownUntil) this.boostState = 'READY';
  }
  /** @param {string} reason */
  pauseRound(reason) {
    if (this.round.phase !== 'active' || this.pausedByPage) return;
    this.pausedByPage = true;
    this.physics.pause();
    this.app.audio.pause();
    this.app.ui?.showPause(reason);
  }
  resumeRound() {
    if (!this.pausedByPage || !this.landscape()) return;
    this.pausedByPage = false;
    this.physics.resume();
    this.app.audio.resume();
    this.renderHud();
  }
  settle() {
    this.physics.pause();
    this.app.audio.stopMusic();
    const result = finishRound(this.round);
    this.round = result.round;
    if (result.summary) {
      const banked = this.app.bank(result.summary);
      this.app.audio.play('results');
      this.app.ui?.showResults(result.summary, banked.unlocked);
    }
  }
  cleanup() {
    window.removeEventListener('sharky:resume', this.resumeHandler);
    window.removeEventListener('sharky:boost', this.boostHandler);
    window.removeEventListener('sharky:pause', this.pauseHandler);
    window.removeEventListener('blur', this.visibilityHandler);
    window.removeEventListener('resize', this.orientationHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.app.audio.pause();
    for (const fish of this.fishPool) fish.warning?.destroy();
  }
}
