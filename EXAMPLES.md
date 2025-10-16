# Integration Examples

This document shows how to integrate NextRealDeal into various applications.

## Table of Contents

1. [Simple Headless Demo](#simple-headless-demo)
2. [CLI Game](#cli-game)
3. [Discord Bot](#discord-bot)
4. [REST API Server](#rest-api-server)
5. [Testing Integration](#testing-integration)

---

## Simple Headless Demo

A minimal example showing the complete game loop (see `examples/simple-demo/demo.ts`):

```typescript
import { ConsoleLogger } from '../../src/util/Logger.js';
import { makeRng } from '../../src/util/Rng.js';
import { GameController } from '../../src/core/GameController.js';
import { MapManager } from '../../src/map/MapManager.js';
import { BattleManager } from '../../src/battle/BattleManager.js';
import { UnitManager } from '../../src/unit/UnitManager.js';
import { EconomyManager } from '../../src/economy/EconomyManager.js';
import { RouteManager } from '../../src/route/RouteManager.js';
import { SaveManager } from '../../src/save/SaveManager.js';

async function runDemo() {
  console.log('=== NextRealDeal Demo ===\n');

  // Create systems
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

  // Register for auto-save
  game.getSaveManager().register({
    name: 'route',
    serialize: () => game.getRouteManager().serialize(),
    deserialize: json => game.getRouteManager().deserialize(json),
  });

  // Create units
  await game.getUnitManager().createUnit({
    id: 'hero',
    name: 'Hero',
    level: 5,
    team: 'player',
  });

  await game.getUnitManager().createUnit({
    id: 'goblin',
    name: 'Goblin',
    level: 3,
    team: 'enemy',
  });

  // Give starting gold
  await game.getEconomyManager().modifyCurrency('player', 500);

  // Start adventure
  console.log('Starting adventure...\n');
  await game.getRouteManager().startRun('demo-run', 12345);

  // Run 5 battles
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Battle ${i + 1} ---`);

    // Get choices
    const choices = await game.getRouteManager().getChoices();
    if (!choices.ok) break;

    console.log('Choices:', choices.value.map(c => c.label).join(', '));

    // Choose first option
    const chosen = await game.getRouteManager().choose(choices.value[0].id);
    if (!chosen.ok) break;

    console.log(`Chose: ${chosen.value.choice.label}`);

    // Generate arena
    const arena = await game.getMapManager().generate({
      width: chosen.value.choice.arenaHint.width,
      height: chosen.value.choice.arenaHint.height,
      seed: chosen.value.choice.arenaSeed,
    });

    if (arena.ok) {
      console.log(`Arena: ${arena.value.width}×${arena.value.height}, ${arena.value.rooms.length} rooms`);
    }

    // Run battle
    const playerUnits = game.getUnitManager().getTeamUnits('player');
    const enemyUnits = game.getUnitManager().getTeamUnits('enemy');

    await game.getBattleManager().startBattle([...playerUnits, ...enemyUnits]);
    const result = await game.getBattleManager().executeRound();

    if (result.ok) {
      console.log(`Winner: ${result.value.winner}`);

      if (result.value.winner === 'player') {
        await game.getEconomyManager().awardBattleReward('player', 100, [
          { itemId: 'health_potion', probability: 30 },
        ]);
      }
    }

    await game.getBattleManager().endBattle();

    // Auto-save
    await game.getSaveManager().autoSave();
    console.log('Progress auto-saved');
  }

  // Show final state
  const pointer = game.getRouteManager().current();
  console.log(`\n Final step: ${pointer?.step}`);

  const gold = game.getEconomyManager().getCurrency('player').gold;
  console.log(`Total gold: ${gold}`);

  // List saves
  const saves = await game.getSaveManager().listSlots();
  if (saves.ok) {
    console.log(`\nSaved games: ${saves.value.length}`);
  }

  await game.destroy();
  console.log('\nDemo complete!');
}

runDemo().catch(console.error);
```

**Run:** `tsx examples/simple-demo/demo.ts`

---

## CLI Game

Interactive terminal game using Node.js readline:

```typescript
import * as readline from 'readline/promises';
import { stdin, stdout } from 'process';
import { ConsoleLogger } from 'nextrealdeal/util/Logger';
import { makeRng } from 'nextrealdeal/util/Rng';
// ... imports

const rl = readline.createInterface({ input: stdin, output: stdout });

async function playGame() {
  const game = createGame(new ConsoleLogger('error'), makeRng(Date.now()));
  await game.initialize();

  // Create player unit
  await game.getUnitManager().createUnit({
    id: 'player',
    name: 'Adventurer',
    level: 1,
    team: 'player',
  });

  await game.getRouteManager().startRun('cli-game', Date.now());

  while (true) {
    // Get choices
    const choices = await game.getRouteManager().getChoices();
    if (!choices.ok) break;

    // Display
    console.log('\n=== Choose Your Path ===');
    choices.value.forEach(c => {
      console.log(`[${c.label}] Battle Arena (Seed: ${c.arenaSeed})`);
    });

    // Input
    const answer = await rl.question('Enter A, B, or C (or Q to quit): ');

    if (answer.toUpperCase() === 'Q') break;

    const choice = choices.value.find(c => c.label === answer.toUpperCase());
    
    if (!choice) {
      console.log('❌ Invalid choice!');
      continue;
    }

    // Make choice
    const chosen = await game.getRouteManager().choose(choice.id);
    if (!chosen.ok) {
      console.log(`❌ Error: ${chosen.error}`);
      break;
    }

    // Generate arena
    const arena = await game.getMapManager().generate({
      width: chosen.value.choice.arenaHint.width,
      height: chosen.value.choice.arenaHint.height,
      seed: chosen.value.choice.arenaSeed,
    });

    if (!arena.ok) break;

    console.log(`\n⚔️ Battle in ${arena.value.width}×${arena.value.height} arena!`);
    console.log(`   Rooms: ${arena.value.rooms.length}`);

    // Auto-battle (simplified for CLI)
    const players = game.getUnitManager().getTeamUnits('player');
    const enemies = game.getUnitManager().getTeamUnits('enemy');

    if (enemies.length === 0) {
      // Create enemy on the fly
      await game.getUnitManager().createUnit({
        id: `enemy-${Date.now()}`,
        name: 'Goblin',
        level: 1,
        team: 'enemy',
      });
    }

    const allUnits = [...players, ...game.getUnitManager().getTeamUnits('enemy')];
    
    await game.getBattleManager().startBattle(allUnits);
    const battleResult = await game.getBattleManager().executeRound();

    if (battleResult.ok) {
      console.log(`\n🏆 Winner: ${battleResult.value.winner}`);
      console.log(`   Actions: ${battleResult.value.actions.length}`);
      console.log(`   Defeated: ${battleResult.value.unitsDefeated.length}`);

      if (battleResult.value.winner === 'player') {
        await game.getEconomyManager().awardBattleReward('player', 100, []);
        
        const currency = game.getEconomyManager().getCurrency('player');
        console.log(`\n💰 Gold earned! Total: ${currency.gold}g`);
      }
    }

    await game.getBattleManager().endBattle();

    // Auto-save
    await game.getSaveManager().autoSave();
    console.log('💾 Progress saved');
  }

  rl.close();
  await game.destroy();
  console.log('\n👋 Thanks for playing!');
}

playGame().catch(console.error);
```

---

## Discord Bot

Complete Discord bot integration:

```typescript
import { Client, Events, GatewayIntentBits, InteractionType } from 'discord.js';
import { GameController } from 'nextrealdeal';
import { makeRng } from 'nextrealdeal/util/Rng';
import { ConsoleLogger } from 'nextrealdeal/util/Logger';
import { InMemorySaveStore } from 'nextrealdeal/save/SaveStore';

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const games = new Map<string, GameController>();

// Helper to create game for user
function createUserGame(userId: string): GameController {
  const log = new ConsoleLogger('error');
  const rng = makeRng(Date.now());
  
  // Create all systems
  const map = new MapManager(log, rng.fork('map'));
  const battle = new BattleManager(log, rng.fork('battle'));
  const unit = new UnitManager(log, rng.fork('unit'));
  const economy = new EconomyManager(log, rng.fork('economy'));
  const route = new RouteManager(log, rng.fork('route'));
  const save = new SaveManager(log, rng.fork('save'));
  
  return new GameController(log, rng, map, battle, unit, economy, route, save);
}

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.type !== InteractionType.ApplicationCommand) return;

  const userId = interaction.user.id;

  // /start - Begin new adventure
  if (interaction.commandName === 'start') {
    const game = createUserGame(userId);
    await game.initialize();
    
    // Create player unit
    await game.getUnitManager().createUnit({
      id: `${userId}-hero`,
      name: interaction.user.username,
      level: 1,
      team: 'player',
    });

    games.set(userId, game);

    // Start run
    await game.getRouteManager().startRun(userId, Date.now());

    // Get initial choices
    const choices = await game.getRouteManager().getChoices();
    
    if (choices.ok) {
      await interaction.reply({
        content: '⚔️ **Adventure Started!**\n\nChoose your path:',
        components: [{
          type: 1,  // Action Row
          components: choices.value.map(c => ({
            type: 2,  // Button
            style: 1, // Primary
            label: `Path ${c.label}`,
            customId: `choice:${c.id}`,
          }))
        }]
      });
    }
  }

  // /stats - Show current status
  if (interaction.commandName === 'stats') {
    const game = games.get(userId);
    if (!game) {
      await interaction.reply('❌ No active game! Use /start first.');
      return;
    }

    const pointer = game.getRouteManager().current();
    const gold = game.getEconomyManager().getCurrency(userId).gold;
    const units = game.getUnitManager().getAllUnits();

    await interaction.reply({
      content: `📊 **Your Stats**\n\n` +
        `Step: ${pointer?.step ?? 0}\n` +
        `Gold: ${gold}g\n` +
        `Units: ${units.length}`,
      ephemeral: true,
    });
  }

  // /save - Save progress
  if (interaction.commandName === 'save') {
    const game = games.get(userId);
    if (!game) {
      await interaction.reply('❌ No active game!');
      return;
    }

    const result = await game.getSaveManager().save(`discord-${userId}`);
    
    if (result.ok) {
      await interaction.reply('💾 Game saved successfully!');
    } else {
      await interaction.reply(`❌ Save failed: ${result.error}`);
    }
  }
});

// Handle button clicks
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.type !== InteractionType.MessageComponent) return;
  if (!interaction.customId.startsWith('choice:')) return;

  const userId = interaction.user.id;
  const game = games.get(userId);

  if (!game) {
    await interaction.reply({ content: '❌ Game session expired!', ephemeral: true });
    return;
  }

  const choiceId = interaction.customId.replace('choice:', '');
  const chosen = await game.getRouteManager().choose(choiceId);

  if (!chosen.ok) {
    await interaction.reply({ content: `❌ Error: ${chosen.error}`, ephemeral: true });
    return;
  }

  // Generate arena
  const arena = await game.getMapManager().generate({
    width: chosen.value.choice.arenaHint.width,
    height: chosen.value.choice.arenaHint.height,
    seed: chosen.value.choice.arenaSeed,
  });

  // Run battle
  const players = game.getUnitManager().getTeamUnits('player');
  const enemies = game.getUnitManager().getTeamUnits('enemy');

  // Create enemy if none
  if (enemies.length === 0) {
    await game.getUnitManager().createUnit({
      id: `${userId}-goblin`,
      name: 'Goblin',
      level: 2,
      team: 'enemy',
    });
  }

  const allUnits = [...players, ...game.getUnitManager().getTeamUnits('enemy')];
  await game.getBattleManager().startBattle(allUnits);
  const battleResult = await game.getBattleManager().executeRound();

  if (battleResult.ok) {
    const log = game.getBattleManager().getCombatLog();
    const winner = battleResult.value.winner;

    await interaction.reply({
      content: `⚔️ **Battle Complete!**\n\n` +
        `Winner: ${winner === 'player' ? '🎉 You!' : '💀 Enemy'}\n` +
        `Actions: ${log.length}\n\n` +
        (winner === 'player' ? '💰 +100 gold!' : ''),
    });

    if (winner === 'player') {
      await game.getEconomyManager().awardBattleReward(userId, 100, [
        { itemId: 'health_potion', probability: 30 },
      ]);
    }
  }

  await game.getBattleManager().endBattle();
  await game.getSaveManager().autoSave();

  // Show next choices
  const nextChoices = await game.getRouteManager().getChoices();
  
  if (nextChoices.ok) {
    await interaction.followUp({
      content: 'Choose your next path:',
      components: [{
        type: 1,
        components: nextChoices.value.map(c => ({
          type: 2,
          style: 1,
          label: `Path ${c.label}`,
          customId: `choice:${c.id}`,
        }))
      }]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
```

**Setup:**
1. Install: `npm install discord.js`
2. Create bot at https://discord.com/developers
3. Set `DISCORD_TOKEN` environment variable
4. Run: `tsx examples/discord-bot/index.ts`

---

## REST API Server

Express.js API for web/mobile frontends:

```typescript
import express from 'express';
import { GameController } from 'nextrealdeal';
import { makeRng } from 'nextrealdeal/util/Rng';
import { ConsoleLogger } from 'nextrealdeal/util/Logger';

const app = express();
app.use(express.json());

const games = new Map<string, GameController>();
const log = new ConsoleLogger('info');

// POST /api/game/start
app.post('/api/game/start', async (req, res) => {
  const { playerId, seed } = req.body;

  const rng = makeRng(seed || Date.now());
  const game = createGame(log, rng);
  await game.initialize();

  games.set(playerId, game);

  await game.getRouteManager().startRun(playerId, seed || Date.now());

  res.json({ 
    success: true, 
    playerId,
    message: 'Game started' 
  });
});

// GET /api/game/:playerId/choices
app.get('/api/game/:playerId/choices', async (req, res) => {
  const game = games.get(req.params.playerId);
  
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const choices = await game.getRouteManager().getChoices();

  if (choices.ok) {
    res.json({ choices: choices.value });
  } else {
    res.status(400).json({ error: choices.error });
  }
});

// POST /api/game/:playerId/choose
app.post('/api/game/:playerId/choose', async (req, res) => {
  const game = games.get(req.params.playerId);
  const { choiceId } = req.body;

  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const result = await game.getRouteManager().choose(choiceId);

  if (result.ok) {
    // Generate arena
    const arena = await game.getMapManager().generate({
      width: result.value.choice.arenaHint.width,
      height: result.value.choice.arenaHint.height,
      seed: result.value.choice.arenaSeed,
    });

    res.json({
      step: result.value.step,
      choice: result.value.choice,
      arena: arena.ok ? arena.value : null,
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// GET /api/game/:playerId/status
app.get('/api/game/:playerId/status', async (req, res) => {
  const game = games.get(req.params.playerId);
  
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const pointer = game.getRouteManager().current();
  const gold = game.getEconomyManager().getCurrency(req.params.playerId).gold;
  const inventory = game.getEconomyManager().getInventory(req.params.playerId);

  res.json({
    runId: pointer?.runId,
    step: pointer?.step,
    gold,
    items: inventory.items.length,
  });
});

// POST /api/game/:playerId/save
app.post('/api/game/:playerId/save', async (req, res) => {
  const game = games.get(req.params.playerId);
  const { slotName } = req.body;

  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  const result = await game.getSaveManager().save(slotName || 'autosave');

  if (result.ok) {
    res.json({ success: true, slot: slotName });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.listen(3000, () => {
  console.log('🎮 NextRealDeal API running on http://localhost:3000');
});
```

**API Endpoints:**
- `POST /api/game/start` - Start new game
- `GET /api/game/:id/choices` - Get current choices
- `POST /api/game/:id/choose` - Make choice
- `GET /api/game/:id/status` - Get game status
- `POST /api/game/:id/save` - Save progress

---

## Testing Integration

Using NextRealDeal in your test suite:

```typescript
import { describe, test, expect } from 'vitest';
import { createGame } from './gameFactory';
import { makeRng } from 'nextrealdeal/util/Rng';

describe('Full Game Flow Integration', () => {
  test('complete run: 10 battles with deterministic outcomes', async () => {
    const log = makeLogger({ enabled: false });
    const rng = makeRng(12345); // Fixed seed

    const game = createGame(log, rng);
    await game.initialize();

    await game.getRouteManager().startRun('test-run', 12345);

    for (let i = 0; i < 10; i++) {
      // Get choices
      const choices = await game.getRouteManager().getChoices();
      expect(choices.ok).toBe(true);

      if (choices.ok) {
        // Always choose A for determinism
        const choiceA = choices.value.find(c => c.label === 'A')!;
        const chosen = await game.getRouteManager().choose(choiceA.id);

        expect(chosen.ok).toBe(true);

        if (chosen.ok) {
          // Verify arena seed is deterministic
          expect(chosen.value.choice.arenaSeed).toBeGreaterThan(0);

          // Generate and verify arena
          const arena = await game.getMapManager().generate({
            width: chosen.value.choice.arenaHint.width,
            height: chosen.value.choice.arenaHint.height,
            seed: chosen.value.choice.arenaSeed,
          });

          expect(arena.ok).toBe(true);
          
          if (arena.ok) {
            expect(arena.value.rooms.length).toBeGreaterThan(0);
          }
        }
      }
    }

    // Verify final state
    const pointer = game.getRouteManager().current();
    expect(pointer?.step).toBe(10);

    await game.destroy();
  });

  test('save/load preserves game state', async () => {
    const game = createGame(makeLogger({ enabled: false }), makeRng(999));
    await game.initialize();

    // Register subsystems
    game.getSaveManager().register({
      name: 'route',
      serialize: () => game.getRouteManager().serialize(),
      deserialize: json => game.getRouteManager().deserialize(json),
    });

    // Play for a bit
    await game.getRouteManager().startRun('test', 777);
    
    const choices = await game.getRouteManager().getChoices();
    if (choices.ok) {
      await game.getRouteManager().choose(choices.value[0].id);
    }

    // Save
    await game.getSaveManager().save('test-save');

    const beforeStep = game.getRouteManager().current()?.step;

    // Load
    const loadResult = await game.getSaveManager().load('test-save');
    expect(loadResult.ok).toBe(true);

    const afterStep = game.getRouteManager().current()?.step;
    expect(afterStep).toBe(beforeStep);

    await game.destroy();
  });
});
```

---

## Performance Benchmarking

Measure engine performance:

```typescript
import { performance } from 'perf_hooks';

async function benchmark() {
  const game = createGame(log, rng);
  await game.initialize();

  // Benchmark map generation
  const mapStart = performance.now();
  
  for (let i = 0; i < 100; i++) {
    await game.getMapManager().generate({
      width: 64,
      height: 64,
      seed: i,
    });
  }
  
  const mapTime = performance.now() - mapStart;
  console.log(`Map generation: ${mapTime / 100}ms per map`);

  // Benchmark battles
  const battleStart = performance.now();

  for (let i = 0; i < 100; i++) {
    const units = [
      /* create test units */
    ];
    
    await game.getBattleManager().startBattle(units);
    await game.getBattleManager().executeRound();
    await game.getBattleManager().endBattle();
  }

  const battleTime = performance.now() - battleStart;
  console.log(`Battle execution: ${battleTime / 100}ms per battle`);

  await game.destroy();
}
```

**Expected Performance (64×64 maps, 10 units):**
- Map generation: ~15ms
- Battle round: ~2ms
- Save operation: ~5ms

---

## Common Patterns

### Factory Function

```typescript
function createGame(log: ILogger, rng: IRng): GameController {
  const map = new MapManager(log, rng.fork('map'));
  const battle = new BattleManager(log, rng.fork('battle'));
  const unit = new UnitManager(log, rng.fork('unit'));
  const economy = new EconomyManager(log, rng.fork('economy'));
  const route = new RouteManager(log, rng.fork('route'));
  const save = new SaveManager(log, rng.fork('save'));

  return new GameController(log, rng, map, battle, unit, economy, route, save);
}
```

### Error Handling with Logging

```typescript
const result = await operation();

if (!result.ok) {
  log.error('Operation failed', { 
    error: result.error,
    context: 'additional info'
  });
  
  // Handle gracefully
  return fallbackValue;
}
```

### AbortController for Timeouts

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const result = await longRunningOperation(controller.signal);
  clearTimeout(timeout);
  
  if (result.ok) {
    // Success
  }
} catch (e) {
  if (e.name === 'AbortError') {
    console.log('Operation timed out');
  }
}
```

---

## See Also

- [API Reference](./API.md) - Complete API documentation
- [CHANGELOG](./CHANGELOG.md) - Version history
- [GitHub Repository](https://github.com/yourusername/NextRealDeal)

