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
    await manager.destroy();
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
      await manager2.destroy();
    });

    test('updates without errors', async () => {
      const result = await manager.update(16.67);
      expect(result.ok).toBe(true);
    });

    test('destroys cleanly', async () => {
      await expect(manager.destroy()).resolves.not.toThrow();
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

  describe('Map Generation', () => {
    test('generates valid 64x64 map', async () => {
      const result = await manager.generate({ width: 64, height: 64, seed: 12345 });
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(result.value.width).toBe(64);
        expect(result.value.height).toBe(64);
        expect(result.value.tiles.length).toBe(64 * 64);
      }
    });

    test('generates custom size map', async () => {
      const result = await manager.generate({ width: 32, height: 48, seed: 99999 });
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(result.value.width).toBe(32);
        expect(result.value.height).toBe(48);
        expect(result.value.tiles.length).toBe(32 * 48);
      }
    });

    test('rejects odd dimensions', async () => {
      const result1 = await manager.generate({ width: 33, height: 32, seed: 111 });
      expect(result1.ok).toBe(false);
      
      const result2 = await manager.generate({ width: 32, height: 33, seed: 222 });
      expect(result2.ok).toBe(false);
    });

    test('rejects out of range dimensions', async () => {
      const result1 = await manager.generate({ width: 14, height: 16, seed: 333 });
      expect(result1.ok).toBe(false);
      
      const result2 = await manager.generate({ width: 130, height: 64, seed: 444 });
      expect(result2.ok).toBe(false);
    });

    test('creates exactly one spawn and exit', async () => {
      const result = await manager.generate({ width: 64, height: 64, seed: 555 });
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const types = result.value.tiles.map(t => t.t);
        const spawnCount = types.filter(t => t === TileType.Spawn).length;
        const exitCount = types.filter(t => t === TileType.Exit).length;
        
        expect(spawnCount).toBe(1);
        expect(exitCount).toBe(1);
      }
    });

    test('ensures border is all walls', async () => {
      const result = await manager.generate({ width: 32, height: 32, seed: 666 });
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        const { tiles, width, height } = result.value;
        
        // Check top and bottom borders
        for (let x = 0; x < width; x++) {
          const topTile = tiles.find(t => t.x === x && t.y === 0);
          const bottomTile = tiles.find(t => t.x === x && t.y === height - 1);
          expect(topTile?.t).toBe(TileType.Wall);
          expect(bottomTile?.t).toBe(TileType.Wall);
        }
        
        // Check left and right borders
        for (let y = 0; y < height; y++) {
          const leftTile = tiles.find(t => t.x === 0 && t.y === y);
          const rightTile = tiles.find(t => t.x === width - 1 && t.y === y);
          expect(leftTile?.t).toBe(TileType.Wall);
          expect(rightTile?.t).toBe(TileType.Wall);
        }
      }
    });

    test('generates deterministically with same seed', async () => {
      const result1 = await manager.generate({ width: 32, height: 32, seed: 777 });
      
      // Create new manager with same RNG seed
      const manager2 = new MapManager(
        { name: 'Map' },
        makeRng(20251014),
        logger,
        queue
      );
      await manager2.initialize();
      const result2 = await manager2.generate({ width: 32, height: 32, seed: 777 });
      await manager2.destroy();
      
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      
      if (result1.ok && result2.ok) {
        // Maps should be identical
        expect(result1.value.tiles).toEqual(result2.value.tiles);
        expect(result1.value.rooms).toEqual(result2.value.rooms);
      }
    });
  });
});
