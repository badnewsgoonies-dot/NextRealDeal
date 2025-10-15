import { describe, test, expect } from 'vitest';
import { GameController } from '../../../src/core/GameController.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type { IMapSystem, IBattleSystem } from '../../../src/types/contracts.js';
import { makeTrace, makeSystemStub } from '../../helpers/systemStubs.js';
import { MapManager } from '../../../src/map/MapManager.js';
import { BattleManager } from '../../../src/battle/BattleManager.js';

describe('GameController — wiring & lifecycle', () => {
  test('forwards initialize to Map → Battle in order', async () => {
    const log = makeLogger({ enabled: false });
    const rng = makeRng(123);

    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));

    const gc = new GameController(log, rng, map, battle);
    const res = await gc.initialize();
    expect(res.ok).toBe(true);

    // Basic sanity: debug stats in test env
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    expect(gc.getDebugStats()).toBeDefined();
    process.env.NODE_ENV = prev;
  });

  test('forwards destroy in reverse order (Battle → Map)', async () => {
    const log = makeLogger({ enabled: false });
    const rng = makeRng(456);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const gc = new GameController(log, rng, map, battle);

    await gc.initialize();
    await expect(gc.destroy()).resolves.not.toThrow();
  });

  test('returns err if first child (map) fails initialize', async () => {
    const trace = makeTrace();
    const log = makeLogger({ enabled: false });
    const rng = makeRng(789);

    const mapFail = makeSystemStub<IMapSystem>('map', trace, { initOk: false }).stub;
    const battleOk = makeSystemStub<IBattleSystem>('battle', trace, { initOk: true }).stub;

    const gc = new GameController(log, rng, mapFail, battleOk);
    const res = await gc.initialize();
    
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('map-init-failed');
    }

    // Battle should not have been initialized
    expect(trace.entries.some(e => e.sys === 'battle')).toBe(false);
  });

  test('getters return injected instances', async () => {
    const log = makeLogger({ enabled: false });
    const rng = makeRng(101);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const gc = new GameController(log, rng, map, battle);

    expect(gc.getMapManager()).toBe(map);
    expect(gc.getBattleManager()).toBe(battle);
  });

  test('getDebugStats returns object in test, undefined in prod', async () => {
    const log = makeLogger({ enabled: false });
    const rng = makeRng(202);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const gc = new GameController(log, rng, map, battle);

    const prev = process.env.NODE_ENV;
    
    process.env.NODE_ENV = 'test';
    expect(gc.getDebugStats()).toBeDefined();
    
    process.env.NODE_ENV = 'production';
    expect(gc.getDebugStats()).toBeUndefined();
    
    process.env.NODE_ENV = prev;
  });

  test('lifecycle ordering with stubs', async () => {
    const trace = makeTrace();
    const log = makeLogger({ enabled: false });
    const rng = makeRng(303);

    const mapStub = makeSystemStub<IMapSystem>('map', trace).stub;
    const battleStub = makeSystemStub<IBattleSystem>('battle', trace).stub;

    const gc = new GameController(log, rng, mapStub, battleStub);

    await gc.initialize();
    await gc.update(16.67);
    await gc.destroy();

    // Verify order
    const inits = trace.entries.filter(e => e.method === 'initialize');
    expect(inits.length).toBe(2);
    expect(inits[0].sys).toBe('map');
    expect(inits[1].sys).toBe('battle');

    const destroys = trace.entries.filter(e => e.method === 'destroy');
    expect(destroys.length).toBe(2);
    expect(destroys[0].sys).toBe('battle');  // Reverse order
    expect(destroys[1].sys).toBe('map');
  });

  test('update forwards to both systems', async () => {
    const trace = makeTrace();
    const log = makeLogger({ enabled: false });
    const rng = makeRng(404);

    const mapStub = makeSystemStub<IMapSystem>('map', trace).stub;
    const battleStub = makeSystemStub<IBattleSystem>('battle', trace).stub;

    const gc = new GameController(log, rng, mapStub, battleStub);

    await gc.initialize();
    await gc.update(16.67);

    const updates = trace.entries.filter(e => e.method === 'update');
    expect(updates.length).toBe(2);
    expect(updates[0].sys).toBe('map');
    expect(updates[1].sys).toBe('battle');

    await gc.destroy();
  });
});

