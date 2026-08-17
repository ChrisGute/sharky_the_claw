// @ts-check
import Phaser from 'phaser';
import { assetCatalog } from '../content/assets.js';
import { fishCatalog } from '../content/fish.js';
import { levelCatalog } from '../content/levels.js';
import { upgradeCatalog } from '../content/upgrades.js';
import { assertValidCatalogs } from '../domain/catalog/validate.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.on('loaderror', (file) =>
      window.dispatchEvent(new CustomEvent('sharky:asset-error', { detail: file.key })),
    );
  }
  create() {
    assertValidCatalogs({ assetCatalog, fishCatalog, levelCatalog, upgradeCatalog });
    this.add.rectangle(640, 360, 1280, 720, 0x067b9e);
  }
}
