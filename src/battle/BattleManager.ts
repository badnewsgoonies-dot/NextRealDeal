/*
 * BattleManager: Turn-based combat system with deterministic mechanics.
 * 
 * Features:
 * - Deterministic initiative ordering (speed DESC, input index ASC)
 * - Turn-based combat with attack resolution
 * - Battle-local RNG to prevent cross-battle bleed
 * - Combat log with sequence numbers (not timestamps)
 * - Dodge (5%), critical (10%), and variance mechanics
 */

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { validate } from '../validation/validate.js';
import { UnitsArraySchema } from './BattleValidator.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import {
  type IBattleSystem,
  type Unit,
  type CombatResult,
  type BattleState,
  type RoundResult,
  type CombatAction,
} from '../types/contracts.js';

export interface IBattleManager extends IBattleSystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  getDebugStats(): { queuePending: number; combatLogSize: number } | undefined;
}

/**
 * BattleManager implementation
 */
export class BattleManager extends SystemTemplate implements IBattleManager {
  private readonly queue: IAsyncQueue;
  
  private battleSeq = 0;
  private battleRng: IRng | null = null;
  private logSeq = 0;
  
  private currentBattle: BattleState | null = null;
  private combatLog: CombatAction[] = [];

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'Battle' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  /**
   * Test-only method to inspect queue and combat log state.
   * Returns undefined in non-test environments.
   */
  public getDebugStats(): { queuePending: number; combatLogSize: number } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }
    return { 
      queuePending: this.queue.pending,
      combatLogSize: this.combatLog.length 
    };
  }

  // ========================================
  // IBattleSystem Interface
  // ========================================

  /**
   * Execute a single attack from one unit to another.
   * Uses deterministic damage calculation with dodge/crit mechanics.
   */
  public async attack(
    attackerId: string,
    targetId: string,
    signal?: AbortSignal
  ): Promise<Result<CombatResult, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this._attackInternal(attackerId, targetId, signal);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('battle:attack_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Internal attack method (no queue - called from within queue scope).
   * Implements 5-step damage calculation.
   */
  private _attackInternal(
    attackerId: string,
    targetId: string,
    _signal?: AbortSignal
  ): Result<CombatResult, string> {
    const validationResult = this.validateAttack(attackerId, targetId);
    if (!validationResult.ok) {
      return validationResult;
    }

    const { attacker, target } = validationResult.value;
    const rng = this.battleRng!;

    // 1. Check dodge (5%)
    const dodged = rng.int(1, 100) <= 5;
    if (dodged) {
      return this.handleDodge(attackerId, targetId, target.hp);
    }

    // 2-5. Calculate damage with variance and crit
    const damageResult = this.calculateDamage(attacker, target, rng);
    return this.applyDamageAndLog(attackerId, targetId, target.hp, damageResult);
  }

  /**
   * Validate attack preconditions.
   */
  private validateAttack(
    attackerId: string,
    targetId: string
  ): Result<{ attacker: Unit; target: Unit }, string> {
    if (!this.currentBattle || !this.currentBattle.isActive) {
      return err('no-active-battle');
    }
    if (!this.battleRng) {
      return err('battle-rng-not-initialized');
    }

    const units = this.currentBattle.units;
    const attacker = units.find(u => u.id === attackerId);
    const target = units.find(u => u.id === targetId);
    
    if (!attacker) return err('attacker-not-found');
    if (!target) return err('target-not-found');
    if (attacker.hp <= 0) return err('attacker-dead');
    if (target.hp <= 0) return err('target-dead');

    return ok({ attacker, target });
  }

  /**
   * Handle dodge result.
   */
  private handleDodge(attackerId: string, targetId: string, targetHp: number): Result<CombatResult, string> {
    this.logCombatAction({ 
      type: 'dodge', 
      actorId: attackerId, 
      targetId, 
      dodged: true 
    });
    return ok({ 
      damage: 0, 
      finalHp: targetHp, 
      killed: false, 
      critical: false, 
      dodged: true 
    });
  }

  /**
   * Calculate damage with variance and critical hit.
   */
  private calculateDamage(
    attacker: Unit,
    target: Unit,
    rng: IRng
  ): { damage: number; critical: boolean } {
    // 2. Base damage = atk - ⌊def/2⌋
    let damage = attacker.atk - Math.floor(target.def / 2);
    
    // 3. Add variance: base + rng.int(-2, 2)
    damage += rng.int(-2, 2);
    
    // 4. Check critical (10%)
    const critical = rng.int(1, 100) <= 10;
    if (critical) {
      damage = Math.floor(damage * 1.5);
    }
    
    // 5. Clamp to non-negative
    damage = Math.max(0, damage);

    return { damage, critical };
  }

  /**
   * Apply damage to target and log actions.
   */
  private applyDamageAndLog(
    attackerId: string,
    targetId: string,
    currentHp: number,
    damageResult: { damage: number; critical: boolean }
  ): Result<CombatResult, string> {
    const { damage, critical } = damageResult;
    const finalHp = Math.max(0, currentHp - damage);
    const killed = finalHp === 0 && currentHp > 0;

    // Update state immutably
    const units = this.currentBattle!.units;
    this.currentBattle = {
      ...this.currentBattle!,
      units: units.map(u => (u.id === targetId ? { ...u, hp: finalHp } : u)),
    };

    this.logCombatAction({ 
      type: 'attack', 
      actorId: attackerId, 
      targetId, 
      damage, 
      critical, 
      dodged: false 
    });
    
    if (killed) {
      this.logCombatAction({ type: 'defeat', actorId: targetId });
    }

    return ok({ damage, finalHp, killed, critical, dodged: false });
  }

  /**
   * Start a new battle with the given units.
   * Initializes battle-local RNG and determines turn order.
   */
  public async startBattle(
    units: Unit[],
    signal?: AbortSignal
  ): Promise<Result<BattleState, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        // Validate units array
        const unitsRes = validate(UnitsArraySchema, units);
        if (!unitsRes.ok) {
          return err(`invalid-units: ${unitsRes.error.message}`);
        }

        // Check for duplicate IDs and hp <= maxHp
        const ids = new Set<string>();
        for (const u of units) {
          if (ids.has(u.id)) return err('duplicate-unit-id');
          ids.add(u.id);
          if (u.hp > u.maxHp) return err('hp-exceeds-maxHp');
        }

        // Create battle-local RNG
        this.battleRng = this.rng.fork(`battle#${this.battleSeq++}`);
        this.logSeq = 0;
        this.combatLog = [];

        // Calculate initiative order (speed DESC, then input index ASC)
        const order = this.determineInitiativeOrder(units);

        // Create battle state
        this.currentBattle = {
          units: units.map(u => ({ ...u })),
          turnOrder: order,
          currentTurn: 0,
          isActive: true,
        };

        this.log.info('battle:started', {
          units: units.length,
          order: order.join(','),
        });

        return ok(this.currentBattle);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('battle:start_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Execute one full round of combat (all units take turns).
   */
  public async executeRound(signal?: AbortSignal): Promise<Result<RoundResult, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this.executeRoundInternal(signal);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('battle:execute_round_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Internal round execution (no queue).
   */
  private executeRoundInternal(signal?: AbortSignal): Result<RoundResult, string> {
    if (!this.currentBattle || !this.currentBattle.isActive) {
      return err('no-active-battle');
    }

    const roundStartSeq = this.logSeq;
    const unitsDefeated: string[] = [];

    // Execute each unit's turn
    for (const unitId of this.currentBattle.turnOrder) {
      if (signal?.aborted) return err('aborted');

      const unit = this.currentBattle.units.find(u => u.id === unitId);
      if (!unit || unit.hp <= 0) continue;

      const targetId = this.selectTarget(unitId);
      if (!targetId) continue;

      const attackResult = this._attackInternal(unitId, targetId, signal);
      
      if (!attackResult.ok) {
        this.log.warn('battle:round_attack_failed', { 
          attacker: unitId, 
          target: targetId, 
          error: attackResult.error 
        });
        continue;
      }

      if (attackResult.value.killed) {
        unitsDefeated.push(targetId);
      }

      const winner = this.checkVictory();
      if (winner !== null) {
        this.currentBattle = { ...this.currentBattle, isActive: false };
        const actions = this.combatLog.slice(roundStartSeq);
        return ok({ actions, unitsDefeated, battleEnded: true, winner });
      }
    }

    const actions = this.combatLog.slice(roundStartSeq);
    return ok({ actions, unitsDefeated, battleEnded: false });
  }

  /**
   * End the current battle and clean up state.
   */
  public async endBattle(): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (!this.currentBattle) {
          return ok(undefined);
        }

        this.log.info('battle:ending', {});
        
        // Mark battle as inactive (keep state for analysis)
        this.currentBattle = { ...this.currentBattle, isActive: false };
        this.battleRng = null;
        
        // Keep combat log for post-battle analysis
        return ok(undefined);
      });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('battle:end_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  /**
   * Get the current battle state (if any).
   */
  public getBattleState(): BattleState | null {
    return this.currentBattle;
  }

  /**
   * Get the combat log for the current/last battle.
   */
  public getCombatLog(): readonly CombatAction[] {
    return this.combatLog;
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('battle:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Battle system is turn-based, no per-frame updates needed
  }

  protected async onDestroy(): Promise<void> {
    this.log.info('battle:destroy', {});
    this.currentBattle = null;
    this.battleRng = null;
    this.combatLog = [];
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Determine initiative order using stable sort.
   * Sort by speed DESC, then input index ASC (deterministic).
   */
  private determineInitiativeOrder(units: Unit[]): string[] {
    const withIndex = units.map((u, index) => ({ u, index }));
    withIndex.sort((a, b) => {
      if (b.u.speed !== a.u.speed) return b.u.speed - a.u.speed;
      return a.index - b.index;
    });
    return withIndex.map(x => x.u.id);
  }

  /**
   * Select target for an attacker (team-based targeting v1).
   * First half = players, second half = enemies.
   * Each unit attacks first living opponent from other team.
   */
  private selectTarget(attackerId: string): string | null {
    if (!this.currentBattle) return null;
    
    const units = this.currentBattle.units;
    const mid = Math.floor(units.length / 2);
    const attackerIdx = units.findIndex(u => u.id === attackerId);
    if (attackerIdx === -1) return null;
    
    const isPlayerAttacker = attackerIdx < mid;
    const enemies = units.filter((u, idx) => {
      const isPlayerUnit = idx < mid;
      return u.hp > 0 && isPlayerUnit !== isPlayerAttacker;
    });
    
    return enemies.length > 0 ? enemies[0].id : null;
  }

  /**
   * Check victory condition.
   * Player wins: all enemies defeated
   * Enemy wins: all players defeated
   * Draw: all units defeated
   */
  private checkVictory(): 'player' | 'enemy' | 'draw' | null {
    if (!this.currentBattle) return null;
    
    const units = this.currentBattle.units;
    const mid = Math.floor(units.length / 2);
    
    const alivePlayers = units.slice(0, mid).filter(u => u.hp > 0);
    const aliveEnemies = units.slice(mid).filter(u => u.hp > 0);
    
    if (aliveEnemies.length === 0 && alivePlayers.length === 0) return 'draw';
    if (aliveEnemies.length === 0) return 'player';
    if (alivePlayers.length === 0) return 'enemy';
    return null;
  }

  /**
   * Log a combat action with automatic sequence number.
   */
  private logCombatAction(action: Omit<CombatAction, 'seq'>): void {
    this.combatLog.push({ ...action, seq: this.logSeq++ });
  }
}

