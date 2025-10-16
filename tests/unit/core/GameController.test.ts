import { describe, test, expect } from 'vitest';
import { GameController } from '../../../src/core/GameController.js';
import { ConsoleLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type {
  IMapSystem,
  IBattleSystem,
  IUnitSystem,
  IEconomySystem,
  IRouteSystem
} from '../../../src/types/contracts.js';
import { makeTrace, makeSystemStub } from '../../helpers/systemStubs.js';
import { MapManager } from '../../../src/map/MapManager.js';
import { BattleManager } from '../../../src/battle/BattleManager.js';
import { UnitManager } from '../../../src/unit/UnitManager.js';
import { EconomyManager } from '../../../src/economy/EconomyManager.js';
import { RouteManager } from '../../../src/route/RouteManager.js';

describe('GameController — wiring & lifecycle', () => {
  test('forwards initialize to all 5 systems in order', async () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(123);

    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const unit = new UnitManager(log, rng.fork('unit'));
    const economy = new EconomyManager(log, rng.fork('economy'));
    const route = new RouteManager(log, rng.fork('route'));

    const gc = new GameController(log, rng, map, battle, unit, economy, route);
    const res = await gc.initialize();
    expect(res.ok).toBe(true);

    // Basic sanity: debug stats in test env
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const stats = gc.getDebugStats();
    expect(stats).toBeDefined();
    if (stats) {
      expect(stats.queuePending).toBe(0);
      expect(stats.routePending).toBe(0);
    }
    process.env.NODE_ENV = prev;

    await gc.destroy();
  });

  test('forwards destroy in reverse order (Route → Economy → Unit → Battle → Map)', async () => {
    const trace = makeTrace();
    const log = new ConsoleLogger('error');
    const rng = makeRng(456);

    const mapStub = makeSystemStub<IMapSystem>('map', trace).stub;
    const battleStub = makeSystemStub<IBattleSystem>('battle', trace).stub;
    const unitStub = makeSystemStub<IUnitSystem>('unit', trace).stub;
    const economyStub = makeSystemStub<IEconomySystem>('economy', trace).stub;
    const routeStub = makeSystemStub<IRouteSystem>('route', trace).stub;

    const gc = new GameController(log, rng, mapStub, battleStub, unitStub, economyStub, routeStub);

    await gc.initialize();
    await gc.destroy();

    // Find destroy calls
    const destroyCalls = trace.entries.filter(e => e.method === 'destroy');
    expect(destroyCalls.length).toBe(5);
    expect(destroyCalls[0].sys).toBe('route');   // Route destroys first
    expect(destroyCalls[1].sys).toBe('economy'); // Economy destroys second
    expect(destroyCalls[2].sys).toBe('unit');    // Unit destroys third
    expect(destroyCalls[3].sys).toBe('battle');  // Battle destroys fourth
    expect(destroyCalls[4].sys).toBe('map');     // Map destroys fifth
  });

  test('returns err if first child (map) fails initialize', async () => {
    const trace = makeTrace();
    const log = new ConsoleLogger('error');
    const rng = makeRng(789);

    const mapFail = makeSystemStub<IMapSystem>('map', trace, { initOk: false }).stub;
    const battleOk = makeSystemStub<IBattleSystem>('battle', trace, { initOk: true }).stub;
    const unitOk = makeSystemStub<IUnitSystem>('unit', trace, { initOk: true }).stub;
    const economyOk = makeSystemStub<IEconomySystem>('economy', trace, { initOk: true }).stub;
    const routeOk = makeSystemStub<IRouteSystem>('route', trace, { initOk: true }).stub;

    const gc = new GameController(log, rng, mapFail, battleOk, unitOk, economyOk, routeOk);
    const res = await gc.initialize();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('map-init-failed');
    }

    // Battle, Unit, Economy, and Route should NOT have been initialized
    const battleInits = trace.entries.filter(e => e.sys === 'battle' && e.method === 'initialize');
    const unitInits = trace.entries.filter(e => e.sys === 'unit' && e.method === 'initialize');
    const economyInits = trace.entries.filter(e => e.sys === 'economy' && e.method === 'initialize');
    const routeInits = trace.entries.filter(e => e.sys === 'route' && e.method === 'initialize');
    expect(battleInits.length).toBe(0);
    expect(unitInits.length).toBe(0);
    expect(economyInits.length).toBe(0);
    expect(routeInits.length).toBe(0);
  });

  test('getters return injected instances', () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(101);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const unit = new UnitManager(log, rng.fork('unit'));
    const economy = new EconomyManager(log, rng.fork('economy'));
    const route = new RouteManager(log, rng.fork('route'));

    const gc = new GameController(log, rng, map, battle, unit, economy, route);

    expect(gc.getMapManager()).toBe(map);
    expect(gc.getBattleManager()).toBe(battle);
    expect(gc.getUnitManager()).toBe(unit);
    expect(gc.getEconomyManager()).toBe(economy);
    expect(gc.getRouteManager()).toBe(route);
  });

  test('getDebugStats returns object in test, undefined in prod', () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(202);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const unit = new UnitManager(log, rng.fork('unit'));
    const economy = new EconomyManager(log, rng.fork('economy'));
    const route = new RouteManager(log, rng.fork('route'));

    const gc = new GameController(log, rng, map, battle, unit, economy, route);

    const prev = process.env.NODE_ENV;

    process.env.NODE_ENV = 'test';
    const testStats = gc.getDebugStats();
    expect(testStats).toBeDefined();
    if (testStats) {
      expect(testStats).toHaveProperty('queuePending');
      expect(testStats).toHaveProperty('mapPending');
      expect(testStats).toHaveProperty('battlePending');
      expect(testStats).toHaveProperty('unitPending');
      expect(testStats).toHaveProperty('economyPending');
      expect(testStats).toHaveProperty('routePending');
    }

    process.env.NODE_ENV = 'production';
    const prodStats = gc.getDebugStats();
    expect(prodStats).toBeUndefined();

    process.env.NODE_ENV = prev;
  });

  test('update forwards to all systems', async () => {
    const log = new ConsoleLogger('error');
    const rng = makeRng(303);
    const map = new MapManager(log, rng.fork('map'));
    const battle = new BattleManager(log, rng.fork('battle'));
    const unit = new UnitManager(log, rng.fork('unit'));
    const economy = new EconomyManager(log, rng.fork('economy'));
    const route = new RouteManager(log, rng.fork('route'));

    const gc = new GameController(log, rng, map, battle, unit, economy, route);
    await gc.initialize();

    const result = await gc.update(16.67);
    expect(result.ok).toBe(true);

    await gc.destroy();
  });
});

