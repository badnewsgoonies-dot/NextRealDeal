import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionEconomyManager } from '../../../src/economy/ProgressionEconomyManager.js';
import { ConsoleLogger } from '../../../src/util/Logger.js';
import { makeRng } from '../../../src/util/Rng.js';
import type {
  ExperienceGain,
  UpgradeGain,
  EnhancementCost,
  ProgressionReward,
  Item,
} from '../../../src/types/contracts.js';

describe('ProgressionEconomyManager', () => {
  let economyManager: ProgressionEconomyManager;
  let logger: ConsoleLogger;

  beforeEach(async () => {
    logger = new ConsoleLogger('error');
    economyManager = new ProgressionEconomyManager(logger, makeRng(12345));
    await economyManager.initialize();
  });

  describe('Progression Currency', () => {
    it('initializes with zero progression currency', () => {
      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.experience).toBe(0);
      expect(currency.upgradePoints).toBe(0);
      expect(currency.skillPoints).toBe(0);
    });

    it('grants experience with multipliers', async () => {
      const experience: ExperienceGain = {
        source: 'battle',
        amount: 100,
        multiplier: 1.5,
      };

      const result = await economyManager.grantExperience('player1', experience);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value).toBe(150); // 100 * 1.5
      }

      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.experience).toBe(150);
    });

    it('grants upgrade points', async () => {
      const upgrade: UpgradeGain = {
        source: 'battle',
        amount: 5,
        type: 'upgrade_points',
      };

      const result = await economyManager.grantUpgradeCurrency('player1', upgrade);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value).toBe(5);
      }

      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.upgradePoints).toBe(5);
    });

    it('grants skill points', async () => {
      const upgrade: UpgradeGain = {
        source: 'quest',
        amount: 3,
        type: 'skill_points',
      };

      const result = await economyManager.grantUpgradeCurrency('player1', upgrade);
      expect(result.ok).toBe(true);

      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.skillPoints).toBe(3);
    });
  });

  describe('Spending Upgrade Points', () => {
    it('spends upgrade points and experience', async () => {
      // Grant currency first
      await economyManager.grantExperience('player1', {
        source: 'battle',
        amount: 200,
        multiplier: 1.0,
      });
      await economyManager.grantUpgradeCurrency('player1', {
        source: 'battle',
        amount: 10,
        type: 'upgrade_points',
      });

      const cost: EnhancementCost = {
        upgradePoints: 5,
        experience: 50,
      };

      const result = await economyManager.spendUpgradePoints('player1', cost);
      expect(result.ok).toBe(true);

      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.upgradePoints).toBe(5); // 10 - 5
      expect(currency.experience).toBe(150); // 200 - 50
    });

    it('rejects spending with insufficient upgrade points', async () => {
      const cost: EnhancementCost = {
        upgradePoints: 10,
        experience: 0,
      };

      const result = await economyManager.spendUpgradePoints('player1', cost);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('insufficient-upgrade-points');
      }
    });

    it('rejects spending with insufficient experience', async () => {
      await economyManager.grantUpgradeCurrency('player1', {
        source: 'battle',
        amount: 20,
        type: 'upgrade_points',
      });

      const cost: EnhancementCost = {
        upgradePoints: 5,
        experience: 100,
      };

      const result = await economyManager.spendUpgradePoints('player1', cost);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('insufficient-experience');
      }
    });

    it('spends with material requirements', async () => {
      // Grant currency and materials
      await economyManager.grantUpgradeCurrency('player1', {
        source: 'battle',
        amount: 10,
        type: 'upgrade_points',
      });
      await economyManager.grantItem('player1', {
        id: 'iron_ore',
        name: 'Iron Ore',
        type: 'consumable',
        value: 0,
      });

      const cost: EnhancementCost = {
        upgradePoints: 5,
        experience: 0,
        materials: ['iron_ore'],
      };

      const result = await economyManager.spendUpgradePoints('player1', cost);
      expect(result.ok).toBe(true);

      // Check material was consumed
      const inventory = economyManager.getProgressionInventory('player1');
      expect(inventory.items.find(i => i.id === 'iron_ore')).toBeUndefined();
    });

    it('rejects spending with missing materials', async () => {
      await economyManager.grantUpgradeCurrency('player1', {
        source: 'battle',
        amount: 10,
        type: 'upgrade_points',
      });

      const cost: EnhancementCost = {
        upgradePoints: 5,
        experience: 0,
        materials: ['missing_material'],
      };

      const result = await economyManager.spendUpgradePoints('player1', cost);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('missing-required-material');
      }
    });
  });

  describe('Progression Rewards', () => {
    it('awards combined progression reward', async () => {
      const reward: ProgressionReward = {
        experience: {
          source: 'battle',
          amount: 100,
          multiplier: 2.0,
        },
        upgrades: [
          { source: 'battle', amount: 5, type: 'upgrade_points' },
          { source: 'battle', amount: 2, type: 'skill_points' },
        ],
        items: [
          { itemId: 'health_potion', probability: 100 },
        ],
      };

      const result = await economyManager.awardProgressionReward('player1', reward);
      expect(result.ok).toBe(true);

      const currency = economyManager.getProgressionCurrency('player1');
      expect(currency.experience).toBe(200); // 100 * 2.0
      expect(currency.upgradePoints).toBe(5);
      expect(currency.skillPoints).toBe(2);
    });
  });

  describe('Item Management', () => {
    it('grants items to player', async () => {
      const item: Item = {
        id: 'sword1',
        name: 'Iron Sword',
        type: 'weapon',
        value: 100,
      };

      const result = await economyManager.grantItem('player1', item);
      expect(result.ok).toBe(true);

      const inventory = economyManager.getProgressionInventory('player1');
      expect(inventory.items).toHaveLength(1);
      expect(inventory.items[0].id).toBe('sword1');
    });

    it('removes items from inventory', async () => {
      const item: Item = {
        id: 'potion1',
        name: 'Health Potion',
        type: 'consumable',
        value: 50,
      };

      await economyManager.grantItem('player1', item);
      const removeResult = await economyManager.removeItem('player1', 'potion1');
      expect(removeResult.ok).toBe(true);

      const inventory = economyManager.getProgressionInventory('player1');
      expect(inventory.items).toHaveLength(0);
    });

    it('rejects inventory overflow', async () => {
      // Fill inventory to max (100 items)
      for (let i = 0; i < 100; i++) {
        await economyManager.grantItem('player1', {
          id: `item_${i}`,
          name: `Item ${i}`,
          type: 'consumable',
          value: 0,
        });
      }

      // Try to add one more
      const result = await economyManager.grantItem('player1', {
        id: 'overflow',
        name: 'Overflow',
        type: 'consumable',
        value: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('inventory-full');
      }
    });
  });

  describe('Loot System', () => {
    it('rolls for loot drops', async () => {
      const dropTable = [
        { itemId: 'rare_item', probability: 100 }, // Guaranteed drop
      ];

      const result = await economyManager.rollLoot(dropTable);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value?.id).toBe('rare_item');
      }
    });

    it('returns null when no drops succeed', async () => {
      const dropTable = [
        { itemId: 'ultra_rare', probability: 0 }, // Never drops
      ];

      const result = await economyManager.rollLoot(dropTable);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('Legacy System Errors', () => {
    it('rejects legacy currency modification', async () => {
      const result = await economyManager.modifyCurrency('player1', 100);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('legacy-currency-not-supported');
      }
    });

    it('returns zero gold for legacy getCurrency', () => {
      const currency = economyManager.getCurrency('player1');
      expect(currency.gold).toBe(0);
    });

    it('rejects shop purchases', async () => {
      const result = await economyManager.purchaseItem('player1', 'some_item');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('shop-system-disabled');
      }
    });

    it('rejects item selling', async () => {
      const result = await economyManager.sellItem('player1', 'some_item');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('shop-system-disabled');
      }
    });

    it('returns empty shop inventory', () => {
      const shop = economyManager.getShopInventory();
      expect(shop).toHaveLength(0);
    });

    it('rejects legacy battle rewards', async () => {
      const result = await economyManager.awardBattleReward('player1', 100, []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('use-awardProgressionReward-instead');
      }
    });
  });

  describe('Debug Stats', () => {
    it('tracks progression currency and items', async () => {
      await economyManager.grantExperience('player1', {
        source: 'battle',
        amount: 100,
        multiplier: 1.0,
      });
      await economyManager.grantItem('player1', {
        id: 'item1',
        name: 'Item 1',
        type: 'consumable',
        value: 0,
      });

      const stats = economyManager.getDebugStats();
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.playerCount).toBe(1);
        expect(stats.totalExperience).toBe(100);
        expect(stats.totalItems).toBe(1);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains IEconomySystem interface', async () => {
      // Can still call getInventory
      const inventory = economyManager.getInventory('player1');
      expect(inventory).toBeDefined();
      expect(inventory.currency.gold).toBe(0);
      expect(inventory.items).toHaveLength(0);
    });
  });
});
