/*
 * EconomyValidator: Validation schemas for economy system.
 * Uses Valibot for runtime validation of currency, items, and transactions.
 */

import * as v from 'valibot';

/**
 * Currency schema
 */
export const CurrencySchema = v.object({
  gold: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(999999999)
  ),
});

export type CurrencyInput = v.InferInput<typeof CurrencySchema>;
export type CurrencyOutput = v.InferOutput<typeof CurrencySchema>;

/**
 * Item schema
 */
export const ItemSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  type: v.picklist(['weapon', 'armor', 'accessory', 'consumable']),
  value: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999999)),
  stats: v.optional(v.object({
    atkBonus: v.optional(v.pipe(v.number(), v.integer())),
    defBonus: v.optional(v.pipe(v.number(), v.integer())),
    speedBonus: v.optional(v.pipe(v.number(), v.integer())),
    hpRestore: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  })),
});

export type ItemInput = v.InferInput<typeof ItemSchema>;
export type ItemOutput = v.InferOutput<typeof ItemSchema>;

/**
 * Item drop schema
 */
export const ItemDropSchema = v.object({
  itemId: v.pipe(v.string(), v.minLength(1)),
  probability: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
});

export type ItemDropInput = v.InferInput<typeof ItemDropSchema>;
export type ItemDropOutput = v.InferOutput<typeof ItemDropSchema>;

/**
 * Currency modification schema
 */
export const CurrencyModSchema = v.object({
  playerId: v.pipe(v.string(), v.minLength(1)),
  delta: v.pipe(v.number(), v.integer()),
});

export type CurrencyModInput = v.InferInput<typeof CurrencyModSchema>;
export type CurrencyModOutput = v.InferOutput<typeof CurrencyModSchema>;

/**
 * Shop inventory schema
 */
export const ShopInventorySchema = v.object({
  itemId: v.pipe(v.string(), v.minLength(1)),
  stock: v.pipe(v.number(), v.integer()),
  price: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type ShopInventoryInput = v.InferInput<typeof ShopInventorySchema>;
export type ShopInventoryOutput = v.InferOutput<typeof ShopInventorySchema>;

/**
 * Custom validation: Total probabilities in drop table
 */
export const validateDropTableProbabilities = (drops: Array<{ probability: number }>): boolean => {
  const total = drops.reduce((sum, d) => sum + d.probability, 0);
  return total <= 100;
};

