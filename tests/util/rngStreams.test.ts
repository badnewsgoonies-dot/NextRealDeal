import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RngStreams } from '../../src/util/RngStreams.js';
import { makeRng } from '../../src/util/Rng.js';

describe('RngStreams', () => {
  it('creates independent streams', () => {
    const root = makeRng(12345);
    const streams = new RngStreams(root);

    // Independence heuristic: different streams produce different sequences
    expect(streams.sampleDistinct()).toBe(true);
  });

  it('provides deterministic streams from same seed', () => {
    const root1 = makeRng(12345);
    const streams1 = new RngStreams(root1);
    
    const root2 = makeRng(12345);
    const streams2 = new RngStreams(root2);

    // Same seed => same samples per named stream
    const battle1 = streams1.get('battle').int(0, 1e9);
    const battle2 = streams2.get('battle').int(0, 1e9);
    expect(battle1).toBe(battle2);

    const route1 = streams1.get('route').int(0, 1e9);
    const route2 = streams2.get('route').int(0, 1e9);
    expect(route1).toBe(route2);
  });

  it('throws error for uninitialized stream', () => {
    const root = makeRng(42);
    const streams = new RngStreams(root, ['battle', 'route']);

    expect(() => streams.get('economy')).toThrow("RNG stream 'economy' not initialized");
  });

  it('supports custom stream labels', () => {
    const root = makeRng(42);
    const streams = new RngStreams(root, ['custom1', 'custom2']);

    const stream1 = streams.get('custom1');
    const stream2 = streams.get('custom2');

    expect(stream1).toBeDefined();
    expect(stream2).toBeDefined();

    // Should throw for default streams since we didn't include them
    expect(() => streams.get('battle')).toThrow();
  });

  it('provides debug information', () => {
    const root = makeRng(42);
    const streams = new RngStreams(root);
    const debug = streams.describeStreams();
    
    expect(debug.route).toBeDefined();
    expect(debug.battle).toBeDefined();
    expect(debug.economy).toBeDefined();
    expect(debug.map).toBeDefined();
    expect(debug.unit).toBeDefined();
    expect(debug.save).toBeDefined();
    expect(debug.events).toBeDefined();
    expect(debug.loot).toBeDefined();
    
    // Each stream should have metadata
    expect(debug.route.seed).toBeDefined();
    expect(debug.route.forks).toBeDefined();
  });

  it('property: different seeds produce variety', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s1 = new RngStreams(makeRng(seed)).get('route').int(0, 1e9);
        const s2 = new RngStreams(makeRng(seed + 1)).get('route').int(0, 1e9);
        return s1 !== s2;
      }),
      { numRuns: 50 }
    );
  });

  it('property: stream isolation - one stream usage does not affect another', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        // Create two identical stream managers
        const streams1 = new RngStreams(makeRng(seed));
        const streams2 = new RngStreams(makeRng(seed));

        // Use battle stream in first manager
        streams1.get('battle').int(0, 100);
        streams1.get('battle').int(0, 100);
        streams1.get('battle').int(0, 100);

        // Route stream should still be identical in both managers
        const route1 = streams1.get('route').int(0, 1e9);
        const route2 = streams2.get('route').int(0, 1e9);

        return route1 === route2;
      }),
      { numRuns: 50 }
    );
  });

  it('provides all default streams', () => {
    const root = makeRng(42);
    const streams = new RngStreams(root);

    const defaultLabels = ['route', 'battle', 'economy', 'map', 'unit', 'save', 'events', 'loot'];
    
    for (const label of defaultLabels) {
      expect(() => streams.get(label)).not.toThrow();
    }
  });

  it('streams produce different values from each other', () => {
    const root = makeRng(12345);
    const streams = new RngStreams(root);

    const routeVal = streams.get('route').int(0, 1e9);
    const battleVal = streams.get('battle').int(0, 1e9);
    const economyVal = streams.get('economy').int(0, 1e9);

    // High probability that independent streams produce different values
    expect(routeVal).not.toBe(battleVal);
    expect(battleVal).not.toBe(economyVal);
    expect(routeVal).not.toBe(economyVal);
  });

  it('maintains determinism across multiple calls', () => {
    const root1 = makeRng(999);
    const streams1 = new RngStreams(root1);
    
    const sequence1 = [
      streams1.get('battle').int(0, 100),
      streams1.get('battle').int(0, 100),
      streams1.get('battle').int(0, 100),
    ];

    const root2 = makeRng(999);
    const streams2 = new RngStreams(root2);
    
    const sequence2 = [
      streams2.get('battle').int(0, 100),
      streams2.get('battle').int(0, 100),
      streams2.get('battle').int(0, 100),
    ];

    expect(sequence1).toEqual(sequence2);
  });
});
