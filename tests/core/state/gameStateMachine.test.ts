import { describe, it, expect } from 'vitest';
import { GameStateMachine } from '../../../src/core/state/GameStateMachine.js';

describe('GameStateMachine', () => {
  it('starts in idle state', () => {
    const fsm = new GameStateMachine();
    expect(fsm.getState()).toBe('idle');
  });

  it('validates legal transitions', () => {
    const fsm = new GameStateMachine();
    expect(fsm.getState()).toBe('idle');
    
    const routeResult = fsm.transitionTo('route_selection');
    expect(routeResult.ok).toBe(true);
    expect(fsm.getState()).toBe('route_selection');
    
    const invalidResult = fsm.transitionTo('battle_active');
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.error).toContain('Invalid transition');
    }
  });

  it('tracks history', () => {
    const fsm = new GameStateMachine();
    fsm.transitionTo('route_selection');
    fsm.transitionTo('battle_preparation');
    
    const history = fsm.getHistory();
    expect(history).toEqual(['idle', 'route_selection']);
  });

  it('resets correctly', () => {
    const fsm = new GameStateMachine();
    fsm.transitionTo('route_selection');
    fsm.transitionTo('battle_preparation');
    
    fsm.reset();
    expect(fsm.getState()).toBe('idle');
    expect(fsm.getHistory()).toEqual([]);
  });

  it('allows valid state flow: idle -> route -> battle -> resolution -> rewards -> route', () => {
    const fsm = new GameStateMachine();
    
    expect(fsm.transitionTo('route_selection').ok).toBe(true);
    expect(fsm.getState()).toBe('route_selection');
    
    expect(fsm.transitionTo('battle_preparation').ok).toBe(true);
    expect(fsm.getState()).toBe('battle_preparation');
    
    expect(fsm.transitionTo('battle_active').ok).toBe(true);
    expect(fsm.getState()).toBe('battle_active');
    
    expect(fsm.transitionTo('battle_resolution').ok).toBe(true);
    expect(fsm.getState()).toBe('battle_resolution');
    
    expect(fsm.transitionTo('economy_rewards').ok).toBe(true);
    expect(fsm.getState()).toBe('economy_rewards');
    
    expect(fsm.transitionTo('route_selection').ok).toBe(true);
    expect(fsm.getState()).toBe('route_selection');
  });

  it('allows error recovery: any state -> error -> idle', () => {
    const fsm = new GameStateMachine();
    
    fsm.transitionTo('route_selection');
    fsm.transitionTo('battle_preparation');
    
    expect(fsm.transitionTo('error').ok).toBe(true);
    expect(fsm.getState()).toBe('error');
    
    expect(fsm.transitionTo('idle').ok).toBe(true);
    expect(fsm.getState()).toBe('idle');
  });

  it('allows run completion: economy_rewards -> run_complete -> idle', () => {
    const fsm = new GameStateMachine();
    
    fsm.transitionTo('route_selection');
    fsm.transitionTo('battle_preparation');
    fsm.transitionTo('battle_active');
    fsm.transitionTo('battle_resolution');
    fsm.transitionTo('economy_rewards');
    
    expect(fsm.transitionTo('run_complete').ok).toBe(true);
    expect(fsm.getState()).toBe('run_complete');
    
    expect(fsm.transitionTo('idle').ok).toBe(true);
    expect(fsm.getState()).toBe('idle');
  });

  it('canTransitionTo returns correct result', () => {
    const fsm = new GameStateMachine();
    
    expect(fsm.canTransitionTo('route_selection')).toBe(true);
    expect(fsm.canTransitionTo('battle_active')).toBe(false);
    expect(fsm.canTransitionTo('error')).toBe(false);
    
    fsm.transitionTo('route_selection');
    expect(fsm.canTransitionTo('battle_preparation')).toBe(true);
    expect(fsm.canTransitionTo('run_complete')).toBe(true);
    expect(fsm.canTransitionTo('idle')).toBe(false);
  });

  it('history is immutable', () => {
    const fsm = new GameStateMachine();
    
    fsm.transitionTo('route_selection');
    const history1 = fsm.getHistory();
    
    fsm.transitionTo('battle_preparation');
    const history2 = fsm.getHistory();
    
    // Original history should be unchanged
    expect(history1).toEqual(['idle']);
    expect(history2).toEqual(['idle', 'route_selection']);
  });
});
