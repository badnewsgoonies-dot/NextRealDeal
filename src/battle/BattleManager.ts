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
import * as Actions from './BattleActions.js';
import * as Helpers from './BattleHelpers.js';
import {
  type IBattleSystem,
  type Unit,
  type CombatResult,
  type BattleState,
  type RoundResult,
  type CombatAction,
  type CombatActionType,
  type ActionSelection,
  type ActionResult,
  type StatusEffect,
  type EnhancedUnit,
  type ActionValidation,
} from '../types/contracts.js';

export interface IBattleManager extends IBattleSystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  
  // Enhanced action system
  selectAction(selection: ActionSelection, signal?: AbortSignal): Promise<Result<ActionResult, string>>;
  validateAction(selection: ActionSelection): ActionValidation;
  getAvailableActions(unitId: string): readonly CombatActionType[];
  getEnhancedUnits(): readonly EnhancedUnit[];
  
  getDebugStats(): { 
    queuePending: number; 
    combatLogSize: number;
    activeStatusEffects: number;
  } | undefined;
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
  private enhancedUnits: EnhancedUnit[] = [];

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
  public getDebugStats(): { 
    queuePending: number; 
    combatLogSize: number;
    activeStatusEffects: number;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') {
      return undefined;
    }
    
    const activeStatusEffects = this.enhancedUnits.reduce(
      (total, unit) => total + unit.statusEffects.length,
      0
    );
    
    return { 
      queuePending: this.queue.pending,
      combatLogSize: this.combatLog.length,
      activeStatusEffects,
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
    const validationResult = Helpers.validateAttack(attackerId, targetId, this.currentBattle, this.battleRng);
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
    const damageResult = Helpers.calculateDamage(attacker, target, rng);
    return this.applyDamageAndLog(attackerId, targetId, target.hp, damageResult);
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
   * Apply damage to target and log actions.
   */
  private applyDamageAndLog(
    attackerId: string,
    targetId: string,
    currentHp: number,
    damageResult: { damage: number; critical: boolean }
  ): Result<CombatResult, string> {
    const result = Helpers.applyDamageResult(attackerId, targetId, currentHp, damageResult);

    // Update state immutably
    this.currentBattle = {
      ...this.currentBattle!,
      units: this.currentBattle!.units.map(u => (u.id === targetId ? { ...u, hp: result.newHp } : u)),
    };

    // Log all actions
    for (const logAction of result.logActions) {
      this.logCombatAction(logAction as Omit<CombatAction, 'seq'>);
    }

    return ok(result.combatResult);
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

        // Initialize enhanced units with status effects and cooldowns
        this.enhancedUnits = units.map(u => ({
          ...u,
          statusEffects: [],
          actionCooldowns: {
            attack: 0,
            defend: 0,
            signature_skill: 0,
          },
        }));

        // Calculate initiative order (speed DESC, then input index ASC)
        const order = Helpers.determineInitiativeOrder(units);

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

    // Process status effects and cooldowns
    this.enhancedUnits = Actions.processStatusEffects(this.enhancedUnits);
    this.enhancedUnits = Actions.processCooldowns(this.enhancedUnits);

    // Execute each unit's turn
    for (const unitId of this.currentBattle.turnOrder) {
      if (signal?.aborted) return err('aborted');

      const unit = this.currentBattle.units.find(u => u.id === unitId);
      if (!unit || unit.hp <= 0) continue;

      const targetId = Helpers.selectTarget(unitId, this.currentBattle.units);
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

      const winner = Helpers.checkVictory(this.currentBattle.units);
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
  // Enhanced Action System (Three-Action Combat)
  // ========================================

  /**
   * Execute a selected action (attack, defend, or signature_skill).
   */
  public async selectAction(
    selection: ActionSelection,
    signal?: AbortSignal
  ): Promise<Result<ActionResult, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this._selectActionInternal(selection);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('battle:select_action_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private _selectActionInternal(selection: ActionSelection): Result<ActionResult, string> {
    return Actions.executeSelectedAction(
      selection,
      this.enhancedUnits,
      this.currentBattle,
      this.battleRng!,
      (action) => this.logCombatAction(action as Omit<CombatAction, 'seq'>),
      (id, hp) => this._updateEnhancedUnitHp(id, hp),
      (id, effect) => this._applyStatusEffect(id, effect),
      (id, type, cd) => this._applyActionCooldown(id, type, cd)
    );
  }

  /**
   * Validate an action selection.
   */
  public validateAction(selection: ActionSelection): ActionValidation {
    return Actions.validateAction(selection, this.currentBattle, this.enhancedUnits);
  }

  /**
   * Get available actions for a unit.
   */
  public getAvailableActions(unitId: string): readonly CombatActionType[] {
    return Actions.getAvailableActions(unitId, this.currentBattle, this.enhancedUnits);
  }

  /**
   * Get enhanced units with status effects and cooldowns.
   */
  public getEnhancedUnits(): readonly EnhancedUnit[] {
    return this.enhancedUnits;
  }

  // ========================================
  // Status Effect and Cooldown Management
  // ========================================

  private _applyStatusEffect(unitId: string, effect: StatusEffect): void {
    const unit = this.enhancedUnits.find(u => u.id === unitId);
    if (!unit) return;

    // Remove existing effect of same type
    const filteredEffects = unit.statusEffects.filter(e => e.type !== effect.type);
    
    // Add new effect
    const newEffects = [...filteredEffects, effect];

    this._updateEnhancedUnit(unitId, { statusEffects: newEffects });
  }

  private _applyActionCooldown(unitId: string, actionType: CombatActionType, cooldown: number): void {
    const unit = this.enhancedUnits.find(u => u.id === unitId);
    if (!unit) return;

    const newCooldowns = { ...unit.actionCooldowns, [actionType]: cooldown };
    this._updateEnhancedUnit(unitId, { actionCooldowns: newCooldowns });
  }

  private _updateEnhancedUnitHp(unitId: string, newHp: number): void {
    this._updateEnhancedUnit(unitId, { hp: newHp });
    
    // Also update basic battle state for compatibility
    if (this.currentBattle) {
      this.currentBattle = {
        ...this.currentBattle,
        units: this.currentBattle.units.map(u => 
          u.id === unitId ? { ...u, hp: newHp } : u
        ),
      };
    }
  }

  private _updateEnhancedUnit(unitId: string, updates: Partial<EnhancedUnit>): void {
    this.enhancedUnits = this.enhancedUnits.map(u => 
      u.id === unitId ? { ...u, ...updates } : u
    );
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('battle:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {}

  protected async onDestroy(): Promise<void> {
    this.currentBattle = null;
    this.battleRng = null;
    this.combatLog = [];
    this.enhancedUnits = [];
    this.log.info('battle:destroy', {});
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Log a combat action with automatic sequence number.
   */
  private logCombatAction(action: Omit<CombatAction, 'seq'>): void {
    this.combatLog.push({ ...action, seq: this.logSeq++ });
  }
}

