// @ts-check

/** A deterministic Mulberry32 pseudo-random number generator. */
export class SeededRandom {
  /** @param {number} seed */
  constructor(seed) {
    this.state = seed >>> 0;
  }
  /** @returns {number} A value in [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** @param {number} min @param {number} max @returns {number} Integer in [min, max). */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min));
  }
  /** @template T @param {readonly T[]} values @returns {T} */
  pick(values) {
    if (!values.length) throw new RangeError('Cannot pick from an empty array');
    return values[this.int(0, values.length)];
  }
  /** @template T @param {readonly {value: T, weight: number}[]} entries @returns {T} */
  weighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (!(total > 0)) throw new RangeError('Weighted entries require a positive total');
    let cursor = this.next() * total;
    for (const entry of entries) {
      cursor -= entry.weight;
      if (cursor < 0) return entry.value;
    }
    return entries[entries.length - 1].value;
  }
}

/** @param {number} seed */
export const createSeededRandom = (seed) => new SeededRandom(seed);
