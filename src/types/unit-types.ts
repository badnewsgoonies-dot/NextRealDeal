/*
 * Unit System Types
 * Extracted from contracts.ts to reduce file size
 */

import type { Result } from '../util/Result.js';
import type { Position } from './contracts.js';

/**
 * Equipment slot types
 */
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

/**
 * Item that can be equipped
 */
export interface Equipment {
  readonly id: string;
  readonly name: string;
  readonly slot: EquipmentSlot;
  readonly atkBonus: number;
  readonly defBonus: number;
  readonly speedBonus: number;
}

/**
 * Unit with extended stats and equipment
 */
export interface GameUnit {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
  readonly level: number;
  readonly experience: number;
  readonly position?: Position;
  readonly equipment?: Partial<Record<EquipmentSlot, Equipment>>;
  readonly team: 'player' | 'enemy';
}

/**
 * Unit creation configuration
 */
export interface UnitCreateConfig {
  readonly id: string;
  readonly name: string;
  readonly level?: number;
  readonly team: 'player' | 'enemy';
  readonly baseStats?: Partial<{ atk: number; def: number; speed: number }>;
}

/**
 * Unit stats after equipment bonuses applied
 */
export interface EffectiveStats {
  readonly hp: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
}

/**
 * Character classes
 */
export type CharacterClass = 'warrior' | 'mage' | 'rogue' | 'paladin' | 'ranger';

/**
 * Skill effect types
 */
export type SkillEffectType = 'stat_bonus' | 'ability_unlock' | 'passive_effect';

/**
 * Skill effects
 */
export interface SkillEffect {
  readonly type: SkillEffectType;
  readonly stat?: 'atk' | 'def' | 'speed' | 'hp' | 'crit_chance' | 'dodge_chance' | 'mana';
  readonly value: number;
  readonly abilityId?: string;
  readonly description: string;
}

/**
 * Skill tree nodes
 */
export interface SkillNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly prerequisites: readonly string[];
  readonly effects: readonly SkillEffect[];
  readonly maxLevel: number;
  readonly currentLevel: number;
}

/**
 * Ability target types
 */
export type AbilityTarget = 'self' | 'enemy' | 'ally' | 'all_enemies' | 'all_allies';

/**
 * Ability effect types
 */
export type AbilityEffectType = 'damage' | 'heal' | 'buff' | 'debuff' | 'status_effect';

/**
 * Ability effects
 */
export interface AbilityEffect {
  readonly type: AbilityEffectType;
  readonly value: number;
  readonly target: AbilityTarget;
  readonly duration?: number;
  readonly statusEffect?: string; // StatusEffectType
}

/**
 * Character abilities
 */
export interface CharacterAbility {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: 'active' | 'passive';
  readonly cooldown: number;
  readonly cost: number;
  readonly effects: readonly AbilityEffect[];
  readonly unlockLevel: number;
}

/**
 * Character progression
 */
export interface CharacterProgression {
  readonly level: number;
  readonly experience: number;
  readonly experienceToNext: number;
  readonly skillPoints: number;
  readonly availableSkillPoints: number;
  readonly unlockedAbilities: readonly string[];
  readonly skillTree: readonly SkillNode[];
}

/**
 * Enhanced game unit
 */
export interface EnhancedGameUnit extends GameUnit {
  readonly characterClass: CharacterClass;
  readonly progression: CharacterProgression;
  readonly abilities: readonly CharacterAbility[];
  readonly mana: number;
  readonly maxMana: number;
}

/**
 * Experience gain result
 */
export interface ExperienceGain {
  readonly amount: number;
  readonly leveledUp: boolean;
  readonly newLevel: number;
  readonly skillPointsGained: number;
  readonly abilitiesUnlocked: readonly string[];
}

/**
 * Skill allocation result
 */
export interface SkillAllocation {
  readonly skillId: string;
  readonly newLevel: number;
  readonly effectsApplied: readonly SkillEffect[];
  readonly skillPointsRemaining: number;
}

/**
 * Character create config
 */
export interface CharacterCreateConfig extends UnitCreateConfig {
  readonly characterClass: CharacterClass;
}

/**
 * Equipment rarity
 */
export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Enhancement types
 */
export type EnhancementType = 'atk' | 'def' | 'speed' | 'hp' | 'mana';

/**
 * Equipment enhancement
 */
export interface EquipmentEnhancement {
  readonly level: number;
  readonly enhancementBonus: number;
  readonly enhancementType: EnhancementType;
}

/**
 * Enhanced equipment
 */
export interface EnhancedEquipment extends Equipment {
  readonly enhancement?: EquipmentEnhancement;
  readonly durability: number;
  readonly maxDurability: number;
  readonly rarity: EquipmentRarity;
}

/**
 * Basic unit for battle (minimal interface)
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
 * Unit System interface
 */
export interface IUnitSystem {
  // Unit management
  createUnit(config: UnitCreateConfig, signal?: AbortSignal): Promise<Result<GameUnit, string>>;
  getUnit(id: string): GameUnit | undefined;
  getAllUnits(): readonly GameUnit[];
  removeUnit(id: string, signal?: AbortSignal): Promise<Result<void, string>>;
  
  // Equipment
  equipItem(unitId: string, item: Equipment, signal?: AbortSignal): Promise<Result<GameUnit, string>>;
  unequipItem(unitId: string, slot: EquipmentSlot, signal?: AbortSignal): Promise<Result<GameUnit, string>>;
  
  // Stats
  getEffectiveStats(unitId: string): EffectiveStats | undefined;
  
  // Position
  setPosition(unitId: string, position: Position, signal?: AbortSignal): Promise<Result<GameUnit, string>>;
  getUnitsAt(position: Position): readonly GameUnit[];
  
  // Battle integration
  getTeamUnits(team: 'player' | 'enemy'): readonly Unit[];
}
