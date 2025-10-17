import React from 'react';
import { Card } from '../components/common/Card';
import { useTheme } from '../context/ThemeContext';

export function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Appearance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-text-primary">Theme</span>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Profile</h3>
        <p className="text-text-secondary">Profile settings coming soon...</p>
      </Card>
    </div>
  );
}