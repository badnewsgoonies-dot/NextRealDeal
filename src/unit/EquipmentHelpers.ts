/*
 * EquipmentHelpers: Helper functions for equipment enhancement.
 */

import type { IRng } from '../util/Rng.js';
import { ok, err, type Result } from '../util/Result.js';
import type {
  EnhancedEquipment,
  EquipmentSlot,
  Equipment,
  EnhancementType,
} from '../types/contracts.js';

/**
 * Calculate enhancement success rate
 */
export function calculateEnhancementSuccessRate(currentLevel: number): number {
  return Math.max(0.1, 1.0 - (currentLevel * 0.1));
}

/**
 * Calculate enhancement bonus
 */
export function calculateEnhancementBonus(level: number): number {
  return level * 2;
}

/**
 * Get enhancement type for equipment slot
 */
export function getEnhancementType(slot: EquipmentSlot): EnhancementType {
  switch (slot) {
    case 'weapon': return 'atk';
    case 'armor': return 'def';
    case 'accessory': return 'speed';
    default: return 'atk';
  }
}

/**
 * Perform equipment enhancement
 */
export function enhanceEquipmentItem(
  equipment: Equipment,
  slot: EquipmentSlot,
  rng: IRng
): Result<EnhancedEquipment, 'enhancement-failed'> {
  const enhancedEquipment = equipment as EnhancedEquipment;
  const currentLevel = enhancedEquipment.enhancement?.level ?? 0;
  
  if (currentLevel >= 10) {
    return err('enhancement-failed');
  }

  const successRate = calculateEnhancementSuccessRate(currentLevel);
  const success = rng.float() < successRate;
  
  if (success) {
    const newLevel = currentLevel + 1;
    const enhancementBonus = calculateEnhancementBonus(newLevel);
    const enhancementType = getEnhancementType(slot);

    return ok({
      ...enhancedEquipment,
      enhancement: { level: newLevel, enhancementBonus, enhancementType },
      durability: Math.max(enhancedEquipment.durability ?? 100, 50),
      maxDurability: enhancedEquipment.maxDurability ?? 100,
      rarity: enhancedEquipment.rarity ?? 'common',
    });
  } else {
    return err('enhancement-failed');
  }
}

/**
 * Apply durability damage to failed enhancement
 */
export function applyEnhancementFailure(equipment: Equipment): EnhancedEquipment {
  const enhancedEquipment = equipment as EnhancedEquipment;
  return {
    ...enhancedEquipment,
    durability: Math.max((enhancedEquipment.durability ?? 100) - 10, 0),
    maxDurability: enhancedEquipment.maxDurability ?? 100,
    rarity: enhancedEquipment.rarity ?? 'common',
  };
}
