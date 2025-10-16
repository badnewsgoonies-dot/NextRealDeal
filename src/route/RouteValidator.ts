/*
 * RouteValidator: Validation schemas for route system.
 * Uses Valibot for runtime validation with even-dimension checks.
 */

import * as v from 'valibot';

/**
 * Run ID schema
 */
export const RunIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

export type RunIdInput = v.InferInput<typeof RunIdSchema>;
export type RunIdOutput = v.InferOutput<typeof RunIdSchema>;

/**
 * Seed schema (accepts number or string)
 */
export const SeedSchema = v.union([v.number(), v.pipe(v.string(), v.minLength(1))]);

export type SeedInput = v.InferInput<typeof SeedSchema>;
export type SeedOutput = v.InferOutput<typeof SeedSchema>;

/**
 * Step schema
 */
export const StepSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10000));

export type StepInput = v.InferInput<typeof StepSchema>;
export type StepOutput = v.InferOutput<typeof StepSchema>;

/**
 * Choice label schema
 */
export const LabelSchema = v.picklist(['A', 'B', 'C']);

export type LabelInput = v.InferInput<typeof LabelSchema>;
export type LabelOutput = v.InferOutput<typeof LabelSchema>;

/**
 * Arena hint schema with even-dimensions validation
 */
export const ArenaHintSchema = v.pipe(
  v.object({
    width: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(128)),
    height: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(128)),
  }),
  v.check(h => h.width % 2 === 0 && h.height % 2 === 0, 'Arena dimensions must be even')
);

export type ArenaHintInput = v.InferInput<typeof ArenaHintSchema>;
export type ArenaHintOutput = v.InferOutput<typeof ArenaHintSchema>;

/**
 * Choice schema
 */
export const ChoiceSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  step: StepSchema,
  type: v.literal('battle'),
  label: LabelSchema,
  arenaSeed: v.pipe(v.number(), v.integer()),
  arenaHint: ArenaHintSchema,
});

export type ChoiceInput = v.InferInput<typeof ChoiceSchema>;
export type ChoiceOutput = v.InferOutput<typeof ChoiceSchema>;

/**
 * Run state schema
 */
export const RunStateSchema = v.object({
  runId: RunIdSchema,
  seed: v.string(),
  step: StepSchema,
  history: v.array(ChoiceSchema),
});

export type RunStateInput = v.InferInput<typeof RunStateSchema>;
export type RunStateOutput = v.InferOutput<typeof RunStateSchema>;

