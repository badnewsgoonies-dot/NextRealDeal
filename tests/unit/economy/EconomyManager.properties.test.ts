import { describe, test, expect } from 'vitest';
import { EconomyManager } from '../../../src/economy/EconomyManager.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import fc from 'fast-check';

describe('EconomyManager Property-Based Tests', () => {
  test('currency never goes negative', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 10, maxLength: 50 }),
        async deltas => {
          const mgr = new EconomyManager(makeLogger({ enabled: false }), makeRng(999));
          await mgr.initialize();

          await mgr.modifyCurrency('player', 1000);

          for (const delta of deltas) {
            await mgr.modifyCurrency('player', delta);
          }

          const final = mgr.getCurrency('player');
          expect(final.gold).toBeGreaterThanOrEqual(0);

          await mgr.destroy();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('currency stays within bounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            player: fc.constantFrom('p1', 'p2', 'p3'),
            delta: fc.integer({ min: -1000, max: 1000 }),
          }),
          { minLength: 20, maxLength: 50 }
        ),
        async operations => {
          const mgr = new EconomyManager(makeLogger({ enabled: false }), makeRng(888));
          await mgr.initialize();

          await mgr.modifyCurrency('p1', 5000);
          await mgr.modifyCurrency('p2', 5000);
          await mgr.modifyCurrency('p3', 5000);

          for (const op of operations) {
            await mgr.modifyCurrency(op.player, op.delta);
          }

          const stats = mgr.getDebugStats();
          expect(stats?.totalGold).toBeGreaterThanOrEqual(0);
          expect(stats?.totalGold).toBeLessThanOrEqual(999999999);

          await mgr.destroy();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('inventory never exceeds 100 items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 5, maxLength: 10 }),
        async counts => {
          const mgr = new EconomyManager(makeLogger({ enabled: false }), makeRng(777));
          await mgr.initialize();

          let total = 0;
          for (const count of counts) {
            for (let i = 0; i < count && total < 105; i++) {
              await mgr.grantItem('player', {
                id: `item_${total}`,
                name: `Item ${total}`,
                type: 'consumable',
                value: 10,
              });
              total++;
            }
          }

          const inventory = mgr.getInventory('player');
          expect(inventory.items.length).toBeLessThanOrEqual(100);

          await mgr.destroy();
        }
      ),
      { numRuns: 20 }
    );
  });
});

