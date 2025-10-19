import React from 'react';
import type { ActionDef } from '../engine/EngineAdapter';

interface Props {
  actions: ActionDef[];
  onChoose: (action: ActionDef) => void;
}

export function ActionMenu({ actions, onChoose }: Props): JSX.Element {
  const [i, setI] = React.useState(0);

  React.useEffect(() => { setI(0); }, [actions]);

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setI((p) => (p - 1 + actions.length) % actions.length); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setI((p) => (p + 1) % actions.length); }
    if (e.key === 'Enter') { e.preventDefault(); actions[i] && onChoose(actions[i]); }
    if (e.key === 'Escape') { e.preventDefault(); /* ignored here */ }
  };

  return (
    <div className="rounded-xl bg-black/50 backdrop-blur px-4 py-3 border border-white/15 min-w-[420px]" onKeyDown={keyDown} tabIndex={0}>
      <div className="grid grid-cols-5 gap-2">
        {actions.map((a, idx) => (
          <button
            key={a.id}
            className={`px-3 py-2 rounded-md border text-sm ${idx === i ? 'border-white/50 bg-white/10' : 'border-white/10 bg-white/5'} `}
            onClick={() => onChoose(a)}
          >
            {a.name}{a.mpCost ? ` (${a.mpCost} MP)` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

