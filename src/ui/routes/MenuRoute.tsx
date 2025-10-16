/*
 * MenuRoute: Main menu scene
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameController } from '../context/GameContext.js';

export function MenuRoute(): JSX.Element {
  const navigate = useNavigate();
  const game = useGameController();
  const [error, setError] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(false);

  // Check if autosave exists
  useEffect(() => {
    async function checkSave(): Promise<void> {
      const slotsResult = await game.getSaveManager().listSlots();
      if (slotsResult.ok) {
        const hasAutosave = slotsResult.value.some(s => s.slot === 'autosave');
        setHasSave(hasAutosave);
      }
    }
    checkSave();
  }, [game]);

  async function handleNewGame(): Promise<void> {
    const runId = `run-${Date.now()}`;
    const seed = Date.now();

    const result = await game.getRouteManager().startRun(runId, seed);

    if (result.ok) {
      setError(null);
      navigate('/route');
    } else {
      setError(`Failed to start: ${result.error}`);
    }
  }

  async function handleLoadGame(): Promise<void> {
    const result = await game.getSaveManager().load('autosave');

    if (result.ok) {
      setError(null);
      navigate('/route');
    } else {
      // Map error to user-friendly message
      const message = result.error === 'slot-not-found' 
        ? 'No save found. Start a new game instead.'
        : `Load failed: ${result.error}`;
      setError(message);
    }
  }

  function handleQuit(): void {
    // Only close if this window was script-opened
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      // In a normal SPA tab, navigate to home
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--surface-0)]">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold text-[var(--text-primary)] mb-12">
          NextRealDeal
        </h1>

        {error && (
          <div className="mb-4 px-6 py-3 bg-[var(--enemy-fill)] bg-opacity-20 border border-[var(--enemy-fill)] rounded-lg text-[var(--text-primary)]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleNewGame}
            className="block w-64 px-6 py-3 text-lg bg-[var(--player-fill)] hover:bg-[var(--player-outline)] text-white rounded-lg transition-colors focus-ring"
          >
            New Game
          </button>

          <button
            onClick={handleLoadGame}
            disabled={!hasSave}
            className={`block w-64 px-6 py-3 text-lg rounded-lg transition-colors focus-ring ${
              hasSave
                ? 'bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-primary)]'
                : 'bg-[var(--disabled)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            Load Game {!hasSave && '(No Save)'}
          </button>

          <button
            className="block w-64 px-6 py-3 text-lg bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-primary)] rounded-lg transition-colors focus-ring"
          >
            Settings
          </button>

          <button
            onClick={handleQuit}
            className="block w-64 px-6 py-3 text-lg bg-[var(--surface-2)] hover:bg-[var(--hover)] text-[var(--text-muted)] rounded-lg transition-colors focus-ring"
          >
            Exit
          </button>
        </div>

        <div className="mt-12 text-sm text-[var(--text-muted)]">
          v1.0.0 | Headless Engine + UI Preview
        </div>
      </div>
    </div>
  );
}

