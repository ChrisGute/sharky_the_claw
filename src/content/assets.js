// @ts-check

/** @typedef {{id: string, path: string, url: string, type: 'image'|'audio'}} AssetDefinition */

/** @type {readonly AssetDefinition[]} */
export const assetCatalog = Object.freeze(
  [
    {
      id: 'shark',
      path: 'src/assets/shark.svg',
      url: new URL('../assets/shark.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-minnow',
      path: 'src/assets/fish/minnow.svg',
      url: new URL('../assets/fish/minnow.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-sardine',
      path: 'src/assets/fish/sardine.svg',
      url: new URL('../assets/fish/sardine.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-pufferfish',
      path: 'src/assets/fish/pufferfish.svg',
      url: new URL('../assets/fish/pufferfish.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-anchovy',
      path: 'src/assets/fish/anchovy.svg',
      url: new URL('../assets/fish/anchovy.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-parrotfish',
      path: 'src/assets/fish/parrotfish.svg',
      url: new URL('../assets/fish/parrotfish.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-golden',
      path: 'src/assets/fish/golden-fish.svg',
      url: new URL('../assets/fish/golden-fish.svg', import.meta.url).href,
      type: 'image',
    },
    {
      id: 'fish-grouper',
      path: 'src/assets/fish/grouper.svg',
      url: new URL('../assets/fish/grouper.svg', import.meta.url).href,
      type: 'image',
    },
  ].map(/** @param {AssetDefinition} asset */ (asset) => Object.freeze(asset)),
);

export const assetIds = Object.freeze(new Set(assetCatalog.map((asset) => asset.id)));
