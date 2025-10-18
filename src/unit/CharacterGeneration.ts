/*
 * CharacterGeneration: Character creation logic.
 */

import type { CharacterCreateConfig, EnhancedGameUnit, CharacterProgression } from '../types/contracts.js';
import { CLASS_BASE_STATS, CLASS_ABILITIES, calculateExperienceToNext } from './CharacterData.js';
import { CLASS_SKILL_TREES } from './SkillTrees.js';

/**
 * Generate a character from config
 */
export function generateCharacter(config: CharacterCreateConfig): EnhancedGameUnit {
  const level = config.level ?? 1;
  const characterClass = config.characterClass;
  
  // Get class-specific base stats
  const classStats = CLASS_BASE_STATS[characterClass];
  
  // Calculate level-scaled stats
  const baseHp = classStats.hp + (level - 1) * classStats.hpPerLevel;
  const baseAtk = classStats.atk + (level - 1) * classStats.atkPerLevel;
  const baseDef = classStats.def + (level - 1) * classStats.defPerLevel;
  const baseSpeed = classStats.speed + (level - 1) * classStats.speedPerLevel;
  const baseMana = classStats.mana + (level - 1) * classStats.manaPerLevel;

  // Calculate experience and skill points
  const experienceToNext = calculateExperienceToNext(level);
  const skillPoints = Math.max(0, level - 1);

  // Get starting abilities
  const startingAbilities = CLASS_ABILITIES[characterClass].filter(a => a.unlockLevel <= level);
  const skillTree = CLASS_SKILL_TREES[characterClass].map(node => ({ ...node, currentLevel: 0 }));

  const progression: CharacterProgression = {
    level,
    experience: 0,
    experienceToNext,
    skillPoints,
    availableSkillPoints: skillPoints,
    unlockedAbilities: startingAbilities.map(a => a.id),
    skillTree,
  };

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
    characterClass,
    progression,
    abilities: startingAbilities,
    mana: baseMana,
    maxMana: baseMana,
  };
}
