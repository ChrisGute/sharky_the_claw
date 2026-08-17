import { expect, test } from 'vitest';
import { createSeededRandom } from '../../src/domain/random/seeded-random.js';

/** Deterministic catalog-level Lagoon harness: 1,000 seeded 20s catch simulations per upgrade state. */
function run(seed, speedMultiplier, tier) {
  const random = createSeededRandom(seed);
  let fish = 0;
  let points = 0;
  for (let tick = 0; tick < 31; tick += 1) {
    const roll = random.next();
    const edible = tier > 1 || roll < 0.9;
    if (edible && random.next() < Math.min(0.65, 0.43 * speedMultiplier)) {
      fish += 1;
      points += roll < 0.55 ? 1 : roll < 0.9 ? 2 : 6;
    }
  }
  return { fish, points };
}
function median(values) {
  return values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
test('1,000 seeded Lagoon runs have target starting medians for every upgrade state', () => {
  for (const state of [
    [1, 1],
    [1.6, 1],
    [1, 2],
    [1.9, 3],
  ]) {
    const runs = Array.from({ length: 1000 }, (_, seed) => run(seed + 1, state[0], state[1]));
    const fish = median(runs.map((run) => run.fish));
    const points = median(runs.map((run) => run.points));
    expect(fish).toBeGreaterThanOrEqual(10);
    expect(fish).toBeLessThanOrEqual(24);
    expect(points).toBeGreaterThanOrEqual(14);
    expect(points).toBeLessThanOrEqual(40);
  }
});
