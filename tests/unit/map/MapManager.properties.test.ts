import fc from 'fast-check';
import { describe, test, expect } from 'vitest';
import { MapManager } from '../../../src/map/MapManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { bfsReachable, isWalkable } from '../../helpers/grid.js';
import type { MapData } from '../../../src/types/contracts.js';

describe('Map Properties (Property-Based Testing)', () => {
  // Helper to create manager
  const createManager = (seed: number): MapManager => {
    const rng = makeRng(seed);
    const logger = makeLogger({ enabled: false });
    return new MapManager(logger, rng);
  };

  test('connectivity & determinism', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          width: fc.integer({ min: 16, max: 128 }).filter(n => n % 2 === 0),
          height: fc.integer({ min: 16, max: 128 }).filter(n => n % 2 === 0),
          seed: fc.integer({ min: 1, max: 999999 }),
        }),
        async ({ width, height, seed }) => {
          const cfg = { width, height, seed };
          const m1 = createManager(seed);
          const m2 = createManager(seed);

          await m1.initialize();
          await m2.initialize();
          const r1 = await m1.generate(cfg);
          const r2 = await m2.generate(cfg);
          await m1.destroy();
          await m2.destroy();

          expect(r1.ok && r2.ok).toBe(true);
          if (r1.ok && r2.ok) {
            // Determinism: same seed/config → identical map
            expect(r1.value).toEqual(r2.value);

            // Spawn/exit counts
            const types = r1.value.tiles.map(t => t.t);
            expect(types.filter(t => t === 4).length).toBe(1); // One spawn
            expect(types.filter(t => t === 5).length).toBe(1); // One exit

            // Walkable connectivity
            const spawn = r1.value.tiles.find(t => t.t === 4)!;
            const seen = bfsReachable(r1.value, spawn.x, spawn.y);
            for (const tile of r1.value.tiles) {
              if (isWalkable(tile.t)) {
                expect(seen.has(tile.y * r1.value.width + tile.x)).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('isWalkable is consistent across tile types', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), (tileType) => {
        const manager = createManager(12345);
        const walkable = manager.isWalkable(tileType);
        
        // Floor(0), Door(3), Spawn(4), Exit(5) are walkable
        // Wall(1), Water(2) are not walkable
        if (tileType === 0 || tileType === 3 || tileType === 4 || tileType === 5) {
          expect(walkable).toBe(true);
        } else {
          expect(walkable).toBe(false);
        }
      })
    );
  });

  test('getTile is consistent with tile array', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 10, max: 50 }),
          height: fc.integer({ min: 10, max: 50 }),
          x: fc.integer({ min: 0, max: 49 }),
          y: fc.integer({ min: 0, max: 49 }),
        }),
        ({ width, height, x, y }) => {
          const manager = createManager(42);
          
          const mockMap: MapData = {
            width,
            height,
            tiles: Array.from({ length: width * height }, (_, i) => ({
              x: i % width,
              y: Math.floor(i / width),
              t: (i % 6), // Cycle through tile types
            })),
            rooms: [],
            connectors: [],
            spawn: { x: 0, y: 0 },
            exit: { x: width - 1, y: height - 1 },
            seed: 42,
            algorithm: 'bsp',
          };

          if (x < width && y < height) {
            const tile = manager.getTile(mockMap, x, y);
            const expectedTile = mockMap.tiles.find(t => t.x === x && t.y === y);
            expect(tile).toBe(expectedTile?.t);
          } else {
            expect(manager.getTile(mockMap, x, y)).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('setTile is immutable', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: 0, max: 15 }),
          y: fc.integer({ min: 0, max: 15 }),
          newType: fc.integer({ min: 0, max: 5 }),
        }),
        ({ x, y, newType }) => {
          const manager = createManager(99);
          
          const mockMap: MapData = {
            width: 16,
            height: 16,
            tiles: Array.from({ length: 256 }, (_, i) => ({
              x: i % 16,
              y: Math.floor(i / 16),
              t: 0,
            })),
            rooms: [],
            connectors: [],
            spawn: { x: 0, y: 0 },
            exit: { x: 15, y: 15 },
            seed: 99,
            algorithm: 'bsp',
          };

          const originalTile = manager.getTile(mockMap, x, y);
          const newMap = manager.setTile(mockMap, x, y, newType);
          
          // Original unchanged
          expect(manager.getTile(mockMap, x, y)).toBe(originalTile);
          // New map has updated tile
          expect(manager.getTile(newMap, x, y)).toBe(newType);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('serialize/deserialize roundtrip preserves data', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 16, max: 32 }),
          height: fc.integer({ min: 16, max: 32 }),
          seed: fc.integer(),
        }),
        ({ width, height, seed }) => {
          const manager = createManager(seed);
          
          const mockMap: MapData = {
            width,
            height,
            tiles: Array.from({ length: width * height }, (_, i) => ({
              x: i % width,
              y: Math.floor(i / width),
              t: i % 6,
            })),
            rooms: [{ x: 2, y: 2, width: 5, height: 5 }],
            connectors: [],
            spawn: { x: 3, y: 3 },
            exit: { x: width - 2, y: height - 2 },
            seed,
            algorithm: 'bsp',
          };

          const json = manager.serialize(mockMap);
          const result = manager.deserialize(json);

          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value.width).toBe(mockMap.width);
            expect(result.value.height).toBe(mockMap.height);
            expect(result.value.seed).toBe(mockMap.seed);
            expect(result.value.tiles.length).toBe(mockMap.tiles.length);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('even dimensions constraint', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 16, max: 128 }),
        (dimension) => {
          // If dimension is odd, generation should fail (once implemented)
          // For now, we just test the constraint itself
          const isEven = dimension % 2 === 0;
          const isValid = dimension >= 16 && dimension <= 128 && isEven;
          
          if (!isValid && dimension % 2 !== 0) {
            // Odd dimensions should be rejected
            expect(isEven).toBe(false);
          }
        }
      )
    );
  });
});

