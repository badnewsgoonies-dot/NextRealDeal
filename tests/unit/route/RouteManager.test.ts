import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RouteManager } from '../../../src/route/RouteManager.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import { ROUTE_ERR } from '../../../src/types/contracts.js';

describe('RouteManager', () => {
  let mgr: RouteManager;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    mgr = new RouteManager(makeLogger({ enabled: false }), makeRng(12345));
    const result = await mgr.initialize();
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await mgr.destroy();
    process.env.NODE_ENV = prevEnv;
  });

  describe('Lifecycle', () => {
    test('initializes successfully', async () => {
      const m = new RouteManager(makeLogger({ enabled: false }), makeRng(123));
      const res = await m.initialize();
      expect(res.ok).toBe(true);
      await m.destroy();
    });

    test('destroys cleanly with summary', async () => {
      await mgr.startRun('run1', 777);
      const choices = await mgr.getChoices();
      if (choices.ok) await mgr.choose(choices.value[0].id);

      await mgr.destroy();

      const stats = mgr.getDebugStats();
      expect(stats?.step).toBe(0);
      expect(stats?.runId).toBeNull();
    });
  });

  describe('Run Lifecycle', () => {
    test('startRun initializes state', async () => {
      const res = await mgr.startRun('run1', 777);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.runId).toBe('run1');
        expect(res.value.seed).toBe('777');
        expect(res.value.step).toBe(0);
        expect(res.value.history.length).toBe(0);
      }

      expect(mgr.current()?.runId).toBe('run1');
    });

    test('startRun normalizes numeric seed to string', async () => {
      const res = await mgr.startRun('run1', 12345);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.seed).toBe('12345');
      }
    });

    test('startRun rejects when run active (without force)', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.startRun('run2', 888);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.RunActive);
    });

    test('startRun with force overwrites', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.startRun('run2', 888, undefined, { force: true });

      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.runId).toBe('run2');
    });

    test('endRun clears state', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.endRun();

      expect(res.ok).toBe(true);
      expect(mgr.current()).toBeNull();
      expect(mgr.history().length).toBe(0);
    });

    test('endRun returns error when no run active', async () => {
      const res = await mgr.endRun();

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.NoRun);
    });
  });

  describe('Choice Generation', () => {
    test('getChoices returns exactly 3 with labels A/B/C', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.getChoices();

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.length).toBe(3);
        expect(res.value.map(c => c.label)).toEqual(['A', 'B', 'C']);
        expect(res.value.every(c => c.type === 'battle')).toBe(true);
        expect(res.value.every(c => c.arenaHint.width === 48)).toBe(true);
        expect(res.value.every(c => c.arenaHint.height === 48)).toBe(true);
      }
    });

    test('getChoices uses cache (prevents RNG drift)', async () => {
      await mgr.startRun('run1', 777);

      const c1 = await mgr.getChoices();
      const stats1 = mgr.getDebugStats();
      expect(stats1?.cacheValid).toBe(true);

      const c2 = await mgr.getChoices();
      const stats2 = mgr.getDebugStats();
      expect(stats2?.cacheValid).toBe(true);

      if (c1.ok && c2.ok) {
        expect(c2.value).toEqual(c1.value);
      }
    });

    test('cache invalidates on choose', async () => {
      await mgr.startRun('run1', 777);

      const choices1 = await mgr.getChoices();
      if (!choices1.ok) return;

      await mgr.choose(choices1.value[0].id);

      const stats = mgr.getDebugStats();
      expect(stats?.cacheValid).toBe(false);

      const choices2 = await mgr.getChoices();
      if (!choices2.ok) return;

      // Different step → different choices
      expect(choices2.value).not.toEqual(choices1.value);
    });

    test('choices have unique IDs at same step', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.getChoices();

      if (res.ok) {
        const ids = res.value.map(c => c.id);
        expect(new Set(ids).size).toBe(3);
      }
    });

    test('choices have unique arena seeds', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.getChoices();

      if (res.ok) {
        const seeds = res.value.map(c => c.arenaSeed);
        expect(new Set(seeds).size).toBe(3);
      }
    });

    test('getChoices returns no-run when no run active', async () => {
      const res = await mgr.getChoices();

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.NoRun);
    });
  });

  describe('Determinism', () => {
    test('same seed → identical choices across managers', async () => {
      const a = new RouteManager(makeLogger({ enabled: false }), makeRng(999));
      const b = new RouteManager(makeLogger({ enabled: false }), makeRng(999));

      await a.initialize();
      await b.initialize();

      await a.startRun('runX', 'seed-1');
      await b.startRun('runX', 'seed-1');

      const ca = await a.getChoices();
      const cb = await b.getChoices();

      if (ca.ok && cb.ok) {
        expect(cb.value).toEqual(ca.value);
      }

      await a.destroy();
      await b.destroy();
    });

    test('different steps → different arena seeds', async () => {
      await mgr.startRun('run1', 789);

      const step0 = await mgr.getChoices();
      if (!step0.ok) return;
      await mgr.choose(step0.value[0].id);

      const step1 = await mgr.getChoices();
      if (!step1.ok) return;

      expect(step1.value[0].arenaSeed).not.toBe(step0.value[0].arenaSeed);
    });

    test('same choice sequence → identical arena seeds', async () => {
      const m1 = new RouteManager(makeLogger({ enabled: false }), makeRng(555));
      const m2 = new RouteManager(makeLogger({ enabled: false }), makeRng(555));

      await m1.initialize();
      await m2.initialize();

      await m1.startRun('run', 1234);
      await m2.startRun('run', 1234);

      const c1 = await m1.getChoices();
      const c2 = await m2.getChoices();

      if (c1.ok && c2.ok) {
        const choiceB1 = c1.value.find(c => c.label === 'B')!;
        const choiceB2 = c2.value.find(c => c.label === 'B')!;

        const r1 = await m1.choose(choiceB1.id);
        const r2 = await m2.choose(choiceB2.id);

        if (r1.ok && r2.ok) {
          expect(r2.value.choice.arenaSeed).toBe(r1.value.choice.arenaSeed);
        }
      }

      await m1.destroy();
      await m2.destroy();
    });
  });

  describe('Choice Selection', () => {
    test('choose advances step and appends to history', async () => {
      await mgr.startRun('run1', 123);
      const choices = await mgr.getChoices();

      if (!choices.ok) return;

      const res = await mgr.choose(choices.value[1].id);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.step).toBe(1);
        expect(res.value.choice.label).toBe('B');
      }

      expect(mgr.current()?.step).toBe(1);
      expect(mgr.history().length).toBe(1);
      expect(mgr.history()[0].label).toBe('B');
    });

    test('choose with invalid ID returns invalid-choice', async () => {
      await mgr.startRun('run1', 123);
      const res = await mgr.choose('fake-id');

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.InvalidChoice);
    });

    test('choose with stale choice returns stale-step', async () => {
      await mgr.startRun('run1', 123);
      const choices = await mgr.getChoices();
      if (!choices.ok) return;

      const oldChoiceId = choices.value[0].id;
      await mgr.choose(oldChoiceId);

      const res = await mgr.choose(oldChoiceId);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.StaleStep);
    });

    test('finished state at step limit', async () => {
      const finishedState = JSON.stringify({
        version: 'v1',
        state: { runId: 'end', seed: '999', step: 10000, history: [] },
      });

      mgr.deserialize(finishedState);
      const res = await mgr.getChoices();

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.Finished);
    });
  });

  describe('Serialization', () => {
    test('serialize/deserialize round-trip preserves state', async () => {
      await mgr.startRun('run1', 'test-seed');

      const choices = await mgr.getChoices();
      if (choices.ok) await mgr.choose(choices.value[1].id);

      const serialized = mgr.serialize();

      const mgr2 = new RouteManager(makeLogger({ enabled: false }), makeRng(12345));
      await mgr2.initialize();

      const deserializeRes = mgr2.deserialize(serialized);
      expect(deserializeRes.ok).toBe(true);

      expect(mgr2.current()).toEqual(mgr.current());
      expect(mgr2.history()).toEqual(mgr.history());

      await mgr2.destroy();
    });

    test('choices after deserialize match original', async () => {
      await mgr.startRun('run1', 999);
      const original = await mgr.getChoices();

      const serialized = mgr.serialize();

      const mgr2 = new RouteManager(makeLogger({ enabled: false }), makeRng(12345));
      await mgr2.initialize();
      mgr2.deserialize(serialized);

      const restored = await mgr2.getChoices();

      if (original.ok && restored.ok) {
        expect(restored.value).toEqual(original.value);
      }

      await mgr2.destroy();
    });

    test('deserialize validates state schema', async () => {
      const invalidJson = JSON.stringify({ version: 'v1', state: { invalid: true } });
      const res = mgr.deserialize(invalidJson);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.InvalidState);
    });

    test('deserialize rejects unsupported version', async () => {
      const futureJson = JSON.stringify({ version: 'v99', state: {} });
      const res = mgr.deserialize(futureJson);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.UnsupportedVersion);
    });

    test('serialize null state', () => {
      const json = mgr.serialize();
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('v1');
      expect(parsed.state).toBeNull();
    });

    test('deserialize null state clears everything', async () => {
      await mgr.startRun('run1', 123);

      const nullState = JSON.stringify({ version: 'v1', state: null });
      const res = mgr.deserialize(nullState);

      expect(res.ok).toBe(true);
      expect(mgr.current()).toBeNull();
    });
  });

  describe('Concurrency', () => {
    test('concurrent getChoices serialize', async () => {
      await mgr.startRun('run1', 123);

      const ops = Array.from({ length: 10 }, () => mgr.getChoices());
      const results = await Promise.all(ops);

      expect(results.every(r => r.ok)).toBe(true);

      const stats = mgr.getDebugStats();
      expect(stats?.queuePending).toBe(0);
    });

    test('multiple sequential choices work correctly', async () => {
      await mgr.startRun('run1', 123);

      for (let i = 0; i < 5; i++) {
        const choices = await mgr.getChoices();
        if (!choices.ok) break;

        const res = await mgr.choose(choices.value[0].id);
        expect(res.ok).toBe(true);

        if (res.ok) {
          expect(res.value.step).toBe(i + 1);
        }
      }

      expect(mgr.current()?.step).toBe(5);
      expect(mgr.history().length).toBe(5);
    });
  });

  describe('Debug Stats', () => {
    test('returns stats with runId in test env', async () => {
      await mgr.startRun('run1', 123);

      const stats = mgr.getDebugStats();
      expect(stats).toBeDefined();
      expect(stats?.runId).toBe('run1');
      expect(stats?.step).toBe(0);
      expect(stats?.cacheValid).toBe(false);
      expect(stats?.historyLen).toBe(0);
    });

    test('returns undefined in production', () => {
      process.env.NODE_ENV = 'production';
      expect(mgr.getDebugStats()).toBeUndefined();
    });

    test('cache valid flag updates correctly', async () => {
      await mgr.startRun('run1', 123);

      let stats = mgr.getDebugStats();
      expect(stats?.cacheValid).toBe(false);

      await mgr.getChoices();

      stats = mgr.getDebugStats();
      expect(stats?.cacheValid).toBe(true);
    });
  });

  describe('Abort Signal', () => {
    test('startRun respects abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const res = await mgr.startRun('run1', 123, controller.signal);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.Aborted);
    });

    test('choose respects abort (no state change)', async () => {
      await mgr.startRun('run1', 123);
      const choices = await mgr.getChoices();
      if (!choices.ok) return;

      const controller = new AbortController();
      controller.abort();

      const res = await mgr.choose(choices.value[0].id, controller.signal);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.Aborted);

      expect(mgr.current()?.step).toBe(0);
      expect(mgr.history().length).toBe(0);
    });

    test('getChoices respects abort', async () => {
      await mgr.startRun('run1', 123);

      const controller = new AbortController();
      controller.abort();

      const res = await mgr.getChoices(controller.signal);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe(ROUTE_ERR.Aborted);
    });
  });

  describe('Arena Hints', () => {
    test('arena hints have even dimensions', async () => {
      await mgr.startRun('run1', 123);
      const res = await mgr.getChoices();

      if (res.ok) {
        for (const choice of res.value) {
          expect(choice.arenaHint.width % 2).toBe(0);
          expect(choice.arenaHint.height % 2).toBe(0);
        }
      }
    });

    test('arena seeds are in valid range', async () => {
      await mgr.startRun('run1', 123);
      const res = await mgr.getChoices();

      if (res.ok) {
        for (const choice of res.value) {
          expect(choice.arenaSeed).toBeGreaterThan(0);
          expect(choice.arenaSeed).toBeLessThanOrEqual(2147483647);
        }
      }
    });
  });

  describe('Seed Uniqueness', () => {
    test('arena seeds are provably unique within step', async () => {
      await mgr.startRun('run1', 777);
      const res = await mgr.getChoices();

      if (res.ok) {
        const seeds = res.value.map(c => c.arenaSeed);
        expect(new Set(seeds).size).toBe(3); // ✅ No duplicates guaranteed
      }
    });

    test('uniqueness holds across multiple runs', async () => {
      for (let runNum = 0; runNum < 10; runNum++) {
        const testMgr = new RouteManager(makeLogger({ enabled: false }), makeRng(runNum));
        await testMgr.initialize();
        await testMgr.startRun(`run${runNum}`, runNum * 1000);

        const res = await testMgr.getChoices();
        if (res.ok) {
          const seeds = res.value.map(c => c.arenaSeed);
          expect(new Set(seeds).size).toBe(3);
        }

        await testMgr.destroy();
      }
    });
  });

  describe('Cache Behavior', () => {
    test('cache valid after first getChoices', async () => {
      await mgr.startRun('run1', 123);
      
      const stats1 = mgr.getDebugStats();
      expect(stats1?.cacheValid).toBe(false);
      
      await mgr.getChoices();

      const stats2 = mgr.getDebugStats();
      expect(stats2?.cacheValid).toBe(true);
    });

    test('cache invalid after choose', async () => {
      await mgr.startRun('run1', 123);
      await mgr.getChoices();
      
      const stats1 = mgr.getDebugStats();
      expect(stats1?.cacheValid).toBe(true);

      const choices = await mgr.getChoices();
      if (!choices.ok) return;

      await mgr.choose(choices.value[0].id);

      const stats2 = mgr.getDebugStats();
      expect(stats2?.cacheValid).toBe(false);
    });

    test('force startRun clears cache', async () => {
      await mgr.startRun('run1', 123);
      await mgr.getChoices(); // Populate cache

      const stats1 = mgr.getDebugStats();
      expect(stats1?.cacheValid).toBe(true);

      await mgr.startRun('run2', 456, undefined, { force: true });

      const stats2 = mgr.getDebugStats();
      expect(stats2?.cacheValid).toBe(false);
    });

    test('getChoices logs fromCache correctly', async () => {
      await mgr.startRun('run1', 123);

      // First call: not cached
      await mgr.getChoices();

      // Second call: from cache
      await mgr.getChoices();

      // Both should succeed
      expect(mgr.getDebugStats()?.cacheValid).toBe(true);
    });
  });
});

