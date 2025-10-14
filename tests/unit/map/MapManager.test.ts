import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MapManager } from '../../../src/map/MapManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeAsyncQueue } from '../../../src/util/AsyncQueue.js';
import { TileType } from '../../../src/types/contracts.js';

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
      const mockMap = {
        width: 10,
        height: 10,
        tiles: new Uint8Array(100),
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

    test('setTile throws for out of bounds', () => {
      const mockMap = {
        width: 10,
        height: 10,
        tiles: new Uint8Array(100),
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
  });

  describe('Serialization', () => {
    test('serialize and deserialize roundtrip', () => {
      const mockMap = {
        width: 16,
        height: 16,
        tiles: new Uint8Array(256).fill(TileType.Floor),
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
      }
    });

    test('deserialize fails for invalid JSON', () => {
      const result = manager.deserialize('not valid json');
      expect(result.ok).toBe(false);
    });
  });

  // TODO: Add map generation tests once implementation is complete
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

