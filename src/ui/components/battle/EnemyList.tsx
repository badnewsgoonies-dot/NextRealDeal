import React from 'react';
import type { Unit } from '../../types';

interface EnemyListProps {
  enemies: Unit[];
}

export function EnemyList({ enemies }: EnemyListProps) {
  return (
    <div className="bg-black bg-opacity-60 border border-white border-opacity-15 rounded-lg p-4 w-64">
      <h3 className="text-white font-semibold mb-3">Enemies</h3>
      <div className="space-y-2">
        {enemies.map(enemy => {
          const hpPercent = (enemy.hp / enemy.hpMax) * 100;
          return (
            <div key={enemy.id} className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: enemy.color,
                  borderColor: '#f87171',
                }}
              >
                {enemy.name[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-white mb-1">
                  <span>{enemy.name}</span>
                  <span>{enemy.hp}/{enemy.hpMax}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}