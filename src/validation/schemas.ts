/*
 * Valibot schemas for runtime validation.
 * Use these for external data (user input, save files, network).
 */

import * as v from 'valibot';

/**
 * Position schema
 */
export const PositionSchema = v.object({
  x: v.number(),
  y: v.number(),
});

export type PositionInput = v.InferInput<typeof PositionSchema>;
export type PositionOutput = v.InferOutput<typeof PositionSchema>;

/**
 * Size schema
 */
export const SizeSchema = v.object({
  width: v.pipe(v.number(), v.minValue(0)),
  height: v.pipe(v.number(), v.minValue(0)),
});

export type SizeInput = v.InferInput<typeof SizeSchema>;
export type SizeOutput = v.InferOutput<typeof SizeSchema>;

/**
 * Rect schema
 */
export const RectSchema = v.object({
  x: v.number(),
  y: v.number(),
  width: v.pipe(v.number(), v.minValue(0)),
  height: v.pipe(v.number(), v.minValue(0)),
});

export type RectInput = v.InferInput<typeof RectSchema>;
export type RectOutput = v.InferOutput<typeof RectSchema>;

/**
 * Game event schema
 */
export const GameEventSchema = v.object({
  type: v.string(),
  timestamp: v.number(),
  data: v.unknown(),
});

export type GameEventInput = v.InferInput<typeof GameEventSchema>;
export type GameEventOutput = v.InferOutput<typeof GameEventSchema>;

/**
 * Config schemas
 */
export const SystemConfigSchema = v.object({
  name: v.string(),
  enabled: v.optional(v.boolean(), true),
});

export type SystemConfigInput = v.InferInput<typeof SystemConfigSchema>;
export type SystemConfigOutput = v.InferOutput<typeof SystemConfigSchema>;

