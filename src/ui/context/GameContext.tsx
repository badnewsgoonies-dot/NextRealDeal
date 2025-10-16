/*
 * GameContext: React context for GameController DI
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { GameController } from '../../core/GameController.js';

interface GameContextValue {
  game: GameController;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  game: GameController;
  children: ReactNode;
}

export function GameProvider({ game, children }: GameProviderProps): JSX.Element {
  return (
    <GameContext.Provider value={{ game }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameController(): GameController {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameController must be used within GameProvider');
  }
  return context.game;
}

