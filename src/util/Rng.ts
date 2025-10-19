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
    // Advance the parent generator by consuming some random numbers
    g.unsafeNext(); g.unsafeNext(); g.unsafeNext(); g.unsafeNext();
    forks += 1;
    // Create child with a different seed based on parent state
    const childSeed = g.unsafeNext() >>> 0;
    return makeRng(childSeed, childLabel);
  };

  const describe = (): { seed: number; forks: number; label?: string } => ({ seed, forks, label });
  return { int, float, bool, choose, shuffleInPlace, fork, describe };
};

/**
 * Creates a deterministic random number generator.
 * 
 * IMPORTANT: The root IRng returned by makeRng() should be used as a fork factory only.
 * Do not draw values from it directly. Instead, create forks for each subsystem:
 * 
 * Sequential calls to fork() are deterministic and distinct.
 * The parent generator advances on each fork to ensure independence.
 * Do not draw random values from the parent after creation—fork and use children only.
 * 
 * @example
 * const rootRng = makeRng(seed);
 * const mapRng = rootRng.fork('map');
 * const battleRng = rootRng.fork('battle');
 * // Use mapRng and battleRng, not rootRng
 * 
 * @param seed - The seed for deterministic generation
 * @param label - Optional label for debugging
 */
export const makeRng = (seed: number, label?: string): IRng =>
  makeFromGen(prand.xoroshiro128plus(seed), { seed, forks: 0, label });
