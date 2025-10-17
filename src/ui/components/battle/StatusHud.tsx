import React from 'react';
import type { Unit } from '../../types';

interface StatusHudProps {
  unit: Unit;
}

export function StatusHud({ unit }: StatusHudProps) {
  const hpPercent = (unit.hp / unit.hpMax) * 100;
  const mpPercent = (unit.mp / unit.mpMax) * 100;

  return (
    <div className="bg-black bg-opacity-60 border border-white border-opacity-15 rounded-lg p-4 w-64">
      <div className="flex items-center space-x-3 mb-3">
        <div
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold"
          style={{
            backgroundColor: unit.color,
            borderColor: unit.faction === 'party' ? '#60a5fa' : '#f87171',
          }}
        >
          {unit.name[0].toUpperCase()}
        </div>
        <div>
          <h3 className="text-white font-semibold">{unit.name}</h3>
          <p className="text-gray-300 text-sm">{unit.faction}</p>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-white mb-1">
          <span>HP</span>
          <span>{unit.hp}/{unit.hpMax}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* MP Bar */}
      <div>
        <div className="flex justify-between text-xs text-white mb-1">
          <span>MP</span>
          <span>{unit.mp}/{unit.mpMax}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${mpPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}