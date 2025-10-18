/*
 * SkillTrees: Skill tree definitions for each character class.
 */

import type { CharacterClass, SkillNode } from '../types/contracts.js';

/**
 * Skill trees for each character class
 */
export const CLASS_SKILL_TREES: Record<CharacterClass, readonly SkillNode[]> = {
  warrior: [
    {
      id: 'warrior_weapon_mastery',
      name: 'Weapon Mastery',
      description: 'Increases attack damage',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'atk', value: 2, description: '+2 Attack per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'warrior_armor_mastery',
      name: 'Armor Mastery',
      description: 'Increases defense',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'def', value: 3, description: '+3 Defense per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'warrior_berserker_rage',
      name: 'Berserker Rage',
      description: 'Unlocks powerful rage ability',
      cost: 2,
      prerequisites: ['warrior_weapon_mastery'],
      effects: [{ type: 'ability_unlock', abilityId: 'berserker_rage', value: 0, description: 'Unlocks Berserker Rage' }],
      maxLevel: 1,
      currentLevel: 0,
    },
  ],
  mage: [
    {
      id: 'mage_mana_mastery',
      name: 'Mana Mastery',
      description: 'Increases maximum mana',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'mana', value: 10, description: '+10 Mana per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'mage_spell_power',
      name: 'Spell Power',
      description: 'Increases spell damage',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'atk', value: 3, description: '+3 Spell Power per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'mage_fireball',
      name: 'Fireball',
      description: 'Unlocks fireball spell',
      cost: 2,
      prerequisites: ['mage_spell_power'],
      effects: [{ type: 'ability_unlock', abilityId: 'fireball', value: 0, description: 'Unlocks Fireball' }],
      maxLevel: 1,
      currentLevel: 0,
    },
  ],
  rogue: [
    {
      id: 'rogue_stealth',
      name: 'Stealth',
      description: 'Increases dodge chance',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'dodge_chance', value: 5, description: '+5% Dodge per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'rogue_critical_strike',
      name: 'Critical Strike',
      description: 'Increases critical hit chance',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'crit_chance', value: 3, description: '+3% Crit per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'rogue_backstab',
      name: 'Backstab',
      description: 'Unlocks backstab ability',
      cost: 2,
      prerequisites: ['rogue_stealth'],
      effects: [{ type: 'ability_unlock', abilityId: 'backstab', value: 0, description: 'Unlocks Backstab' }],
      maxLevel: 1,
      currentLevel: 0,
    },
  ],
  paladin: [
    {
      id: 'paladin_holy_power',
      name: 'Holy Power',
      description: 'Increases attack and defense',
      cost: 1,
      prerequisites: [],
      effects: [
        { type: 'stat_bonus', stat: 'atk', value: 1, description: '+1 Attack per level' },
        { type: 'stat_bonus', stat: 'def', value: 2, description: '+2 Defense per level' },
      ],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'paladin_healing',
      name: 'Healing',
      description: 'Unlocks healing abilities',
      cost: 2,
      prerequisites: ['paladin_holy_power'],
      effects: [{ type: 'ability_unlock', abilityId: 'heal', value: 0, description: 'Unlocks Heal' }],
      maxLevel: 1,
      currentLevel: 0,
    },
  ],
  ranger: [
    {
      id: 'ranger_archery',
      name: 'Archery',
      description: 'Increases attack damage',
      cost: 1,
      prerequisites: [],
      effects: [{ type: 'stat_bonus', stat: 'atk', value: 2, description: '+2 Attack per level' }],
      maxLevel: 5,
      currentLevel: 0,
    },
    {
      id: 'ranger_multishot',
      name: 'Multishot',
      description: 'Unlocks multishot ability',
      cost: 2,
      prerequisites: ['ranger_archery'],
      effects: [{ type: 'ability_unlock', abilityId: 'multishot', value: 0, description: 'Unlocks Multishot' }],
      maxLevel: 1,
      currentLevel: 0,
    },
  ],
};
