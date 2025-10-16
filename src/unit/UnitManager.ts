/*
 * UnitManager: Unit management system with equipment and stats.
 * 
 * Features:
 * - Unit creation with level-based stat scaling
 * - Equipment system with stat bonuses
 * - Position tracking for map integration
 * - Battle integration (converts to combat units)
 * - Deterministic unit generation
 */

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import { UnitCreateConfigSchema } from './UnitValidator.js';
import {
  type IUnitSystem,
  type GameUnit,
  type UnitCreateConfig,
  type Equipment,
  type EquipmentSlot,
  type Position,
  type Unit,
  type EffectiveStats,
} from '../types/contracts.js';

export interface IUnitManager extends IUnitSystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  getDebugStats(): { queuePending: number; unitCount: number } | undefined;
}

/**
 * UnitManager implementation
 */
export class UnitManager extends SystemTemplate implements IUnitManager {
  private readonly queue: IAsyncQueue;
  private units: Map<string, GameUnit> = new Map();

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'Unit' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): { queuePending: number; unitCount: number } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }
    return {
      queuePending: this.queue.pending,
      unitCount: this.units.size,
    };
  }

  // ========================================
  // IUnitSystem Interface
  // ========================================

  public async createUnit(
    config: UnitCreateConfig,
    signal?: AbortSignal
  ): Promise<Result<GameUnit, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const configResult = validate(UnitCreateConfigSchema, config);
        if (!configResult.ok) {
          return err(`invalid-config: ${configResult.error.message}`);
        }

        if (this.units.has(config.id)) {
          return err('unit-id-already-exists');
        }

        const unit = this.generateUnit(config);
        this.units.set(unit.id, unit);

        this.log.info('unit:created', { id: unit.id, name: unit.name, level: unit.level });
        return ok(unit);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('unit:create_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getUnit(id: string): GameUnit | undefined {
    return this.units.get(id);
  }

  public getAllUnits(): readonly GameUnit[] {
    return Array.from(this.units.values());
  }

  public async removeUnit(id: string, signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        if (!this.units.has(id)) {
          return err('unit-not-found');
        }

        this.units.delete(id);
        this.log.info('unit:removed', { id });
        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('unit:remove_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public async equipItem(
    unitId: string,
    item: Equipment,
    signal?: AbortSignal
  ): Promise<Result<GameUnit, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const unit = this.units.get(unitId);
        if (!unit) return err('unit-not-found');

        const updated: GameUnit = {
          ...unit,
          equipment: {
            ...unit.equipment,
            [item.slot]: item,
          },
        };

        this.units.set(unitId, updated);
        this.log.info('unit:equipped', { unitId, item: item.id, slot: item.slot });
        return ok(updated);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('unit:equip_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public async unequipItem(
    unitId: string,
    slot: EquipmentSlot,
    signal?: AbortSignal
  ): Promise<Result<GameUnit, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const unit = this.units.get(unitId);
        if (!unit) return err('unit-not-found');

        const equipment = { ...unit.equipment };
        delete equipment[slot];

        const updated: GameUnit = { ...unit, equipment };
        this.units.set(unitId, updated);

        this.log.info('unit:unequipped', { unitId, slot });
        return ok(updated);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('unit:unequip_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getEffectiveStats(unitId: string): EffectiveStats | undefined {
    const unit = this.units.get(unitId);
    if (!unit) return undefined;

    let atk = unit.atk;
    let def = unit.def;
    let speed = unit.speed;

    if (unit.equipment) {
      for (const item of Object.values(unit.equipment)) {
        if (item) {
          atk += item.atkBonus;
          def += item.defBonus;
          speed += item.speedBonus;
        }
      }
    }

    return {
      hp: unit.hp,
      maxHp: unit.maxHp,
      atk,
      def,
      speed,
    };
  }

  public async setPosition(
    unitId: string,
    position: Position,
    signal?: AbortSignal
  ): Promise<Result<GameUnit, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const unit = this.units.get(unitId);
        if (!unit) return err('unit-not-found');

        const updated: GameUnit = { ...unit, position };
        this.units.set(unitId, updated);

        this.log.info('unit:positioned', { unitId, x: position.x, y: position.y });
        return ok(updated);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('unit:set_position_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getUnitsAt(position: Position): readonly GameUnit[] {
    return Array.from(this.units.values()).filter(
      u => u.position?.x === position.x && u.position?.y === position.y
    );
  }

  public getTeamUnits(team: 'player' | 'enemy'): readonly Unit[] {
    return Array.from(this.units.values())
      .filter(u => u.team === team)
      .map(u => this.toUnit(u));
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('unit:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Unit system is passive - no per-frame updates
  }

  protected async onDestroy(): Promise<void> {
    this.log.info('unit:destroy', {});
    this.units.clear();
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Generate a unit with level-based stats.
   */
  private generateUnit(config: UnitCreateConfig): GameUnit {
    const level = config.level ?? 1;
    
    // Base stats scale with level
    const baseHp = 100 + (level - 1) * 10;
    const baseAtk = (config.baseStats?.atk ?? 20) + (level - 1) * 2;
    const baseDef = (config.baseStats?.def ?? 10) + (level - 1) * 1;
    const baseSpeed = (config.baseStats?.speed ?? 50) + (level - 1) * 1;

    return {
      id: config.id,
      name: config.name,
      hp: baseHp,
      maxHp: baseHp,
      atk: baseAtk,
      def: baseDef,
      speed: baseSpeed,
      level,
      experience: 0,
      team: config.team,
      equipment: {},
    };
  }

  /**
   * Convert GameUnit to Battle Unit (applies equipment bonuses).
   */
  private toUnit(gameUnit: GameUnit): Unit {
    const stats = this.getEffectiveStats(gameUnit.id) ?? {
      hp: gameUnit.hp,
      maxHp: gameUnit.maxHp,
      atk: gameUnit.atk,
      def: gameUnit.def,
      speed: gameUnit.speed,
    };

    return {
      id: gameUnit.id,
      hp: stats.hp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed,
    };
  }
}

