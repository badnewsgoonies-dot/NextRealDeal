import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EconomyManager } from '../../../src/economy/EconomyManager.js';
import { makeLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type { Item, ItemDrop } from '../../../src/types/contracts.js';

describe('EconomyManager', () => {
  let economyManager: EconomyManager;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const log = makeLogger({ enabled: false });
    const rng = makeRng(12345);

    economyManager = new EconomyManager(log, rng);
    const result = await economyManager.initialize();
    expect(result.ok).toBe(true);
  });

  afterEach(async () => {
    await economyManager.destroy();
    process.env.NODE_ENV = prevEnv;
  });

  // ========================================
  // Lifecycle Tests
  // ========================================

  describe('Lifecycle', () => {
    test('initializes successfully', async () => {
      const mgr = new EconomyManager(makeLogger({ enabled: false }), makeRng(123));
      const result = await mgr.initialize();
      expect(result.ok).toBe(true);
      await mgr.destroy();
    });

    test('destroys cleanly with count logging', async () => {
      await economyManager.modifyCurrency('player1', 100);
      await economyManager.grantItem('player1', {
        id: 'test',
        name: 'Test',
        type: 'weapon',
        value: 50,
      });

      await expect(economyManager.destroy()).resolves.not.toThrow();

      const stats = economyManager.getDebugStats();
      expect(stats?.totalGold).toBe(0);
      expect(stats?.totalItems).toBe(0);
    });
  });

  // ========================================
  // Currency Tests
  // ========================================

  describe('Currency Management', () => {
    test('adds currency to player', async () => {
      const result = await economyManager.modifyCurrency('player1', 100);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gold).toBe(100);
      }

      const currency = economyManager.getCurrency('player1');
      expect(currency.gold).toBe(100);
    });

    test('subtracts currency from player', async () => {
      await economyManager.modifyCurrency('player1', 100);
      const result = await economyManager.modifyCurrency('player1', -30);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gold).toBe(70);
      }
    });

    test('prevents negative balances', async () => {
      await economyManager.modifyCurrency('player1', 50);
      const result = await economyManager.modifyCurrency('player1', -100);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('insufficient-funds');
      }

      expect(economyManager.getCurrency('player1').gold).toBe(50);
    });

    test('prevents currency overflow', async () => {
      const result = await economyManager.modifyCurrency('player1', 1000000000);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('currency-overflow');
      }
    });

    test('getCurrency returns zero for new player', () => {
      const currency = economyManager.getCurrency('new_player');
      expect(currency.gold).toBe(0);
    });

    test('multiple players have independent currency', async () => {
      await economyManager.modifyCurrency('player1', 100);
      await economyManager.modifyCurrency('player2', 200);

      expect(economyManager.getCurrency('player1').gold).toBe(100);
      expect(economyManager.getCurrency('player2').gold).toBe(200);
    });
  });

  // ========================================
  // Item Management Tests
  // ========================================

  describe('Item Management', () => {
    const testItem: Item = {
      id: 'test_item',
      name: 'Test Item',
      type: 'weapon',
      value: 100,
      stats: { atkBonus: 5 },
    };

    test('grants item to player', async () => {
      const result = await economyManager.grantItem('player1', testItem);

      expect(result.ok).toBe(true);

      const inventory = economyManager.getInventory('player1');
      expect(inventory.items.length).toBe(1);
      expect(inventory.items[0].id).toBe('test_item');
    });

    test('removes item from player', async () => {
      await economyManager.grantItem('player1', testItem);
      const result = await economyManager.removeItem('player1', 'test_item');

      expect(result.ok).toBe(true);

      const inventory = economyManager.getInventory('player1');
      expect(inventory.items.length).toBe(0);
    });

    test('rejects removal of non-existent item', async () => {
      const result = await economyManager.removeItem('player1', 'fake_item');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('item-not-found');
      }
    });

    test('enforces inventory limit (100 items)', async () => {
      for (let i = 0; i < 100; i++) {
        await economyManager.grantItem('player1', {
          ...testItem,
          id: `item_${i}`,
        });
      }

      const result = await economyManager.grantItem('player1', {
        ...testItem,
        id: 'item_101',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('inventory-full');
      }
    });

    test('getInventory returns currency and items together', async () => {
      await economyManager.modifyCurrency('player1', 500);
      await economyManager.grantItem('player1', testItem);

      const inventory = economyManager.getInventory('player1');

      expect(inventory.currency.gold).toBe(500);
      expect(inventory.items.length).toBe(1);
      expect(inventory.items[0].id).toBe('test_item');
    });
  });

  // ========================================
  // Shop Tests
  // ========================================

  describe('Shop System', () => {
    test('purchases item from shop', async () => {
      await economyManager.modifyCurrency('player1', 200);
      const result = await economyManager.purchaseItem('player1', 'iron_sword');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('iron_sword');
        expect(result.value.name).toBe('Iron Sword');
      }

      expect(economyManager.getCurrency('player1').gold).toBe(100);

      const inventory = economyManager.getInventory('player1');
      expect(inventory.items.length).toBe(1);
      expect(inventory.items[0].id).toBe('iron_sword');
    });

    test('rejects purchase with insufficient funds', async () => {
      await economyManager.modifyCurrency('player1', 50);
      const result = await economyManager.purchaseItem('player1', 'iron_sword');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('insufficient-funds');
      }

      expect(economyManager.getCurrency('player1').gold).toBe(50);
      expect(economyManager.getInventory('player1').items.length).toBe(0);
    });

    test('decreases shop stock on purchase', async () => {
      await economyManager.modifyCurrency('player1', 1000);

      const initialStock = economyManager
        .getShopInventory()
        .find(s => s.itemId === 'iron_sword')?.stock;

      await economyManager.purchaseItem('player1', 'iron_sword');

      const newStock = economyManager
        .getShopInventory()
        .find(s => s.itemId === 'iron_sword')?.stock;

      expect(newStock).toBe((initialStock || 0) - 1);
    });

    test('infinite stock items never deplete', async () => {
      await economyManager.modifyCurrency('player1', 1000);

      for (let i = 0; i < 5; i++) {
        const result = await economyManager.purchaseItem('player1', 'health_potion');
        expect(result.ok).toBe(true);
      }

      const stock = economyManager
        .getShopInventory()
        .find(s => s.itemId === 'health_potion')?.stock;

      expect(stock).toBe(-1);
    });

    test('rejects purchase when out of stock', async () => {
      await economyManager.modifyCurrency('player1', 10000);

      for (let i = 0; i < 10; i++) {
        await economyManager.purchaseItem('player1', 'iron_sword');
      }

      const result = await economyManager.purchaseItem('player1', 'iron_sword');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('out-of-stock');
      }
    });

    test('sells item for 50% of value', async () => {
      const item: Item = {
        id: 'test_sword',
        name: 'Test Sword',
        type: 'weapon',
        value: 200,
      };

      await economyManager.grantItem('player1', item);
      const result = await economyManager.sellItem('player1', 'test_sword');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(100);
      }

      expect(economyManager.getCurrency('player1').gold).toBe(100);

      const inventory = economyManager.getInventory('player1');
      expect(inventory.items.length).toBe(0);
    });

    test('purchase rollback on grant failure', async () => {
      await economyManager.modifyCurrency('player1', 1000);

      for (let i = 0; i < 100; i++) {
        await economyManager.grantItem('player1', {
          id: `filler_${i}`,
          name: 'Filler',
          type: 'consumable',
          value: 1,
        });
      }

      const result = await economyManager.purchaseItem('player1', 'iron_sword');

      expect(result.ok).toBe(false);
      expect(economyManager.getCurrency('player1').gold).toBe(1000);
    });
  });

  // ========================================
  // Loot System Tests
  // ========================================

  describe('Loot System', () => {
    test('rolls loot with 100% probability', async () => {
      const dropTable: ItemDrop[] = [{ itemId: 'iron_sword', probability: 100 }];

      const result = await economyManager.rollLoot(dropTable);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value?.id).toBe('iron_sword');
      }
    });

    test('returns null with 0% probability', async () => {
      const dropTable: ItemDrop[] = [{ itemId: 'iron_sword', probability: 0 }];

      const result = await economyManager.rollLoot(dropTable);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    test('deterministic loot with same seed', async () => {
      const dropTable: ItemDrop[] = [{ itemId: 'iron_sword', probability: 50 }];

      const mgr1 = new EconomyManager(makeLogger({ enabled: false }), makeRng(999));
      const mgr2 = new EconomyManager(makeLogger({ enabled: false }), makeRng(999));

      await mgr1.initialize();
      await mgr2.initialize();

      const result1 = await mgr1.rollLoot(dropTable);
      const result2 = await mgr2.rollLoot(dropTable);

      expect(result1.ok && result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        if (result1.value === null) {
          expect(result2.value).toBeNull();
        } else {
          expect(result2.value?.id).toBe(result1.value.id);
        }
      }

      await mgr1.destroy();
      await mgr2.destroy();
    });

    test('first-match algorithm (single drop)', async () => {
      const dropTable: ItemDrop[] = [
        { itemId: 'iron_sword', probability: 0 },
        { itemId: 'wooden_shield', probability: 100 },
        { itemId: 'health_potion', probability: 100 },
      ];

      const result = await economyManager.rollLoot(dropTable);

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.id).toBe('wooden_shield');
      }
    });

    test('validates drop table items', async () => {
      const invalidDrop: ItemDrop[] = [{ itemId: 'nonexistent', probability: 100 }];

      const result = await economyManager.rollLoot(invalidDrop);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('catalog');
      }
    });
  });

  // ========================================
  // Battle Integration Tests
  // ========================================

  describe('Battle Rewards', () => {
    test('awards gold and items after battle', async () => {
      const dropTable: ItemDrop[] = [{ itemId: 'iron_sword', probability: 100 }];

      const result = await economyManager.awardBattleReward('player1', 500, dropTable);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gold).toBe(500);
        expect(result.value.items.length).toBeGreaterThanOrEqual(1);
        expect(result.value.items[0].id).toBe('iron_sword');
      }

      expect(economyManager.getCurrency('player1').gold).toBe(500);

      const inventory = economyManager.getInventory('player1');
      expect(inventory.items.length).toBe(1);
    });

    test('awards gold even when no loot drops', async () => {
      const dropTable: ItemDrop[] = [{ itemId: 'iron_sword', probability: 0 }];

      const result = await economyManager.awardBattleReward('player1', 300, dropTable);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gold).toBe(300);
        expect(result.value.items.length).toBe(0);
      }
    });

    test('handles multiple loot drops', async () => {
      const dropTable: ItemDrop[] = [
        { itemId: 'iron_sword', probability: 100 },
        { itemId: 'wooden_shield', probability: 100 },
      ];

      const result = await economyManager.awardBattleReward('player1', 100, dropTable);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items.length).toBe(2);
      }
    });
  });

  // ========================================
  // Concurrency Tests
  // ========================================

  describe('Concurrency', () => {
    test('concurrent currency modifications serialize', async () => {
      const operations = Array.from({ length: 20 }, () =>
        economyManager.modifyCurrency('player1', 10)
      );

      const results = await Promise.all(operations);
      const successCount = results.filter(r => r.ok).length;

      expect(successCount).toBe(20);

      const currency = economyManager.getCurrency('player1');
      expect(currency.gold).toBe(200);

      const stats = economyManager.getDebugStats();
      expect(stats?.queuePending).toBe(0);
    });

    test('concurrent purchases serialize (NO DEADLOCK)', async () => {
      await economyManager.modifyCurrency('player1', 10000);

      const operations = Array.from({ length: 10 }, () =>
        economyManager.purchaseItem('player1', 'health_potion')
      );

      const results = await Promise.all(operations);
      const successCount = results.filter(r => r.ok).length;

      expect(successCount).toBe(10);

      const stats = economyManager.getDebugStats();
      expect(stats?.queuePending).toBe(0);
    });

    test('mixed operations serialize correctly', async () => {
      await economyManager.modifyCurrency('player1', 1000);

      const ops = [
        economyManager.purchaseItem('player1', 'health_potion'),
        economyManager.modifyCurrency('player1', 50),
        economyManager.purchaseItem('player1', 'health_potion'),
        economyManager.modifyCurrency('player1', -20),
      ];

      await Promise.all(ops);

      const currency = economyManager.getCurrency('player1');
      expect(currency.gold).toBeGreaterThan(0);
    });
  });


  // ========================================
  // Debug Stats Tests
  // ========================================

  describe('Debug Stats', () => {
    test('returns stats in test environment', () => {
      const stats = economyManager.getDebugStats();
      expect(stats).toBeDefined();
      expect(stats?.queuePending).toBe(0);
      expect(stats?.playerCount).toBe(0);
      expect(stats?.totalGold).toBe(0);
      expect(stats?.totalItems).toBe(0);
    });

    test('returns undefined in production', () => {
      process.env.NODE_ENV = 'production';
      const stats = economyManager.getDebugStats();
      expect(stats).toBeUndefined();
    });

    test('aggregates totals correctly', async () => {
      await economyManager.modifyCurrency('p1', 100);
      await economyManager.modifyCurrency('p2', 200);
      await economyManager.grantItem('p1', {
        id: 'sword',
        name: 'Sword',
        type: 'weapon',
        value: 50,
      });

      const stats = economyManager.getDebugStats();
      expect(stats?.playerCount).toBe(2);
      expect(stats?.totalGold).toBe(300);
      expect(stats?.totalItems).toBe(1);
    });
  });

  // ========================================
  // Abort Signal Tests
  // ========================================

  describe('Abort Signal', () => {
    test('modifyCurrency respects abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await economyManager.modifyCurrency('player1', 100, controller.signal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('aborted');
      }
    });

    test('purchaseItem respects abort (no partial state)', async () => {
      await economyManager.modifyCurrency('player1', 1000);

      const controller = new AbortController();
      controller.abort();

      const result = await economyManager.purchaseItem('player1', 'iron_sword', controller.signal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('aborted');
      }

      expect(economyManager.getCurrency('player1').gold).toBe(1000);
      expect(economyManager.getInventory('player1').items.length).toBe(0);
    });

    test('rollLoot respects abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await economyManager.rollLoot(
        [{ itemId: 'iron_sword', probability: 100 }],
        controller.signal
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('aborted');
      }
    });

    test('awardBattleReward respects abort', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await economyManager.awardBattleReward(
        'player1',
        500,
        [],
        controller.signal
      );

      expect(result.ok).toBe(false);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================

  describe('Edge Cases', () => {
    test('handles empty inventory correctly', () => {
      const inventory = economyManager.getInventory('new_player');
      expect(inventory.currency.gold).toBe(0);
      expect(inventory.items.length).toBe(0);
    });

    test('handles zero gold reward', async () => {
      const result = await economyManager.awardBattleReward('player1', 0, []);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gold).toBe(0);
        expect(result.value.items.length).toBe(0);
      }
    });

    test('handles empty drop table', async () => {
      const result = await economyManager.rollLoot([]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    test('shop returns all configured items', () => {
      const shop = economyManager.getShopInventory();
      expect(shop.length).toBe(3);
      expect(shop.map(s => s.itemId).sort()).toEqual([
        'health_potion',
        'iron_sword',
        'wooden_shield',
      ]);
    });
  });
});

