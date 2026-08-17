// @ts-check
export function reducedEffects(
  setting,
  prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  return setting === 'on' || (setting === 'auto' && prefersReducedMotion);
}
