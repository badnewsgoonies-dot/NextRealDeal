/*
 * BattleHelpers: Utility functions for battle management.
 * 
 * Handles:
 * - Initiative order calculation
 * - Target selection
 * - Victory condition checking
 */

import type { IRng } from '../util/Rng.js';
import { ok, err, type Result } from '../util/Result.js';
import type { Unit, CombatResult, BattleState } from '../types/contracts.js';

/**
 * Determine initiative order using stable sort.
 * Sort by speed DESC, then input index ASC (deterministic).
 */
export function determineInitiativeOrder(units: readonly Unit[]): string[] {
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
export function selectTarget(attackerId: string, units: readonly Unit[]): string | null {
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
export function checkVictory(units: readonly Unit[]): 'player' | 'enemy' | 'draw' | null {
  const mid = Math.floor(units.length / 2);
  
  const alivePlayers = units.slice(0, mid).filter(u => u.hp > 0);
  const aliveEnemies = units.slice(mid).filter(u => u.hp > 0);
  
  if (aliveEnemies.length === 0 && alivePlayers.length === 0) return 'draw';
  if (aliveEnemies.length === 0) return 'player';
  if (alivePlayers.length === 0) return 'enemy';
  return null;
}

/**
 * Validate attack preconditions.
 */
export function validateAttack(
  attackerId: string,
  targetId: string,
  battleState: BattleState | null,
  battleRng: IRng | null
): Result<{ attacker: Unit; target: Unit }, string> {
  if (!battleState || !battleState.isActive) {
    return err('no-active-battle');
  }
  if (!battleRng) {
    return err('battle-rng-not-initialized');
  }

  const units = battleState.units;
  const attacker = units.find(u => u.id === attackerId);
  const target = units.find(u => u.id === targetId);
  
  if (!attacker) return err('attacker-not-found');
  if (!target) return err('target-not-found');
  if (attacker.hp <= 0) return err('attacker-dead');
  if (target.hp <= 0) return err('target-dead');

  return ok({ attacker, target });
}

/**
 * Calculate damage with variance and critical hit.
 */
export function calculateDamage(
  attacker: Unit,
  target: Unit,
  rng: IRng
): { damage: number; critical: boolean } {
  // Base damage = atk - ⌊def/2⌋
  let damage = attacker.atk - Math.floor(target.def / 2);
  
  // Add variance: base + rng.int(-2, 2)
  damage += rng.int(-2, 2);
  
  // Check critical (10%)
  const critical = rng.int(1, 100) <= 10;
  if (critical) {
    damage = Math.floor(damage * 1.5);
  }
  
  // Clamp to non-negative
  damage = Math.max(0, damage);

  return { damage, critical };
}

/**
 * Apply damage and create combat result
 */
export function applyDamageResult(
  attackerId: string,
  targetId: string,
  currentHp: number,
  damageResult: { damage: number; critical: boolean }
): {
  combatResult: CombatResult;
  newHp: number;
  killed: boolean;
  logActions: Array<{ type: string; actorId: string; targetId?: string; damage?: number; critical?: boolean; dodged?: boolean }>;
} {
  const { damage, critical } = damageResult;
  const finalHp = Math.max(0, currentHp - damage);
  const killed = finalHp === 0 && currentHp > 0;

  const logActions = [
    {
      type: 'attack',
      actorId: attackerId,
      targetId,
      damage,
      critical,
      dodged: false,
    },
  ];

  if (killed) {
    logActions.push({ type: 'defeat', actorId: targetId });
  }

  return {
    combatResult: { damage, finalHp, killed, critical, dodged: false },
    newHp: finalHp,
    killed,
    logActions,
  };
}
