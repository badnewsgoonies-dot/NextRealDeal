/*
 * Deterministic RNG wrapper for games.
 * - Uses pure-rand's xoroshiro128plus and uniform distributions.
 * - fork() returns independent sub-streams via .jump().
 */
import * as prand from 'pure-rand';

export interface IRng {
  int(min: number, max: number): number;
  float(): number;
  bool(probability?: number): boolean;
  choose<T>(arr: readonly T[]): T;
  shuffleInPlace<T>(arr: T[]): void;
  fork(label?: string): IRng;
  describe(): { seed: number; forks: number; label?: string };
}

type Gen = prand.RandomGenerator;

const makeFromGen = (gen: Gen, meta: { seed: number; forks: number; label?: string }): IRng => {
  let g = gen;
  let forks = meta.forks;
  const { seed, label } = meta;

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`IRng.int invalid range: [${min}, ${max}]`);
    }
    const [v, ng] = prand.uniformIntDistribution(min, max, g);
    g = ng; return v;
  };

  const float = (): number => {
    const [a, g1] = prand.uniformIntDistribution(0, (1 << 26) - 1, g);
    const [b, g2] = prand.uniformIntDistribution(0, (1 << 27) - 1, g1);
    g = g2; return (a * 2 ** 27 + b) * 2 ** -53;
  };

  const bool = (p = 0.5): boolean => {
    if (!(p >= 0 && p <= 1)) throw new Error('IRng.bool probability must be [0,1]');
    return float() < p;
  };

  const choose = <T>(arr: readonly T[]): T => { 
    if (!arr.length) throw new Error('IRng.choose on empty array'); 
    return arr[int(0, arr.length - 1)]; 
  };

  const shuffleInPlace = <T>(arr: T[]): void => { 
    for (let i = arr.length - 1; i > 0; i--) { 
      const j = int(0, i); 
      [arr[i], arr[j]] = [arr[j], arr[i]]; 
    } 
  };

  const fork = (childLabel?: string): IRng => {
    const childGen = g.jump();  // ✅ CRITICAL FIX: Use jumped generator, not original seed
    forks += 1;
    return makeFromGen(childGen, { seed, forks: 0, label: childLabel });
  };

  const describe = (): { seed: number; forks: number; label?: string } => ({ seed, forks, label });
  return { int, float, bool, choose, shuffleInPlace, fork, describe };
};

export const makeRng = (seed: number, label?: string): IRng =>
  makeFromGen(prand.xoroshiro128plus(seed), { seed, forks: 0, label });
