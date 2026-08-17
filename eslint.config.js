import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest, __E2E__: 'readonly' },
    },
  },
];
