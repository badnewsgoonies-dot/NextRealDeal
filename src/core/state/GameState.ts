/*
 * GameState: Type-safe game state definitions and valid transitions.
 * 
 * States:
 * - idle: Initial state, no run active
 * - route_selection: Player selecting next node on route
 * - battle_preparation: Loading battle, spawning units
 * - battle_active: Combat in progress
 * - battle_resolution: Combat ended, calculating results
 * - economy_rewards: Displaying/selecting rewards
 * - run_complete: All nodes completed or player defeated
 * - error: Unrecoverable error state
 */

export type GameState =
  | 'idle'
  | 'route_selection'
  | 'battle_preparation'
  | 'battle_active'
  | 'battle_resolution'
  | 'economy_rewards'
  | 'run_complete'
  | 'error';

/**
 * Valid state transitions map
 * Key: current state
 * Value: array of valid next states
 */
export const STATE_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  idle: ['route_selection'],
  route_selection: ['battle_preparation', 'run_complete'],
  battle_preparation: ['battle_active', 'error'],
  battle_active: ['battle_resolution', 'error'],
  battle_resolution: ['economy_rewards', 'error'],
  economy_rewards: ['route_selection', 'run_complete'],
  run_complete: ['idle'],
  error: ['idle'],
} as const;
