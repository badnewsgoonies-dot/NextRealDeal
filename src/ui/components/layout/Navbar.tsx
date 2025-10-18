import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/runs', label: 'Runs' },
  { path: '/encounters', label: 'Encounters' },
  { path: '/settings', label: 'Settings' },
  { path: '/battle', label: 'Battle' },
];

export function Navbar(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <nav className="bg-surface border-b border-border-color px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-primary">Route Runner</h1>
        <div className="hidden md:flex space-x-4">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={toggleTheme}
        className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </nav>
  );
}