import { describe, test, expect } from 'vitest';
import { makeRng } from '../../src/util/Rng.js';
import type { IRng } from '../../src/util/Rng.js';

const seq = (r: IRng, n = 6): number[] => Array.from({ length: n }, () => r.int(0, 1e9));

describe('RNG.fork()', () => {
  test('forks are independent', () => {
    const r = makeRng(42);
    expect(seq(r.fork('a'))).not.toEqual(seq(r.fork('b')));
  });

  test('same seed+labels -> same sequence', () => {
    const a = makeRng(42).fork('map');
    const b = makeRng(42).fork('map');
    expect(seq(a)).toEqual(seq(b));
  });

  test('parent != child', () => {
    const r = makeRng(123);
    expect(seq(r)).not.toEqual(seq(r.fork('child')));
  });

  test('deterministic int generation', () => {
    const r1 = makeRng(999);
    const r2 = makeRng(999);
    expect(r1.int(0, 100)).toBe(r2.int(0, 100));
  });

  test('deterministic float generation', () => {
    const r1 = makeRng(777);
    const r2 = makeRng(777);
    expect(r1.float()).toBe(r2.float());
  });

  test('bool with probability', () => {
    const r = makeRng(555);
    const results = Array.from({ length: 100 }, () => r.bool(0.5));
    const trueCount = results.filter(x => x).length;
    // Should be roughly 50%, allow some variance
    expect(trueCount).toBeGreaterThan(30);
    expect(trueCount).toBeLessThan(70);
  });

  test('choose from array', () => {
    const r = makeRng(333);
    const arr = ['a', 'b', 'c', 'd'];
    const chosen = r.choose(arr);
    expect(arr).toContain(chosen);
  });

  test('shuffleInPlace deterministic', () => {
    const r1 = makeRng(111);
    const r2 = makeRng(111);
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    r1.shuffleInPlace(arr1);
    r2.shuffleInPlace(arr2);
    expect(arr1).toEqual(arr2);
  });

  test('describe returns metadata', () => {
    const r = makeRng(123, 'test');
    const desc = r.describe();
    expect(desc.seed).toBe(123);
    expect(desc.label).toBe('test');
    expect(desc.forks).toBe(0);
  });
});

