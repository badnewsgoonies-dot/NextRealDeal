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
import type { IRng } from '../util/Rng.js';
import type {
  IMapSystem,
  IBattleSystem,
  IUnitSystem,
  IEconomySystem,
  IRouteSystem,
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
    private readonly rng: IRng,
    private readonly mapSystem: IMapSystem,
    private readonly battleSystem: IBattleSystem,
    private readonly unitSystem: IUnitSystem,
    private readonly economySystem: IEconomySystem,
    private readonly routeSystem: IRouteSystem
  ) {
    super({ name: 'GameController' });
  }

  // ========================================
  // Lifecycle (Map → Battle init, Battle → Map destroy)
  // ========================================

  async initialize(signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        // Initialize Map first
        const mapResult = await this.mapSystem.initialize?.(signal);
        if (mapResult && !mapResult.ok) {
          return err(`map-init-failed:${String(mapResult.error)}`);
        }

        // Initialize Battle second
        const battleResult = await this.battleSystem.initialize?.(signal);
        if (battleResult && !battleResult.ok) {
          return err(`battle-init-failed:${String(battleResult.error)}`);
        }

        // Initialize Unit third
        const unitResult = await this.unitSystem.initialize?.(signal);
        if (unitResult && !unitResult.ok) {
          return err(`unit-init-failed:${String(unitResult.error)}`);
        }

        // Initialize Economy fourth
        const economyResult = await this.economySystem.initialize?.(signal);
        if (economyResult && !economyResult.ok) {
          return err(`economy-init-failed:${String(economyResult.error)}`);
        }

        // Initialize Route fifth
        const routeResult = await this.routeSystem.initialize?.(signal);
        if (routeResult && !routeResult.ok) {
          return err(`route-init-failed:${String(routeResult.error)}`);
        }

        this.log.info('gc:init_ok', { map: 'ok', battle: 'ok', unit: 'ok', economy: 'ok', route: 'ok' });
        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('gc:init_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  async update(dt: number, signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        // Update all systems (order doesn't matter for update)
        await this.mapSystem.update?.(dt, signal);
        await this.battleSystem.update?.(dt, signal);
        await this.unitSystem.update?.(dt, signal);
        await this.economySystem.update?.(dt, signal);
        await this.routeSystem.update?.(dt, signal);

        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('gc:update_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.queue.run(async () => {
        // Destroy in REVERSE order (Route → Economy → Unit → Battle → Map)
        try {
          await this.routeSystem.destroy?.();
        } catch {
          // Continue to next system
        }
        try {
          await this.economySystem.destroy?.();
        } catch {
          // Continue to next system
        }
        try {
          await this.unitSystem.destroy?.();
        } catch {
          // Continue to next system
        }
        try {
          await this.battleSystem.destroy?.();
        } catch {
          // Continue to next system
        }
        try {
          await this.mapSystem.destroy?.();
        } catch {
          // Final cleanup
        }

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
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;

    return {
      queuePending: this.queue.pending,
      mapPending: this.mapSystem.getDebugStats?.()?.queuePending ?? 0,
      battlePending: this.battleSystem.getDebugStats?.()?.queuePending ?? 0,
      unitPending: this.unitSystem.getDebugStats?.()?.queuePending ?? 0,
      economyPending: this.economySystem.getDebugStats?.()?.queuePending ?? 0,
      routePending: this.routeSystem.getDebugStats?.()?.queuePending ?? 0,
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

