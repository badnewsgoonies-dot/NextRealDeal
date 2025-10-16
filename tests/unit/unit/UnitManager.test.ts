import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { UnitManager } from '../../../src/unit/UnitManager.js';
import { makeRng } from '../../../src/util/Rng.js';
import { makeLogger } from '../../../src/util/Logger.js';
import type { UnitCreateConfig, Equipment } from '../../../src/types/contracts.js';

describe('UnitManager', () => {
  let manager: UnitManager;
  let rng: ReturnType<typeof makeRng>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(async () => {
    rng = makeRng(20251014);
    logger = makeLogger({ enabled: false });
    manager = new UnitManager(logger, rng);
    const result = await manager.initialize();
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Lifecycle', () => {
    test('initializes successfully', async () => {
      const mgr2 = new UnitManager(logger, rng);
      const result = await mgr2.initialize();
      expect(result.ok).toBe(true);
      await mgr2.destroy();
    });

    test('updates without errors', async () => {
      const result = await manager.update(16.67);
      expect(result.ok).toBe(true);
    });

    test('destroys cleanly', async () => {
      await expect(manager.destroy()).resolves.not.toThrow();
    });

    test('getAllUnits returns empty array initially', () => {
      expect(manager.getAllUnits()).toEqual([]);
    });
  });

  describe('Debug Stats', () => {
    test('getDebugStats returns stats in test env', () => {
      const stats = manager.getDebugStats();
      expect(stats).toBeDefined();
      if (stats) {
        expect(typeof stats.queuePending).toBe('number');
        expect(typeof stats.unitCount).toBe('number');
      }
    });

    test('getDebugStats returns undefined in prod', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const stats = manager.getDebugStats();
      expect(stats).toBeUndefined();
      
      process.env.NODE_ENV = prev;
    });
  });

  describe('Unit Creation', () => {
    test('creates unit with valid config', async () => {
      const config: UnitCreateConfig = {
        id: 'hero1',
        name: 'Hero',
        level: 1,
        team: 'player',
      };

      const result = await manager.createUnit(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.id).toBe('hero1');
        expect(result.value.name).toBe('Hero');
        expect(result.value.level).toBe(1);
        expect(result.value.team).toBe('player');
        expect(result.value.hp).toBeGreaterThan(0);
        expect(result.value.maxHp).toBeGreaterThan(0);
      }
    });

    test('creates unit with custom base stats', async () => {
      const config: UnitCreateConfig = {
        id: 'warrior1',
        name: 'Warrior',
        team: 'player',
        baseStats: {
          atk: 50,
          def: 30,
          speed: 40,
        },
      };

      const result = await manager.createUnit(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.atk).toBe(50);
        expect(result.value.def).toBe(30);
        expect(result.value.speed).toBe(40);
      }
    });

    test('scales stats with level', async () => {
      const config1: UnitCreateConfig = { id: 'u1', name: 'Unit', level: 1, team: 'player' };
      const config10: UnitCreateConfig = { id: 'u2', name: 'Unit', level: 10, team: 'player' };

      const r1 = await manager.createUnit(config1);
      const r2 = await manager.createUnit(config10);

      expect(r1.ok && r2.ok).toBe(true);

      if (r1.ok && r2.ok) {
        expect(r2.value.maxHp).toBeGreaterThan(r1.value.maxHp);
        expect(r2.value.atk).toBeGreaterThan(r1.value.atk);
      }
    });

    test('rejects duplicate unit ID', async () => {
      const config: UnitCreateConfig = {
        id: 'dup',
        name: 'Duplicate',
        team: 'player',
      };

      await manager.createUnit(config);
      const result2 = await manager.createUnit(config);

      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        expect(result2.error).toContain('already-exists');
      }
    });

    test('rejects invalid config', async () => {
      const invalidConfig = {
        id: '',  // Empty ID
        name: 'Invalid',
        team: 'player',
      } as UnitCreateConfig;

      const result = await manager.createUnit(invalidConfig);
      expect(result.ok).toBe(false);
    });
  });

  describe('Unit Retrieval', () => {
    test('getUnit returns created unit', async () => {
      const config: UnitCreateConfig = { id: 'test1', name: 'Test', team: 'player' };
      await manager.createUnit(config);

      const unit = manager.getUnit('test1');
      expect(unit).toBeDefined();
      expect(unit?.id).toBe('test1');
    });

    test('getUnit returns undefined for non-existent unit', () => {
      const unit = manager.getUnit('nonexistent');
      expect(unit).toBeUndefined();
    });

    test('getAllUnits returns all created units', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit 1', team: 'player' });
      await manager.createUnit({ id: 'u2', name: 'Unit 2', team: 'enemy' });

      const units = manager.getAllUnits();
      expect(units.length).toBe(2);
      expect(units.map(u => u.id).sort()).toEqual(['u1', 'u2']);
    });
  });

  describe('Unit Removal', () => {
    test('removes existing unit', async () => {
      await manager.createUnit({ id: 'remove1', name: 'Remove', team: 'player' });
      
      const result = await manager.removeUnit('remove1');
      expect(result.ok).toBe(true);
      expect(manager.getUnit('remove1')).toBeUndefined();
    });

    test('returns error for non-existent unit', async () => {
      const result = await manager.removeUnit('nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not-found');
      }
    });
  });

  describe('Equipment System', () => {
    const testWeapon: Equipment = {
      id: 'sword1',
      name: 'Iron Sword',
      slot: 'weapon',
      atkBonus: 10,
      defBonus: 0,
      speedBonus: 0,
    };

    const testArmor: Equipment = {
      id: 'armor1',
      name: 'Iron Armor',
      slot: 'armor',
      atkBonus: 0,
      defBonus: 15,
      speedBonus: -5,
    };

    test('equips item to unit', async () => {
      await manager.createUnit({ id: 'warrior', name: 'Warrior', team: 'player' });

      const result = await manager.equipItem('warrior', testWeapon);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.equipment?.weapon).toEqual(testWeapon);
      }
    });

    test('applies equipment bonuses to effective stats', async () => {
      const config: UnitCreateConfig = {
        id: 'knight',
        name: 'Knight',
        team: 'player',
        baseStats: { atk: 20, def: 10, speed: 50 },
      };

      await manager.createUnit(config);
      const baseStats = manager.getEffectiveStats('knight');

      await manager.equipItem('knight', testWeapon);
      const withWeapon = manager.getEffectiveStats('knight');

      expect(baseStats && withWeapon).toBeDefined();
      if (baseStats && withWeapon) {
        expect(withWeapon.atk).toBe(baseStats.atk + 10);
      }
    });

    test('stacks multiple equipment bonuses', async () => {
      await manager.createUnit({
        id: 'hero',
        name: 'Hero',
        team: 'player',
        baseStats: { atk: 20, def: 10, speed: 50 },
      });

      await manager.equipItem('hero', testWeapon);
      await manager.equipItem('hero', testArmor);

      const stats = manager.getEffectiveStats('hero');
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.atk).toBe(20 + 10);      // base + weapon
        expect(stats.def).toBe(10 + 15);      // base + armor
        expect(stats.speed).toBe(50 - 5);     // base + armor penalty
      }
    });

    test('unequips item from slot', async () => {
      await manager.createUnit({ id: 'mage', name: 'Mage', team: 'player' });
      await manager.equipItem('mage', testWeapon);

      const result = await manager.unequipItem('mage', 'weapon');
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.equipment?.weapon).toBeUndefined();
      }
    });

    test('replaces equipment in same slot', async () => {
      const sword1 = testWeapon;
      const sword2: Equipment = {
        ...testWeapon,
        id: 'sword2',
        name: 'Steel Sword',
        atkBonus: 20,
      };

      await manager.createUnit({ id: 'fighter', name: 'Fighter', team: 'player' });
      await manager.equipItem('fighter', sword1);
      await manager.equipItem('fighter', sword2);

      const unit = manager.getUnit('fighter');
      expect(unit?.equipment?.weapon?.id).toBe('sword2');
    });
  });

  describe('Position Management', () => {
    test('sets unit position', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit', team: 'player' });

      const result = await manager.setPosition('u1', { x: 10, y: 20 });
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.position).toEqual({ x: 10, y: 20 });
      }
    });

    test('getUnitsAt returns units at position', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit1', team: 'player' });
      await manager.createUnit({ id: 'u2', name: 'Unit2', team: 'player' });
      await manager.createUnit({ id: 'u3', name: 'Unit3', team: 'enemy' });

      await manager.setPosition('u1', { x: 5, y: 5 });
      await manager.setPosition('u2', { x: 5, y: 5 });
      await manager.setPosition('u3', { x: 10, y: 10 });

      const unitsAt55 = manager.getUnitsAt({ x: 5, y: 5 });
      expect(unitsAt55.length).toBe(2);
      expect(unitsAt55.map(u => u.id).sort()).toEqual(['u1', 'u2']);
    });

    test('returns empty array for position with no units', () => {
      const units = manager.getUnitsAt({ x: 100, y: 100 });
      expect(units).toEqual([]);
    });
  });

  describe('Battle Integration', () => {
    test('getTeamUnits returns player units only', async () => {
      await manager.createUnit({ id: 'p1', name: 'Player1', team: 'player' });
      await manager.createUnit({ id: 'p2', name: 'Player2', team: 'player' });
      await manager.createUnit({ id: 'e1', name: 'Enemy1', team: 'enemy' });

      const players = manager.getTeamUnits('player');
      expect(players.length).toBe(2);
      expect(players.every(u => u.id.startsWith('p'))).toBe(true);
    });

    test('getTeamUnits returns enemy units only', async () => {
      await manager.createUnit({ id: 'p1', name: 'Player1', team: 'player' });
      await manager.createUnit({ id: 'e1', name: 'Enemy1', team: 'enemy' });
      await manager.createUnit({ id: 'e2', name: 'Enemy2', team: 'enemy' });

      const enemies = manager.getTeamUnits('enemy');
      expect(enemies.length).toBe(2);
      expect(enemies.every(u => u.id.startsWith('e'))).toBe(true);
    });

    test('team units include equipment bonuses', async () => {
      const config: UnitCreateConfig = {
        id: 'hero',
        name: 'Hero',
        team: 'player',
        baseStats: { atk: 20, def: 10, speed: 50 },
      };

      await manager.createUnit(config);
      
      const weapon: Equipment = {
        id: 'weapon1',
        name: 'Sword',
        slot: 'weapon',
        atkBonus: 15,
        defBonus: 0,
        speedBonus: 0,
      };

      await manager.equipItem('hero', weapon);

      const battleUnits = manager.getTeamUnits('player');
      expect(battleUnits.length).toBe(1);
      expect(battleUnits[0].atk).toBe(35); // 20 + 15
    });
  });

  describe('Effective Stats', () => {
    test('calculates stats without equipment', async () => {
      const config: UnitCreateConfig = {
        id: 'basic',
        name: 'Basic',
        team: 'player',
        baseStats: { atk: 25, def: 15, speed: 55 },
      };

      await manager.createUnit(config);
      const stats = manager.getEffectiveStats('basic');

      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.atk).toBe(25);
        expect(stats.def).toBe(15);
        expect(stats.speed).toBe(55);
      }
    });

    test('returns undefined for non-existent unit', () => {
      const stats = manager.getEffectiveStats('nonexistent');
      expect(stats).toBeUndefined();
    });
  });

  describe('Abort Signal', () => {
    test('createUnit respects AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const config: UnitCreateConfig = { id: 'u1', name: 'Unit', team: 'player' };
      const result = await manager.createUnit(config, controller.signal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('abort');
      }
    });

    test('removeUnit respects AbortSignal', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit', team: 'player' });

      const controller = new AbortController();
      controller.abort();

      const result = await manager.removeUnit('u1', controller.signal);
      expect(result.ok).toBe(false);
    });

    test('equipItem respects AbortSignal', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit', team: 'player' });

      const controller = new AbortController();
      controller.abort();

      const item: Equipment = {
        id: 'item1',
        name: 'Item',
        slot: 'weapon',
        atkBonus: 10,
        defBonus: 0,
        speedBonus: 0,
      };

      const result = await manager.equipItem('u1', item, controller.signal);
      expect(result.ok).toBe(false);
    });
  });

  describe('Immutability', () => {
    test('equipment changes return new unit instance', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit', team: 'player' });
      
      const unit1 = manager.getUnit('u1');
      
      const weapon: Equipment = {
        id: 'w1',
        name: 'Weapon',
        slot: 'weapon',
        atkBonus: 10,
        defBonus: 0,
        speedBonus: 0,
      };

      await manager.equipItem('u1', weapon);
      
      const unit2 = manager.getUnit('u1');

      // Units should be different instances
      expect(unit1).not.toBe(unit2);
      expect(unit1?.equipment?.weapon).toBeUndefined();
      expect(unit2?.equipment?.weapon).toEqual(weapon);
    });

    test('position changes return new unit instance', async () => {
      await manager.createUnit({ id: 'u1', name: 'Unit', team: 'player' });
      
      const unit1 = manager.getUnit('u1');
      await manager.setPosition('u1', { x: 5, y: 10 });
      const unit2 = manager.getUnit('u1');

      expect(unit1?.position).toBeUndefined();
      expect(unit2?.position).toEqual({ x: 5, y: 10 });
    });
  });
});

