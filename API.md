# NextRealDeal API Reference (v1.0)

## Overview

NextRealDeal is a headless game engine for battle-first roguelikes. It provides deterministic gameplay, cross-platform save/load, and clean system separation.

**Key Features:**
- 🎲 Deterministic gameplay (full replay support)
- ⚔️ Turn-based tactical combat
- 🗺️ Procedural map generation (BSP algorithm)
- 💰 Economy system (currency, shop, loot)
- 🛤️ Meta-map progression (Slay the Spire style)
- 💾 Cross-platform save/load
- 🧪 256 tests (82% coverage)

## Installation

```bash
npm install nextrealdeal
```

Or use directly from source:

```typescript
import { GameController } from './src/core/GameController.js';
import { MapManager } from './src/map/MapManager.js';
// ... other imports
```

---

## Core Concepts

### Deterministic RNG

All randomness uses seeded pseudo-random number generation:

```typescript
import { makeRng } from './src/util/Rng.js';

// Create root RNG (use as fork factory only)
const rng = makeRng(20251016);

// Fork for each subsystem (guaranteed independent streams)
const mapRng = rng.fork('map');
const battleRng = rng.fork('battle');

// Use forked RNGs, NOT the root
const randomNumber = mapRng.int(1, 100);
```

**Important:** Never call methods on the root RNG after forking. Use it as a fork factory only.

### Result Types

All operations return `Result<T, E>` instead of throwing:

```typescript
import { ok, err } from './src/util/Result.js';

const result = await system.operation();

if (result.ok) {
  const data = result.value;  // Success
} else {
  const error = result.error; // Error code (string)
}
```

### System Architecture

All systems extend `SystemTemplate` with lifecycle methods:

```typescript
await system.initialize();      // Setup
await system.update(deltaTime); // Per-frame (if needed)
await system.destroy();          // Cleanup
```

Systems use constructor dependency injection:

```typescript
const system = new SystemManager(logger, rng);
```

---

## Systems

### MapManager

**Purpose:** Procedural battle arena generation using Binary Space Partitioning (BSP).

**Constructor:**
```typescript
new MapManager(log: ILogger, rng: IRng)
```

**Methods:**

#### `generate(config, signal?)`

Generates a deterministic battle arena.

**Parameters:**
- `config.width` (number, 16-128, even): Arena width in tiles
- `config.height` (number, 16-128, even): Arena height in tiles
- `config.seed` (number): Deterministic seed for generation
- `config.minRoomSize` (number, optional): Minimum room size (default: 5)
- `config.maxRoomSize` (number, optional): Maximum room size (default: 15)
- `config.extraLoopsPct` (number, optional): Extra corridor percentage (default: 12)
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<Result<MapData, string>>`

**Example:**
```typescript
const result = await mapManager.generate({ 
  width: 48, 
  height: 48, 
  seed: 12345 
});

if (result.ok) {
  console.log(`Map: ${result.value.width}×${result.value.height}`);
  console.log(`Rooms: ${result.value.rooms.length}`);
  console.log(`Spawn: (${result.value.spawn.x}, ${result.value.spawn.y})`);
}
```

#### `getTile(data, x, y)`

Get tile type at position.

**Returns:** `number | undefined` (0=floor, 1=wall, 2=water, 3=door, 4=spawn, 5=exit)

#### `isWalkable(tileType)`

Check if tile type is walkable (floor, door, spawn, exit).

**Returns:** `boolean`

---

### BattleManager

**Purpose:** Turn-based combat with deterministic initiative and damage calculation.

**Constructor:**
```typescript
new BattleManager(log: ILogger, rng: IRng)
```

**Methods:**

#### `startBattle(units, signal?)`

Initialize a new battle with given units.

**Parameters:**
- `units` (Unit[]): Array of combat units (players + enemies)
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<Result<BattleState, string>>`

**Example:**
```typescript
const units = [
  { id: 'hero', hp: 100, maxHp: 100, atk: 25, def: 10, speed: 60 },
  { id: 'goblin', hp: 50, maxHp: 50, atk: 15, def: 5, speed: 40 },
];

const result = await battleManager.startBattle(units);

if (result.ok) {
  console.log('Battle started!');
  console.log('Turn order:', result.value.turnOrder);
}
```

#### `executeRound(signal?)`

Execute one full combat round (all units take turns).

**Returns:** `Promise<Result<RoundResult, string>>`

**Damage Formula:**
```
1. Check dodge (5% chance) → damage = 0
2. Base damage = attacker.atk - ⌊target.def / 2⌋
3. Add variance: ±2 (random)
4. Check critical (10% chance) → damage × 1.5
5. Clamp to non-negative
```

#### `attack(attackerId, targetId, signal?)`

Execute single attack between two units.

**Returns:** `Promise<Result<CombatResult, string>>`

---

### UnitManager

**Purpose:** Character management with equipment and stats.

**Constructor:**
```typescript
new UnitManager(log: ILogger, rng: IRng)
```

**Methods:**

#### `createUnit(config, signal?)`

Create a new game unit.

**Parameters:**
- `config.id` (string): Unique unit ID
- `config.name` (string): Display name
- `config.level` (number, optional): Level (default: 1)
- `config.team` ('player' | 'enemy'): Team designation
- `config.baseStats` (optional): Custom base stats

**Returns:** `Promise<Result<GameUnit, string>>`

**Example:**
```typescript
const result = await unitManager.createUnit({
  id: 'hero',
  name: 'Hero',
  level: 5,
  team: 'player',
  baseStats: { atk: 30, def: 15, speed: 55 }
});
```

#### `equipItem(unitId, item, signal?)`

Equip an item to a unit.

**Returns:** `Promise<Result<GameUnit, string>>`

#### `getEffectiveStats(unitId)`

Get unit stats with equipment bonuses applied.

**Returns:** `EffectiveStats | undefined`

---

### EconomyManager

**Purpose:** Currency, items, shop, and loot management.

**Constructor:**
```typescript
new EconomyManager(log: ILogger, rng: IRng)
```

**Methods:**

#### `modifyCurrency(playerId, delta, signal?)`

Add or subtract gold from player.

**Parameters:**
- `delta` (number): Amount to add (positive) or subtract (negative)

**Returns:** `Promise<Result<Currency, string>>`

**Constraints:** Gold stays in range [0, 999,999,999]

#### `purchaseItem(playerId, itemId, signal?)`

Buy item from shop (atomic transaction with rollback).

**Returns:** `Promise<Result<Item, string>>`

**Default Shop Items:**
- Iron Sword: 100g, stock: 10, +10 ATK
- Wooden Shield: 80g, stock: 10, +5 DEF
- Health Potion: 50g, stock: ∞, +50 HP

#### `rollLoot(dropTable, signal?)`

Roll for loot using first-match algorithm.

**Parameters:**
- `dropTable` (ItemDrop[]): Array of {itemId, probability (0-100)}

**Returns:** `Promise<Result<Item | null, string>>`

**Algorithm:** First item with successful roll wins (single drop).

---

### RouteManager

**Purpose:** Slay the Spire-style meta-map with branching choices.

**Constructor:**
```typescript
new RouteManager(log: ILogger, rng: IRng)
```

**Methods:**

#### `startRun(runId, seed, signal?, opts?)`

Start a new run.

**Parameters:**
- `runId` (string): Unique run identifier
- `seed` (number | string): Deterministic seed
- `opts.force` (boolean, optional): Overwrite existing run

**Returns:** `Promise<Result<RunState, RouteError>>`

#### `getChoices(signal?)`

Get 3 battle choices for current step (A/B/C).

**Returns:** `Promise<Result<readonly Choice[], RouteError>>`

**Caching:** Choices computed once per step, cached until chosen.

#### `choose(choiceId, signal?)`

Make a choice and advance to next step.

**Returns:** `Promise<Result<Chosen, RouteError>>`

**Example:**
```typescript
const choices = await routeManager.getChoices();

if (choices.ok) {
  const choiceB = choices.value.find(c => c.label === 'B')!;
  const result = await routeManager.choose(choiceB.id);
  
  if (result.ok) {
    const arenaSeed = result.value.choice.arenaSeed;
    // Use this seed for MapManager.generate()
  }
}
```

---

### SaveManager

**Purpose:** Cross-platform persistence with versioning.

**Constructor:**
```typescript
new SaveManager(log: ILogger, rng: IRng)
```

**Initialization:**
```typescript
await saveManager.initialize(undefined, {
  store: new InMemorySaveStore()  // or LocalStorageSaveStore()
});
```

**Methods:**

#### `register(subsystem)`

Register a subsystem for auto-save.

**Parameters:**
- `subsystem.name` (string): Subsystem identifier
- `subsystem.serialize` (() => string): Serialization function
- `subsystem.deserialize` ((json: string) => Result<void, string>): Deserialization function

**Example:**
```typescript
saveManager.register({
  name: 'route',
  serialize: () => routeManager.serialize(),
  deserialize: json => routeManager.deserialize(json),
});
```

#### `save(slot, signal?)`

Save all registered subsystems to slot (registry mode).

**Returns:** `Promise<Result<void, SaveError>>`

#### `load(slot, signal?, opts?)`

Load save from slot.

**Parameters:**
- `opts.apply` (boolean, optional): Apply to subsystems (default: true)

**Returns:** `Promise<Result<SaveEnvelope, SaveError>>`

#### `autoSave(slot?, signal?)`

Quick save to 'autosave' slot (or custom name).

**Returns:** `Promise<Result<void, SaveError>>`

---

### GameController

**Purpose:** Composition root that wires all systems together.

**Constructor:**
```typescript
new GameController(
  log: ILogger,
  rng: IRng,
  mapSystem: IMapSystem,
  battleSystem: IBattleSystem,
  unitSystem: IUnitSystem,
  economySystem: IEconomySystem,
  routeSystem: IRouteSystem,
  saveSystem: ISaveSystem
)
```

**Lifecycle:**
```
Initialize: Map → Battle → Unit → Economy → Route → Save
Update:     All systems (parallel)
Destroy:    Save → Route → Economy → Unit → Battle → Map (reverse)
```

**Getters:**
- `getMapManager()`: IMapSystem
- `getBattleManager()`: IBattleSystem
- `getUnitManager()`: IUnitSystem
- `getEconomyManager()`: IEconomySystem
- `getRouteManager()`: IRouteSystem
- `getSaveManager()`: ISaveSystem

---

## Type Definitions

### MapData
```typescript
interface MapData {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];  // { x, y, t: 0-5 }
  readonly rooms: readonly Room[];
  readonly connectors: readonly Connector[];
  readonly spawn: Position;
  readonly exit: Position;
  readonly seed: number;
  readonly algorithm: string;
}
```

### Unit
```typescript
interface Unit {
  readonly id: string;
  readonly hp: number;          // Current HP (0-9999)
  readonly maxHp: number;       // Maximum HP (1-9999)
  readonly atk: number;         // Attack (0-999)
  readonly def: number;         // Defense (0-999)
  readonly speed: number;       // Initiative (1-999)
}
```

### Choice
```typescript
interface Choice {
  readonly id: string;          // "runId:s{step}:i{idx}:lbl{label}"
  readonly step: number;
  readonly type: 'battle';
  readonly label: 'A' | 'B' | 'C';
  readonly arenaSeed: number;   // For MapManager.generate()
  readonly arenaHint: {
    readonly width: number;     // Always even
    readonly height: number;    // Always even
  };
}
```

---

## Error Handling

### Result Pattern

```typescript
const result = await system.operation();

if (result.ok) {
  const data = result.value;
  // Handle success
} else {
  const errorCode = result.error;
  // Handle specific error
  
  switch (errorCode) {
    case 'insufficient-funds':
      console.log('Not enough gold!');
      break;
    case 'aborted':
      console.log('Operation cancelled');
      break;
    default:
      console.error('Unknown error:', errorCode);
  }
}
```

### Common Error Codes

**Map System:**
- `'invalid-config'` - Configuration validation failed
- `'aborted'` - Operation cancelled via AbortSignal

**Battle System:**
- `'no-active-battle'` - Battle not started
- `'attacker-dead'` / `'target-dead'` - Invalid combatant
- `'aborted'` - Operation cancelled

**Economy System:**
- `'insufficient-funds'` - Not enough gold
- `'inventory-full'` - Max 100 items reached
- `'out-of-stock'` - Shop item unavailable
- `'item-not-found'` - Item doesn't exist

**Route System (RouteError):**
- `ROUTE_ERR.NoRun` - No active run
- `ROUTE_ERR.RunActive` - Run already started (use force option)
- `ROUTE_ERR.InvalidChoice` - Choice ID not found
- `ROUTE_ERR.StaleStep` - Choice from previous step
- `ROUTE_ERR.Finished` - Step limit reached (10,000)

**Save System (SaveError):**
- `SAVE_ERR.SlotNotFound` - Save slot doesn't exist
- `SAVE_ERR.InvalidSlot` - Invalid slot name format
- `SAVE_ERR.ApplyFailed` - Subsystem deserialization failed
- `SAVE_ERR.UnsupportedVersion` - Save from future version

---

## Advanced Usage

### Custom Save Stores

Implement `ISaveStore` for custom persistence backends:

```typescript
class DatabaseSaveStore implements ISaveStore {
  async write(slot: string, payload: string): Promise<void> {
    await db.saves.upsert({ slot, data: payload, modified: new Date() });
  }

  async read(slot: string): Promise<string> {
    const save = await db.saves.findOne({ slot });
    if (!save) throw new Error('ENOENT: Slot not found');
    return save.data;
  }

  async delete(slot: string): Promise<void> {
    await db.saves.deleteOne({ slot });
  }

  async list(): Promise<Array<{ slot: string; modified: string; size: number }>> {
    const saves = await db.saves.find({}).toArray();
    return saves.map(s => ({
      slot: s.slot,
      modified: s.modified.toISOString(),
      size: Buffer.byteLength(s.data, 'utf8')
    }));
  }
}

await saveManager.initialize(undefined, { 
  store: new DatabaseSaveStore() 
});
```

### Property-Based Testing

Use fast-check for invariant testing:

```typescript
import fc from 'fast-check';

test('currency never goes negative', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: -100, max: 100 })),
      async (deltas) => {
        const economy = new EconomyManager(log, rng);
        await economy.initialize();
        await economy.modifyCurrency('player', 1000);

        for (const delta of deltas) {
          await economy.modifyCurrency('player', delta);
        }

        const currency = economy.getCurrency('player');
        expect(currency.gold).toBeGreaterThanOrEqual(0);

        await economy.destroy();
      }
    ),
    { numRuns: 100 }
  );
});
```

---

## Best Practices

### 1. Always Initialize Systems

```typescript
const system = new MapManager(log, rng);
await system.initialize();  // ✅ Required before use
```

### 2. Use AbortSignal for Cancellable Operations

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 1000); // Cancel after 1s

const result = await mapManager.generate(config, controller.signal);
```

### 3. Fork RNG for Each Subsystem

```typescript
const rootRng = makeRng(seed);

// ✅ Correct
const mapRng = rootRng.fork('map');
const battleRng = rootRng.fork('battle');

// ❌ Wrong - don't use root after forking
const number = rootRng.int(1, 100);  // BAD!
```

### 4. Register Save Subsystems at Startup

```typescript
saveManager.register({
  name: 'route',
  serialize: () => routeManager.serialize(),
  deserialize: json => routeManager.deserialize(json),
});

// Now autoSave() includes route state
await saveManager.autoSave();
```

### 5. AutoSave After Important Events

```typescript
// After choice
await routeManager.choose(choiceId);
await saveManager.autoSave();

// After battle
if (battleWon) {
  await economyManager.awardBattleReward(...);
  await saveManager.autoSave();
}
```

---

## Troubleshooting

### Q: Tests fail with RNG errors

**A:** Ensure you're using `makeRng()`, not `Math.random()`. ESLint should catch this.

### Q: "queue deadlock" or operations hang

**A:** Don't call public async methods from within other public async methods. Use internal methods instead.

### Q: Save/load doesn't work in browser

**A:** Use `LocalStorageSaveStore` instead of `InMemorySaveStore`:

```typescript
import { LocalStorageSaveStore } from 'nextrealdeal/save/SaveStore';

await saveManager.initialize(undefined, {
  store: new LocalStorageSaveStore()
});
```

### Q: Maps always generate the same layout

**A:** This is intentional! Use different seeds for variety:

```typescript
// Different seed each time
const seed = Date.now();
await mapManager.generate({ width: 64, height: 64, seed });
```

### Q: Battle outcomes not deterministic

**A:** Ensure you create battle-local RNG via `startBattle()`. The system does this automatically.

---

## Performance Tips

### Large Unit Counts

The engine supports up to 200 units per battle. For best performance:

- Keep battles under 50 units for sub-100ms rounds
- Use smaller arenas (32×32) for faster generation
- Batch operations when possible

### Save File Sizes

- Registry mode: ~1-5KB per save
- Payload mode: ~10-50KB per save
- Store uses gzip-friendly JSON (compresses well)

### Memory Management

All systems use `destroy()` for cleanup:

```typescript
await game.destroy();  // Cleans up all 6 systems + controller
```

---

## Version Compatibility

**Current Version:** v1.0

**Save Format:** v1 (migration-ready)

**Breaking Changes:** None (initial release)

**Deprecations:** None

---

## Further Reading

- `CHANGELOG.md` - Release history
- `EXAMPLES.md` - Integration examples
- `docs/BUGS_LEARNED.md` - Known issues and fixes
- `docs/adr/0001-platform-and-stack.md` - Architecture decisions

---

## License

MIT License - See LICENSE file for details.

