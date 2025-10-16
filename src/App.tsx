/*
 * App: Main application with routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './ui/context/GameContext.js';
import { MenuRoute } from './ui/routes/MenuRoute.js';
import { RouteRoute } from './ui/routes/RouteRoute.js';
import type { GameController } from './core/GameController.js';
import './ui/styles/theme-tokens.css';

interface AppProps {
  game: GameController;
}

export function App({ game }: AppProps): JSX.Element {
  return (
    <GameProvider game={game}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MenuRoute />} />
          <Route path="/route" element={<RouteRoute />} />
          <Route path="/battle/:runId" element={<div>Battle Route (TODO)</div>} />
          <Route path="/shop" element={<div>Shop (TODO)</div>} />
          <Route path="/inventory" element={<div>Inventory (TODO)</div>} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

