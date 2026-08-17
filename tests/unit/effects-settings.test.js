import { expect, test } from 'vitest';
import { reducedEffects } from '../../src/runtime/effects/effects-settings.js';

test('reduced-effects honours explicit preference and motion preference', () => {
  expect(reducedEffects('on', false)).toBe(true);
  expect(reducedEffects('off', true)).toBe(false);
  expect(reducedEffects('auto', true)).toBe(true);
  expect(reducedEffects('auto', false)).toBe(false);
});
