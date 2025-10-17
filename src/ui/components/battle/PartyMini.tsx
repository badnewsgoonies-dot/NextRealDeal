import React from 'react';
import type { Unit } from '../../types';

interface PartyMiniProps {
  party: Unit[];
}

export function PartyMini({ party }: PartyMiniProps) {
  return (
    <div className="bg-black bg-opacity-60 border border-white border-opacity-15 rounded-lg p-4 w-64">
      <h3 className="text-white font-semibold mb-3">Party</h3>
      <div className="space-y-2">
        {party.map(member => {
          const hpPercent = (member.hp / member.hpMax) * 100;
          const mpPercent = (member.mp / member.mpMax) * 100;
          return (
            <div key={member.id} className="bg-gray-800 bg-opacity-50 rounded p-2">
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: member.color,
                    borderColor: '#60a5fa',
                  }}
                >
                  {member.name[0].toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium">{member.name}</span>
              </div>
              <div className="space-y-1">
                <div>
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>HP</span>
                    <span>{member.hp}/{member.hpMax}</span>
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
                <div>
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>MP</span>
                    <span>{member.mp}/{member.mpMax}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${mpPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}