import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SaveManager } from '../../../src/save/SaveManager.js';
import { InMemorySaveStore } from '../../../src/save/SaveStore.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import { SAVE_ERR, type SaveSubsystem, type SaveData } from '../../../src/types/contracts.js';
import { ok } from '../../../src/util/Result.js';

describe('SaveManager', () => {
  let saveManager: SaveManager;
  let store: InMemorySaveStore;
  let prevEnv: string | undefined;

  const mockSubsystem = (name: string, data = '{}'): SaveSubsystem => ({
    name,
    serialize: () => data,
    deserialize: () => ok(undefined),
  });

  beforeEach(async () => {
    prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    store = new InMemorySaveStore();
    saveManager = new SaveManager(makeLogger({ enabled: false }), makeRng(12345));
    const result = await saveManager.initialize(undefined, { store });
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await saveManager.destroy();
    process.env.NODE_ENV = prevEnv;
  });

  describe('Lifecycle', () => {
    test('initializes with default store', async () => {
      const mgr = new SaveManager(makeLogger({ enabled: false }), makeRng(123));
      const res = await mgr.initialize();
      expect(res.ok).toBe(true);
      await mgr.destroy();
    });

    test('initializes with custom store', async () => {
      const customStore = new InMemorySaveStore();
      const mgr = new SaveManager(makeLogger({ enabled: false }), makeRng(123));
      const res = await mgr.initialize(undefined, { store: customStore });
      expect(res.ok).toBe(true);
      await mgr.destroy();
    });

    test('destroys cleanly', async () => {
      saveManager.register(mockSubsystem('test'));
      await expect(saveManager.destroy()).resolves.not.toThrow();
      
      const stats = saveManager.getDebugStats();
      expect(stats?.registered).toBe(0);
    });
  });

  describe('Subsystem Registry', () => {
    test('registers subsystem', () => {
      saveManager.register(mockSubsystem('route'));
      expect(saveManager.listRegistered()).toContain('route');
    });

    test('unregisters subsystem', () => {
      saveManager.register(mockSubsystem('route'));
      saveManager.unregister('route');
      expect(saveManager.listRegistered()).not.toContain('route');
    });

    test('rejects reserved subsystem names', () => {
      const before = saveManager.listRegistered().length;

      saveManager.register(mockSubsystem('_payload')); // Reserved!

      const after = saveManager.listRegistered().length;
      expect(after).toBe(before); // Unchanged
    });

    test('lists all registered subsystems', () => {
      saveManager.register(mockSubsystem('route'));
      saveManager.register(mockSubsystem('economy'));

      const registered = saveManager.listRegistered();
      expect(registered).toContain('route');
      expect(registered).toContain('economy');
      expect(registered.length).toBe(2);
    });
  });

  describe('Registry Mode (Auto-Gather)', () => {
    test('saves registered subsystems', async () => {
      saveManager.register(mockSubsystem('route', '{"test":true}'));
      saveManager.register(mockSubsystem('economy', '{"gold":100}'));

      const result = await saveManager.save('slot1');
      expect(result.ok).toBe(true);

      const stats = saveManager.getDebugStats();
      expect(stats?.lastSaveISO).not.toBeNull();
    });

    test('loads and applies to registered subsystems', async () => {
      let routeData = '';
      let economyData = '';

      saveManager.register({
        name: 'route',
        serialize: () => '{"route":"data"}',
        deserialize: json => {
          routeData = json;
          return ok(undefined);
        },
      });

      saveManager.register({
        name: 'economy',
        serialize: () => '{"economy":"data"}',
        deserialize: json => {
          economyData = json;
          return ok(undefined);
        },
      });

      await saveManager.save('slot1');
      const result = await saveManager.load('slot1');

      expect(result.ok).toBe(true);
      expect(routeData).toBe('{"route":"data"}');
      expect(economyData).toBe('{"economy":"data"}');
    });

    test('load without apply returns envelope', async () => {
      saveManager.register(mockSubsystem('route', '{"test":true}'));

      await saveManager.save('slot1');
      const result = await saveManager.load('slot1', undefined, { apply: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.subsystems).toHaveProperty('route');
        expect(result.value.version).toBe('v1');
      }
    });

    test('returns error when subsystem serialize fails', async () => {
      saveManager.register({
        name: 'bad',
        serialize: () => {
          throw new Error('Serialize error');
        },
        deserialize: () => ok(undefined),
      });

      const result = await saveManager.save('slot1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.Internal);
      }
    });

    test('returns error when subsystem deserialize fails', async () => {
      saveManager.register({
        name: 'bad',
        serialize: () => '{}',
        deserialize: () => ({ ok: false, error: 'boom' }),
      });

      await saveManager.save('slot1');
      const result = await saveManager.load('slot1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.ApplyFailed);
      }
    });
  });

  describe('Payload Mode (Manual)', () => {
    test('saves manual SaveData', async () => {
      const data: SaveData = {
        version: 'v1',
        createdAt: new Date().toISOString(),
        systems: {
          custom: { foo: 'bar' },
        },
      };

      const result = await saveManager.saveWithData('slot1', data);
      expect(result.ok).toBe(true);
    });

    test('validates SaveData schema', async () => {
      const invalidData = {
        version: 'v99',
        createdAt: 'invalid-date',
        systems: {},
      } as unknown as SaveData;

      const result = await saveManager.saveWithData('slot1', invalidData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.InvalidData);
      }
    });
  });

  describe('Slot Management', () => {
    test('listSlots returns all saved slots', async () => {
      saveManager.register(mockSubsystem('test'));

      await saveManager.save('slot1');
      await saveManager.save('slot2');
      await saveManager.save('slot3');

      const result = await saveManager.listSlots();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
        expect(result.value.map(s => s.slot)).toContain('slot1');
        expect(result.value.map(s => s.slot)).toContain('slot2');
        expect(result.value.map(s => s.slot)).toContain('slot3');
      }
    });

    test('listSlots sorted by modified DESC, then slot ASC', async () => {
      saveManager.register(mockSubsystem('test'));

      await saveManager.save('slotA');
      await new Promise(r => setTimeout(r, 10));
      await saveManager.save('slotB');
      await new Promise(r => setTimeout(r, 10));
      await saveManager.save('slotC');

      const result = await saveManager.listSlots();
      expect(result.ok).toBe(true);

      if (result.ok) {
        const slots = result.value.map(s => s.slot);
        // Most recent first
        expect(slots[0]).toBe('slotC');
        expect(slots[1]).toBe('slotB');
        expect(slots[2]).toBe('slotA');
      }
    });

    test('deleteSlot removes save', async () => {
      saveManager.register(mockSubsystem('test'));

      await saveManager.save('slot1');
      const deleteResult = await saveManager.deleteSlot('slot1');

      expect(deleteResult.ok).toBe(true);

      const listResult = await saveManager.listSlots();
      if (listResult.ok) {
        expect(listResult.value.length).toBe(0);
      }
    });

    test('deleteSlot returns error for non-existent slot', async () => {
      const result = await saveManager.deleteSlot('nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.SlotNotFound);
      }
    });

    test('autoSave uses default slot name', async () => {
      saveManager.register(mockSubsystem('test'));

      const result = await saveManager.autoSave();
      expect(result.ok).toBe(true);

      const listResult = await saveManager.listSlots();
      if (listResult.ok) {
        const autosaveSlot = listResult.value.find(s => s.slot === 'autosave');
        expect(autosaveSlot).toBeDefined();
      }
    });
  });

  describe('Validation', () => {
    test('rejects invalid slot names', async () => {
      saveManager.register(mockSubsystem('test'));

      const result = await saveManager.save('invalid slot!');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.InvalidSlot);
      }
    });

    test('rejects empty slot name', async () => {
      const result = await saveManager.save('');
      expect(result.ok).toBe(false);
    });

    test('accepts valid slot names', async () => {
      saveManager.register(mockSubsystem('test'));

      const validNames = ['save1', 'my-save', 'save_slot', 'SLOT123'];

      for (const name of validNames) {
        const result = await saveManager.save(name);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('Versioning', () => {
    test('load rejects unsupported version', async () => {
      await store.write('future', JSON.stringify({
        version: 'v99',
        timestamp: new Date().toISOString(),
        subsystems: {},
      }));

      const result = await saveManager.load('future');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.UnsupportedVersion);
      }
    });

    test('serialize/deserialize preserves lastSaveISO', async () => {
      saveManager.register(mockSubsystem('test'));

      await saveManager.save('slot1');

      const serialized = saveManager.serialize();
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe('v1');
      expect(parsed.state.lastSaveISO).not.toBeNull();

      const mgr2 = new SaveManager(makeLogger({ enabled: false }), makeRng(123));
      await mgr2.initialize();

      const deserializeResult = mgr2.deserialize(serialized);
      expect(deserializeResult.ok).toBe(true);

      const stats = mgr2.getDebugStats();
      expect(stats?.lastSaveISO).toBe(parsed.state.lastSaveISO);

      await mgr2.destroy();
    });
  });

  describe('Error Handling', () => {
    test('load returns slot-not-found for missing slot', async () => {
      const result = await saveManager.load('nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.SlotNotFound);
      }
    });

    test('load returns invalid-envelope for corrupted data', async () => {
      await store.write('corrupt', 'not valid json');

      const result = await saveManager.load('corrupt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.InvalidEnvelope);
      }
    });

    test('skips unregistered subsystems during load', async () => {
      await store.write('slot1', JSON.stringify({
        version: 'v1',
        timestamp: new Date().toISOString(),
        subsystems: {
          unknown: '{}',
        },
      }));

      const result = await saveManager.load('slot1');

      expect(result.ok).toBe(true); // Doesn't fail, just skips
    });
  });

  describe('Concurrency', () => {
    test('concurrent saves serialize', async () => {
      saveManager.register(mockSubsystem('test'));

      const operations = Array.from({ length: 10 }, (_, i) =>
        saveManager.save(`slot${i}`)
      );

      const results = await Promise.all(operations);
      expect(results.every(r => r.ok)).toBe(true);

      const stats = saveManager.getDebugStats();
      expect(stats?.queuePending).toBe(0);
    });

    test('save-load cycle is atomic', async () => {
      let counter = 0;

      saveManager.register({
        name: 'test',
        serialize: () => JSON.stringify({ counter }),
        deserialize: json => {
          const data = JSON.parse(json) as { counter: number };
          counter = data.counter;
          return ok(undefined);
        },
      });

      counter = 42;
      await saveManager.save('slot1');

      counter = 0;
      await saveManager.load('slot1');

      expect(counter).toBe(42);
    });
  });

  describe('Debug Stats', () => {
    test('returns stats in test environment', () => {
      const stats = saveManager.getDebugStats();
      expect(stats).toBeDefined();
      expect(typeof stats?.queuePending).toBe('number');
      expect(typeof stats?.registered).toBe('number');
    });

    test('returns undefined in production', () => {
      process.env.NODE_ENV = 'production';
      const stats = saveManager.getDebugStats();
      expect(stats).toBeUndefined();
    });

    test('tracks registration count', () => {
      saveManager.register(mockSubsystem('r1'));
      saveManager.register(mockSubsystem('r2'));

      const stats = saveManager.getDebugStats();
      expect(stats?.registered).toBe(2);

      saveManager.unregister('r1');

      const stats2 = saveManager.getDebugStats();
      expect(stats2?.registered).toBe(1);
    });
  });

  describe('Abort Signal', () => {
    test('save respects abort', async () => {
      saveManager.register(mockSubsystem('test'));

      const controller = new AbortController();
      controller.abort();

      const result = await saveManager.save('slot1', controller.signal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.Aborted);
      }
    });

    test('load respects abort', async () => {
      saveManager.register(mockSubsystem('test'));
      await saveManager.save('slot1');

      const controller = new AbortController();
      controller.abort();

      const result = await saveManager.load('slot1', controller.signal);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_ERR.Aborted);
      }
    });

    test('deleteSlot respects abort', async () => {
      saveManager.register(mockSubsystem('test'));
      await saveManager.save('slot1');

      const controller = new AbortController();
      controller.abort();

      const result = await saveManager.deleteSlot('slot1', controller.signal);
      expect(result.ok).toBe(false);
    });
  });

  describe('Save-Load Cycle', () => {
    test('can validate save by loading separately', async () => {
      let applied = false;

      saveManager.register({
        name: 'test',
        serialize: () => '{"data":"test"}',
        deserialize: () => {
          applied = true;
          return ok(undefined);
        },
      });

      const saveResult = await saveManager.save('slot1');
      expect(saveResult.ok).toBe(true);

      const loadResult = await saveManager.load('slot1');
      expect(loadResult.ok).toBe(true);
      expect(applied).toBe(true);
    });
  });

  describe('Deterministic Ordering', () => {
    test('listSlots returns newest first', async () => {
      saveManager.register(mockSubsystem('test'));

      await saveManager.save('old');
      await new Promise(r => setTimeout(r, 20));
      await saveManager.save('new');

      const result = await saveManager.listSlots();

      if (result.ok) {
        expect(result.value[0].slot).toBe('new');
        expect(result.value[1].slot).toBe('old');
      }
    });

    test('ties broken by slot name alphabetically', async () => {
      saveManager.register(mockSubsystem('test'));

      // Write directly to store with same timestamp
      const timestamp = new Date().toISOString();
      const envelope = {
        version: 'v1',
        timestamp,
        subsystems: { test: '{}' },
      };

      await store.write('zebra', JSON.stringify(envelope));
      await store.write('apple', JSON.stringify(envelope));

      const result = await saveManager.listSlots();

      if (result.ok) {
        const sameTsSlots = result.value
          .filter(s => s.modified === timestamp)
          .map(s => s.slot);

        if (sameTsSlots.length === 2) {
          expect(sameTsSlots[0]).toBe('apple');
          expect(sameTsSlots[1]).toBe('zebra');
        }
      }
    });
  });

  describe('Reserved Keys', () => {
    test('_payload is reserved', () => {
      saveManager.register(mockSubsystem('_payload'));
      expect(saveManager.listRegistered()).not.toContain('_payload');
    });

    test('payload mode uses _payload internally', async () => {
      const data: SaveData = {
        version: 'v1',
        createdAt: new Date().toISOString(),
        systems: { test: true },
      };

      await saveManager.saveWithData('slot1', data);

      const loadResult = await saveManager.load('slot1', undefined, { apply: false });

      if (loadResult.ok) {
        expect(loadResult.value.subsystems).toHaveProperty('_payload');
      }
    });
  });
});

