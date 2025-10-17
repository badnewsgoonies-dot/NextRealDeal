import React, { useRef, useState, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate responsive tile size
  const calculateTileSize = () => {
    const { width, height } = dimensions;
    // Isometric diamond width = (gridW + gridH) * tileW
    // Isometric diamond height = (gridW + gridH) * tileH / 2
    const maxTileW = width / (gridW + gridH) * 0.8; // 80% of available width
    const maxTileH = height / ((gridW + gridH) / 2) * 0.8; // 80% of available height
    const tileSize = Math.min(maxTileW, maxTileH, 60); // Cap at 60px
    return {
      tileW: tileSize,
      tileH: tileSize * 0.5, // Isometric ratio
    };
  };

  // Calculate isometric position
  const getPosition = (x: number, y: number) => {
    const { width, height } = dimensions;
    const { tileW, tileH } = calculateTileSize();
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Isometric projection: (x - y) for horizontal, (x + y) for vertical
    const isoX = (x - y) * (tileW / 2);
    const isoY = (x + y) * (tileH / 2);
    
    return { 
      x: centerX + isoX, 
      y: centerY + isoY - (gridH * tileH) / 4 // Offset to center vertically
    };
  };

  const { tileW, tileH } = calculateTileSize();

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-[1100px] h-[min(70vh,640px)] bg-gradient-to-b from-blue-200 to-blue-400 dark:from-blue-900 dark:to-blue-950 rounded-lg overflow-hidden"
    >
      {/* Grid lines for diamond pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {Array.from({ length: gridW }, (_, x) =>
          Array.from({ length: gridH }, (_, y) => {
            const pos = getPosition(x, y);
            const halfW = tileW / 2;
            const halfH = tileH / 2;
            return (
              <polygon
                key={`${x}-${y}`}
                points={`${pos.x},${pos.y - halfH} ${pos.x + halfW},${pos.y} ${pos.x},${pos.y + halfH} ${pos.x - halfW},${pos.y}`}
                fill="rgba(100, 150, 200, 0.1)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
            );
          })
        )}
      </svg>

      {/* Unit markers */}
      {units.map(unit => {
        // Support both x/y and tx/ty coordinate names
        const unitX = 'x' in unit ? unit.x : (unit as any).tx ?? 0;
        const unitY = 'y' in unit ? unit.y : (unit as any).ty ?? 0;
        const pos = getPosition(unitX, unitY);
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