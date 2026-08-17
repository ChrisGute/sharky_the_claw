import { assetCatalog } from '../src/content/assets.js';
import { fishCatalog } from '../src/content/fish.js';
import { levelCatalog } from '../src/content/levels.js';
import { upgradeCatalog } from '../src/content/upgrades.js';
import { assertValidCatalogs } from '../src/domain/catalog/validate.js';

assertValidCatalogs(
  { assetCatalog, fishCatalog, levelCatalog, upgradeCatalog },
  { assetPathExists: (assetPath) => existsSync(resolve(process.cwd(), assetPath)) },
);
console.log('Content catalog validation passed.');
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
