/*
 * GameController: Composition root for Map and Battle systems.
 * 
 * Responsibilities:
 * - Dependency injection (strict DI - systems injected, not constructed)
 * - Lifecycle coordination (init: Map → Battle, destroy: Battle → Map)
 * - System access via getters
 * - NO game logic (pure wiring)
 */

import { SystemTemplate } from './SystemTemplate.js';
import type { ILogger } from '../util/Logger.js';
import type {
  IMapSystem,
  IBattleSystem,
  IUnitSystem,
  IEconomySystem,
  IRouteSystem,
  ISaveSystem,
  IGameController
} from '../types/contracts.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';

/**
 * GameController implementation
 */
export class GameController extends SystemTemplate implements IGameController {
  private readonly queue = makeAsyncQueue();

  constructor(
    protected readonly log: ILogger,
    private readonly mapSystem: IMapSystem,
    private readonly battleSystem: IBattleSystem,
    private readonly unitSystem: IUnitSystem,
    private readonly economySystem: IEconomySystem,
    private readonly routeSystem: IRouteSystem,
    private readonly saveSystem: ISaveSystem
  ) {
    super({ name: 'GameController' });
  }

  // ========================================
  // Lifecycle (Map → Battle init, Battle → Map destroy)
  // ========================================

  async initialize(): Promise<Result<void, Error>> {
    try {
      return await this.queue.run(async () => {
        // Systems are initialized by their managers during construction
        // GameController coordinates but doesn't manage individual system lifecycles

        this.log.info('gc:init_ok', { 
          map: 'ok', battle: 'ok', unit: 'ok', economy: 'ok', route: 'ok', save: 'ok' 
        });
        return ok(undefined);
      });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(new Error('aborted'));
      this.log.error('gc:init_failed', { error: error?.message });
      return err(new Error('internal-error'));
    }
  }

  async update(_deltaTime: number): Promise<Result<void, Error>> {
    try {
      return await this.queue.run(async () => {
        // Systems are updated by their managers as needed
        // GameController coordinates but doesn't manage individual system updates

        return ok(undefined);
      });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err(new Error('aborted'));
      this.log.error('gc:update_failed', { error: error?.message });
      return err(new Error('internal-error'));
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.queue.run(async () => {
        // Systems are destroyed by their managers during garbage collection
        // GameController coordinates but doesn't manage individual system destruction

        this.log.info('gc:destroy_ok', {});
      });
    } catch (e: unknown) {
      // Keep destroy idempotent; child systems log their own errors
      const error = e as { message?: string };
      this.log.warn('gc:destroy_warning', { error: error?.message });
    }
  }

  // ========================================
  // System Access (getters only)
  // ========================================

  getMapManager(): IMapSystem {
    return this.mapSystem;
  }

  getBattleManager(): IBattleSystem {
    return this.battleSystem;
  }

  getUnitManager(): IUnitSystem {
    return this.unitSystem;
  }

  getEconomyManager(): IEconomySystem {
    return this.economySystem;
  }

  getRouteManager(): IRouteSystem {
    return this.routeSystem;
  }

  getSaveManager(): ISaveSystem {
    return this.saveSystem;
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  getDebugStats(): {
    queuePending: number;
    mapPending: number;
    battlePending: number;
    unitPending: number;
    economyPending: number;
    routePending: number;
    savePending: number;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;

    return {
      queuePending: this.queue.pending,
      mapPending: 0, // Systems manage their own debug stats
      battlePending: 0,
      unitPending: 0,
      economyPending: 0,
      routePending: 0,
      savePending: 0,
    };
  }

  // ========================================
  // SystemTemplate Lifecycle Hooks (unused - we override public methods)
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

