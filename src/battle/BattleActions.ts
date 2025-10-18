/*
 * BattleActions: Enhanced action system for three-action combat.
 * 
 * Handles:
 * - Action validation
 * - Action execution (attack, defend, signature_skill)
 * - Status effects (weakened, shielded, blessed, cursed, poisoned)
 * - Action cooldowns
 * - Damage calculation with status modifiers
 */

import type { IRng } from '../util/Rng.js';
import { ok, err, type Result } from '../util/Result.js';
import type {
  ActionSelection,
  ActionResult,
  StatusEffect,
  EnhancedUnit,
  ActionValidation,
  CombatActionType,
  BattleState,
} from '../types/contracts.js';

/**
 * Validate an action selection
 */
export function validateAction(
  selection: ActionSelection,
  battleState: BattleState | null,
  enhancedUnits: EnhancedUnit[]
): ActionValidation {
  if (!battleState || !battleState.isActive) {
    return { valid: false, reason: 'no-active-battle' };
  }

  const unit = enhancedUnits.find(u => u.id === selection.actorId);
  if (!unit) {
    return { valid: false, reason: 'unit-not-found' };
  }

  if (unit.hp <= 0) {
    return { valid: false, reason: 'unit-dead' };
  }

  const cooldown = unit.actionCooldowns[selection.actionType];
  if (cooldown > 0) {
    return { 
      valid: false, 
      reason: 'action-on-cooldown',
      cooldownRemaining: cooldown 
    };
  }

  if (selection.actionType === 'attack' || selection.actionType === 'signature_skill') {
    if (!selection.targetId) {
      return { valid: false, reason: 'target-required' };
    }

    const target = enhancedUnits.find(u => u.id === selection.targetId);
    if (!target) {
      return { valid: false, reason: 'target-not-found' };
    }

    if (target.hp <= 0) {
      return { valid: false, reason: 'target-dead' };
    }
  }

  return { valid: true };
}

/**
 * Get available actions for a unit
 */
export function getAvailableActions(
  unitId: string,
  battleState: BattleState | null,
  enhancedUnits: EnhancedUnit[]
): readonly CombatActionType[] {
  if (!battleState || !battleState.isActive) {
    return [];
  }

  const unit = enhancedUnits.find(u => u.id === unitId);
  if (!unit || unit.hp <= 0) {
    return [];
  }

  const actions: CombatActionType[] = [];
  
  if (unit.actionCooldowns.attack === 0) {
    actions.push('attack');
  }
  
  if (unit.actionCooldowns.defend === 0) {
    actions.push('defend');
  }
  
  if (unit.actionCooldowns.signature_skill === 0) {
    actions.push('signature_skill');
  }

  return actions;
}

/**
 * Execute selected action with validation
 */
export function executeSelectedAction(
  selection: ActionSelection,
  enhancedUnits: EnhancedUnit[],
  battleState: BattleState | null,
  battleRng: IRng,
  logFn: (action: { type: string; actorId: string; targetId?: string; damage?: number; critical?: boolean; dodged?: boolean }) => void,
  updateHpFn: (unitId: string, hp: number) => void,
  applyEffectFn: (unitId: string, effect: StatusEffect) => void,
  applyCooldownFn: (unitId: string, actionType: CombatActionType, cooldown: number) => void
): Result<ActionResult, string> {
  const validation = validateAction(selection, battleState, enhancedUnits);
  if (!validation.valid) {
    return err(validation.reason || 'invalid-action');
  }

  const unit = enhancedUnits.find(u => u.id === selection.actorId);
  if (!unit) return err('unit-not-found');

  switch (selection.actionType) {
    case 'attack':
      return executeAttack(
        selection,
        unit,
        enhancedUnits,
        battleRng,
        logFn,
        updateHpFn,
        applyCooldownFn
      );
    case 'defend':
      return executeDefend(
        selection,
        unit,
        logFn,
        applyEffectFn,
        applyCooldownFn
      );
    case 'signature_skill':
      return executeSignatureSkill(
        selection,
        unit,
        enhancedUnits,
        battleRng,
        logFn,
        updateHpFn,
        applyEffectFn,
        applyCooldownFn
      );
    default:
      return err('unknown-action-type');
  }
}

/**
 * Execute an attack action
 */
export function executeAttack(
  selection: ActionSelection,
  unit: EnhancedUnit,
  enhancedUnits: EnhancedUnit[],
  rng: IRng,
  logFn: (action: { type: string; actorId: string; targetId?: string; damage?: number; critical?: boolean; dodged?: boolean }) => void,
  updateHpFn: (unitId: string, hp: number) => void,
  applyCooldownFn: (unitId: string, actionType: CombatActionType, cooldown: number) => void
): Result<ActionResult, string> {
  if (!selection.targetId) return err('target-required');

  const target = enhancedUnits.find(u => u.id === selection.targetId);
  if (!target) return err('target-not-found');

  // Check dodge (5%)
  const dodged = rng.int(1, 100) <= 5;
  if (dodged) {
    logFn({
      type: 'attack',
      actorId: selection.actorId,
      targetId: selection.targetId,
      dodged: true,
      damage: 0,
    });
    return ok({
      action: 'attack',
      damage: 0,
      effects: [],
      critical: false,
      dodged: true,
      description: `${unit.id} attacks ${target.id} but it's dodged!`,
    });
  }

  // Calculate damage with status effect modifiers
  const damageResult = calculateEnhancedDamage(unit, target, rng);
  const finalHp = Math.max(0, target.hp - damageResult.damage);
  const killed = finalHp === 0 && target.hp > 0;

  // Update unit HP
  updateHpFn(selection.targetId, finalHp);

  // Apply cooldown (1 turn)
  applyCooldownFn(selection.actorId, 'attack', 1);

  logFn({
    type: 'attack',
    actorId: selection.actorId,
    targetId: selection.targetId,
    damage: damageResult.damage,
    critical: damageResult.critical,
    dodged: false,
  });

  if (killed) {
    logFn({ type: 'defeat', actorId: selection.targetId });
  }

  return ok({
    action: 'attack',
    damage: damageResult.damage,
    effects: [],
    critical: damageResult.critical,
    dodged: false,
    description: `${unit.id} attacks ${target.id} for ${damageResult.damage} damage${damageResult.critical ? ' (CRITICAL!)' : ''}`,
  });
}

/**
 * Execute a defend action
 */
export function executeDefend(
  selection: ActionSelection,
  unit: EnhancedUnit,
  logFn: (action: { type: string; actorId: string; targetId?: string; damage?: number; critical?: boolean; dodged?: boolean }) => void,
  applyEffectFn: (unitId: string, effect: StatusEffect) => void,
  applyCooldownFn: (unitId: string, actionType: CombatActionType, cooldown: number) => void
): Result<ActionResult, string> {
  // Defend reduces incoming damage by 50% and grants temporary defense
  const defenseBonus = Math.floor(unit.def * 0.5);
  const duration = 2; // 2 turns
  
  // Apply shielded status effect
  const statusEffect: StatusEffect = {
    type: 'shielded',
    duration,
    intensity: defenseBonus,
    source: 'defend_action',
  };

  applyEffectFn(selection.actorId, statusEffect);

  // Apply cooldown (2 turns)
  applyCooldownFn(selection.actorId, 'defend', 2);

  logFn({
    type: 'defend',
    actorId: selection.actorId,
  });

  return ok({
    action: 'defend',
    damage: 0,
    effects: [statusEffect],
    critical: false,
    dodged: false,
    description: `${unit.id} defends, gaining ${defenseBonus} defense for ${duration} turns`,
  });
}

/**
 * Execute a signature skill action
 */
export function executeSignatureSkill(
  selection: ActionSelection,
  unit: EnhancedUnit,
  enhancedUnits: EnhancedUnit[],
  rng: IRng,
  logFn: (action: { type: string; actorId: string; targetId?: string; damage?: number; critical?: boolean; dodged?: boolean }) => void,
  updateHpFn: (unitId: string, hp: number) => void,
  applyEffectFn: (unitId: string, effect: StatusEffect) => void,
  applyCooldownFn: (unitId: string, actionType: CombatActionType, cooldown: number) => void
): Result<ActionResult, string> {
  if (!selection.targetId) return err('target-required');

  const target = enhancedUnits.find(u => u.id === selection.targetId);
  if (!target) return err('target-not-found');

  // Signature skill: 150% damage, 20% crit chance, applies weakened status
  const baseDamage = Math.floor(unit.atk * 1.5);
  const critical = rng.int(1, 100) <= 20;
  const damage = critical ? Math.floor(baseDamage * 1.5) : baseDamage;
  
  const finalHp = Math.max(0, target.hp - damage);
  const killed = finalHp === 0 && target.hp > 0;

  // Update unit HP
  updateHpFn(selection.targetId, finalHp);

  // Apply weakened status to target
  const weakenedEffect: StatusEffect = {
    type: 'weakened',
    duration: 3,
    intensity: 25, // 25% attack reduction
    source: 'signature_skill',
  };
  applyEffectFn(selection.targetId, weakenedEffect);

  // Apply cooldown (3 turns)
  applyCooldownFn(selection.actorId, 'signature_skill', 3);

  logFn({
    type: 'attack',
    actorId: selection.actorId,
    targetId: selection.targetId,
    damage,
    critical,
    dodged: false,
  });

  if (killed) {
    logFn({ type: 'defeat', actorId: selection.targetId });
  }

  return ok({
    action: 'signature_skill',
    damage,
    effects: [weakenedEffect],
    critical,
    dodged: false,
    description: `${unit.id} uses signature skill on ${target.id} for ${damage} damage${critical ? ' (CRITICAL!)' : ''} and weakens them!`,
  });
}

/**
 * Calculate damage with status effect modifiers
 */
export function calculateEnhancedDamage(
  attacker: EnhancedUnit,
  target: EnhancedUnit,
  rng: IRng
): { damage: number; critical: boolean } {
  // Apply status effects to damage calculation
  const attackModifier = getAttackModifier(attacker);
  const defenseModifier = getDefenseModifier(target);

  let damage = Math.floor(attacker.atk * attackModifier) - Math.floor((target.def / 2) * defenseModifier);
  damage += rng.int(-2, 2);
  
  const critical = rng.int(1, 100) <= 10;
  if (critical) {
    damage = Math.floor(damage * 1.5);
  }
  
  return { damage: Math.max(0, damage), critical };
}

/**
 * Get attack modifier from status effects
 */
export function getAttackModifier(unit: EnhancedUnit): number {
  let modifier = 1.0;
  
  for (const effect of unit.statusEffects) {
    switch (effect.type) {
      case 'weakened':
        modifier *= (1 - effect.intensity / 100);
        break;
      case 'blessed':
        modifier *= 1.25;
        break;
      case 'cursed':
        modifier *= 0.75;
        break;
    }
  }
  
  return modifier;
}

/**
 * Get defense modifier from status effects
 */
export function getDefenseModifier(unit: EnhancedUnit): number {
  let modifier = 1.0;
  
  for (const effect of unit.statusEffects) {
    switch (effect.type) {
      case 'shielded':
        modifier *= 0.5;
        break;
      case 'blessed':
        modifier *= 1.25;
        break;
      case 'cursed':
        modifier *= 0.75;
        break;
    }
  }
  
  return modifier;
}

/**
 * Process status effect durations
 */
export function processStatusEffects(enhancedUnits: EnhancedUnit[]): EnhancedUnit[] {
  return enhancedUnits.map(unit => {
    const newEffects = unit.statusEffects
      .map(effect => ({ ...effect, duration: effect.duration - 1 }))
      .filter(effect => effect.duration > 0);

    return { ...unit, statusEffects: newEffects };
  });
}

/**
 * Process action cooldowns
 */
export function processCooldowns(enhancedUnits: EnhancedUnit[]): EnhancedUnit[] {
  return enhancedUnits.map(unit => {
    const newCooldowns = Object.fromEntries(
      Object.entries(unit.actionCooldowns).map(([action, cooldown]) => [
        action,
        Math.max(0, cooldown - 1)
      ])
    ) as Record<CombatActionType, number>;

    return { ...unit, actionCooldowns: newCooldowns };
  });
}
