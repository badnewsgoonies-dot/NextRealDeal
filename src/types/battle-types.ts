/*
 * Battle System Types
 * Extracted from contracts.ts to reduce file size
 */

import type { Result } from '../util/Result.js';

/**
 * Basic combat unit
 */
export interface Unit {
  readonly id: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
}

/**
 * Result of a single combat action
 */
export interface CombatResult {
  readonly damage: number;
  readonly finalHp: number;
  readonly killed: boolean;
  readonly critical: boolean;
  readonly dodged: boolean;
}

/**
 * Current battle state
 */
export interface BattleState {
  readonly units: readonly Unit[];
  readonly turnOrder: readonly string[];
  readonly currentTurn: number;
  readonly isActive: boolean;
}

/**
 * Result of executing a full combat round
 */
export interface RoundResult {
  readonly actions: readonly CombatAction[];
  readonly unitsDefeated: readonly string[];
  readonly battleEnded: boolean;
  readonly winner?: 'player' | 'enemy' | 'draw';
}

/**
 * Individual combat action in the log
 */
export interface CombatAction {
  readonly type: 'attack' | 'dodge' | 'defeat' | 'defend';
  readonly actorId: string;
  readonly targetId?: string;
  readonly damage?: number;
  readonly critical?: boolean;
  readonly dodged?: boolean;
  readonly seq: number;
}

/**
 * Battle System interface
 */
export interface IBattleSystem {
  attack(attackerId: string, targetId: string, signal?: AbortSignal): Promise<Result<CombatResult, string>>;
  startBattle(units: Unit[], signal?: AbortSignal): Promise<Result<BattleState, string>>;
  executeRound(signal?: AbortSignal): Promise<Result<RoundResult, string>>;
  endBattle(): Promise<Result<void, string>>;
  getBattleState(): BattleState | null;
  getCombatLog(): readonly CombatAction[];
}

/**
 * Enhanced Battle System Types (Three-Action Combat)
 */

export type CombatActionType = 'attack' | 'defend' | 'signature_skill';

export interface ActionSelection {
  readonly actionType: CombatActionType;
  readonly actorId: string;
  readonly targetId?: string;
}

export interface ActionResult {
  readonly action: CombatActionType;
  readonly damage: number;
  readonly effects: readonly StatusEffect[];
  readonly critical: boolean;
  readonly dodged: boolean;
  readonly description: string;
}

export type StatusEffectType = 'weakened' | 'shielded' | 'poisoned' | 'blessed' | 'cursed';

export interface StatusEffect {
  readonly type: StatusEffectType;
  readonly duration: number;
  readonly intensity: number;
  readonly source: string;
}

export interface EnhancedUnit extends Unit {
  readonly statusEffects: readonly StatusEffect[];
  readonly actionCooldowns: Record<CombatActionType, number>;
}

export interface ActionValidation {
  readonly valid: boolean;
  readonly reason?: string;
  readonly cooldownRemaining?: number;
}
