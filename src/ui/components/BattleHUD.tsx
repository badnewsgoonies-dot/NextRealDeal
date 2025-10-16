/*
 * BattleHUD: Top status bar for battle scene
 */

import React from 'react';

interface BattleHUDProps {
  gold: number;
  step: number;
  runId: string;
  onMenu: () => void;
}

export function BattleHUD({ gold, step, runId, onMenu }: BattleHUDProps): JSX.Element {
  return (
    <div className="absolute left-0 top-0 right-0 bg-[var(--hud-bg)] border-b border-[var(--hud-border)] px-6 py-3 z-10">
      <div className="flex items-center justify-between text-[var(--text-primary)]">
        <div className="flex gap-6">
          <span>💰 {gold}g</span>
          <span>📍 Step {step}</span>
          <span className="text-[var(--text-muted)] text-sm">{runId}</span>
        </div>
        
        <button
          onClick={onMenu}
          className="rounded px-4 py-1 hover:bg-[var(--hover)] transition-colors"
          aria-label="Open menu"
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

