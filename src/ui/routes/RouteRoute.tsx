/*
 * RouteRoute: Meta-map route selection scene
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameController } from '../context/GameContext.js';
import type { Choice } from '../../types/contracts.js';

export function RouteRoute(): JSX.Element {
  const navigate = useNavigate();
  const game = useGameController();
  
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChoices(): Promise<void> {
      const result = await game.getRouteManager().getChoices();
      
      if (result.ok) {
        setChoices(result.value as Choice[]);
        setLoading(false);
      } else {
        setError(result.error);
        setLoading(false);
      }
    }

    void loadChoices();
  }, [game]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'a' || e.key === 'A') setSelectedIndex(0);
      if (e.key === 'b' || e.key === 'B') setSelectedIndex(1);
      if (e.key === 'c' || e.key === 'C') setSelectedIndex(2);
      if (e.key === 'Enter' && selectedIndex !== null) {
        confirmChoice();
      }
      if (e.key === 'Escape') {
        navigate('/');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex]);

  async function confirmChoice(): Promise<void> {
    if (selectedIndex === null) return;

    const choice = choices[selectedIndex];
    const result = await game.getRouteManager().choose(choice.id);

    if (result.ok) {
      const pointer = result.value.step;
      const arenaSeed = result.value.choice.arenaSeed;
      const runId = game.getRouteManager().current()?.runId ?? 'unknown';

      // Navigate to battle with state
      navigate(`/battle/${runId}?seed=${arenaSeed}&step=${pointer}`, {
        state: { runId, seed: arenaSeed, step: pointer },
      });
    } else {
      setError(result.error);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--surface-0)]">
        <div className="text-[var(--text-primary)]">Loading choices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--surface-0)]">
        <div className="text-[var(--enemy-fill)]">Error: {error}</div>
      </div>
    );
  }

  const pointer = game.getRouteManager().current();

  return (
    <div className="w-full h-full bg-[var(--surface-0)] flex flex-col">
      {/* Top HUD */}
      <div className="bg-[var(--hud-bg)] border-b border-[var(--hud-border)] px-6 py-3">
        <div className="flex items-center justify-between text-[var(--text-primary)]">
          <div className="flex gap-6">
            <span>📍 Step {pointer?.step ?? 0}</span>
            <span className="text-[var(--text-muted)]">{pointer?.runId}</span>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="rounded px-4 py-1 hover:bg-[var(--hover)] transition-colors"
          >
            ⚙️ Menu
          </button>
        </div>
      </div>

      {/* Choice Display */}
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-center text-[var(--text-primary)]">
            Choose Your Path
          </h2>

          <div className="flex gap-8">
            {choices.map((choice, index) => (
              <button
                key={choice.id}
                onClick={() => {
                  setSelectedIndex(index);
                  setTimeout(confirmChoice, 100);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  w-48 h-64 rounded-lg border-2 transition-all
                  ${selectedIndex === index 
                    ? 'border-[var(--selected)] bg-[var(--surface-2)] scale-105' 
                    : 'border-[var(--border-color)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
                  }
                `}
              >
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className={`
                    text-6xl font-bold
                    ${selectedIndex === index ? 'text-[var(--selected)]' : 'text-[var(--text-primary)]'}
                  `}>
                    {choice.label}
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)]">
                    Battle Arena
                  </div>
                  
                  <div className="text-xs text-[var(--text-muted)]">
                    {choice.arenaHint.width}×{choice.arenaHint.height}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center text-sm text-[var(--text-muted)]">
            Press A/B/C or click to select
          </div>
        </div>
      </div>
    </div>
  );
}

