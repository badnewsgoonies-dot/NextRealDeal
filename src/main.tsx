/*
 * main.tsx: Application entry point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tailwind.css';
import { App } from './App.js';

// Initialize and mount
// For the UI, we don't need the full game engine
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

