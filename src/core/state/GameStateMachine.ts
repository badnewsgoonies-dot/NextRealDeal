/*
 * GameStateMachine: Enforces valid state transitions with history tracking.
 * 
 * Usage:
 *   const fsm = new GameStateMachine();
 *   const result = fsm.transitionTo('route_selection');
 *   if (!result.ok) {
 *     // Handle invalid transition
 *   }
 */

import type { GameState } from './GameState.js';
import { STATE_TRANSITIONS } from './GameState.js';
import { ok, err, type Result } from '../../util/Result.js';

export class GameStateMachine {
  private current: GameState = 'idle';
  private readonly history: GameState[] = [];

  getState(): GameState {
    return this.current;
  }

  getHistory(): readonly GameState[] {
    return [...this.history];
  }

  canTransitionTo(next: GameState): boolean {
    return STATE_TRANSITIONS[this.current].includes(next);
  }

  transitionTo(next: GameState): Result<void, string> {
    if (!this.canTransitionTo(next)) {
      return err(`Invalid transition: ${this.current} -> ${next}`);
    }
    this.history.push(this.current);
    this.current = next;
    return ok(undefined);
  }

  reset(): void {
    this.current = 'idle';
    this.history.length = 0;
  }
}
