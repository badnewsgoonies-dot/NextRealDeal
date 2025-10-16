/*
 * SaveValidator: Validation schemas for save system.
 * Uses Valibot for runtime validation of save data.
 */

import * as v from 'valibot';

/**
 * Slot name schema (alphanumeric + _ -)
 */
export const SlotSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(/^[a-zA-Z0-9_\-]+$/, 'Slot may contain letters, numbers, _ or -')
);

export type SlotInput = v.InferInput<typeof SlotSchema>;
export type SlotOutput = v.InferOutput<typeof SlotSchema>;

/**
 * ISO date schema (UTC format)
 */
export const IsoDateSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, 'Must be ISO UTC')
);

export type IsoDateInput = v.InferInput<typeof IsoDateSchema>;
export type IsoDateOutput = v.InferOutput<typeof IsoDateSchema>;

/**
 * Save envelope schema
 */
export const SaveEnvelopeSchema = v.object({
  version: v.literal('v1'),
  timestamp: IsoDateSchema,
  subsystems: v.record(v.string(), v.string()),
});

export type SaveEnvelopeInput = v.InferInput<typeof SaveEnvelopeSchema>;
export type SaveEnvelopeOutput = v.InferOutput<typeof SaveEnvelopeSchema>;

/**
 * Save data schema (payload mode)
 */
export const SaveDataSchema = v.object({
  version: v.literal('v1'),
  createdAt: IsoDateSchema,
  systems: v.record(v.string(), v.unknown()),
});

export type SaveDataInput = v.InferInput<typeof SaveDataSchema>;
export type SaveDataOutput = v.InferOutput<typeof SaveDataSchema>;

/**
 * SaveManager internal state schema
 */
export const SaveManagerStateSchema = v.object({
  lastSaveISO: v.optional(v.union([IsoDateSchema, v.null()])),
});

export type SaveManagerStateInput = v.InferInput<typeof SaveManagerStateSchema>;
export type SaveManagerStateOutput = v.InferOutput<typeof SaveManagerStateSchema>;

