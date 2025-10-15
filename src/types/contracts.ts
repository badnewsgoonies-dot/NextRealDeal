/*
 * Core type contracts for the game engine.
 * These types define interfaces between systems.
 */

import type { Result } from '../util/Result.js';

/**
 * Basic geometric types
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Time management
 */
export interface TimeInfo {
  readonly deltaTime: number;
  readonly totalTime: number;
  readonly frameCount: number;
}

/**
 * Resource management
 */
export interface ResourceHandle<T> {
  readonly id: string;
  readonly type: string;
  load(): Promise<Result<T, Error>>;
  unload(): Promise<Result<void, Error>>;
  isLoaded(): boolean;
}

/**
 * Event system
 */
export interface GameEvent<T = unknown> {
  readonly type: string;
  readonly timestamp: number;
  readonly data: T;
}

export interface IEventEmitter<TEvents extends Record<string, unknown>> {
  on<K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void): void;
  off<K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void): void;
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
}

/**
 * State management
 */
export interface GameState<T> {
  readonly current: T;
  canTransitionTo(state: T): boolean;
  transitionTo(state: T): Result<void, Error>;
}

/**
 * Serialization
 */
export interface Serializable<T> {
  serialize(): T;
}

export interface Deserializable<T, TData> {
  deserialize(data: TData): Result<T, Error>;
}

/**
 * Map System Types
 */

/**
 * Tile with position and type
 * t: 0=floor, 1=wall, 2=water, 3=door, 4=spawn, 5=exit
 */
export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly t: number; // 0..5
}

/**
 * Tile type constants for readability
 */
export const TileType = {
  Floor: 0,
  Wall: 1,
  Water: 2,
  Door: 3,
  Spawn: 4,
  Exit: 5,
} as const;

/**
 * Map generation configuration
 */
export interface MapGenConfig {
  readonly width: number;  // Even number in [16..128]
  readonly height: number; // Even number in [16..128]
  readonly seed: number;   // RNG seed for this map
  readonly minRoomSize?: number;
  readonly maxRoomSize?: number;
  readonly extraLoopsPct?: number; // 0-100, percentage of extra connectors for loops
  readonly algorithm?: 'bsp' | 'cellular' | 'drunkard'; // Future extensibility
}

/**
 * Room data for BSP generation
 */
export interface Room {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Connector between rooms
 */
export interface Connector {
  readonly from: Position;
  readonly to: Position;
  readonly isExtra: boolean; // true if added for loops
}

/**
 * Generated map data
 */
export interface MapData {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[]; // Array of tiles with positions
  readonly rooms: readonly Room[];
  readonly connectors: readonly Connector[];
  readonly spawn: Position;
  readonly exit: Position;
  readonly seed: number;
  readonly algorithm: string;
}

/**
 * Map System interface
 */
export interface IMapSystem {
  generate(config: MapGenConfig, signal?: AbortSignal): Promise<Result<MapData, string>>;
  getTile(data: MapData, x: number, y: number): number | undefined;
  setTile(data: MapData, x: number, y: number, tileType: number): MapData;
  isWalkable(tileType: number): boolean;
  isConnected(data: MapData): boolean;
  serialize(data: MapData): string;
  deserialize(json: string): Result<MapData, string>;
}

