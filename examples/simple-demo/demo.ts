/*
 * Simple headless demo of NextRealDeal game engine.
 * Shows complete game loop: choices → arena → battle → rewards
 * 
 * Run: npm run demo
 * or: tsx examples/simple-demo/demo.ts
 */

import { ConsoleLogger } from '../../src/util/Logger.js';
import { makeRng } from '../../src/util/Rng.js';
import { GameController } from '../../src/core/GameController.js';
import { MapManager } from '../../src/map/MapManager.js';
import { BattleManager } from '../../src/battle/BattleManager.js';
import { UnitManager } from '../../src/unit/UnitManager.js';
import { EconomyManager } from '../../src/economy/EconomyManager.js';
import { RouteManager } from '../../src/route/RouteManager.js';
import { SaveManager } from '../../src/save/SaveManager.js';

async function runDemo(): Promise<void> {
  console.log('=== NextRealDeal v1.0 Demo ===\n');

  // Create systems with deterministic seed
  const log = new ConsoleLogger('info');
  const rng = makeRng(20251016);

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

  // Create player units
  console.log('Creating player units...');
  await game.getUnitManager().createUnit({
    id: 'hero',
    name: 'Hero',
    level: 5,
    team: 'player',
  });

  // Give starting gold
  await game.getEconomyManager().modifyCurrency('player', 500);
  console.log('Starting gold: 500g\n');

  // Start adventure
  console.log('Starting adventure with seed: 12345\n');
  await game.getRouteManager().startRun('demo-run', 12345);

  // Run 5 battles
  for (let i = 0; i < 5; i++) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Battle ${i + 1}/5`);
    console.log('='.repeat(50));

    // Get choices
    const choices = await game.getRouteManager().getChoices();
    if (!choices.ok) {
      console.log(`Error getting choices: ${choices.error}`);
      break;
    }

    console.log('\nAvailable paths:');
    choices.value.forEach(c => {
      console.log(`  [${c.label}] Arena Seed: ${c.arenaSeed}`);
    });

    // Choose first option
    const chosen = await game.getRouteManager().choose(choices.value[0].id);
    if (!chosen.ok) {
      console.log(`Error choosing: ${chosen.error}`);
      break;
    }

    console.log(`\n✅ Chose: ${chosen.value.choice.label}`);

    // Generate arena
    console.log('\nGenerating arena...');
    const arena = await game.getMapManager().generate({
      width: chosen.value.choice.arenaHint.width,
      height: chosen.value.choice.arenaHint.height,
      seed: chosen.value.choice.arenaSeed,
    });

    if (arena.ok) {
      console.log(`  Size: ${arena.value.width}×${arena.value.height}`);
      console.log(`  Rooms: ${arena.value.rooms.length}`);
      console.log(`  Connectors: ${arena.value.connectors.length}`);
    }

    // Create enemy for this battle
    await game.getUnitManager().createUnit({
      id: `goblin-${i}`,
      name: `Goblin ${i + 1}`,
      level: 2 + i,
      team: 'enemy',
    });

    // Run battle
    console.log('\n⚔️ Starting battle...');
    const playerUnits = game.getUnitManager().getTeamUnits('player');
    const enemyUnits = game.getUnitManager().getTeamUnits('enemy');

    await game.getBattleManager().startBattle([...playerUnits, ...enemyUnits]);
    const battleResult = await game.getBattleManager().executeRound();

    if (battleResult.ok) {
      console.log(`\n🏆 Winner: ${battleResult.value.winner}`);
      console.log(`  Combat actions: ${battleResult.value.actions.length}`);
      console.log(`  Units defeated: ${battleResult.value.unitsDefeated.length}`);

      if (battleResult.value.winner === 'player') {
        const goldReward = 100 + i * 20;
        
        await game.getEconomyManager().awardBattleReward('player', goldReward, [
          { itemId: 'health_potion', probability: 30 },
        ]);

        console.log(`\n💰 Rewards:`);
        console.log(`  Gold: +${goldReward}g`);
      }
    }

    // Clean up battle
    await game.getBattleManager().endBattle();

    // Remove enemy unit
    await game.getUnitManager().removeUnit(`goblin-${i}`);

    // Auto-save
    await game.getSaveManager().autoSave();
    console.log('\n💾 Progress auto-saved');
  }

  // Final status
  console.log(`\n${'='.repeat(50)}`);
  console.log('Adventure Complete!');
  console.log('='.repeat(50));

  const pointer = game.getRouteManager().current();
  console.log(`\nFinal step: ${pointer?.step}`);

  const finalGold = game.getEconomyManager().getCurrency('player').gold;
  console.log(`Total gold: ${finalGold}g`);

  const inventory = game.getEconomyManager().getInventory('player');
  console.log(`Items collected: ${inventory.items.length}`);

  // List saves
  const saves = await game.getSaveManager().listSlots();
  if (saves.ok) {
    console.log(`\nSaved games: ${saves.value.length}`);
    saves.value.forEach(s => {
      console.log(`  - ${s.slot} (${s.size} bytes, ${s.modified})`);
    });
  }

  // Cleanup
  await game.destroy();
  console.log('\n✅ Demo complete!\n');
}

// Run demo
runDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});

