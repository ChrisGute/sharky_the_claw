// @ts-check
import { describe, expect, it } from 'vitest';
import { SeededRandom, createSeededRandom } from '../../src/domain/random/seeded-random.js';

describe('SeededRandom', () => {
  it('produces the documented known sequence for seed 123', () => {
    const random = createSeededRandom(123);
    expect([random.next(), random.next(), random.next(), random.next(), random.next()]).toEqual([
      0.7872516233474016, 0.1785435655619949, 0.49531551403924823, 0.23136196262203157,
      0.375791602069512,
    ]);
  });

  it('is repeatable, including its selection helpers', () => {
    const first = new SeededRandom(77);
    const second = new SeededRandom(77);
    const getSequence = (random) => [
      random.int(4, 9),
      random.pick(['a', 'b', 'c']),
      random.weighted([
        { value: 'small', weight: 2 },
        { value: 'large', weight: 1 },
      ]),
    ];
    expect(getSequence(first)).toEqual(getSequence(second));
  });

  it('has correct selection boundaries and rejects empty/zero-weight choices', () => {
    const random = new SeededRandom(1);
    for (let index = 0; index < 50; index += 1)
      expect(random.int(-3, 4)).toBeGreaterThanOrEqual(-3);
    expect(() => random.pick([])).toThrow(RangeError);
    expect(() => random.weighted([{ value: 'x', weight: 0 }])).toThrow(RangeError);
    random.next = () => 1;
    expect(
      random.weighted([
        { value: 'first', weight: 1 },
        { value: 'last', weight: 1 },
      ]),
    ).toBe('last');
  });
});
