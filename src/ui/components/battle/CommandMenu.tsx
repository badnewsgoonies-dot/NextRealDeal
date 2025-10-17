import React from 'react';

interface CommandMenuProps {
  onCommand: (command: 'attack' | 'spells' | 'items' | 'defend') => void;
  disabled?: boolean;
}

export function CommandMenu({ onCommand, disabled = false }: CommandMenuProps) {
  const commands = [
    { key: 'attack' as const, label: 'Attack', icon: '⚔️' },
    { key: 'spells' as const, label: 'Spells', icon: '🔮' },
    { key: 'items' as const, label: 'Items', icon: '💊' },
    { key: 'defend' as const, label: 'Defend', icon: '🛡️' },
  ];

  return (
    <div className="bg-black bg-opacity-60 border border-white border-opacity-15 rounded-lg p-4 w-64">
      <h3 className="text-white font-semibold mb-3">Commands</h3>
      <div className="grid grid-cols-2 gap-2">
        {commands.map(command => (
          <button
            key={command.key}
            onClick={() => onCommand(command.key)}
            disabled={disabled}
            className="bg-gray-800 bg-opacity-50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded flex flex-col items-center space-y-1 transition-colors"
          >
            <span className="text-lg">{command.icon}</span>
            <span className="text-sm font-medium">{command.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}