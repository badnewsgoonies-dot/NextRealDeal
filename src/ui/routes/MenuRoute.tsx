/*
 * MenuRoute: Main menu scene
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameController } from '../context/GameContext.js';

export function MenuRoute(): JSX.Element {
  const navigate = useNavigate();
  const game = useGameController();

  async function handleNewGame(): Promise<void> {
    const runId = `run-${Date.now()}`;
    const seed = Date.now();

    const result = await game.getRouteManager().startRun(runId, seed);

    if (result.ok) {
      navigate('/route');
    } else {
      console.error('Failed to start run:', result.error);
    }
  }

  async function handleLoadGame(): Promise<void> {
    // TODO: Show load dialog
    const result = await game.getSaveManager().load('autosave');

    if (result.ok) {
      navigate('/route');
    } else {
      console.error('Failed to load:', result.error);
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--surface-0)]">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold text-[var(--text-primary)] mb-12">
          NextRealDeal
        </h1>

        <div className="space-y-4">
          <button
            onClick={handleNewGame}
            className="block w-64 px-6 py-3 text-lg bg-[var(--player-fill)] hover:bg-[var(--player-outline)] text-white rounded-lg transition-colors"
          >
            New Game
          </button>

          <button
            onClick={handleLoadGame}
            className="block w-64 px-6 py-3 text-lg bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-primary)] rounded-lg transition-colors"
          >
            Load Game
          </button>

          <button
            className="block w-64 px-6 py-3 text-lg bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-primary)] rounded-lg transition-colors"
          >
            Settings
          </button>

          <button
            onClick={() => window.close()}
            className="block w-64 px-6 py-3 text-lg bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-muted)] rounded-lg transition-colors"
          >
            Exit
          </button>
        </div>

        <div className="mt-12 text-sm text-[var(--text-muted)]">
          v1.0.0 | Headless Engine
        </div>
      </div>
    </div>
  );
}

