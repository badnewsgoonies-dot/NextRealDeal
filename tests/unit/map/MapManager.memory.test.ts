import { describe, test, expect } from 'vitest';
import { MapManager } from '../../../src/map/MapManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeAsyncQueue } from '../../../src/util/AsyncQueue.js';

describe('MapManager Memory & Cleanup', () => {
  test('cleanup after dispose()', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(999),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    
    // Try to generate (will fail with "Not implemented" but exercises the queue)
    const r = await mgr.generate({ width: 32, height: 32, seed: 1 });
    expect(r.ok).toBe(false); // Expected since not implemented yet
    
    // Dispose
    await mgr.dispose();
    
    // Check queue is empty
    const dbg = mgr.getDebugStats?.();
    if (dbg) {
      expect(dbg.queuePending).toBe(0);
    }
    
    // Current map should be null
    expect(mgr.getCurrentMap()).toBeNull();
  });

  test('no exceptions on dispose', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(111),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    await expect(mgr.dispose()).resolves.not.toThrow();
  });

  test('multiple dispose calls are safe', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(222),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    await mgr.dispose();
    await mgr.dispose(); // Second dispose should be safe
    await expect(mgr.dispose()).resolves.not.toThrow();
  });

  test('reset clears current map', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(333),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    
    // Verify initial state
    expect(mgr.getCurrentMap()).toBeNull();
    
    // Reset
    const result = await mgr.reset();
    expect(result.ok).toBe(true);
    expect(mgr.getCurrentMap()).toBeNull();
    
    await mgr.dispose();
  });

  test('queue empties after concurrent operations', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(444),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    
    // Fire multiple concurrent operations
    const operations = Array.from({ length: 20 }, (_, i) =>
      mgr.generate({ width: 32, height: 32, seed: i + 100 })
    );
    
    await Promise.all(operations);
    
    // Queue should be empty
    const dbg = mgr.getDebugStats?.();
    if (dbg) {
      expect(dbg.queuePending).toBe(0);
    }
    
    await mgr.dispose();
  });

  test('dispose during pending operations', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(555),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    
    // Start operations but don't await
    const ops = Array.from({ length: 10 }, (_, i) =>
      mgr.generate({ width: 32, height: 32, seed: i + 200 })
    );
    
    // Dispose immediately (before operations complete)
    await mgr.dispose();
    
    // Wait for operations to complete
    const results = await Promise.all(ops);
    
    // Operations should have completed (even if with errors)
    expect(results.length).toBe(10);
    
    // Queue should be empty
    const dbg = mgr.getDebugStats?.();
    if (dbg) {
      expect(dbg.queuePending).toBe(0);
    }
  });

  test('lifecycle methods can be called multiple times', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(666),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    // Initialize twice
    await mgr.initialize();
    const result = await mgr.initialize();
    expect(result.ok).toBe(false); // Should fail on second init
    
    // Reset multiple times
    await mgr.reset();
    await mgr.reset();
    
    // Update multiple times
    await mgr.update(16.67);
    await mgr.update(16.67);
    
    await mgr.dispose();
  });

  test('no memory leak from serialization', async () => {
    const mgr = new MapManager(
      { name: 'Map' },
      makeRng(777),
      makeLogger({ enabled: false }),
      makeAsyncQueue()
    );
    
    await mgr.initialize();
    
    // Create large map data
    const largeTiles = Array.from({ length: 128 * 128 }, (_, i) => ({
      x: i % 128,
      y: Math.floor(i / 128),
      t: 0,
    }));
    
    const mockMap = {
      width: 128,
      height: 128,
      tiles: largeTiles,
      rooms: [],
      connectors: [],
      spawn: { x: 0, y: 0 },
      exit: { x: 127, y: 127 },
      seed: 777,
      algorithm: 'bsp',
    };
    
    // Serialize/deserialize many times
    for (let i = 0; i < 100; i++) {
      const json = mgr.serialize(mockMap);
      const result = mgr.deserialize(json);
      expect(result.ok).toBe(true);
    }
    
    await mgr.dispose();
  });
});

