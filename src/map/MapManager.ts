/*
 * MapManager: Map generation and management system.
 * Generates tactical grid maps using BSP algorithm with configurable parameters.
 * 
 * Features:
 * - BSP (Binary Space Partitioning) room generation
 * - Corridor connectors with optional loops (10-15% extra)
 * - Deterministic generation via IRng
 * - Validation of connectivity and invariants
 * - Support for 64×64 grids (configurable 16-128, even numbers only)
 */

import { SystemTemplate, type SystemConfig } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { Ok, Err, type Result } from '../util/Result.js';
import {
  type IMapSystem,
  type MapGenConfig,
  type MapData,
  type Tile,
  type Room,
  type Connector,
  type Position,
  TileType,
} from '../types/contracts.js';

export interface IMapManager extends IMapSystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  reset(): Promise<Result<void, Error>>;
  dispose(): Promise<void>;
  getCurrentMap(): MapData | null;
  getDebugStats(): { queuePending: number } | undefined;
}

interface MapManagerConfig extends SystemConfig {
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * MapManager implementation
 */
export class MapManager extends SystemTemplate implements IMapManager {
  private readonly rng: IRng;
  private readonly logger: ILogger;
  private readonly queue: IAsyncQueue;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;
  
  private currentMap: MapData | null = null;

  constructor(
    config: MapManagerConfig,
    rng: IRng,
    logger: ILogger,
    queue: IAsyncQueue
  ) {
    super(config);
    this.rng = rng.fork('map');
    this.logger = logger.child({ system: 'Map' });
    this.queue = queue;
    this.defaultWidth = config.defaultWidth ?? 64;
    this.defaultHeight = config.defaultHeight ?? 64;
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  /**
   * Test-only method to inspect queue state.
   * Returns undefined in non-test environments.
   */
  public getDebugStats(): { queuePending: number } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }
    return { queuePending: this.queue.pending };
  }

  // ========================================
  // IMapSystem Interface
  // ========================================

  /**
   * Generate a new map with the given configuration.
   * Uses BSP algorithm by default.
   */
  public async generate(
    config: MapGenConfig,
    signal?: AbortSignal
  ): Promise<Result<MapData, string>> {
    return this.queue.enqueue(async () => {
      if (signal?.aborted) {
        return Err('Map generation aborted');
      }

      this.logger.info('Generating map', {
        width: config.width,
        height: config.height,
        seed: config.seed,
        algorithm: config.algorithm ?? 'bsp',
      });

      // TODO: Validate config
      // TODO: Call generation algorithm
      // TODO: Validate invariants (connectivity, spawn/exit, border walls)
      // TODO: Store currentMap
      // TODO: Log generation stats

      return Err('Not implemented');
    });
  }

  /**
   * Get tile type at (x, y). Returns undefined if out of bounds.
   */
  public getTile(data: MapData, x: number, y: number): number | undefined {
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) {
      return undefined;
    }
    const tile = data.tiles.find(t => t.x === x && t.y === y);
    return tile?.t;
  }

  /**
   * Set tile at (x, y). Returns new MapData (immutable update).
   */
  public setTile(data: MapData, x: number, y: number, tileType: number): MapData {
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) {
      throw new Error(`setTile out of bounds: (${x}, ${y})`);
    }
    if (tileType < 0 || tileType > 5) {
      throw new Error(`Invalid tile type: ${tileType}`);
    }
    
    const newTiles = data.tiles.map(t =>
      t.x === x && t.y === y ? { ...t, t: tileType } : t
    );
    
    return { ...data, tiles: newTiles };
  }

  /**
   * Check if tile type is walkable.
   * Walkable: Floor(0), Door(3), Spawn(4), Exit(5)
   * Impassable: Wall(1), Water(2)
   */
  public isWalkable(tileType: number): boolean {
    return (
      tileType === TileType.Floor ||
      tileType === TileType.Door ||
      tileType === TileType.Spawn ||
      tileType === TileType.Exit
    );
  }

  /**
   * Check if all walkable tiles are connected via flood fill.
   */
  public isConnected(_data: MapData): boolean {
    // TODO: Implement flood fill from spawn to verify all walkable tiles reachable
    return false;
  }

  /**
   * Serialize map to JSON string
   */
  public serialize(data: MapData): string {
    const serializable = {
      width: data.width,
      height: data.height,
      tiles: data.tiles,
      rooms: data.rooms,
      connectors: data.connectors,
      spawn: data.spawn,
      exit: data.exit,
      seed: data.seed,
      algorithm: data.algorithm,
    };
    return JSON.stringify(serializable);
  }

  /**
   * Deserialize map from JSON string
   */
  public deserialize(json: string): Result<MapData, string> {
    try {
      const parsed = JSON.parse(json) as {
        width: number;
        height: number;
        tiles: Tile[];
        rooms: Room[];
        connectors: Connector[];
        spawn: Position;
        exit: Position;
        seed: number;
        algorithm: string;
      };

      // Validate required fields exist
      if (
        typeof parsed.width !== 'number' ||
        typeof parsed.height !== 'number' ||
        !Array.isArray(parsed.tiles) ||
        !Array.isArray(parsed.rooms) ||
        !Array.isArray(parsed.connectors) ||
        !parsed.spawn ||
        !parsed.exit ||
        typeof parsed.seed !== 'number' ||
        typeof parsed.algorithm !== 'string'
      ) {
        return Err('Invalid map data structure');
      }

      const data: MapData = {
        width: parsed.width,
        height: parsed.height,
        tiles: parsed.tiles,
        rooms: parsed.rooms,
        connectors: parsed.connectors,
        spawn: parsed.spawn,
        exit: parsed.exit,
        seed: parsed.seed,
        algorithm: parsed.algorithm,
      };

      return Ok(data);
    } catch (err) {
      return Err(`Failed to deserialize map: ${String(err)}`);
    }
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing MapManager');
    // No initialization needed for map system
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Map system is passive - no per-frame updates needed
  }

  protected async onReset(): Promise<void> {
    this.logger.info('Resetting MapManager');
    this.currentMap = null;
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('Disposing MapManager');
    this.currentMap = null;
  }

  // ========================================
  // Public Accessors
  // ========================================

  /**
   * Get current active map (if any)
   */
  public getCurrentMap(): MapData | null {
    return this.currentMap;
  }

  // ========================================
  // Private Generation Methods (TODO)
  // ========================================

  // TODO: generateBSP(config: MapGenConfig): MapData
  // TODO: createRooms(tree: BSPNode[]): Room[]
  // TODO: connectRooms(rooms: Room[]): Connector[]
  // TODO: addExtraLoops(connectors: Connector[], pct: number): Connector[]
  // TODO: placeSpawnAndExit(rooms: Room[]): { spawn: Position; exit: Position }
  // TODO: validateInvariants(data: MapData): Result<void, string>
  // TODO: floodFill(data: MapData, start: Position): Set<string>
}
