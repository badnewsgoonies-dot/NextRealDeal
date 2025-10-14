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

