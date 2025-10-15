import { describe, test, expect } from 'vitest';
import { GameController } from '../../../src/core/GameController.js';
import { ConsoleLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type { IMapSystem, IBattleSystem } from '../../../src/types/contracts.js';
import { makeTrace, makeSystemStub } from '../../helpers/systemStubs.js';
import { MapManager } from '../../../src/map/MapManager.js';
import { BattleManager } from '../../../src/battle/BattleManager.js';

describe('GameController — wiring & lifecycle', () => {
  test('forwards initialize to Map → Battle in order', async () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(123);

    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));

    const gc = new GameController(log, rng, map, battle);
    const res = await gc.initialize();
    expect(res.ok).toBe(true);

    // Basic sanity: debug stats in test env
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const stats = gc.getDebugStats();
    expect(stats).toBeDefined();
    if (stats) {
      expect(stats.queuePending).toBe(0);
    }
    process.env.NODE_ENV = prev;
    
    await gc.destroy();
  });

  test('forwards destroy in reverse order (Battle → Map)', async () => {
    const trace = makeTrace();
    const log = new ConsoleLogger('error');
    const rng = makeRng(456);

    const mapStub = makeSystemStub<IMapSystem>('map', trace).stub;
    const battleStub = makeSystemStub<IBattleSystem>('battle', trace).stub;

    const gc = new GameController(log, rng, mapStub, battleStub);

    await gc.initialize();
    await gc.destroy();

    // Find destroy calls
    const destroyCalls = trace.entries.filter(e => e.method === 'destroy');
    expect(destroyCalls.length).toBe(2);
    expect(destroyCalls[0].sys).toBe('battle'); // Battle destroys first
    expect(destroyCalls[1].sys).toBe('map');    // Map destroys second
  });

  test('returns err if first child (map) fails initialize', async () => {
    const trace = makeTrace();
    const log = new ConsoleLogger('error');
    const rng = makeRng(789);

    const mapFail = makeSystemStub<IMapSystem>('map', trace, { initOk: false }).stub;
    const battleOk = makeSystemStub<IBattleSystem>('battle', trace, { initOk: true }).stub;

    const gc = new GameController(log, rng, mapFail, battleOk);
    const res = await gc.initialize();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('map-init-failed');
    }

    // Battle should NOT have been initialized
    const battleInits = trace.entries.filter(e => e.sys === 'battle' && e.method === 'initialize');
    expect(battleInits.length).toBe(0);
  });

  test('getters return injected instances', () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(101);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));

    const gc = new GameController(log, rng, map, battle);

    expect(gc.getMapManager()).toBe(map);
    expect(gc.getBattleManager()).toBe(battle);
  });

  test('getDebugStats returns object in test, undefined in prod', () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(202);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));

    const gc = new GameController(log, rng, map, battle);

    const prev = process.env.NODE_ENV;
    
    process.env.NODE_ENV = 'test';
    const testStats = gc.getDebugStats();
    expect(testStats).toBeDefined();
    if (testStats) {
      expect(testStats).toHaveProperty('queuePending');
      expect(testStats).toHaveProperty('mapPending');
      expect(testStats).toHaveProperty('battlePending');
    }

    process.env.NODE_ENV = 'production';
    const prodStats = gc.getDebugStats();
    expect(prodStats).toBeUndefined();
    
    process.env.NODE_ENV = prev;
  });

  test('update forwards to both systems', async () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(303);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));

    const gc = new GameController(log, rng, map, battle);
    await gc.initialize();

    const result = await gc.update(16.67);
    expect(result.ok).toBe(true);

    await gc.destroy();
  });
});

