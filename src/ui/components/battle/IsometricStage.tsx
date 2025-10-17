import React from 'react';
import { UnitMarker } from './UnitMarker';
import type { Unit } from '../../types';

interface IsometricStageProps {
  gridW: number;
  gridH: number;
  units: Unit[];
  selectedId?: string;
  onUnitClick: (unit: Unit) => void;
}

export function IsometricStage({ gridW, gridH, units, selectedId, onUnitClick }: IsometricStageProps) {
  // Calculate diamond grid positions
  const getPosition = (x: number, y: number) => {
    const centerX = 400; // Center of stage
    const centerY = 300;
    const tileSize = 40;
    const isoX = (x - y) * tileSize;
    const isoY = (x + y) * tileSize * 0.5;
    return { x: centerX + isoX, y: centerY + isoY };
  };

  return (
    <div className="relative w-full h-96 bg-gradient-to-b from-blue-200 to-blue-400 dark:from-blue-900 dark:to-blue-950 rounded-lg overflow-hidden">
      {/* Grid lines for diamond pattern */}
      <svg className="absolute inset-0 w-full h-full">
        {Array.from({ length: gridW }, (_, x) =>
          Array.from({ length: gridH }, (_, y) => {
            const pos = getPosition(x, y);
            return (
              <polygon
                key={`${x}-${y}`}
                points={`${pos.x},${pos.y} ${pos.x + 20},${pos.y + 10} ${pos.x},${pos.y + 20} ${pos.x - 20},${pos.y + 10}`}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            );
          })
        )}
      </svg>

      {/* Unit markers */}
      {units.map(unit => {
        const pos = getPosition(unit.x, unit.y);
        return (
          <UnitMarker
            key={unit.id}
            unit={unit}
            x={pos.x}
            y={pos.y}
            isSelected={unit.id === selectedId}
            onClick={() => onUnitClick(unit)}
          />
        );
      })}
    </div>
  );
}