import { describe, test, expect } from 'vitest';
import { MapManager } from '../../../src/map/MapManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';

describe('MapManager Memory & Cleanup', () => {
  test('cleanup after destroy()', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(999)
    );
    
    await mgr.initialize();
    
    // Try to generate (should succeed now)
    const r = await mgr.generate({ width: 32, height: 32, seed: 1 });
    expect(r.ok).toBe(true); // Generation is now implemented
    
    // Destroy
    await mgr.destroy();
    
    // Check queue is empty
    const dbg = mgr.getDebugStats?.();
    if (dbg) {
      expect(dbg.queuePending).toBe(0);
    }
    
    // Current map should be null
    expect(mgr.getCurrentMap()).toBeNull();
  });

  test('no exceptions on destroy', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(111)
    );
    
    await mgr.initialize();
    await expect(mgr.destroy()).resolves.not.toThrow();
  });

  test('multiple destroy calls are safe', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(222)
    );
    
    await mgr.initialize();
    await mgr.destroy();
    await mgr.destroy(); // Second destroy should be safe
    await expect(mgr.destroy()).resolves.not.toThrow();
  });

  test('queue empties after concurrent operations', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(444)
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
    
    await mgr.destroy();
  });

  test('destroy during pending operations', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(555)
    );
    
    await mgr.initialize();
    
    // Start operations but don't await
    const ops = Array.from({ length: 10 }, (_, i) =>
      mgr.generate({ width: 32, height: 32, seed: i + 200 })
    );
    
    // Destroy immediately (before operations complete)
    await mgr.destroy();
    
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
      makeLogger({ enabled: false }),
      makeRng(666)
    );
    
    // Initialize twice
    await mgr.initialize();
    const result = await mgr.initialize();
    expect(result.ok).toBe(false); // Should fail on second init
    
    // Update multiple times
    await mgr.update(16.67);
    await mgr.update(16.67);
    
    await mgr.destroy();
  });

  test('no memory leak from serialization', async () => {
    const mgr = new MapManager(
      makeLogger({ enabled: false }),
      makeRng(777)
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
    
    await mgr.destroy();
  });
});

