/*
 * CharacterData: Class definitions, base stats, and ability configurations.
 */

import type { CharacterClass, CharacterAbility } from '../types/contracts.js';

export interface ClassBaseStats {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly speed: number;
  readonly mana: number;
  readonly hpPerLevel: number;
  readonly atkPerLevel: number;
  readonly defPerLevel: number;
  readonly speedPerLevel: number;
  readonly manaPerLevel: number;
}

/**
 * Base stats for each character class
 */
export const CLASS_BASE_STATS: Record<CharacterClass, ClassBaseStats> = {
  warrior: {
    hp: 120,
    atk: 25,
    def: 15,
    speed: 45,
    mana: 50,
    hpPerLevel: 15,
    atkPerLevel: 3,
    defPerLevel: 2,
    speedPerLevel: 1,
    manaPerLevel: 5,
  },
  mage: {
    hp: 80,
    atk: 20,
    def: 8,
    speed: 55,
    mana: 100,
    hpPerLevel: 8,
    atkPerLevel: 4,
    defPerLevel: 1,
    speedPerLevel: 2,
    manaPerLevel: 15,
  },
  rogue: {
    hp: 90,
    atk: 22,
    def: 10,
    speed: 65,
    mana: 60,
    hpPerLevel: 10,
    atkPerLevel: 3,
    defPerLevel: 1,
    speedPerLevel: 3,
    manaPerLevel: 8,
  },
  paladin: {
    hp: 110,
    atk: 23,
    def: 18,
    speed: 40,
    mana: 70,
    hpPerLevel: 12,
    atkPerLevel: 2,
    defPerLevel: 3,
    speedPerLevel: 1,
    manaPerLevel: 10,
  },
  ranger: {
    hp: 95,
    atk: 24,
    def: 12,
    speed: 60,
    mana: 65,
    hpPerLevel: 11,
    atkPerLevel: 3,
    defPerLevel: 1,
    speedPerLevel: 2,
    manaPerLevel: 9,
  },
};

/**
 * Abilities for each character class
 */
export const CLASS_ABILITIES: Record<CharacterClass, readonly CharacterAbility[]> = {
  warrior: [
    {
      id: 'power_strike',
      name: 'Power Strike',
      description: 'Deal increased damage to a single enemy',
      type: 'active',
      cooldown: 2,
      cost: 20,
      effects: [{ type: 'damage', value: 150, target: 'enemy' }],
      unlockLevel: 1,
    },
    {
      id: 'berserker_rage',
      name: 'Berserker Rage',
      description: 'Enter rage mode for increased attack',
      type: 'active',
      cooldown: 5,
      cost: 30,
      effects: [{ type: 'buff', value: 50, target: 'self', duration: 3 }],
      unlockLevel: 5,
    },
  ],
  mage: [
    {
      id: 'magic_missile',
      name: 'Magic Missile',
      description: 'Fire magical projectiles at an enemy',
      type: 'active',
      cooldown: 1,
      cost: 25,
      effects: [{ type: 'damage', value: 120, target: 'enemy' }],
      unlockLevel: 1,
    },
    {
      id: 'fireball',
      name: 'Fireball',
      description: 'Unleash a devastating fireball',
      type: 'active',
      cooldown: 4,
      cost: 50,
      effects: [{ type: 'damage', value: 200, target: 'enemy' }],
      unlockLevel: 5,
    },
  ],
  rogue: [
    {
      id: 'quick_strike',
      name: 'Quick Strike',
      description: 'Strike quickly with increased speed',
      type: 'active',
      cooldown: 1,
      cost: 15,
      effects: [{ type: 'damage', value: 100, target: 'enemy' }],
      unlockLevel: 1,
    },
    {
      id: 'backstab',
      name: 'Backstab',
      description: 'Deal massive damage from behind',
      type: 'active',
      cooldown: 3,
      cost: 35,
      effects: [{ type: 'damage', value: 250, target: 'enemy' }],
      unlockLevel: 5,
    },
  ],
  paladin: [
    {
      id: 'holy_smite',
      name: 'Holy Smite',
      description: 'Strike with holy power',
      type: 'active',
      cooldown: 2,
      cost: 25,
      effects: [{ type: 'damage', value: 130, target: 'enemy' }],
      unlockLevel: 1,
    },
    {
      id: 'heal',
      name: 'Heal',
      description: 'Restore health to self or ally',
      type: 'active',
      cooldown: 4,
      cost: 40,
      effects: [{ type: 'heal', value: 100, target: 'ally' }],
      unlockLevel: 5,
    },
  ],
  ranger: [
    {
      id: 'aimed_shot',
      name: 'Aimed Shot',
      description: 'Precisely aim and fire',
      type: 'active',
      cooldown: 2,
      cost: 20,
      effects: [{ type: 'damage', value: 140, target: 'enemy' }],
      unlockLevel: 1,
    },
    {
      id: 'multishot',
      name: 'Multishot',
      description: 'Fire at all enemies',
      type: 'active',
      cooldown: 5,
      cost: 45,
      effects: [{ type: 'damage', value: 100, target: 'all_enemies' }],
      unlockLevel: 5,
    },
  ],
};

/**
 * Calculate experience required for next level
 */
export function calculateExperienceToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

/**
 * Calculate skill points gained per level
 */
export function getSkillPointsPerLevel(level: number): number {
  return level % 5 === 0 ? 2 : 1; // Extra skill point every 5 levels
}
