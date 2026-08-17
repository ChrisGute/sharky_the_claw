// @ts-check

/** @typedef {{ x: number, y: number }} Vector */

/** Stable pure behavior registry. Runtime code supplies movement and Phaser integration. */
export const FISH_BEHAVIORS = Object.freeze({
  wander: Object.freeze({ id: 'wander' }),
  flee: Object.freeze({ id: 'flee' }),
  school: Object.freeze({ id: 'school' }),
  dash: Object.freeze({ id: 'dash' }),
});

/** @param {string} behaviorId */
export function getFishBehavior(behaviorId) {
  return FISH_BEHAVIORS[/** @type {keyof typeof FISH_BEHAVIORS} */ (behaviorId)] ?? null;
}

/** @param {Vector} from @param {Vector} awayFrom @param {number} magnitude */
export function fleeVector(from, awayFrom, magnitude) {
  const x = from.x - awayFrom.x;
  const y = from.y - awayFrom.y;
  const length = Math.hypot(x, y) || 1;
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}
