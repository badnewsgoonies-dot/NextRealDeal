/*
 * SystemTemplate: Base pattern for all game systems.
 * Enforces lifecycle, dependency injection, and cleanup patterns.
 */

import type { Result } from '../util/Result.js';

export interface ISystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
}

export interface SystemConfig {
  name: string;
  enabled?: boolean;
}

/**
 * Base class for implementing systems.
 * Subclasses should override the protected lifecycle methods.
 */
export abstract class SystemTemplate implements ISystem {
  public readonly name: string;
  protected enabled: boolean;
  private initialized = false;
  private disposed = false;

  constructor(config: SystemConfig) {
    this.name = config.name;
    this.enabled = config.enabled ?? true;
  }

  public async initialize(): Promise<Result<void, Error>> {
    if (this.disposed) {
      return { ok: false, error: new Error(`System ${this.name} already disposed`) };
    }
    if (this.initialized) {
      return { ok: false, error: new Error(`System ${this.name} already initialized`) };
    }

    try {
      await this.onInitialize();
      this.initialized = true;
      return { ok: true, value: undefined };
    } catch (err) {
      return { 
        ok: false, 
        error: err instanceof Error ? err : new Error(String(err)) 
      };
    }
  }

  public async update(deltaTime: number): Promise<Result<void, Error>> {
    if (this.disposed) {
      return { ok: false, error: new Error(`System ${this.name} disposed`) };
    }
    if (!this.initialized) {
      return { ok: false, error: new Error(`System ${this.name} not initialized`) };
    }
    if (!this.enabled) {
      return { ok: true, value: undefined };
    }

    try {
      await this.onUpdate(deltaTime);
      return { ok: true, value: undefined };
    } catch (err) {
      return { 
        ok: false, 
        error: err instanceof Error ? err : new Error(String(err)) 
      };
    }
  }

  public async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.initialized = false;
    await this.onDestroy();
  }

  // Lifecycle hooks for subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract onUpdate(deltaTime: number): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
}

