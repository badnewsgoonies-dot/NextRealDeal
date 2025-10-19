/*
 * ProgressionEconomyManager: Progression-focused economy system.
 * 
 * Features:
 * - Experience as primary progression currency
 * - Upgrade points for equipment enhancement
 * - Skill points for character progression
 * - Item drops (no shops/commerce)
 * - Progression rewards (combined XP + currency + items)
 * - NO buying/selling functionality
 */

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import { ItemSchema, ItemDropSchema } from './EconomyValidator.js';
import {
  type IEconomySystem,
  type Currency,
  type Item,
  type ItemDrop,
  type ShopInventory,
  type PlayerInventory,
  type ProgressionCurrency,
  type ExperienceGain,
  type UpgradeGain,
  type EnhancementCost,
  type ProgressionReward,
  type ProgressionInventory,
} from '../types/contracts.js';

export interface IProgressionEconomyManager extends IEconomySystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  
  // Progression currency (new primary methods)
  getProgressionCurrency(playerId: string): ProgressionCurrency;
  grantExperience(playerId: string, experience: ExperienceGain, signal?: AbortSignal): Promise<Result<number, string>>;
  grantUpgradeCurrency(playerId: string, upgrade: UpgradeGain, signal?: AbortSignal): Promise<Result<number, string>>;
  spendUpgradePoints(playerId: string, cost: EnhancementCost, signal?: AbortSignal): Promise<Result<void, string>>;
  awardProgressionReward(playerId: string, reward: ProgressionReward, signal?: AbortSignal): Promise<Result<void, string>>;
  getProgressionInventory(playerId: string): ProgressionInventory;
  
  getDebugStats(): {
    queuePending: number;
    playerCount: number;
    totalExperience: number;
    totalItems: number;
  } | undefined;
}

/**
 * ProgressionEconomyManager implementation
 */
export class ProgressionEconomyManager extends SystemTemplate implements IProgressionEconomyManager {
  private readonly queue: IAsyncQueue;

  private playerCurrency = new Map<string, ProgressionCurrency>();
  private playerInventories = new Map<string, Item[]>();

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'ProgressionEconomy' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): {
    queuePending: number;
    playerCount: number;
    totalExperience: number;
    totalItems: number;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;

    let totalExperience = 0;
    let totalItems = 0;

    for (const currency of this.playerCurrency.values()) {
      totalExperience += currency.experience;
    }

    for (const inventory of this.playerInventories.values()) {
      totalItems += inventory.length;
    }

    // Count unique players (those with currency OR inventory)
    const allPlayerIds = new Set([
      ...this.playerCurrency.keys(),
      ...this.playerInventories.keys(),
    ]);

    return {
      queuePending: this.queue.pending,
      playerCount: allPlayerIds.size,
      totalExperience,
      totalItems,
    };
  }

  // ========================================
  // Progression Currency Management
  // ========================================

  public getProgressionCurrency(playerId: string): ProgressionCurrency {
    return this.playerCurrency.get(playerId) || {
      experience: 0,
      upgradePoints: 0,
      skillPoints: 0,
    };
  }

  public async grantExperience(
    playerId: string,
    experience: ExperienceGain,
    signal?: AbortSignal
  ): Promise<Result<number, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this._grantExperienceInternal(playerId, experience);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:grant_experience_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private _grantExperienceInternal(playerId: string, experience: ExperienceGain): Result<number, string> {
    const current = this.getProgressionCurrency(playerId);
    const totalGain = Math.floor(experience.amount * experience.multiplier);
    const newExperience = current.experience + totalGain;

    this.playerCurrency.set(playerId, {
      ...current,
      experience: newExperience,
    });

    this.log.info('economy:experience_granted', {
      playerId,
      source: experience.source,
      amount: experience.amount,
      multiplier: experience.multiplier,
      totalGain,
    });

    return ok(newExperience);
  }

  public async grantUpgradeCurrency(
    playerId: string,
    upgrade: UpgradeGain,
    signal?: AbortSignal
  ): Promise<Result<number, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this._grantUpgradeCurrencyInternal(playerId, upgrade);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:grant_upgrade_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private _grantUpgradeCurrencyInternal(playerId: string, upgrade: UpgradeGain): Result<number, string> {
    const current = this.getProgressionCurrency(playerId);
    
    if (upgrade.type === 'upgrade_points') {
      const newPoints = current.upgradePoints + upgrade.amount;
      this.playerCurrency.set(playerId, {
        ...current,
        upgradePoints: newPoints,
      });
      this.log.info('economy:upgrade_points_granted', { playerId, amount: upgrade.amount, source: upgrade.source });
      return ok(newPoints);
    } else {
      const newPoints = current.skillPoints + upgrade.amount;
      this.playerCurrency.set(playerId, {
        ...current,
        skillPoints: newPoints,
      });
      this.log.info('economy:skill_points_granted', { playerId, amount: upgrade.amount, source: upgrade.source });
      return ok(newPoints);
    }
  }

  public async spendUpgradePoints(
    playerId: string,
    cost: EnhancementCost,
    signal?: AbortSignal
  ): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const current = this.getProgressionCurrency(playerId);

        if (current.upgradePoints < cost.upgradePoints) {
          return err('insufficient-upgrade-points');
        }

        if (current.experience < cost.experience) {
          return err('insufficient-experience');
        }

        // Check materials if required
        if (cost.materials && cost.materials.length > 0) {
          const inventory = this.playerInventories.get(playerId) || [];
          for (const materialId of cost.materials) {
            if (!inventory.find(item => item.id === materialId)) {
              return err('missing-required-material');
            }
          }

          // Remove materials
          for (const materialId of cost.materials) {
            const removeResult = this._removeItemInternal(playerId, materialId);
            if (!removeResult.ok) {
              return err('material-removal-failed');
            }
          }
        }

        // Spend currency
        this.playerCurrency.set(playerId, {
          ...current,
          upgradePoints: current.upgradePoints - cost.upgradePoints,
          experience: current.experience - cost.experience,
        });

        this.log.info('economy:upgrade_points_spent', {
          playerId,
          upgradePoints: cost.upgradePoints,
          experience: cost.experience,
        });

        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:spend_upgrade_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public async awardProgressionReward(
    playerId: string,
    reward: ProgressionReward,
    signal?: AbortSignal
  ): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        // Grant experience
        const expResult = this._grantExperienceInternal(playerId, reward.experience);
        if (!expResult.ok) return err(expResult.error);

        // Grant upgrade currency
        for (const upgrade of reward.upgrades) {
          const upgradeResult = this._grantUpgradeCurrencyInternal(playerId, upgrade);
          if (!upgradeResult.ok) return err(upgradeResult.error);
        }

        // Roll for item drops
        for (const drop of reward.items) {
          const rollResult = await this._rollLootInternal(drop);
          if (rollResult.ok && rollResult.value) {
            const grantResult = this._grantItemInternal(playerId, rollResult.value);
            if (!grantResult.ok) {
              this.log.warn('economy:item_grant_failed_in_reward', { playerId, itemId: drop.itemId });
            }
          }
        }

        this.log.info('economy:progression_reward_awarded', { playerId });
        return ok(undefined);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:award_progression_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getProgressionInventory(playerId: string): ProgressionInventory {
    return {
      currency: this.getProgressionCurrency(playerId),
      items: this.playerInventories.get(playerId) || [],
    };
  }

  // ========================================
  // Legacy Currency Management (Compatibility)
  // ========================================

  public async modifyCurrency(
    _playerId: string,
    _delta: number,
    _signal?: AbortSignal
  ): Promise<Result<Currency, string>> {
    return err('legacy-currency-not-supported');
  }

  public getCurrency(_playerId: string): Currency {
    return { gold: 0 };
  }

  // ========================================
  // Item Management
  // ========================================

  public async grantItem(
    playerId: string,
    item: Item,
    signal?: AbortSignal
  ): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        const result = this._grantItemInternal(playerId, item);
        if (result.ok) {
          this.log.info('economy:item_granted', { playerId, itemId: item.id });
        }
        return result;
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:grant_item_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private _grantItemInternal(playerId: string, item: Item): Result<void, string> {
    const itemResult = validate(ItemSchema, item);
    if (!itemResult.ok) {
      return err(`invalid-item: ${itemResult.error.message}`);
    }

    const inventory = this.playerInventories.get(playerId) || [];
    if (inventory.length >= 100) {
      return err('inventory-full');
    }

    this.playerInventories.set(playerId, [...inventory, item]);
    return ok(undefined);
  }

  public async removeItem(
    playerId: string,
    itemId: string,
    signal?: AbortSignal
  ): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        const result = this._removeItemInternal(playerId, itemId);
        if (result.ok) {
          this.log.info('economy:item_removed', { playerId, itemId });
        }
        return result;
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:remove_item_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private _removeItemInternal(playerId: string, itemId: string): Result<void, string> {
    const inventory = this.playerInventories.get(playerId);
    if (!inventory) return err('player-has-no-inventory');

    const itemIndex = inventory.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return err('item-not-in-inventory');

    const updated = inventory.filter((_, idx) => idx !== itemIndex);
    this.playerInventories.set(playerId, updated);
    return ok(undefined);
  }

  public getInventory(playerId: string): PlayerInventory {
    return {
      currency: { gold: 0 },
      items: this.playerInventories.get(playerId) || [],
    };
  }

  // ========================================
  // Legacy Shop System (Returns Errors)
  // ========================================

  public async purchaseItem(
    _playerId: string,
    _itemId: string,
    _signal?: AbortSignal
  ): Promise<Result<Item, string>> {
    return err('shop-system-disabled');
  }

  public async sellItem(
    _playerId: string,
    _itemId: string,
    _signal?: AbortSignal
  ): Promise<Result<number, string>> {
    return err('shop-system-disabled');
  }

  public getShopInventory(): readonly ShopInventory[] {
    return [];
  }

  // ========================================
  // Loot System
  // ========================================

  public async rollLoot(
    dropTable: ItemDrop[],
    signal?: AbortSignal
  ): Promise<Result<Item | null, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        for (const drop of dropTable) {
          const result = await this._rollLootInternal(drop);
          if (result.ok && result.value) {
            return ok(result.value);
          }
        }

        return ok(null);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:roll_loot_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  private async _rollLootInternal(drop: ItemDrop): Promise<Result<Item | null, string>> {
    const dropResult = validate(ItemDropSchema, drop);
    if (!dropResult.ok) {
      return err(`invalid-drop: ${dropResult.error.message}`);
    }

    const roll = this.rng.int(1, 100);
    if (roll <= drop.probability) {
      // For testing, create a simple item
      const item: Item = {
        id: drop.itemId,
        name: drop.itemId,
        type: 'consumable',
        value: 0,
      };
      return ok(item);
    }

    return ok(null);
  }

  // ========================================
  // Legacy Battle Rewards (Returns Error)
  // ========================================

  public async awardBattleReward(
    _playerId: string,
    _goldReward: number,
    _itemDrops: ItemDrop[],
    _signal?: AbortSignal
  ): Promise<Result<{ gold: number; items: Item[] }, string>> {
    return err('use-awardProgressionReward-instead');
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.log.info('progression-economy:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {}

  protected async onDestroy(): Promise<void> {
    this.playerCurrency.clear();
    this.playerInventories.clear();
    this.log.info('progression-economy:destroy', {});
  }
}
