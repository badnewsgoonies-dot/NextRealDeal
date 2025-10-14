/*
 * MapValidator: Validation schemas for map generation and data.
 * Uses Valibot for runtime validation of external data.
 */

import * as v from 'valibot';

/**
 * Position schema
 */
export const PositionSchema = v.object({
  x: v.number(),
  y: v.number(),
});

/**
 * Room schema
 */
export const RoomSchema = v.object({
  x: v.pipe(v.number(), v.integer()),
  y: v.pipe(v.number(), v.integer()),
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

/**
 * Connector schema
 */
export const ConnectorSchema = v.object({
  from: PositionSchema,
  to: PositionSchema,
  isExtra: v.boolean(),
});

/**
 * Map generation config schema
 */
export const MapGenConfigSchema = v.object({
  width: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(16),
    v.maxValue(128),
    v.custom((val) => val % 2 === 0, 'Width must be even')
  ),
  height: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(16),
    v.maxValue(128),
    v.custom((val) => val % 2 === 0, 'Height must be even')
  ),
  minRoomSize: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(20)),
    5
  ),
  maxRoomSize: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(40)),
    15
  ),
  extraLoopsPct: v.optional(
    v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
    12
  ),
  algorithm: v.optional(
    v.union([v.literal('bsp'), v.literal('cellular'), v.literal('drunkard')]),
    'bsp'
  ),
});

export type MapGenConfigInput = v.InferInput<typeof MapGenConfigSchema>;
export type MapGenConfigOutput = v.InferOutput<typeof MapGenConfigSchema>;

/**
 * Map data schema (for serialization/deserialization)
 */
export const MapDataSchema = v.object({
  width: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(128)),
  height: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(128)),
  tiles: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(5))),
    v.minLength(16 * 16),
    v.maxLength(128 * 128)
  ),
  rooms: v.array(RoomSchema),
  connectors: v.array(ConnectorSchema),
  spawn: PositionSchema,
  exit: PositionSchema,
  seed: v.number(),
  algorithm: v.string(),
});

export type MapDataInput = v.InferInput<typeof MapDataSchema>;
export type MapDataOutput = v.InferOutput<typeof MapDataSchema>;

/**
 * Tile type validation
 */
export const TileTypeSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(5)
);

/**
 * Custom validation: Map dimensions match tiles array length
 */
export const validateMapDimensions = (data: {
  width: number;
  height: number;
  tiles: number[] | Uint8Array;
}): boolean => {
  return data.tiles.length === data.width * data.height;
};

/**
 * Custom validation: Spawn and exit are within bounds
 */
export const validateSpawnExit = (data: {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  exit: { x: number; y: number };
}): boolean => {
  const { width, height, spawn, exit } = data;
  return (
    spawn.x >= 0 &&
    spawn.x < width &&
    spawn.y >= 0 &&
    spawn.y < height &&
    exit.x >= 0 &&
    exit.x < width &&
    exit.y >= 0 &&
    exit.y < height
  );
};

