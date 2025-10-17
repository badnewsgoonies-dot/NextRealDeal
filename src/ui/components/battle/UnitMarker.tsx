import React from 'react';
import type { Unit } from '../../types';

interface UnitMarkerProps {
  unit: Unit;
  x: number;
  y: number;
  isSelected: boolean;
  onClick: () => void;
}

export function UnitMarker({ unit, x, y, isSelected, onClick }: UnitMarkerProps) {
  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
        isSelected ? 'scale-110' : ''
      } ${!unit.alive ? 'opacity-50 grayscale' : ''}`}
      style={{ left: x, top: y }}
      onClick={onClick}
    >
      {/* Selection ring */}
      {isSelected && (
        <div className="absolute -inset-2 border-2 border-yellow-400 rounded-full animate-pulse" />
      )}

      {/* Unit marker */}
      <div
        className="w-8 h-8 rounded-full border-2 shadow-lg flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: unit.color,
          borderColor: unit.faction === 'party' ? '#60a5fa' : '#f87171',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        }}
      >
        {unit.name[0].toUpperCase()}
      </div>

      {/* Shadow */}
      <div
        className="absolute top-6 left-1/2 transform -translate-x-1/2 w-6 h-2 bg-black bg-opacity-30 rounded-full blur-sm"
        style={{ filter: 'blur(1px)' }}
      />
    </div>
  );
}