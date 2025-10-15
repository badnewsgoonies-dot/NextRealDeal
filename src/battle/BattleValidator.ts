/*
 * BattleValidator: Validation schemas for combat system.
 * Uses Valibot for runtime validation of unit stats and battle state.
 */

import * as v from 'valibot';

/**
 * Unit schema with stat validation
 */
export const UnitSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  hp: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(9999)),
  maxHp: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999)),
  atk: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999)),
  def: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(999)),
  speed: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999)),
});

/**
 * Custom validation: hp <= maxHp
 */
export const validateHpConstraint = (unit: { hp: number; maxHp: number }): boolean => {
  return unit.hp <= unit.maxHp;
};

/**
 * Units array schema for battle start
 */
export const UnitsArraySchema = v.pipe(
  v.array(UnitSchema),
  v.minLength(1),
  v.maxLength(200)
);

export type UnitInput = v.InferInput<typeof UnitSchema>;
export type UnitOutput = v.InferOutput<typeof UnitSchema>;

/**
 * Combat action schema
 */
export const CombatActionSchema = v.object({
  type: v.union([v.literal('attack'), v.literal('dodge'), v.literal('defeat')]),
  actorId: v.string(),
  targetId: v.optional(v.string()),
  damage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  critical: v.optional(v.boolean()),
  dodged: v.optional(v.boolean()),
  seq: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type CombatActionInput = v.InferInput<typeof CombatActionSchema>;
export type CombatActionOutput = v.InferOutput<typeof CombatActionSchema>;

/**
 * Battle state schema
 */
export const BattleStateSchema = v.object({
  units: v.pipe(v.array(UnitSchema), v.minLength(1)),
  turnOrder: v.array(v.string()),
  currentTurn: v.pipe(v.number(), v.integer(), v.minValue(0)),
  isActive: v.boolean(),
});

export type BattleStateInput = v.InferInput<typeof BattleStateSchema>;
export type BattleStateOutput = v.InferOutput<typeof BattleStateSchema>;

/**
 * Custom validation: At least one unit is alive
 */
export const validateAtLeastOneAlive = (units: Array<{ hp: number }>): boolean => {
  return units.some(u => u.hp > 0);
};

/**
 * Custom validation: Unit IDs are unique
 */
export const validateUniqueIds = (units: Array<{ id: string }>): boolean => {
  const ids = new Set(units.map(u => u.id));
  return ids.size === units.length;
};

/**
 * Custom validation: attackerId and targetId exist in units
 */
export const validateUnitExists = (
  unitId: string,
  units: Array<{ id: string }>
): boolean => {
  return units.some(u => u.id === unitId);
};

/**
 * Custom validation: target is alive
 */
export const validateTargetAlive = (
  targetId: string,
  units: Array<{ id: string; hp: number }>
): boolean => {
  const target = units.find(u => u.id === targetId);
  return target !== undefined && target.hp > 0;
};

/**
 * Damage result schema
 */
export const CombatResultSchema = v.object({
  damage: v.pipe(v.number(), v.integer(), v.minValue(0)),
  finalHp: v.pipe(v.number(), v.integer(), v.minValue(0)),
  killed: v.boolean(),
  critical: v.boolean(),
  dodged: v.boolean(),
});

export type CombatResultInput = v.InferInput<typeof CombatResultSchema>;
export type CombatResultOutput = v.InferOutput<typeof CombatResultSchema>;

/**
 * Round result schema
 */
export const RoundResultSchema = v.object({
  actions: v.array(CombatActionSchema),
  unitsDefeated: v.array(v.string()),
  battleEnded: v.boolean(),
  winner: v.optional(v.union([
    v.literal('player'),
    v.literal('enemy'),
    v.literal('draw'),
  ])),
});

export type RoundResultInput = v.InferInput<typeof RoundResultSchema>;
export type RoundResultOutput = v.InferOutput<typeof RoundResultSchema>;

