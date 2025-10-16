/*
 * main.tsx: Application entry point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tailwind.css';
import { App } from './App.js';
import { GameController } from './core/GameController.js';
import { MapManager } from './map/MapManager.js';
import { BattleManager } from './battle/BattleManager.js';
import { UnitManager } from './unit/UnitManager.js';
import { EconomyManager } from './economy/EconomyManager.js';
import { RouteManager } from './route/RouteManager.js';
import { SaveManager } from './save/SaveManager.js';
import { ConsoleLogger } from './util/Logger.js';
import { makeRng } from './util/Rng.js';

async function initializeGame(): Promise<GameController> {
  const log = new ConsoleLogger('info');
  const rng = makeRng(Date.now());

  const map = new MapManager(log, rng.fork('map'));
  const battle = new BattleManager(log, rng.fork('battle'));
  const unit = new UnitManager(log, rng.fork('unit'));
  const economy = new EconomyManager(log, rng.fork('economy'));
  const route = new RouteManager(log, rng.fork('route'));
  const save = new SaveManager(log, rng.fork('save'));

  const game = new GameController(log, rng, map, battle, unit, economy, route, save);
  
  await game.initialize();

  // Register save subsystems
  game.getSaveManager().register({
    name: 'route',
    serialize: () => game.getRouteManager().serialize(),
    deserialize: json => game.getRouteManager().deserialize(json),
  });

  // Create default player unit
  await game.getUnitManager().createUnit({
    id: 'player-hero',
    name: 'Hero',
    level: 1,
    team: 'player',
  });

  // Give starting gold
  await game.getEconomyManager().modifyCurrency('player', 500);

  return game;
}

// Initialize and mount
initializeGame().then(game => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App game={game} />
    </React.StrictMode>
  );
}).catch(err => {
  console.error('Failed to initialize game:', err);
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Failed to initialize game. Check console.</div>';
});

