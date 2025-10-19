/*
 * ProgressionHelpers: Helper functions for character progression.
 */

import { ok, err, type Result } from '../util/Result.js';
import type {
  EnhancedGameUnit,
  SkillNode,
  SkillAllocation,
} from '../types/contracts.js';
import { CLASS_ABILITIES } from './CharacterData.js';

/**
 * Validate skill allocation
 */
export function validateSkillAllocation(
  unit: EnhancedGameUnit,
  skillId: string
): Result<SkillNode, string> {
  if (unit.progression.availableSkillPoints <= 0) {
    return err('no-skill-points-available');
  }

  const skillTree = unit.progression.skillTree;
  const skill = skillTree.find(s => s.id === skillId);
  if (!skill) {
    return err('skill-not-found');
  }

  if (skill.currentLevel >= skill.maxLevel) {
    return err('skill-max-level');
  }

  // Check prerequisites
  for (const prereqId of skill.prerequisites) {
    const prereq = skillTree.find(s => s.id === prereqId);
    if (!prereq || prereq.currentLevel === 0) {
      return err('prerequisites-not-met');
    }
  }

  // Check cost
  if (skill.cost > unit.progression.availableSkillPoints) {
    return err('insufficient-skill-points');
  }

  return ok(skill);
}

/**
 * Apply skill allocation
 */
export function applySkillAllocation(
  unit: EnhancedGameUnit,
  skillId: string,
  skill: SkillNode
): { updatedUnit: EnhancedGameUnit; allocation: SkillAllocation } {
  const newLevel = skill.currentLevel + 1;
  const newSkillPoints = unit.progression.availableSkillPoints - skill.cost;

  // Update skill tree
  const updatedSkillTree = unit.progression.skillTree.map(s => 
    s.id === skillId ? { ...s, currentLevel: newLevel } : s
  );

  const effectsApplied = skill.effects;

  // Update unit
  const updatedUnit: EnhancedGameUnit = {
    ...unit,
    progression: {
      ...unit.progression,
      availableSkillPoints: newSkillPoints,
      skillTree: updatedSkillTree,
    },
  };

  const allocation: SkillAllocation = {
    skillId,
    newLevel,
    effectsApplied,
    skillPointsRemaining: newSkillPoints,
  };

  return { updatedUnit, allocation };
}

/**
 * Calculate experience gain and level ups
 */
export function calculateLevelUps(
  unit: EnhancedGameUnit,
  experienceGain: number,
  calculateExpToNext: (level: number) => number,
  getSkillPoints: (level: number) => number
): {
  newExperience: number;
  newLevel: number;
  skillPointsGained: number;
  abilitiesUnlocked: string[];
} {
  const startLevel = unit.level;
  const totalExperience = unit.experience + experienceGain;
  let currentLevel = startLevel;
  let totalSkillPoints = 0;
  const newAbilities: string[] = [];

  // Check for level ups
  while (currentLevel < 100 && totalExperience >= calculateExpToNext(currentLevel)) {
    currentLevel++;
    totalSkillPoints += getSkillPoints(currentLevel);
    
    // Check for new abilities
    const levelAbilities = CLASS_ABILITIES[unit.characterClass]
      .filter(ability => ability.unlockLevel === currentLevel && !unit.progression.unlockedAbilities.includes(ability.id));
    newAbilities.push(...levelAbilities.map(a => a.id));
  }

  return {
    newExperience: totalExperience,
    newLevel: currentLevel,
    skillPointsGained: totalSkillPoints,
    abilitiesUnlocked: newAbilities,
  };
}

/**
 * Apply experience gain to unit
 */
export function applyExperienceGain(
  unit: EnhancedGameUnit,
  experienceAmount: number,
  newLevel: number,
  newExperience: number,
  skillPointsGained: number,
  abilitiesUnlocked: string[],
  experienceToNext: number
): EnhancedGameUnit {
  return {
    ...unit,
    level: newLevel,
    experience: newExperience,
    progression: {
      ...unit.progression,
      level: newLevel,
      experience: newExperience,
      experienceToNext,
      skillPoints: unit.progression.skillPoints + skillPointsGained,
      availableSkillPoints: unit.progression.availableSkillPoints + skillPointsGained,
      unlockedAbilities: [...unit.progression.unlockedAbilities, ...abilitiesUnlocked],
    },
    abilities: [...unit.abilities, ...CLASS_ABILITIES[unit.characterClass]
      .filter(ability => abilitiesUnlocked.includes(ability.id))],
  };
}
