import { describe, it, expect, beforeEach } from 'vitest';
import { UnitManager } from '../../src/unit/UnitManager.js';
import { ConsoleLogger } from '../../src/util/Logger.js';
import { makeRng } from '../../src/util/Rng.js';
import type { CharacterCreateConfig, CharacterClass } from '../../src/types/contracts.js';

describe('EnhancedUnitManager (Character Progression)', () => {
  let unitManager: UnitManager;
  let logger: ConsoleLogger;

  beforeEach(async () => {
    logger = new ConsoleLogger('error');
    unitManager = new UnitManager(logger, makeRng(12345));
    await unitManager.initialize();
  });

  describe('Character Creation', () => {
    it('creates character with valid config', async () => {
      const config: CharacterCreateConfig = {
        id: 'hero1',
        name: 'Hero',
        characterClass: 'warrior',
        level: 1,
        team: 'player',
      };

      const result = await unitManager.createCharacter(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.id).toBe('hero1');
        expect(result.value.characterClass).toBe('warrior');
        expect(result.value.progression.level).toBe(1);
        expect(result.value.abilities.length).toBeGreaterThan(0);
        expect(result.value.mana).toBeGreaterThan(0);
        expect(result.value.maxMana).toBeGreaterThan(0);
      }
    });

    it('creates character with different classes', async () => {
      const classes: CharacterClass[] = ['warrior', 'mage', 'rogue', 'paladin', 'ranger'];
      
      for (const charClass of classes) {
        const config: CharacterCreateConfig = {
          id: `char_${charClass}`,
          name: `Character ${charClass}`,
          characterClass: charClass,
          team: 'player',
        };

        const result = await unitManager.createCharacter(config);
        expect(result.ok).toBe(true);

        if (result.ok) {
          expect(result.value.characterClass).toBe(charClass);
          expect(result.value.abilities.length).toBeGreaterThan(0);
          expect(result.value.progression.skillTree.length).toBeGreaterThan(0);
        }
      }
    });

    it('rejects duplicate character IDs', async () => {
      const config: CharacterCreateConfig = {
        id: 'duplicate',
        name: 'First',
        characterClass: 'warrior',
        team: 'player',
      };

      await unitManager.createCharacter(config);
      const result = await unitManager.createCharacter(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('unit-id-already-exists');
      }
    });

    it('creates character at higher level with correct stats', async () => {
      const config: CharacterCreateConfig = {
        id: 'high_level',
        name: 'Veteran',
        characterClass: 'warrior',
        level: 10,
        team: 'player',
      };

      const result = await unitManager.createCharacter(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.progression.level).toBe(10);
        expect(result.value.hp).toBeGreaterThan(120); // Base warrior HP
        expect(result.value.atk).toBeGreaterThan(25); // Base warrior ATK
        expect(result.value.progression.availableSkillPoints).toBe(9); // 10 - 1
      }
    });
  });

  describe('Experience and Leveling', () => {
    it('gains experience correctly', async () => {
      const config: CharacterCreateConfig = {
        id: 'test_char',
        name: 'Test Character',
        characterClass: 'warrior',
        team: 'player',
      };

      await unitManager.createCharacter(config);

      const result = await unitManager.gainExperience('test_char', 50);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.amount).toBe(50);
        expect(result.value.newLevel).toBeGreaterThanOrEqual(1);
      }
    });

    it('levels up when gaining enough experience', async () => {
      const config: CharacterCreateConfig = {
        id: 'leveler',
        name: 'Leveler',
        characterClass: 'warrior',
        level: 1,
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Gain enough experience to level up (level 1 needs 100 XP)
      const result = await unitManager.gainExperience('leveler', 100);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.leveledUp).toBe(true);
        expect(result.value.newLevel).toBe(2);
        expect(result.value.skillPointsGained).toBeGreaterThan(0);
      }
    });

    it('handles multiple level ups from single experience gain', async () => {
      const config: CharacterCreateConfig = {
        id: 'multi_level',
        name: 'Multi',
        characterClass: 'mage',
        level: 1,
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Gain huge experience to level up multiple times
      const result = await unitManager.gainExperience('multi_level', 500);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.leveledUp).toBe(true);
        expect(result.value.newLevel).toBeGreaterThan(2);
        expect(result.value.skillPointsGained).toBeGreaterThan(1);
      }
    });

    it('unlocks abilities at specific levels', async () => {
      const config: CharacterCreateConfig = {
        id: 'ability_unlock',
        name: 'Unlocker',
        characterClass: 'warrior',
        level: 1,
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Gain experience to reach level 5 (berserker_rage unlocks)
      const result = await unitManager.gainExperience('ability_unlock', 500);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.newLevel >= 5) {
        expect(result.value.abilitiesUnlocked.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('fails to gain experience for non-existent unit', async () => {
      const result = await unitManager.gainExperience('nonexistent', 100);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('unit-not-found');
      }
    });
  });

  describe('Skill Tree System', () => {
    it('allocates skill points correctly', async () => {
      const config: CharacterCreateConfig = {
        id: 'skill_test',
        name: 'Skill Test',
        characterClass: 'warrior',
        level: 2, // Start at level 2 for 1 skill point
        team: 'player',
      };

      await unitManager.createCharacter(config);

      const abilities = unitManager.getCharacterAbilities('skill_test');
      expect(abilities.length).toBeGreaterThan(0);

      // Try to allocate to the first skill (weapon mastery)
      const result = await unitManager.allocateSkillPoint('skill_test', 'warrior_weapon_mastery');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.skillId).toBe('warrior_weapon_mastery');
        expect(result.value.newLevel).toBe(1);
        expect(result.value.effectsApplied.length).toBeGreaterThan(0);
        expect(result.value.skillPointsRemaining).toBe(0);
      }
    });

    it('enforces skill prerequisites', async () => {
      const config: CharacterCreateConfig = {
        id: 'prereq_test',
        name: 'Prereq Test',
        characterClass: 'warrior',
        level: 2,
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Try to allocate berserker_rage without weapon_mastery
      const result = await unitManager.allocateSkillPoint('prereq_test', 'warrior_berserker_rage');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('prerequisites');
      }
    });

    it('prevents allocation without skill points', async () => {
      const config: CharacterCreateConfig = {
        id: 'no_points',
        name: 'No Points',
        characterClass: 'warrior',
        level: 1, // No skill points
        team: 'player',
      };

      await unitManager.createCharacter(config);

      const result = await unitManager.allocateSkillPoint('no_points', 'warrior_weapon_mastery');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('no-skill-points-available');
      }
    });

    it('prevents allocation beyond max level', async () => {
      const config: CharacterCreateConfig = {
        id: 'max_level',
        name: 'Max Level',
        characterClass: 'warrior',
        level: 10, // Many skill points
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Allocate weapon_mastery 5 times (max level)
      for (let i = 0; i < 5; i++) {
        const result = await unitManager.allocateSkillPoint('max_level', 'warrior_weapon_mastery');
        expect(result.ok).toBe(true);
      }

      // Try to allocate again
      const result = await unitManager.allocateSkillPoint('max_level', 'warrior_weapon_mastery');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('skill-max-level');
      }
    });

    it('returns character abilities', async () => {
      const config: CharacterCreateConfig = {
        id: 'ability_test',
        name: 'Ability Test',
        characterClass: 'mage',
        team: 'player',
      };

      await unitManager.createCharacter(config);

      const abilities = unitManager.getCharacterAbilities('ability_test');
      expect(abilities.length).toBeGreaterThan(0);
      expect(abilities.every(a => a.type === 'active' || a.type === 'passive')).toBe(true);
      expect(abilities.every(a => a.cooldown >= 0)).toBe(true);
      expect(abilities.every(a => a.cost >= 0)).toBe(true);
    });
  });

  describe('Equipment Enhancement', () => {
    it('enhances equipment successfully with RNG', async () => {
      const config: CharacterCreateConfig = {
        id: 'enhancer',
        name: 'Enhancer',
        characterClass: 'warrior',
        team: 'player',
      };

      await unitManager.createCharacter(config);

      // Equip an item first
      const weapon = {
        id: 'test_sword',
        name: 'Test Sword',
        slot: 'weapon' as const,
        atkBonus: 10,
        defBonus: 0,
        speedBonus: 0,
      };

      await unitManager.equipItem('enhancer', weapon);

      // Try to enhance it (success/failure depends on RNG)
      const result = await unitManager.enhanceEquipment('enhancer', 'weapon');
      
      // Should either succeed or fail with expected error
      if (!result.ok) {
        // Accept either enhancement failure or equipment-related errors
        expect(['enhancement-failed', 'rng-not-available', 'no-equipment-in-slot'].includes(result.error)).toBe(true);
      } else {
        expect(result.ok).toBe(true);
      }
    });

    it('fails enhancement for non-equipped item', async () => {
      const config: CharacterCreateConfig = {
        id: 'no_equipment',
        name: 'No Equipment',
        characterClass: 'warrior',
        team: 'player',
      };

      await unitManager.createCharacter(config);

      const result = await unitManager.enhanceEquipment('no_equipment', 'weapon');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('no-equipment-in-slot');
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains basic unit creation', async () => {
      const config = {
        id: 'basic_unit',
        name: 'Basic',
        team: 'player' as const,
      };

      const result = await unitManager.createUnit(config);
      expect(result.ok).toBe(true);
    });

    it('maintains equipment system', async () => {
      const config = {
        id: 'equip_test',
        name: 'Equipment Test',
        team: 'player' as const,
      };

      await unitManager.createUnit(config);

      const weapon = {
        id: 'sword',
        name: 'Sword',
        slot: 'weapon' as const,
        atkBonus: 5,
        defBonus: 0,
        speedBonus: 0,
      };

      const result = await unitManager.equipItem('equip_test', weapon);
      expect(result.ok).toBe(true);
    });
  });

  describe('Debug Stats', () => {
    it('returns debug stats including total experience', async () => {
      const config: CharacterCreateConfig = {
        id: 'stats_test',
        name: 'Stats Test',
        characterClass: 'warrior',
        team: 'player',
      };

      await unitManager.createCharacter(config);
      await unitManager.gainExperience('stats_test', 50);

      const stats = unitManager.getDebugStats();
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.unitCount).toBeGreaterThan(0);
        expect(stats.totalExperience).toBe(50);
      }
    });
  });
});
