import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MapManager } from '../../../src/map/MapManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeAsyncQueue } from '../../../src/util/AsyncQueue.js';
import { TileType, type MapData } from '../../../src/types/contracts.js';

describe('MapManager', () => {
  let manager: MapManager;
  let rng: ReturnType<typeof makeRng>;
  let logger: ReturnType<typeof makeLogger>;
  let queue: ReturnType<typeof makeAsyncQueue>;

  beforeEach(async () => {
    rng = makeRng(20251014); // Global seed
    logger = makeLogger({ enabled: false });
    queue = makeAsyncQueue();
    manager = new MapManager(
      { name: 'Map', defaultWidth: 64, defaultHeight: 64 },
      rng,
      logger,
      queue
    );
    const result = await manager.initialize();
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('Lifecycle', () => {
    test('initializes successfully', async () => {
      const manager2 = new MapManager(
        { name: 'Map' },
        rng,
        logger,
        queue
      );
      const result = await manager2.initialize();
      expect(result.ok).toBe(true);
      await manager2.dispose();
    });

    test('updates without errors', async () => {
      const result = await manager.update(16.67);
      expect(result.ok).toBe(true);
    });

    test('resets successfully', async () => {
      const result = await manager.reset();
      expect(result.ok).toBe(true);
    });

    test('disposes cleanly', async () => {
      await expect(manager.dispose()).resolves.not.toThrow();
    });

    test('getCurrentMap returns null initially', () => {
      expect(manager.getCurrentMap()).toBeNull();
    });
  });

  describe('Tile Operations', () => {
    test('isWalkable returns correct values', () => {
      expect(manager.isWalkable(TileType.Floor)).toBe(true);
      expect(manager.isWalkable(TileType.Door)).toBe(true);
      expect(manager.isWalkable(TileType.Spawn)).toBe(true);
      expect(manager.isWalkable(TileType.Exit)).toBe(true);
      expect(manager.isWalkable(TileType.Wall)).toBe(false);
      expect(manager.isWalkable(TileType.Water)).toBe(false);
    });

    test('getTile returns undefined for out of bounds', () => {
      const mockMap: MapData = {
        width: 10,
        height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          t: TileType.Floor,
        })),
        rooms: [],
        connectors: [],
        spawn: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 123,
        algorithm: 'bsp',
      };
      expect(manager.getTile(mockMap, -1, 0)).toBeUndefined();
      expect(manager.getTile(mockMap, 0, -1)).toBeUndefined();
      expect(manager.getTile(mockMap, 10, 0)).toBeUndefined();
      expect(manager.getTile(mockMap, 0, 10)).toBeUndefined();
    });

    test('getTile returns correct tile type', () => {
      const mockMap: MapData = {
        width: 10,
        height: 10,
        tiles: [
          { x: 0, y: 0, t: TileType.Spawn },
          { x: 5, y: 5, t: TileType.Wall },
          { x: 9, y: 9, t: TileType.Exit },
          ...Array.from({ length: 97 }, (_, i) => ({
            x: (i + 3) % 10,
            y: Math.floor((i + 3) / 10),
            t: TileType.Floor,
          })),
        ],
        rooms: [],
        connectors: [],
        spawn: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 123,
        algorithm: 'bsp',
      };
      expect(manager.getTile(mockMap, 0, 0)).toBe(TileType.Spawn);
      expect(manager.getTile(mockMap, 5, 5)).toBe(TileType.Wall);
      expect(manager.getTile(mockMap, 9, 9)).toBe(TileType.Exit);
    });

    test('setTile throws for out of bounds', () => {
      const mockMap: MapData = {
        width: 10,
        height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          t: TileType.Floor,
        })),
        rooms: [],
        connectors: [],
        spawn: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 123,
        algorithm: 'bsp',
      };
      expect(() => manager.setTile(mockMap, -1, 0, TileType.Wall)).toThrow();
      expect(() => manager.setTile(mockMap, 10, 0, TileType.Wall)).toThrow();
    });

    test('setTile throws for invalid tile type', () => {
      const mockMap: MapData = {
        width: 10,
        height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          t: TileType.Floor,
        })),
        rooms: [],
        connectors: [],
        spawn: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 123,
        algorithm: 'bsp',
      };
      expect(() => manager.setTile(mockMap, 0, 0, -1)).toThrow();
      expect(() => manager.setTile(mockMap, 0, 0, 6)).toThrow();
    });

    test('setTile returns new MapData with updated tile', () => {
      const mockMap: MapData = {
        width: 10,
        height: 10,
        tiles: Array.from({ length: 100 }, (_, i) => ({
          x: i % 10,
          y: Math.floor(i / 10),
          t: TileType.Floor,
        })),
        rooms: [],
        connectors: [],
        spawn: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 123,
        algorithm: 'bsp',
      };
      
      const newMap = manager.setTile(mockMap, 5, 5, TileType.Wall);
      expect(manager.getTile(newMap, 5, 5)).toBe(TileType.Wall);
      expect(manager.getTile(mockMap, 5, 5)).toBe(TileType.Floor); // Original unchanged
    });
  });

  describe('Serialization', () => {
    test('serialize and deserialize roundtrip', () => {
      const mockMap: MapData = {
        width: 16,
        height: 16,
        tiles: Array.from({ length: 256 }, (_, i) => ({
          x: i % 16,
          y: Math.floor(i / 16),
          t: TileType.Floor,
        })),
        rooms: [{ x: 2, y: 2, width: 8, height: 8 }],
        connectors: [],
        spawn: { x: 5, y: 5 },
        exit: { x: 10, y: 10 },
        seed: 42,
        algorithm: 'bsp',
      };

      const json = manager.serialize(mockMap);
      const result = manager.deserialize(json);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(mockMap.width);
        expect(result.value.height).toBe(mockMap.height);
        expect(result.value.spawn).toEqual(mockMap.spawn);
        expect(result.value.exit).toEqual(mockMap.exit);
        expect(result.value.tiles.length).toBe(256);
      }
    });

    test('deserialize fails for invalid JSON', () => {
      const result = manager.deserialize('not valid json');
      expect(result.ok).toBe(false);
    });

    test('deserialize fails for malformed data', () => {
      const result = manager.deserialize('{"invalid": "data"}');
      expect(result.ok).toBe(false);
    });
  });

  describe('Concurrency', () => {
    test('concurrent generate calls are serialized', async () => {
      const configs = Array.from({ length: 8 }, (_, i) => ({
        width: 32,
        height: 32,
        seed: i + 1000,
      }));

      const promises = configs.map(cfg => manager.generate(cfg));
      const results = await Promise.all(promises);

      // All should complete (even though they return Err for not implemented)
      expect(results.length).toBe(8);
      
      // Queue should be empty after all complete
      const dbg = manager.getDebugStats?.();
      if (dbg) {
        expect(dbg.queuePending).toBe(0);
      }
    });

    test('getDebugStats returns undefined in non-test env', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const stats = manager.getDebugStats();
      expect(stats).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('getDebugStats returns queue state in test env', () => {
      const dbg = manager.getDebugStats();
      expect(dbg).toBeDefined();
      if (dbg) {
        expect(typeof dbg.queuePending).toBe('number');
      }
    });
  });

  describe('AbortSignal', () => {
    test('generate respects AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await manager.generate(
        { width: 32, height: 32, seed: 999 },
        controller.signal
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('abort');
      }
    });
  });

  // TODO: These tests will pass once generation is implemented
  describe.todo('Map Generation', () => {
    test.todo('generates valid 64x64 map');
    test.todo('respects even width/height constraints');
    test.todo('creates exactly one spawn and exit');
    test.todo('ensures border is all walls');
    test.todo('creates connected walkable regions');
    test.todo('adds extra loops based on configuration');
    test.todo('generates deterministically with same seed');
  });
});
