/*
 * GameController: Composition root for game systems.
 * Wires together Map and Battle systems with strict dependency injection.
 * 
 * Responsibilities:
 * - Initialize/update/destroy subsystems in correct order
 * - Forward lifecycle calls (no game logic)
 * - Provide access to subsystems
 * - Expose debug stats for testing
 */

import { SystemTemplate } from './SystemTemplate.js';
import type { ILogger } from '../util/Logger.js';
import type { IRng } from '../util/Rng.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import type { IMapSystem, IBattleSystem, IGameController } from '../types/contracts.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';

/**
 * GameController implementation
 */
export class GameController extends SystemTemplate implements IGameController {
  private readonly queue: IAsyncQueue;

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng,
    private readonly mapSystem: IMapSystem,
    private readonly battleSystem: IBattleSystem
  ) {
    super({ name: 'GameController' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // IGameController Interface (Override SystemTemplate)
  // ========================================

  /**
   * Initialize all subsystems in order: Map → Battle
   */
  public async initialize(signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        // Initialize map system
        const mapResult = await this.mapSystem.initialize();
        if (!mapResult.ok) {
          return err(`map-init-failed: ${mapResult.error.message}`);
        }

        // Initialize battle system
        const battleResult = await this.battleSystem.initialize();
        if (!battleResult.ok) {
          return err(`battle-init-failed: ${battleResult.error.message}`);
        }

        this.log.info('gc:init_ok', {});
        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('gc:init_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Update all subsystems: Map → Battle
   */
  public async update(dt: number, signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        await this.mapSystem.update(dt);
        await this.battleSystem.update(dt);

        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('gc:update_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Destroy all subsystems in reverse order: Battle → Map
   */
  public async destroy(): Promise<void> {
    try {
      await this.queue.run(async () => {
        // Teardown in reverse order
        try {
          await this.battleSystem.destroy();
        } finally {
          await this.mapSystem.destroy();
        }
        this.log.info('gc:destroy_ok', {});
      });
    } catch {
      // Keep destroy idempotent; subsystems log their own errors
    }
  }

  // ========================================
  // Accessors
  // ========================================

  public getMapManager(): IMapSystem {
    return this.mapSystem;
  }

  public getBattleManager(): IBattleSystem {
    return this.battleSystem;
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): { queuePending: number; mapPending: number; battlePending: number } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }

    return {
      queuePending: this.queue.pending,
      mapPending: this.mapSystem.getDebugStats?.()?.queuePending ?? 0,
      battlePending: this.battleSystem.getDebugStats?.()?.queuePending ?? 0,
    };
  }

  // ========================================
  // SystemTemplate Lifecycle (Not Used - We Override)
  // ========================================

  protected async onInitialize(): Promise<void> {
    // Not used - we override initialize() directly
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Not used - we override update() directly
  }

  protected async onDestroy(): Promise<void> {
    // Not used - we override destroy() directly
  }
}

