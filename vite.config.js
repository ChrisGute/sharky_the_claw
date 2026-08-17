import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: { __E2E__: JSON.stringify(process.env.VITE_E2E === '1') },
  // Phaser's SVG loader expects a URL (its data-URI path assumes base64), so keep
  // original character art as cacheable files instead of Vite data URIs.
  build: { sourcemap: false, assetsInlineLimit: 0 },
});
