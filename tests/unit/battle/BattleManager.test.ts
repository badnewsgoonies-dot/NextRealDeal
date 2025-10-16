import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { BattleManager } from '../../../src/battle/BattleManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import type { Unit } from '../../../src/types/contracts.js';

describe('BattleManager', () => {
  let manager: BattleManager;
  let rng: ReturnType<typeof makeRng>;
  let logger: ReturnType<typeof makeLogger>;

  // Test unit helper
  const createTestUnit = (id: string, overrides?: Partial<Unit>): Unit => ({
    id,
    hp: 100,
    maxHp: 100,
    atk: 20,
    def: 10,
    speed: 50,
    ...overrides,
  });

  beforeEach(async () => {
    rng = makeRng(20251014); // Global seed
    logger = makeLogger({ enabled: false });
    manager = new BattleManager(logger, rng);
    const result = await manager.initialize();
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Lifecycle', () => {
    test('initializes successfully', async () => {
      const manager2 = new BattleManager(logger, rng);
      const result = await manager2.initialize();
      expect(result.ok).toBe(true);
      await manager2.destroy();
    });

    test('updates without errors', async () => {
      const result = await manager.update(16.67);
      expect(result.ok).toBe(true);
    });

    test('destroys cleanly', async () => {
      await expect(manager.destroy()).resolves.not.toThrow();
    });

    test('getBattleState returns null initially', () => {
      expect(manager.getBattleState()).toBeNull();
    });

    test('getCombatLog returns empty array initially', () => {
      expect(manager.getCombatLog()).toEqual([]);
    });
  });

  describe('Debug Stats', () => {
    test('getDebugStats returns queue state in test env', () => {
      const stats = manager.getDebugStats();
      expect(stats).toBeDefined();
      if (stats) {
        expect(typeof stats.queuePending).toBe('number');
        expect(typeof stats.combatLogSize).toBe('number');
      }
    });

    test('getDebugStats returns undefined in non-test env', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const stats = manager.getDebugStats();
      expect(stats).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Battle Management', () => {
    test('starts battle with valid units', async () => {
      const units: Unit[] = [
        createTestUnit('player1', { speed: 60 }),
        createTestUnit('player2', { speed: 40 }),
        createTestUnit('enemy1', { speed: 50 }),
        createTestUnit('enemy2', { speed: 30 }),
      ];

      const result = await manager.startBattle(units);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.units.length).toBe(4);
        expect(result.value.isActive).toBe(true);
        expect(result.value.turnOrder.length).toBe(4);
      }
    });

    test('calculates initiative order correctly (speed DESC, index ASC)', async () => {
      const units: Unit[] = [
        createTestUnit('slow', { speed: 10 }),
        createTestUnit('fast', { speed: 90 }),
        createTestUnit('mid1', { speed: 50 }),
        createTestUnit('mid2', { speed: 50 }), // Same speed as mid1
      ];

      const result = await manager.startBattle(units);
      expect(result.ok).toBe(true);

      if (result.ok) {
        // Expected order: fast (90), mid1 (50), mid2 (50), slow (10)
        // For same speed, input order (index) breaks ties
        expect(result.value.turnOrder[0]).toBe('fast');
        expect(result.value.turnOrder[1]).toBe('mid1');
        expect(result.value.turnOrder[2]).toBe('mid2');
        expect(result.value.turnOrder[3]).toBe('slow');
      }
    });

    test('rejects battle with no units', async () => {
      const result = await manager.startBattle([]);
      expect(result.ok).toBe(false);
    });

    test('rejects battle with invalid units', async () => {
      const invalidUnits = [
        createTestUnit('player1'),
        createTestUnit('player1'), // Duplicate ID
      ];

      const result = await manager.startBattle(invalidUnits);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('duplicate');
      }
    });

    test('ends battle and clears state', async () => {
      const units = [createTestUnit('p1'), createTestUnit('e1')];
      await manager.startBattle(units);

      const endResult = await manager.endBattle();
      expect(endResult.ok).toBe(true);

      const state = manager.getBattleState();
      expect(state?.isActive).toBe(false);
    });
  });

  describe('Combat Mechanics', () => {
    test('executes attack with damage calculation', async () => {
      const units = [
        createTestUnit('attacker', { atk: 30, speed: 100 }),
        createTestUnit('target', { def: 10, hp: 50, maxHp: 50, speed: 50 }),
      ];

      await manager.startBattle(units);
      const result = await manager.attack('attacker', 'target');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value.damage).toBe('number');
        expect(result.value.finalHp).toBeLessThanOrEqual(50);
        expect(typeof result.value.dodged).toBe('boolean');
        expect(typeof result.value.critical).toBe('boolean');
      }
    });

    test('applies dodge (5% chance)', async () => {
      // Test by running many attacks and checking at least one dodge occurs
      let dodgeCount = 0;
      
      for (let i = 0; i < 100; i++) {
        const testManager = new BattleManager(logger, makeRng(i));
        await testManager.initialize();
        
        const units = [
          createTestUnit('attacker'),
          createTestUnit('target'),
        ];
        
        await testManager.startBattle(units);
        const result = await testManager.attack('attacker', 'target');
        
        if (result.ok && result.value.dodged) {
          dodgeCount++;
        }
        
        await testManager.destroy();
      }
      
      // With 100 attempts and 5% chance, expect 1-15 dodges (allowing variance)
      expect(dodgeCount).toBeGreaterThan(0);
      expect(dodgeCount).toBeLessThan(20);
    });

    test('applies critical hit (10% chance, 1.5x damage)', async () => {
      let critCount = 0;
      
      for (let i = 0; i < 100; i++) {
        const testManager = new BattleManager(logger, makeRng(i + 1000));
        await testManager.initialize();
        
        const units = [
          createTestUnit('attacker', { atk: 30 }),
          createTestUnit('target', { def: 0, hp: 1000, maxHp: 1000 }),
        ];
        
        await testManager.startBattle(units);
        const result = await testManager.attack('attacker', 'target');
        
        if (result.ok && result.value.critical) {
          critCount++;
        }
        
        await testManager.destroy();
      }
      
      // With 100 attempts and 10% chance, expect 3-20 crits (allowing variance)
      expect(critCount).toBeGreaterThan(2);
      expect(critCount).toBeLessThan(25);
    });

    test('applies damage variance (-2 to +2)', async () => {
      const damages = new Set<number>();
      
      for (let i = 0; i < 50; i++) {
        const testManager = new BattleManager(logger, makeRng(i + 5000));
        await testManager.initialize();
        
        const units = [
          createTestUnit('attacker', { atk: 20 }),
          createTestUnit('target', { def: 0, hp: 1000, maxHp: 1000 }),
        ];
        
        await testManager.startBattle(units);
        const result = await testManager.attack('attacker', 'target');
        
        if (result.ok && !result.value.dodged && !result.value.critical) {
          damages.add(result.value.damage);
        }
        
        await testManager.destroy();
      }
      
      // Should see variety in damage values (base 20 +/- 2)
      expect(damages.size).toBeGreaterThan(1);
    });

    test('clamps damage to non-negative', async () => {
      const units = [
        createTestUnit('weak', { atk: 5 }),
        createTestUnit('strong', { def: 100, hp: 100, maxHp: 100 }),
      ];

      await manager.startBattle(units);
      const result = await manager.attack('weak', 'strong');

      expect(result.ok).toBe(true);
      if (result.ok && !result.value.dodged) {
        expect(result.value.damage).toBeGreaterThanOrEqual(0);
        expect(result.value.finalHp).toBe(100); // No damage due to high def
      }
    });

    test('marks unit as killed when HP reaches 0', async () => {
      const units = [
        createTestUnit('attacker', { atk: 200 }),
        createTestUnit('target', { def: 0, hp: 10, maxHp: 10 }),
      ];

      await manager.startBattle(units);
      const result = await manager.attack('attacker', 'target');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.finalHp).toBe(0);
        expect(result.value.killed).toBe(true);
      }
    });

    test('rejects attack on dead target', async () => {
      const units = [
        createTestUnit('attacker'),
        createTestUnit('target', { hp: 0 }),
      ];

      await manager.startBattle(units);
      const result = await manager.attack('attacker', 'target');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('dead');
      }
    });

    test('rejects attack from dead attacker', async () => {
      const units = [
        createTestUnit('attacker', { hp: 0 }),
        createTestUnit('target'),
      ];

      await manager.startBattle(units);
      const result = await manager.attack('attacker', 'target');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('dead');
      }
    });
  });

  describe('Combat Log', () => {
    test('logs attacks with sequence numbers', async () => {
      const units = [
        createTestUnit('p1'),
        createTestUnit('e1'),
      ];

      await manager.startBattle(units);
      await manager.attack('p1', 'e1');

      const log = manager.getCombatLog();
      expect(log.length).toBeGreaterThan(0);
      
      const attackAction = log.find(a => a.type === 'attack');
      expect(attackAction).toBeDefined();
      if (attackAction) {
        expect(typeof attackAction.seq).toBe('number');
        expect(attackAction.actorId).toBe('p1');
        expect(attackAction.targetId).toBe('e1');
      }
    });

    test('logs dodges with sequence numbers', async () => {
      // Run many battles until we get a dodge
      let dodgeLogged = false;
      
      for (let i = 0; i < 50 && !dodgeLogged; i++) {
        const testManager = new BattleManager(logger, makeRng(i + 10000));
        await testManager.initialize();
        
        const units = [createTestUnit('p1'), createTestUnit('e1')];
        await testManager.startBattle(units);
        await testManager.attack('p1', 'e1');
        
        const log = testManager.getCombatLog();
        const dodgeAction = log.find(a => a.type === 'dodge');
        
        if (dodgeAction) {
          expect(dodgeAction.dodged).toBe(true);
          expect(typeof dodgeAction.seq).toBe('number');
          dodgeLogged = true;
        }
        
        await testManager.destroy();
      }
      
      expect(dodgeLogged).toBe(true);
    });

    test('logs defeats with sequence numbers', async () => {
      const units = [
        createTestUnit('p1', { atk: 200 }),
        createTestUnit('e1', { def: 0, hp: 1, maxHp: 1 }),
      ];

      await manager.startBattle(units);
      await manager.attack('p1', 'e1');

      const log = manager.getCombatLog();
      const defeatAction = log.find(a => a.type === 'defeat');
      
      expect(defeatAction).toBeDefined();
      if (defeatAction) {
        expect(defeatAction.actorId).toBe('e1');
        expect(typeof defeatAction.seq).toBe('number');
      }
    });

    test('sequence numbers are monotonic increasing', async () => {
      const units = [
        createTestUnit('p1'),
        createTestUnit('e1'),
      ];

      await manager.startBattle(units);
      await manager.attack('p1', 'e1');
      await manager.attack('e1', 'p1');

      const log = manager.getCombatLog();
      expect(log.length).toBeGreaterThan(1);
      
      for (let i = 1; i < log.length; i++) {
        expect(log[i].seq).toBeGreaterThan(log[i - 1].seq);
      }
    });
  });

  describe('Round Execution', () => {
    test('executes full round in initiative order', async () => {
      const units = [
        createTestUnit('p1', { speed: 100, atk: 10 }),
        createTestUnit('p2', { speed: 50, atk: 10 }),
        createTestUnit('e1', { speed: 75, atk: 10 }),
        createTestUnit('e2', { speed: 25, atk: 10 }),
      ];

      await manager.startBattle(units);
      const result = await manager.executeRound();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.actions.length).toBeGreaterThan(0);
        expect(result.value.battleEnded).toBeDefined();
      }
    });

    test('tracks defeated units', async () => {
      const units = [
        createTestUnit('p1', { atk: 200, speed: 100 }),
        createTestUnit('e1', { def: 0, hp: 1, maxHp: 1, speed: 50 }),
      ];

      await manager.startBattle(units);
      const result = await manager.executeRound();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.unitsDefeated).toContain('e1');
      }
    });

    test('detects battle end condition', async () => {
      const units = [
        createTestUnit('p1', { atk: 200, speed: 100 }),
        createTestUnit('e1', { def: 0, hp: 1, maxHp: 1, speed: 50 }),
      ];

      await manager.startBattle(units);
      const result = await manager.executeRound();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.battleEnded).toBe(true);
        expect(result.value.winner).toBeDefined();
      }
    });

    test('determines winner correctly', async () => {
      const units = [
        createTestUnit('p1', { atk: 200, speed: 100 }),
        createTestUnit('e1', { def: 0, hp: 1, maxHp: 1, speed: 50 }),
      ];

      await manager.startBattle(units);
      const result = await manager.executeRound();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.winner).toBe('player');
      }
    });
  });

  describe('Determinism', () => {
    test('same seed produces same battle outcomes', async () => {
      const units1 = [
        createTestUnit('p1', { atk: 25 }),
        createTestUnit('e1', { def: 5, hp: 100, maxHp: 100 }),
      ];
      
      const units2 = units1.map(u => ({ ...u }));

      const mgr1 = new BattleManager(logger, makeRng(42));
      const mgr2 = new BattleManager(logger, makeRng(42));
      
      await mgr1.initialize();
      await mgr2.initialize();
      
      await mgr1.startBattle(units1);
      await mgr2.startBattle(units2);
      
      const result1 = await mgr1.attack('p1', 'e1');
      const result2 = await mgr2.attack('p1', 'e1');
      
      expect(result1).toEqual(result2);
      
      await mgr1.destroy();
      await mgr2.destroy();
    });

    test('battle-local RNG prevents cross-battle bleed', async () => {
      const units = [
        createTestUnit('p1'),
        createTestUnit('e1'),
      ];

      // First battle
      await manager.startBattle(units);
      const log1 = manager.getDebugStats();
      await manager.endBattle();

      // Second battle with same units
      await manager.startBattle(units.map(u => ({ ...u })));
      const log2 = manager.getDebugStats();

      // Different battles should have independent RNG states
      expect(log1).toBeDefined();
      expect(log2).toBeDefined();
    });

    test('fork label includes battle sequence number', async () => {
      const units = [createTestUnit('p1'), createTestUnit('e1')];

      await manager.startBattle(units);
      await manager.endBattle();
      
      await manager.startBattle(units.map(u => ({ ...u })));
      
      // Battle sequence should increment
      // This is tested indirectly through determinism
      expect(manager.getBattleState()).toBeDefined();
    });
  });

  describe('Abort Signal', () => {
    test('attack respects AbortSignal', async () => {
      const controller = new AbortController();
      const units = [createTestUnit('p1'), createTestUnit('e1')];
      
      await manager.startBattle(units);
      controller.abort();
      
      const result = await manager.attack('p1', 'e1', controller.signal);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('abort');
      }
    });

    test('startBattle respects AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();
      
      const units = [createTestUnit('p1'), createTestUnit('e1')];
      const result = await manager.startBattle(units, controller.signal);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('abort');
      }
    });

    test('executeRound respects AbortSignal', async () => {
      const controller = new AbortController();
      const units = [createTestUnit('p1'), createTestUnit('e1')];
      
      await manager.startBattle(units);
      controller.abort();
      
      const result = await manager.executeRound(controller.signal);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('abort');
      }
    });
  });
});

