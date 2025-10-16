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

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import { MapGenConfigSchema } from '../map/MapValidator.js';
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
  destroy(): Promise<void>;
  getCurrentMap(): MapData | null;
  getDebugStats(): { queuePending: number } | undefined;
}

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

/**
 * MapManager implementation
 */
export class MapManager extends SystemTemplate implements IMapManager {
  private readonly queue: IAsyncQueue;
  private currentMap: MapData | null = null;

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'Map' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): { queuePending: number } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }
    return { queuePending: this.queue.pending };
  }

  // ========================================
  // IMapSystem Interface
  // ========================================

  public async generate(
    config: MapGenConfig,
    signal?: AbortSignal
  ): Promise<Result<MapData, string>> {
    return this.queue.enqueue(async () => {
      if (signal?.aborted) {
        return err('Map generation aborted');
      }

      const validationResult = validate(MapGenConfigSchema, config);
      if (!validationResult.ok) {
        return err(`Invalid config: ${validationResult.error.message}`);
      }

      return this.generateInternal(config);
    });
  }

  private async generateInternal(config: MapGenConfig): Promise<Result<MapData, string>> {
      const { width, height, seed, minRoomSize = 5, maxRoomSize = 15, extraLoopsPct = 12 } = config;

    this.log.info('map:generating', {
      width, height, seed, algorithm: config.algorithm ?? 'bsp',
    });

    const tiles = this.createBlankMap(width, height);
    const roomsResult = this.generateRooms(width, height, minRoomSize, maxRoomSize);
    
    if (!roomsResult.ok) {
      return roomsResult;
    }

    const { rootNode, rooms } = roomsResult.value;
    this.carveAllRooms(rooms, tiles, width);
    const connectors = this.connectRooms(rootNode, tiles, width);
    this.addExtraLoops(rooms, tiles, width, height, extraLoopsPct);

    const spawnExit = this.placeSpecialTiles(rooms, tiles, width);
    if (!spawnExit.ok) {
      return spawnExit;
    }

    const mapData = this.createMapData(config, tiles, rooms, connectors, spawnExit.value);
    
    if (!this.isFullyConnected(mapData)) {
      return err('Generated map is not fully connected');
    }

    this.currentMap = mapData;
    this.log.info('map:generated', {
      seed, width, height, rooms: rooms.length, connectors: connectors.length,
    });

    return ok(mapData);
  }

  private createBlankMap(width: number, height: number): Tile[] {
    const tiles: Tile[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({ x, y, t: TileType.Wall });
      }
    }
    return tiles;
  }

  private generateRooms(
    width: number,
    height: number,
    minRoomSize: number,
    maxRoomSize: number
  ): Result<{ rootNode: BSPNode; rooms: Room[] }, string> {
    const rootNode: BSPNode = { x: 1, y: 1, width: width - 2, height: height - 2 };
    const minArea = width * height;
    const minDepth = minArea < 800 ? 2 : 3;
    const maxDepth = minArea < 800 ? 3 : minArea < 2000 ? 4 : 5;
    
    this.splitNode(rootNode, 0, minDepth, maxDepth, minRoomSize, maxRoomSize);
    const rooms = this.collectRooms(rootNode);
    
    if (rooms.length === 0) {
      return err('Failed to generate rooms');
    }

    return ok({ rootNode, rooms });
  }

  private carveAllRooms(rooms: Room[], tiles: Tile[], width: number): void {
    for (const room of rooms) {
      this.carveRoom(room, tiles, width);
    }
  }

  private createMapData(
    config: MapGenConfig,
    tiles: Tile[],
    rooms: Room[],
    connectors: Connector[],
    spawnExit: { spawn: Position; exit: Position }
  ): MapData {
    return {
      width: config.width,
      height: config.height,
      tiles,
      rooms,
      connectors,
      spawn: spawnExit.spawn,
      exit: spawnExit.exit,
      seed: config.seed,
      algorithm: config.algorithm ?? 'bsp',
    };
  }

  public getTile(data: MapData, x: number, y: number): number | undefined {
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) {
      return undefined;
    }
    const tile = data.tiles.find(t => t.x === x && t.y === y);
    return tile?.t;
  }

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

  public isWalkable(tileType: number): boolean {
    return (
      tileType === TileType.Floor ||
      tileType === TileType.Door ||
      tileType === TileType.Spawn ||
      tileType === TileType.Exit
    );
  }

  public isConnected(data: MapData): boolean {
    return this.isFullyConnected(data);
  }

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
        return err('Invalid map data structure');
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

      return ok(data);
    } catch (e) {
      return err(`Failed to deserialize map: ${String(e)}`);
    }
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('map:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Map system is passive - no per-frame updates needed
  }

  protected async onDestroy(): Promise<void> {
    this.log.info('map:destroy', {});
    this.currentMap = null;
  }

  public getCurrentMap(): MapData | null {
    return this.currentMap;
  }

  // ========================================
  // Private Generation Methods
  // ========================================

  private splitNode(
    node: BSPNode,
    depth: number,
    minDepth: number,
    maxDepth: number,
    minRoomSize: number,
    maxRoomSize: number
  ): void {
    if (depth >= maxDepth) {
      this.placeRoomInNode(node, minRoomSize, maxRoomSize);
      return;
    }

    const minSplitSize = minRoomSize * 2 + 3;
    const canSplitH = node.width >= minSplitSize;
    const canSplitV = node.height >= minSplitSize;

    if (!canSplitH && !canSplitV) {
      if (depth >= minDepth) {
        this.placeRoomInNode(node, minRoomSize, maxRoomSize);
      }
      return;
    }

    const splitH = canSplitH && canSplitV ? this.rng.bool() : canSplitH;

    if (splitH) {
      const minSplit = Math.floor(node.width * 0.4);
      const maxSplit = Math.floor(node.width * 0.6);
      const split = this.rng.int(minSplit, maxSplit);

      node.left = { x: node.x, y: node.y, width: split, height: node.height };
      node.right = { x: node.x + split, y: node.y, width: node.width - split, height: node.height };
    } else {
      const minSplit = Math.floor(node.height * 0.4);
      const maxSplit = Math.floor(node.height * 0.6);
      const split = this.rng.int(minSplit, maxSplit);

      node.left = { x: node.x, y: node.y, width: node.width, height: split };
      node.right = { x: node.x, y: node.y + split, width: node.width, height: node.height - split };
    }

    this.splitNode(node.left, depth + 1, minDepth, maxDepth, minRoomSize, maxRoomSize);
    this.splitNode(node.right, depth + 1, minDepth, maxDepth, minRoomSize, maxRoomSize);
  }

  private placeRoomInNode(node: BSPNode, minSize: number, maxSize: number): void {
    const maxW = Math.min(node.width - 2, maxSize);
    const maxH = Math.min(node.height - 2, maxSize);
    
    if (maxW < minSize || maxH < minSize) return;

    const w = this.rng.int(minSize, maxW);
    const h = this.rng.int(minSize, maxH);
    const x = node.x + this.rng.int(1, node.width - w - 1);
    const y = node.y + this.rng.int(1, node.height - h - 1);

    node.room = { x, y, width: w, height: h };
  }

  private collectRooms(node: BSPNode): Room[] {
    const rooms: Room[] = [];
    if (node.room) {
      rooms.push(node.room);
    }
    if (node.left) {
      rooms.push(...this.collectRooms(node.left));
    }
    if (node.right) {
      rooms.push(...this.collectRooms(node.right));
    }
    return rooms;
  }

  private carveRoom(room: Room, tiles: Tile[], width: number): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const idx = y * width + x;
        if (tiles[idx]) {
          tiles[idx] = { x, y, t: TileType.Floor };
        }
      }
    }
  }

  private connectRooms(node: BSPNode, tiles: Tile[], width: number): Connector[] {
    const connectors: Connector[] = [];
    
    if (!node.left || !node.right) return connectors;

    const leftRooms = this.collectRooms(node.left);
    const rightRooms = this.collectRooms(node.right);

    if (leftRooms.length > 0 && rightRooms.length > 0) {
      const leftRoom = leftRooms[this.rng.int(0, leftRooms.length - 1)];
      const rightRoom = rightRooms[this.rng.int(0, rightRooms.length - 1)];

      const from = this.getRoomCenter(leftRoom);
      const to = this.getRoomCenter(rightRoom);
      
      this.carveCorridor(from, to, tiles, width);
      connectors.push({ from, to, isExtra: false });
    }

    connectors.push(...this.connectRooms(node.left, tiles, width));
    connectors.push(...this.connectRooms(node.right, tiles, width));

    return connectors;
  }

  private getRoomCenter(room: Room): Position {
    return {
      x: room.x + Math.floor(room.width / 2),
      y: room.y + Math.floor(room.height / 2),
    };
  }

  private carveCorridor(from: Position, to: Position, tiles: Tile[], width: number): void {
    if (this.rng.bool()) {
      this.carveHorizontal(from.x, to.x, from.y, tiles, width);
      this.carveVertical(from.y, to.y, to.x, tiles, width);
    } else {
      this.carveVertical(from.y, to.y, from.x, tiles, width);
      this.carveHorizontal(from.x, to.x, to.y, tiles, width);
    }
  }

  private carveHorizontal(x1: number, x2: number, y: number, tiles: Tile[], width: number): void {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      const idx = y * width + x;
      if (tiles[idx] && tiles[idx].t === TileType.Wall) {
        tiles[idx] = { x, y, t: TileType.Floor };
      }
    }
  }

  private carveVertical(y1: number, y2: number, x: number, tiles: Tile[], width: number): void {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      const idx = y * width + x;
      if (tiles[idx] && tiles[idx].t === TileType.Wall) {
        tiles[idx] = { x, y, t: TileType.Floor };
      }
    }
  }

  private addExtraLoops(
    rooms: Room[],
    tiles: Tile[],
    width: number,
    height: number,
    pct: number
  ): void {
    const numExtra = Math.floor((rooms.length - 1) * (pct / 100));
    
    for (let i = 0; i < numExtra; i++) {
      const room1 = rooms[this.rng.int(0, rooms.length - 1)];
      const room2 = rooms[this.rng.int(0, rooms.length - 1)];
      
      if (room1 !== room2) {
        const from = this.getRoomCenter(room1);
        const to = this.getRoomCenter(room2);
        this.carveCorridor(from, to, tiles, width);
      }
    }
  }

  private placeSpecialTiles(
    rooms: Room[],
    tiles: Tile[],
    width: number
  ): Result<{ spawn: Position; exit: Position }, string> {
    if (rooms.length === 0) {
      return err('No rooms available for spawn/exit placement');
    }

    const spawnRoom = rooms[this.rng.int(0, rooms.length - 1)];
    const spawn = this.getRandomFloorInRoom(spawnRoom, tiles, width);
    
    if (!spawn) {
      return err('Failed to place spawn');
    }

    tiles[spawn.y * width + spawn.x] = { ...spawn, t: TileType.Spawn };

    let exitRoom = rooms[this.rng.int(0, rooms.length - 1)];
    let attempts = 0;
    while (exitRoom === spawnRoom && rooms.length > 1 && attempts < 10) {
      exitRoom = rooms[this.rng.int(0, rooms.length - 1)];
      attempts++;
    }

    const exit = this.getRandomFloorInRoom(exitRoom, tiles, width);
    if (!exit) {
      return err('Failed to place exit');
    }

    tiles[exit.y * width + exit.x] = { ...exit, t: TileType.Exit };

    return ok({ spawn, exit });
  }

  private getRandomFloorInRoom(room: Room, tiles: Tile[], width: number): Position | null {
    const candidates: Position[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const idx = y * width + x;
        if (tiles[idx]?.t === TileType.Floor) {
          candidates.push({ x, y });
        }
      }
    }
    
    return candidates.length > 0 ? candidates[this.rng.int(0, candidates.length - 1)] : null;
  }

  private isFullyConnected(data: MapData): boolean {
    const spawn = data.tiles.find(t => t.t === TileType.Spawn);
    if (!spawn) return false;

    const reachable = this.bfsReachable(data, spawn.x, spawn.y);
    const walkableTiles = data.tiles.filter(t => this.isWalkable(t.t));

    return walkableTiles.every(t => reachable.has(t.y * data.width + t.x));
  }

  private bfsReachable(data: MapData, sx: number, sy: number): Set<number> {
    const seen = new Set<number>();
    const q: [number, number][] = [[sx, sy]];
    
    while (q.length > 0) {
      const [x, y] = q.shift()!;
      const i = y * data.width + x;
      
      if (seen.has(i)) continue;
      seen.add(i);
      
      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && ny >= 0 && nx < data.width && ny < data.height) {
          const tile = data.tiles.find(t => t.x === nx && t.y === ny);
          if (tile && this.isWalkable(tile.t) && !seen.has(ny * data.width + nx)) {
            q.push([nx, ny]);
          }
        }
      }
    }
    
    return seen;
  }
}
