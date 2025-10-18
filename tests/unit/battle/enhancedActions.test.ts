import { describe, it, expect, beforeEach } from 'vitest';
import { BattleManager } from '../../../src/battle/BattleManager.js';
import { ConsoleLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type { Unit, ActionSelection } from '../../../src/types/contracts.js';

describe('EnhancedBattleManager (Three-Action Combat)', () => {
  let battleManager: BattleManager;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger('error');
    battleManager = new BattleManager(logger, makeRng(12345));
  });

  describe('Action Validation', () => {
    it('validates action selection correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const validAction: ActionSelection = {
        actionType: 'attack',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      const validation = battleManager.validateAction(validAction);
      expect(validation.valid).toBe(true);
    });

    it('rejects action with invalid target', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const invalidAction: ActionSelection = {
        actionType: 'attack',
        actorId: 'player1',
        targetId: 'nonexistent',
      };

      const validation = battleManager.validateAction(invalidAction);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('target-not-found');
    });

    it('rejects action with dead unit', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 0, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'attack',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      const validation = battleManager.validateAction(action);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('unit-dead');
    });
  });

  describe('Attack Action', () => {
    it('executes attack action correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'attack',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      const result = await battleManager.selectAction(action);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.action).toBe('attack');
        expect(result.value.description).toContain('player1 attacks enemy1');
      }
    });

    it('applies attack cooldown correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'attack',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      await battleManager.selectAction(action);

      // Check cooldown was applied
      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      expect(player?.actionCooldowns.attack).toBe(1);
    });
  });

  describe('Defend Action', () => {
    it('executes defend action correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'defend',
        actorId: 'player1',
      };

      const result = await battleManager.selectAction(action);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.action).toBe('defend');
        expect(result.value.damage).toBe(0);
        expect(result.value.effects).toHaveLength(1);
        expect(result.value.effects[0].type).toBe('shielded');
      }
    });

    it('applies defend cooldown correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'defend',
        actorId: 'player1',
      };

      await battleManager.selectAction(action);

      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      expect(player?.actionCooldowns.defend).toBe(2);
    });
  });

  describe('Signature Skill Action', () => {
    it('executes signature skill action correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'signature_skill',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      const result = await battleManager.selectAction(action);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.action).toBe('signature_skill');
        expect(result.value.damage).toBeGreaterThan(0);
        expect(result.value.effects).toHaveLength(1);
        expect(result.value.effects[0].type).toBe('weakened');
      }
    });

    it('applies signature skill cooldown correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const action: ActionSelection = {
        actionType: 'signature_skill',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      await battleManager.selectAction(action);

      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      expect(player?.actionCooldowns.signature_skill).toBe(3);
    });
  });

  describe('Status Effects', () => {
    it('applies and tracks status effects correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const defendAction: ActionSelection = {
        actionType: 'defend',
        actorId: 'player1',
      };

      await battleManager.selectAction(defendAction);

      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      expect(player?.statusEffects).toHaveLength(1);
      expect(player?.statusEffects[0].type).toBe('shielded');
      expect(player?.statusEffects[0].duration).toBe(2);
    });

    it('processes status effect durations correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const defendAction: ActionSelection = {
        actionType: 'defend',
        actorId: 'player1',
      };

      await battleManager.selectAction(defendAction);

      // Execute a round to process status effects
      await battleManager.executeRound();

      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      
      // Duration should be reduced by 1
      expect(player?.statusEffects[0]?.duration).toBeLessThan(2);
    });
  });

  describe('Action Cooldowns', () => {
    it('enforces action cooldowns correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const signatureAction: ActionSelection = {
        actionType: 'signature_skill',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      await battleManager.selectAction(signatureAction);

      // Try to use it again immediately
      const validation = battleManager.validateAction(signatureAction);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('action-on-cooldown');
      expect(validation.cooldownRemaining).toBe(3);
    });

    it('processes cooldowns correctly', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const signatureAction: ActionSelection = {
        actionType: 'signature_skill',
        actorId: 'player1',
        targetId: 'enemy1',
      };

      await battleManager.selectAction(signatureAction);

      // Execute a round to process cooldowns
      await battleManager.executeRound();

      const enhancedUnits = battleManager.getEnhancedUnits();
      const player = enhancedUnits.find(u => u.id === 'player1');
      
      // Cooldown should be reduced by 1
      expect(player?.actionCooldowns.signature_skill).toBeLessThan(3);
    });
  });

  describe('Available Actions', () => {
    it('returns correct available actions for a unit', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const availableActions = battleManager.getAvailableActions('player1');
      expect(availableActions).toContain('attack');
      expect(availableActions).toContain('defend');
      expect(availableActions).toContain('signature_skill');
    });

    it('excludes actions on cooldown', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const defendAction: ActionSelection = {
        actionType: 'defend',
        actorId: 'player1',
      };

      await battleManager.selectAction(defendAction);

      const availableActions = battleManager.getAvailableActions('player1');
      expect(availableActions).not.toContain('defend');
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains compatibility with existing attack method', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const result = await battleManager.attack('player1', 'enemy1');
      expect(result.ok).toBe(true);
    });

    it('maintains compatibility with existing executeRound method', async () => {
      const units: Unit[] = [
        { id: 'player1', hp: 100, maxHp: 100, atk: 20, def: 10, speed: 15 },
        { id: 'enemy1', hp: 80, maxHp: 80, atk: 15, def: 8, speed: 12 },
      ];

      await battleManager.startBattle(units);

      const result = await battleManager.executeRound();
      expect(result.ok).toBe(true);
    });
  });
});
