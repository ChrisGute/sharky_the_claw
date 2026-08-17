// @ts-check
import { describe, expect, it } from 'vitest';
import {
  advanceRound,
  createRound,
  finishRound,
  recordBoostUse,
  recordEat,
  startRound,
} from '../../src/domain/round/round-controller.js';

describe('round controller', () => {
  it('uses unclamped active delta and settles exactly once', () => {
    const active = startRound(createRound({ levelId: 'sunny-lagoon', seed: 12, durationMs: 100 }));
    const settling = advanceRound(active, 500);
    expect(settling).toMatchObject({ remainingMs: 0, phase: 'settling', endedReason: 'time' });
    const first = finishRound(settling);
    const second = finishRound(first.round);
    expect(first.summary).toMatchObject({ durationMs: 100, endedReason: 'time' });
    expect(second.summary).toBeNull();
  });
  it('allows awards only in active state and only for edible fish', () => {
    const fish = { id: 'pufferfish', sizeTier: 2, scoreValue: 6, coinValue: 6 };
    const ready = createRound({ levelId: 'sunny-lagoon', seed: 1 });
    expect(recordEat(ready, fish, 2)).toBe(ready);
    const active = startRound(ready);
    expect(recordEat(active, fish, 1)).toBe(active);
    expect(recordEat(active, fish, 2)).toMatchObject({ score: 6, coinsEarned: 6, fishEaten: 1 });
  });
  it('leaves inactive rounds unchanged and uses quit for unfinished rounds', () => {
    const ready = createRound({ levelId: 'x', seed: 1 });
    expect(startRound(startRound(ready))).toMatchObject({ phase: 'active' });
    expect(advanceRound(ready, -1)).toBe(ready);
    expect(recordBoostUse(ready)).toBe(ready);
    expect(finishRound(ready).summary).toMatchObject({ endedReason: 'quit' });
  });
  it('preserves a custom end reason, ignores negative elapsed time, and counts repeated fish', () => {
    const active = startRound(createRound({ levelId: 'x', seed: 2, durationMs: 20 }));
    expect(advanceRound(active, -5).remainingMs).toBe(20);
    const fish = { id: 'minnow', sizeTier: 1, scoreValue: 1, coinValue: 1 };
    const twice = recordEat(recordEat(active, fish, 1), fish, 1);
    expect(twice.fishCountsById).toEqual({ minnow: 2 });
    expect(finishRound({ ...active, endedReason: 'abort' }).summary).toMatchObject({
      endedReason: 'abort',
    });
  });
});
