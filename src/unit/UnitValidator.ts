/*
 * UnitValidator: Validation schemas for unit system.
 * Uses Valibot for runtime validation of unit data and equipment.
 */

import * as v from 'valibot';

/**
 * Equipment slot schema
 */
export const EquipmentSlotSchema = v.union([
  v.literal('weapon'),
  v.literal('armor'),
  v.literal('accessory'),
]);

/**
 * Equipment item schema
 */
export const EquipmentSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  slot: EquipmentSlotSchema,
  atkBonus: v.pipe(v.number(), v.integer()),
  defBonus: v.pipe(v.number(), v.integer()),
  speedBonus: v.pipe(v.number(), v.integer()),
});

export type EquipmentInput = v.InferInput<typeof EquipmentSchema>;
export type EquipmentOutput = v.InferOutput<typeof EquipmentSchema>;

/**
 * Position schema
 */
export const PositionSchema = v.object({
  x: v.pipe(v.number(), v.integer()),
  y: v.pipe(v.number(), v.integer()),
});

/**
 * Unit creation config schema
 */
export const UnitCreateConfigSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  level: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 1),
  team: v.union([v.literal('player'), v.literal('enemy')]),
  baseStats: v.optional(v.object({
    atk: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999))),
    def: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999))),
    speed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999))),
  })),
});

export type UnitCreateConfigInput = v.InferInput<typeof UnitCreateConfigSchema>;
export type UnitCreateConfigOutput = v.InferOutput<typeof UnitCreateConfigSchema>;

/**
 * Game unit schema (full unit with equipment)
 */
export const GameUnitSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  hp: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9999)),
  maxHp: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999)),
  atk: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999)),
  def: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999)),
  speed: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999)),
  level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  experience: v.pipe(v.number(), v.integer(), v.minValue(0)),
  team: v.union([v.literal('player'), v.literal('enemy')]),
  position: v.optional(PositionSchema),
  equipment: v.optional(v.record(v.string(), EquipmentSchema)),
});

export type GameUnitInput = v.InferInput<typeof GameUnitSchema>;
export type GameUnitOutput = v.InferOutput<typeof GameUnitSchema>;

/**
 * Custom validation: hp <= maxHp
 */
export const validateHpConstraint = (unit: { hp: number; maxHp: number }): boolean => {
  return unit.hp <= unit.maxHp;
};

/**
 * Custom validation: level is reasonable
 */
export const validateLevel = (level: number): boolean => {
  return level >= 1 && level <= 100;
};

/**
 * Custom validation: equipment bonuses don't exceed limits
 */
export const validateEquipmentBonuses = (item: {
  atkBonus: number;
  defBonus: number;
  speedBonus: number;
}): boolean => {
  return (
    Math.abs(item.atkBonus) <= 500 &&
    Math.abs(item.defBonus) <= 500 &&
    Math.abs(item.speedBonus) <= 500
  );
};


