/*
 * EconomyManager: Manages currency, items, shops, and loot.
 * 
 * Features (v1):
 * - Single currency type (gold, 0 to 999,999,999)
 * - Item inventory per player (max 100 items)
 * - Shop system with stock/pricing
 * - Deterministic loot rolls via RNG (single-drop, first-match)
 * - Battle reward distribution
 * - Atomic transactions with rollback
 */

import { SystemTemplate } from '../core/SystemTemplate.js';
import type { IRng } from '../util/Rng.js';
import type { ILogger } from '../util/Logger.js';
import type { IAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { validate } from '../validation/validate.js';
import {
  ItemSchema,
  ItemDropSchema,
  CurrencyModSchema,
} from './EconomyValidator.js';
import {
  type IEconomySystem,
  type Currency,
  type Item,
  type ItemDrop,
  type ShopInventory,
  type PlayerInventory,
} from '../types/contracts.js';

export interface IEconomyManager extends IEconomySystem {
  readonly name: string;
  initialize(): Promise<Result<void, Error>>;
  update(deltaTime: number): Promise<Result<void, Error>>;
  destroy(): Promise<void>;
  getDebugStats(): {
    queuePending: number;
    playerCount: number;
    totalGold: number;
    totalItems: number;
  } | undefined;
}

/**
 * EconomyManager implementation
 */
export class EconomyManager extends SystemTemplate implements IEconomyManager {
  private readonly queue: IAsyncQueue;

  private playerCurrency = new Map<string, Currency>();
  private playerInventories = new Map<string, Item[]>();
  private shopStock = new Map<string, ShopInventory>();
  private itemCatalog = new Map<string, Item>();

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'Economy' });
    this.queue = makeAsyncQueue();
  }

  // ========================================
  // Test-Only Debug Hook
  // ========================================

  public getDebugStats(): {
    queuePending: number;
    playerCount: number;
    totalGold: number;
    totalItems: number;
  } | undefined {
    if (process.env.NODE_ENV !== 'test') return undefined;

    let totalGold = 0;
    let totalItems = 0;

    for (const currency of this.playerCurrency.values()) {
      totalGold += currency.gold;
    }

    for (const inventory of this.playerInventories.values()) {
      totalItems += inventory.length;
    }

    return {
      queuePending: this.queue.pending,
      playerCount: this.playerCurrency.size,
      totalGold,
      totalItems,
    };
  }

  // ========================================
  // Currency Management
  // ========================================

  public async modifyCurrency(
    playerId: string,
    delta: number,
    signal?: AbortSignal
  ): Promise<Result<Currency, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        return this._modifyCurrencyInternal(playerId, delta);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:currency_modify_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getCurrency(playerId: string): Currency {
    return this.playerCurrency.get(playerId) || { gold: 0 };
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

  public getInventory(playerId: string): PlayerInventory {
    return {
      currency: this.getCurrency(playerId),
      items: this.playerInventories.get(playerId) || [],
    };
  }

  // ========================================
  // Shop System
  // ========================================

  public async purchaseItem(
    playerId: string,
    itemId: string,
    signal?: AbortSignal
  ): Promise<Result<Item, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const shopItem = this.shopStock.get(itemId);
        if (!shopItem) return err('item-not-in-shop');
        if (shopItem.stock === 0) return err('out-of-stock');

        const currency = this.getCurrency(playerId);
        if (currency.gold < shopItem.price) return err('insufficient-funds');

        const item = this.itemCatalog.get(itemId);
        if (!item) return err('item-not-found-in-catalog');

        const currencyResult = this._modifyCurrencyInternal(playerId, -shopItem.price);
        if (!currencyResult.ok) {
          return currencyResult as Result<Item, string>;
        }

        const grantResult = this._grantItemInternal(playerId, item);
        if (!grantResult.ok) {
          this._modifyCurrencyInternal(playerId, shopItem.price);
          return grantResult as Result<Item, string>;
        }

        if (shopItem.stock > 0) {
          this.shopStock.set(itemId, {
            ...shopItem,
            stock: shopItem.stock - 1,
          });
        }

        this.log.info('economy:item_purchased', { playerId, itemId, price: shopItem.price });
        return ok(item);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:purchase_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public async sellItem(
    playerId: string,
    itemId: string,
    signal?: AbortSignal
  ): Promise<Result<number, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const inventory = this.playerInventories.get(playerId) || [];
        const item = inventory.find(i => i.id === itemId);
        if (!item) return err('item-not-in-inventory');

        const sellPrice = Math.floor(item.value / 2);

        const removeResult = this._removeItemInternal(playerId, itemId);
        if (!removeResult.ok) {
          return removeResult as Result<number, string>;
        }

        const currencyResult = this._modifyCurrencyInternal(playerId, sellPrice);
        if (!currencyResult.ok) {
          this._grantItemInternal(playerId, item);
          return currencyResult as Result<number, string>;
        }

        this.log.info('economy:item_sold', { playerId, itemId, sellPrice });
        return ok(sellPrice);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:sell_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  public getShopInventory(): readonly ShopInventory[] {
    return Array.from(this.shopStock.values());
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
          const validation = validate(ItemDropSchema, drop);
          if (!validation.ok) {
            return err(`invalid-drop-table: ${validation.error.message}`);
          }
        }

        for (const drop of dropTable) {
          const roll = this.rng.int(1, 100);
          if (roll <= drop.probability) {
            const item = this.itemCatalog.get(drop.itemId);
            if (!item) return err('drop-item-not-in-catalog');

            this.log.info('economy:loot_rolled', { itemId: drop.itemId, roll });
            return ok(item);
          }
        }

        this.log.info('economy:loot_rolled', { result: 'no-drop' });
        return ok(null);
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:loot_roll_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  // ========================================
  // Battle Integration
  // ========================================

  public async awardBattleReward(
    playerId: string,
    goldReward: number,
    itemDrops: ItemDrop[],
    signal?: AbortSignal
  ): Promise<Result<{ gold: number; items: Item[] }, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');

        const items: Item[] = [];

        const currencyResult = this._modifyCurrencyInternal(playerId, goldReward);
        if (!currencyResult.ok) {
          return currencyResult as Result<{ gold: number; items: Item[] }, string>;
        }

        for (const drop of itemDrops) {
          const roll = this.rng.int(1, 100);
          if (roll <= drop.probability) {
            const item = this.itemCatalog.get(drop.itemId);
            if (item) {
              const grantResult = this._grantItemInternal(playerId, item);
              if (grantResult.ok) {
                items.push(item);
              } else {
                this.log.warn('economy:loot_grant_failed', { error: grantResult.error });
              }
            }
          }
        }

        this.log.info('economy:battle_reward_awarded', {
          playerId,
          gold: goldReward,
          itemsDropped: items.length,
        });

        return ok({ gold: goldReward, items });
      }, { signal });
    } catch (e: unknown) {
      const error = e as { name?: string; message?: string };
      if (error?.name === 'AbortError') return err('aborted');
      this.log.error('economy:award_reward_failed', { error: error?.message });
      return err('internal-error');
    }
  }

  // ========================================
  // SystemTemplate Lifecycle
  // ========================================

  protected async onInitialize(): Promise<void> {
    this.initializeDefaultShop();
    this.log.info('economy:init', {});
  }

  protected async onUpdate(_deltaTime: number): Promise<void> {
    // Economy system is passive
  }

  protected async onDestroy(): Promise<void> {
    const playerCount = this.playerCurrency.size;
    const itemCount = Array.from(this.playerInventories.values()).reduce(
      (sum, inv) => sum + inv.length,
      0
    );

    this.playerCurrency.clear();
    this.playerInventories.clear();
    this.shopStock.clear();
    this.itemCatalog.clear();

    this.log.info('economy:destroy', { playersCleared: playerCount, itemsCleared: itemCount });
  }

  // ========================================
  // Internal Methods (NO queue)
  // ========================================

  private _modifyCurrencyInternal(playerId: string, delta: number): Result<Currency, string> {
    const validation = validate(CurrencyModSchema, { playerId, delta });
    if (!validation.ok) {
      return err(`invalid-params: ${validation.error.message}`);
    }

    const current = this.playerCurrency.get(playerId) || { gold: 0 };
    const newGold = current.gold + delta;

    if (newGold < 0) return err('insufficient-funds');
    if (newGold > 999999999) return err('currency-overflow');

    const newCurrency: Currency = { gold: newGold };
    this.playerCurrency.set(playerId, newCurrency);

    return ok(newCurrency);
  }

  private _grantItemInternal(playerId: string, item: Item): Result<void, string> {
    const validation = validate(ItemSchema, item);
    if (!validation.ok) {
      return err(`invalid-item: ${validation.error.message}`);
    }

    const inventory = this.playerInventories.get(playerId) || [];

    if (inventory.length >= 100) return err('inventory-full');

    this.playerInventories.set(playerId, [...inventory, item]);
    return ok(undefined);
  }

  private _removeItemInternal(playerId: string, itemId: string): Result<void, string> {
    const inventory = this.playerInventories.get(playerId) || [];
    const itemIndex = inventory.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return err('item-not-found');

    const newInventory = [
      ...inventory.slice(0, itemIndex),
      ...inventory.slice(itemIndex + 1),
    ];
    this.playerInventories.set(playerId, newInventory);

    return ok(undefined);
  }

  private initializeDefaultShop(): void {
    const sword: Item = {
      id: 'iron_sword',
      name: 'Iron Sword',
      type: 'weapon',
      value: 100,
      stats: { atkBonus: 10 },
    };

    const shield: Item = {
      id: 'wooden_shield',
      name: 'Wooden Shield',
      type: 'armor',
      value: 80,
      stats: { defBonus: 5 },
    };

    const potion: Item = {
      id: 'health_potion',
      name: 'Health Potion',
      type: 'consumable',
      value: 50,
      stats: { hpRestore: 50 },
    };

    this.itemCatalog.set(sword.id, sword);
    this.itemCatalog.set(shield.id, shield);
    this.itemCatalog.set(potion.id, potion);

    this.shopStock.set(sword.id, { itemId: sword.id, stock: 10, price: 100 });
    this.shopStock.set(shield.id, { itemId: shield.id, stock: 10, price: 80 });
    this.shopStock.set(potion.id, { itemId: potion.id, stock: -1, price: 50 });
  }
}

