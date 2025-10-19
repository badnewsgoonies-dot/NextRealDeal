import React from 'react';
import type { UnitView } from '../engine/EngineAdapter';

interface Props { title: string; units: UnitView[]; }

export function PartyPanel({ title, units }: Props): JSX.Element {
  return (
    <div className="rounded-xl bg-black/40 backdrop-blur px-4 py-3 border border-white/15 w-full">
      <div className="text-sm opacity-80 mb-2">{title}</div>
      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white/10 border border-white/15 grid place-items-center text-xs">
              {u.portraitUrl ? <img src={u.portraitUrl} alt={u.name} className="w-8 h-8 object-cover rounded"/> : (u.name[0] || '?')}
            </div>
            <div className="flex-1">
              <div className="text-sm leading-tight">{u.name}</div>
              <Bar hp={u.hp} hpMax={u.hpMax} mp={u.mp} mpMax={u.mpMax} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ hp, hpMax, mp, mpMax }: { hp: number; hpMax: number; mp?: number; mpMax?: number }) {
  const hpPct = Math.max(0, Math.min(1, hp / hpMax));
  return (
    <div className="space-y-1 mt-1">
      <div className="h-2 rounded bg-white/10 relative">
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${hpPct * 100}%`, background: hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444' }} />
      </div>
      {mp != null && mpMax != null && (
        <div className="h-2 rounded bg-white/10 relative">
          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.max(0, Math.min(1, mp / mpMax)) * 100}%`, background: '#60a5fa' }} />
        </div>
      )}
    </div>
  );
}

