import React from 'react';
import type { UnitView } from '../engine/EngineAdapter';

interface Props {
  units: UnitView[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TargetList({ units, selectedId, onSelect, onConfirm, onCancel }: Props): JSX.Element {
  const idx = Math.max(0, units.findIndex(u => u.id === selectedId));

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onSelect(units[(idx - 1 + units.length) % units.length]?.id); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onSelect(units[(idx + 1) % units.length]?.id); }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="rounded-xl bg-black/50 backdrop-blur px-4 py-3 border border-white/15 min-w-[420px]" tabIndex={0} onKeyDown={keyDown}>
      <div className="grid grid-cols-6 gap-2">
        {units.map(u => (
          <button
            key={u.id}
            className={`px-3 py-2 rounded-md border text-sm ${u.id === selectedId ? 'border-white/50 bg-white/10' : 'border-white/10 bg-white/5'} ${!u.alive ? 'opacity-50 line-through' : ''}`}
            onClick={() => onSelect(u.id)}
          >
            {u.name}
          </button>
        ))}
      </div>
    </div>
  );
}

