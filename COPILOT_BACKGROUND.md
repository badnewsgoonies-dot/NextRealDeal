# Copilot Background for NextRealDeal

## Summary

NextRealDeal is a **production-ready headless game engine** for battle-first roguelikes built with TypeScript. It features deterministic gameplay, turn-based tactical combat, procedural map generation (BSP algorithm), branching meta-map progression (Slay the Spire style), and cross-platform save/load. The engine is fully tested (256 tests, 82% coverage) and follows strict architectural patterns including dependency injection, AsyncQueue serialization, Result types, and deterministic RNG.

---

## Project Structure

```
NextRealDeal/
├── src/
│   ├── core/           # GameController (composition root), SystemTemplate (base class)
│   ├── map/            # MapManager (BSP procedural generation)
│   ├── battle/         # BattleManager (turn-based combat)
│   ├── unit/           # UnitManager (character management)
│   ├── economy/        # EconomyManager (currency, shops, loot)
│   ├── route/          # RouteManager (meta-map progression)
│   ├── save/           # SaveManager (persistence), SaveStore (storage abstraction)
│   ├── ui/             # React UI (Vite + React Router + Tailwind)
│   │   ├── components/ # Reusable UI components (BattleHUD, etc.)
│   │   ├── context/    # GameContext (React DI for GameController)
│   │   ├── routes/     # MenuRoute, RouteRoute
│   │   ├── canvas/     # GameCanvas (DPR-aware canvas component)
│   │   └── hooks/      # useRafLoop (requestAnimationFrame hook)
│   ├── util/           # AsyncQueue, Result, Rng, Scope, Logger
│   ├── types/          # contracts.ts (all TypeScript interfaces)
│   └── validation/     # Valibot schemas for runtime validation
├── tests/
│   ├── unit/           # System tests (map/, battle/, unit/, economy/, route/, save/, core/)
│   ├── util/           # Utility tests (asyncQueue, rng, etc.)
│   ├── helpers/        # Test helpers (BFS for map validation, stubs)
│   └── smoke/          # Smoke/CI tests
├── docs/
│   ├── adr/            # Architecture Decision Records
│   ├── BUGS_LEARNED.md # Bug tracking and prevention patterns
│   ├── SPEC-7-UI-System.md
│   └── UI-DESIGN-DECISIONS.md
├── examples/           # Integration examples (simple-demo/)
├── scripts/            # perf.ts (performance benchmarking)
├── Package.json        # NPM scripts, dependencies
├── tsconfig.json       # TypeScript config (strict mode, ES2022)
├── vitest.config.ts    # Test config (coverage thresholds)
├── eslint.config.js    # Linter (500 line limit, Math.random() banned)
└── vite.config.ts      # Vite config for UI
```

---

## Platform & Technologies

### Core Stack
- **TypeScript 5.9+**: Strict mode, ESM modules
- **Node 20+**: Runtime environment
- **Vite 5.4+**: Build tool and dev server for UI
- **React 19+**: UI framework with React Router
- **Tailwind CSS 4.1+**: Styling framework

### Key Libraries
- **pure-rand**: Deterministic RNG (xoroshiro128plus algorithm)
- **valibot**: Lightweight schema validation
- **vitest**: Test framework (256 tests, 82% coverage)
- **fast-check**: Property-based testing
- **eslint**: Code quality (max 500 lines/file, complexity ≤12)
- **dependency-cruiser, madge**: Dependency analysis

### Browser Compatibility
- Modern browsers (ES2022+ support)
- LocalStorage for persistence
- Canvas API for rendering

---

## Architecture Patterns (Phase-0 - Strictly Enforced)

### 1. Dependency Injection (Constructor-Only)

All systems receive dependencies through constructors. **Never** instantiate another system with `new`.

```typescript
// ✅ CORRECT
class SystemManager extends SystemTemplate {
  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'SystemName' });
  }
}

// ❌ WRONG - Don't do this
class SystemManager extends SystemTemplate {
  constructor() {
    this.log = new ConsoleLogger(); // Don't instantiate dependencies!
  }
}
```

### 2. AsyncQueue Serialization

All async operations must go through an `AsyncQueue` to prevent race conditions.

```typescript
export class SystemManager extends SystemTemplate {
  private readonly queue: IAsyncQueue = makeAsyncQueue();

  async operation(signal?: AbortSignal): Promise<Result<T, string>> {
    return await this.queue.run(async () => {
      if (signal?.aborted) return err('aborted');
      // ... operation logic
      return ok(result);
    }, { signal });
  }
}
```

**Critical**: Operations serialize automatically even when called concurrently. This prevents race conditions on shared state.

### 3. Result Types (No Throwing for Expected Failures)

Use `Result<T, E>` for expected failures (validation, business logic). Only throw for unexpected programmer errors.

```typescript
import { ok, err, type Result } from '../util/Result.js';

async function loadData(): Promise<Result<Data, string>> {
  if (!fileExists) return err('file-not-found');
  if (!valid) return err('invalid-format');
  return ok(data);
}

// Usage
const result = await loadData();
if (result.ok) {
  console.log(result.value); // Success
} else {
  console.error(result.error); // Typed error string
}
```

### 4. Deterministic RNG (No Math.random())

All randomness uses seeded RNG. `Math.random()` is **banned** by ESLint.

```typescript
// Root RNG - use as fork factory only
const rootRng = makeRng(seed);

// Fork for each subsystem (guaranteed independent streams)
const mapRng = rootRng.fork('map');
const battleRng = rootRng.fork('battle');

// Use forked RNGs, NOT the root
const value = mapRng.int(0, 100);  // ✅ CORRECT
const value = rootRng.int(0, 100); // ❌ WRONG - Don't use root after forking
```

**Critical Bug Fix**: The `fork()` implementation uses `jump()` to create independent sub-streams AND advances parent state. See `docs/BUGS_LEARNED.md` for details.

### 5. SystemTemplate Lifecycle

All systems extend `SystemTemplate` and implement lifecycle hooks:

```typescript
export class SystemManager extends SystemTemplate {
  constructor(log: ILogger, rng: IRng) {
    super({ name: 'SystemName' });
  }

  protected async onInitialize(): Promise<void> {
    // Setup logic
  }

  protected async onUpdate(deltaTime: number): Promise<void> {
    // Per-frame logic (optional)
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup logic
  }
}
```

### 6. Resource Cleanup with Scope

Use `Scope` for automatic resource cleanup (event listeners, timers, etc.):

```typescript
const scope = makeScope();
const handler = () => { /* ... */ };
emitter.on('event', handler);
scope.add(() => emitter.off('event', handler));

// Later...
await scope.dispose(); // Automatically cleans up all registered resources
```

---

## Core Systems

### GameController (Composition Root)

**Path**: `src/core/GameController.ts`

**Purpose**: Wires all systems together. **Zero game logic** - pure dependency injection and lifecycle coordination.

**Initialization Order**: Map → Battle → Unit → Economy → Route → Save

**Destruction Order**: Save → Route → Economy → Unit → Battle → Map (reverse)

**Key Methods**:
- `initialize(signal?)`: Initialize all systems in order
- `update(dt, signal?)`: Update all systems (optional per-frame logic)
- `destroy()`: Cleanup all systems in reverse order
- `getMapManager()`, `getBattleManager()`, etc.: System accessors

**Example**:
```typescript
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
```

---

### MapManager (Procedural Generation)

**Path**: `src/map/MapManager.ts`

**Purpose**: Generate battle arenas using Binary Space Partitioning (BSP) algorithm.

**Algorithm**:
1. Recursive space partitioning (depth 2-5)
2. Room placement (5×5 to 15×15, configurable)
3. L-shaped corridors connecting rooms
4. Extra loops (10-15% for non-linearity)
5. Exactly 1 spawn point, 1 exit point
6. Full connectivity validation (BFS)

**Key Methods**:
- `generate(config, signal?)`: Generate a map
  - `config.width`, `config.height` (16-128, even numbers only)
  - `config.seed`: Deterministic seed
  - `config.minRoomSize`, `config.maxRoomSize`, `config.extraLoopsPct` (optional)
- `getTile(data, x, y)`: Get tile type at position (0=floor, 1=wall, 2=water, 3=door, 4=spawn, 5=exit)
- `isWalkable(tileType)`: Check if tile is walkable
- `getCurrentMap()`: Get last generated map

**Example**:
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

**Tests**: 37 tests, 96% coverage (including property-based tests)

---

### BattleManager (Turn-based Combat)

**Path**: `src/battle/BattleManager.ts`

**Purpose**: Deterministic turn-based combat with initiative ordering, dodge/crit mechanics.

**Combat Formula** (5 steps):
1. Dodge check (5%) → damage = 0
2. Base damage → `atk - floor(def/2)`
3. Variance → ±2 random
4. Critical (10%) → ×1.5 damage
5. Clamp → `max(0, damage)`

**Initiative**: Speed DESC, then input index ASC (stable sort)

**Key Features**:
- Battle-local RNG (prevents cross-battle contamination)
- Combat log with sequence numbers (deterministic)
- Typed combat actions and results
- AbortSignal support

**Key Methods**:
- `attack(attackerId, targetId, signal?)`: Execute single attack
- `startBattle(units, signal?)`: Initialize battle with units
- `executeRound(signal?)`: Execute one round (all unit turns)
- `endBattle()`: Cleanup battle state
- `getCurrentBattle()`: Get battle state
- `getCombatLog()`: Get combat action log

**Example**:
```typescript
await battleManager.startBattle([hero, goblin]);

const result = await battleManager.executeRound();
if (result.ok) {
  console.log(`Winner: ${result.value.winner}`);
  console.log(`Survivors: ${result.value.survivors.length}`);
}

await battleManager.endBattle();
```

**Tests**: 34 tests, 93% coverage

---

### UnitManager (Character Management)

**Path**: `src/unit/UnitManager.ts`

**Purpose**: Character creation, stats, teams, equipment, position tracking.

**Features**:
- Level-based stat scaling
- Equipment system (weapon, armor, accessory)
- Team management (player/enemy)
- Position tracking on maps
- Battle integration (converts to combat-ready units)

**Key Methods**:
- `createUnit(data, signal?)`: Create a unit
  - `data.id`, `data.name`, `data.level`, `data.team`
- `getUnit(id)`: Get unit by ID
- `getTeamUnits(team)`: Get all units in team ('player' or 'enemy')
- `deleteUnit(id, signal?)`: Remove unit
- `updateUnit(id, updates, signal?)`: Update unit stats/equipment
- `getAllUnits()`: Get all units

**Example**:
```typescript
await unitManager.createUnit({
  id: 'hero',
  name: 'Hero',
  level: 5,
  team: 'player',
});

const hero = unitManager.getUnit('hero');
const playerUnits = unitManager.getTeamUnits('player');
```

**Tests**: 34 tests, 93% coverage

---

### EconomyManager (Currency & Items)

**Path**: `src/economy/EconomyManager.ts`

**Purpose**: Currency management, shop system, inventory, loot drops.

**Features**:
- Gold currency (0 to 999,999,999)
- Item inventory (max 100 per player)
- Shop system with stock management
- Deterministic loot drops (first-match algorithm)
- Battle reward distribution
- Transaction rollback on failures

**Key Methods**:
- `modifyCurrency(playerId, amount, signal?)`: Add/subtract gold
- `getCurrency(playerId)`: Get player's gold
- `addItem(playerId, itemId, signal?)`: Add item to inventory
- `removeItem(playerId, itemId, signal?)`: Remove item from inventory
- `getInventory(playerId)`: Get player's items
- `awardBattleReward(playerId, gold, lootTable, signal?)`: Award post-battle rewards

**Example**:
```typescript
await economyManager.modifyCurrency('player', 500);
await economyManager.awardBattleReward('player', 100, [
  { itemId: 'health_potion', probability: 50 },
  { itemId: 'iron_sword', probability: 20 },
]);

const gold = economyManager.getCurrency('player');
const items = economyManager.getInventory('player');
```

**Tests**: 45 tests, 90% coverage (including property-based tests)

---

### RouteManager (Meta-Map Progression)

**Path**: `src/route/RouteManager.ts`

**Purpose**: Slay the Spire-style branching progression (battle → choice A/B/C → battle).

**Features**:
- 3 deterministic choices per step (cached)
- Versioned RNG (`route:v1 → run:v1 → step:v1`)
- Run lifecycle guards (prevent overwrites)
- Choice history tracking
- Serialization for save/load

**Key Methods**:
- `startRun(runId, seed, signal?, opts?)`: Start a new run
- `getChoices(signal?)`: Get 3 choices (A/B/C)
- `choose(choiceId, signal?)`: Select a choice
- `getCurrentRun()`: Get current run state
- `serialize()`: Export run state (JSON)
- `deserialize(json)`: Import run state

**Example**:
```typescript
await routeManager.startRun('adventure-001', 20251016);

const choicesResult = await routeManager.getChoices();
if (choicesResult.ok) {
  const [A, B, C] = choicesResult.value;
  console.log('Choices:', A.label, B.label, C.label);
  
  const chosen = await routeManager.choose(B.id);
  if (chosen.ok) {
    console.log(`Arena seed: ${chosen.value.choice.arenaSeed}`);
    console.log(`Arena size: ${chosen.value.choice.arenaHint.width}×${chosen.value.choice.arenaHint.height}`);
  }
}
```

**Tests**: 37 tests, 97% coverage

---

### SaveManager (Persistence)

**Path**: `src/save/SaveManager.ts`, `src/save/SaveStore.ts`

**Purpose**: Cross-system persistence with pluggable storage backends.

**Features**:
- Registry mode: Auto-gather from registered subsystems
- Payload mode: Manual SaveData for special cases
- Store abstraction: InMemorySaveStore (tests) or LocalStorageSaveStore (browser)
- Versioned envelopes (`v1`, migration-ready)
- Deterministic slot ordering

**Key Methods**:
- `register(subsystem)`: Register a subsystem for auto-save
  - `subsystem.name`, `subsystem.serialize()`, `subsystem.deserialize(json)`
- `save(slot, signal?, opts?)`: Save all registered subsystems
- `load(slot, signal?)`: Load and restore subsystems
- `listSlots(signal?)`: List all save slots
- `deleteSlot(slot, signal?)`: Delete a save slot
- `hasSlot(slot)`: Check if slot exists

**Example**:
```typescript
// Register subsystems
saveManager.register({
  name: 'route',
  serialize: () => game.getRouteManager().serialize(),
  deserialize: json => game.getRouteManager().deserialize(json),
});

// Save
await saveManager.save('autosave-1');

// Load
const loadResult = await saveManager.load('autosave-1');
if (loadResult.ok) {
  console.log('Game loaded successfully');
}

// List saves
const slots = await saveManager.listSlots();
```

**Tests**: 40 tests, 88% coverage

---

## Core Utilities

### AsyncQueue

**Path**: `src/util/AsyncQueue.ts`

**Purpose**: Serialize async operations to prevent race conditions.

```typescript
const queue = makeAsyncQueue();

// All operations execute in FIFO order
await Promise.all([
  queue.enqueue(async () => operation1()),
  queue.enqueue(async () => operation2()),
  queue.enqueue(async () => operation3()),
]); // Executes 1 → 2 → 3 (serialized)
```

### Result Types

**Path**: `src/util/Result.ts`

**Purpose**: Type-safe error handling without exceptions.

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Helpers
isOk(result);           // Type guard
isErr(result);          // Type guard
unwrap(result);         // Throws if Err
unwrapOr(result, def);  // Returns value or default
map(result, fn);        // Transform value
mapErr(result, fn);     // Transform error
andThen(result, fn);    // Chain results (flatMap)
combine(results);       // Combine array of results
```

### RNG

**Path**: `src/util/Rng.ts`

**Purpose**: Deterministic random number generation.

```typescript
interface IRng {
  int(min: number, max: number): number;  // Random integer [min, max]
  float(): number;                         // Random float [0, 1)
  bool(probability?: number): boolean;     // Random boolean (default 0.5)
  choose<T>(arr: readonly T[]): T;         // Random array element
  shuffleInPlace<T>(arr: T[]): void;       // Shuffle array in-place
  fork(label?: string): IRng;              // Create independent sub-stream
  describe(): { seed: number; forks: number; label?: string };
}

// Usage
const rootRng = makeRng(12345);         // Root RNG (fork factory only)
const mapRng = rootRng.fork('map');     // Independent sub-stream
const value = mapRng.int(1, 100);       // Use forked RNG
```

**Critical**: After forking, use the child RNGs. Don't call methods on the root RNG.

### Scope

**Path**: `src/util/Scope.ts`

**Purpose**: Resource cleanup via dispose pattern.

```typescript
const scope = makeScope();

// Register cleanup functions
scope.add(() => clearInterval(timerId));
scope.add(() => emitter.off('event', handler));
scope.add(disposableObject); // Must have dispose() method

// Cleanup (executes in LIFO order)
await scope.dispose();

// Helper
await withScope(async (scope) => {
  // ... use scope
}); // Automatically disposed
```

### Logger

**Path**: `src/util/Logger.ts`

**Purpose**: Structured logging with levels and context.

```typescript
interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}

// Usage
const log = new ConsoleLogger('info'); // Min level
log.info('game:started', { seed: 12345 });

const childLog = log.child({ system: 'battle' });
childLog.debug('battle:attack', { attacker: 'hero', target: 'goblin' });
```

---

## UI Architecture (React + Vite)

### Entry Points

**main.tsx**: Application entry point
- Initializes GameController
- Creates default player unit
- Gives starting gold (500)
- Registers save subsystems
- Mounts React app

**App.tsx**: React Router setup
- GameProvider wrapper (DI for GameController)
- Routes: `/` (MenuRoute), `/route` (RouteRoute), `/battle/:runId`, `/shop`, `/inventory`

### Key UI Components

**GameContext** (`src/ui/context/GameContext.tsx`)
- React Context for GameController
- `useGameController()` hook for accessing game instance

**MenuRoute** (`src/ui/routes/MenuRoute.tsx`)
- Main menu
- Start new run
- Load/save slots

**RouteRoute** (`src/ui/routes/RouteRoute.tsx`)
- Route selection scene
- Displays 3 choices (A/B/C)
- Arena hint information

**GameCanvas** (`src/ui/canvas/GameCanvas.tsx`)
- DPR-aware canvas component
- Handles pixel ratio for sharp rendering

**BattleHUD** (`src/ui/components/BattleHUD.tsx`)
- Battle UI overlay (TODO)

### Hooks

**useRafLoop** (`src/ui/hooks/useRafLoop.ts`)
- requestAnimationFrame hook
- Provides deltaTime for smooth animations

### Styling

**Tailwind CSS** with custom theme tokens:
- `@layer base`, `@layer components`, `@layer utilities`
- CSS custom properties for colors, spacing

---

## Build, Test, and Development

### NPM Scripts

```bash
# Build
npm run build              # Compile TypeScript → dist/
npm run build:web          # Build UI for production

# Development
npm run dev                # Start Vite dev server (localhost:3000)
npm run demo               # Run headless demo (examples/simple-demo/demo.ts)

# Testing
npm test                   # Run all tests (256 tests)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report (82% avg)

# Linting & Quality
npm run lint               # ESLint
npm run lint:fix           # Auto-fix issues
npm run circular           # Check circular dependencies (0)
npm run deps               # Validate architecture rules
npm run ci                 # Full CI pipeline (lint + circular + deps + coverage)

# Performance
npm run perf               # Run performance benchmarks

# Code Generation
npm run gen                # Plop code generator
```

### Build Targets

**Headless** (default):
- TypeScript → ESM modules
- Output: `dist/`
- Main: `dist/index.js`
- Types: `dist/index.d.ts`

**Web UI**:
- Vite build → production bundle
- Output: `dist/` (overrides headless build)
- Entry: `index.html`

### Test Structure

**Unit Tests** (`tests/unit/`)
- Per-system: `map/`, `battle/`, `unit/`, `economy/`, `route/`, `save/`, `core/`
- Naming: `SystemManager.test.ts`, `SystemManager.properties.test.ts`, `SystemManager.memory.test.ts`

**Utility Tests** (`tests/util/`)
- `asyncQueue.test.ts`, `rng.test.ts`, `result.test.ts`, `scope.test.ts`, `logger.test.ts`

**Smoke Tests** (`tests/smoke/`)
- `ci.test.ts`: Quick sanity checks

**Test Helpers** (`tests/helpers/`)
- BFS for map connectivity validation
- Stub implementations

### Coverage Thresholds (vitest.config.ts)

- Lines: 75%
- Functions: 75%
- Branches: 60%

**Current**: ~82% average across all systems

---

## Coding Conventions

### File Organization

**Max 500 lines per file** (ESLint enforced, 1 exception at 526 lines)

Split large systems:
```
SystemManager.ts       # Core logic
SystemValidator.ts     # Valibot schemas
SystemManager.test.ts  # Unit tests
```

### Naming

- **Functions**: Verb-based (`generateMap`, `executeRound`, `awardReward`)
- **Types**: Noun-based (`MapData`, `BattleState`, `Unit`)
- **Interfaces**: Prefix with `I` (`ILogger`, `IMapSystem`, `IRng`)
- **Constants**: SCREAMING_SNAKE_CASE (`SAVE_VERSION`, `ROUTE_VERSION`)

### Code Structure

**MARK comments** for organization:
```typescript
// ========================================
// Lifecycle
// ========================================

// ========================================
// IMapSystem Interface
// ========================================

// ========================================
// Test-Only Debug Hook
// ========================================
```

### TypeScript

**Strict mode** enabled:
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- `strictPropertyInitialization: true`

**Module system**: ESM (`.js` extensions in imports)

```typescript
import { ok, err } from '../util/Result.js'; // ✅ Include .js
import { ok, err } from '../util/Result';    // ❌ Missing .js
```

### Error Handling

**Expected failures**: Use `Result<T, E>`
```typescript
async function loadConfig(): Promise<Result<Config, string>> {
  if (!exists) return err('file-not-found');
  return ok(config);
}
```

**Unexpected failures**: Throw (programmer errors)
```typescript
if (units.length === 0) {
  throw new Error('Units array cannot be empty'); // Invariant violation
}
```

### Async Patterns

**Always use AbortSignal**:
```typescript
async operation(signal?: AbortSignal): Promise<Result<T, string>> {
  if (signal?.aborted) return err('aborted');
  // ... operation
}
```

**Always use AsyncQueue** for shared state:
```typescript
private readonly queue = makeAsyncQueue();

async operation(): Promise<Result<T, string>> {
  return await this.queue.run(async () => {
    // ... operation
    return ok(result);
  });
}
```

### Validation

**Validate at boundaries** (file I/O, user input, network):
```typescript
import { validate } from '../validation/validate.js';
import { ConfigSchema } from './Validator.js';

const result = validate(ConfigSchema, data);
if (!result.ok) {
  return err(`Validation failed: ${result.error.message}`);
}
```

### Logging

**Structured logging** with context:
```typescript
this.log.info('map:generated', { 
  width: map.width, 
  height: map.height, 
  rooms: map.rooms.length 
});

this.log.error('battle:attack_failed', { 
  attacker: attackerId, 
  target: targetId,
  error: errorMsg 
});
```

**Log levels**:
- `debug`: Verbose development info
- `info`: Key events (map generated, battle started)
- `warn`: Recoverable issues
- `error`: Failures

---

## Known Limitations

### Headless Engine
- ✅ Map generation: Complete (37 tests, 96% coverage)
- ✅ Battle system: Complete (34 tests, 93% coverage)
- ✅ Unit system: Complete (34 tests, 93% coverage)
- ✅ Economy system: Complete (45 tests, 90% coverage)
- ✅ Route system: Complete (37 tests, 97% coverage)
- ✅ Save system: Complete (40 tests, 88% coverage)
- ✅ GameController: Complete (6 tests, 78% coverage)

### UI (v1.0 Foundation)
- ✅ Main menu: Functional
- ✅ Route selection: Functional
- ✅ Vite + React + Router: Setup complete
- ✅ Tailwind CSS: Theme configured
- ✅ GameContext: Provider working
- ⏳ Battle visualization: TODO (v1.1)
- ⏳ Combat UI: TODO (v1.1)
- ⏳ Shop/Inventory UI: TODO (v1.1)

### Missing Features (Future)
- Multi-currency economy
- Player-to-player trading
- Crafting system
- Skill trees/abilities
- Multiplayer support
- Performance optimization for 200+ units

---

## How to Extend Safely

### Adding a New System

1. Create `src/newsystem/NewSystemManager.ts`:
```typescript
import { SystemTemplate } from '../core/SystemTemplate.js';
import type { ILogger } from '../util/Logger.js';
import type { IRng } from '../util/Rng.js';
import { makeAsyncQueue } from '../util/AsyncQueue.js';
import { ok, err, type Result } from '../util/Result.js';

export class NewSystemManager extends SystemTemplate {
  private readonly queue = makeAsyncQueue();

  constructor(
    protected readonly log: ILogger,
    private readonly rng: IRng
  ) {
    super({ name: 'NewSystem' });
  }

  protected async onInitialize(): Promise<void> {
    this.log.info('newsystem:init', {});
  }

  protected async onUpdate(deltaTime: number): Promise<void> {
    // Optional per-frame logic
  }

  protected async onDestroy(): Promise<void> {
    this.log.info('newsystem:destroy', {});
  }

  // System-specific methods
  async operation(signal?: AbortSignal): Promise<Result<T, string>> {
    return await this.queue.run(async () => {
      if (signal?.aborted) return err('aborted');
      // ... implementation
      return ok(result);
    }, { signal });
  }
}
```

2. Create `src/newsystem/NewSystemValidator.ts` (Valibot schemas)

3. Create `tests/unit/newsystem/NewSystemManager.test.ts`

4. Wire into `GameController`:
```typescript
constructor(
  // ... existing systems
  private readonly newSystem: INewSystem
) {
  super({ name: 'GameController' });
}

async initialize() {
  // Add to initialization chain
  const newSystemResult = await this.newSystem.initialize?.(signal);
  if (newSystemResult && !newSystemResult.ok) {
    return err(`newsystem-init-failed:${String(newSystemResult.error)}`);
  }
}
```

### Adding New Skills/Abilities

1. Define skill data in `src/types/contracts.ts`
2. Extend `BattleManager` with new skill execution logic
3. Update `BattleValidator` schemas
4. Add tests to `tests/unit/battle/BattleManager.test.ts`

### Adding New Map Generators

1. Create algorithm in `MapManager` (BSP is reference)
2. Add config options to `MapGenConfig`
3. Update `MapValidator` schema
4. Test connectivity with BFS helper (`tests/helpers/bfs.ts`)

### Adding Persistence to New Systems

1. Implement `serialize()` and `deserialize()` methods:
```typescript
export class NewSystemManager extends SystemTemplate {
  serialize(): Record<string, unknown> {
    return {
      version: 'v1',
      data: this.state,
    };
  }

  deserialize(json: Record<string, unknown>): Result<void, string> {
    if (json.version !== 'v1') return err('version-mismatch');
    this.state = json.data;
    return ok(undefined);
  }
}
```

2. Register with SaveManager:
```typescript
saveManager.register({
  name: 'newsystem',
  serialize: () => newSystem.serialize(),
  deserialize: json => newSystem.deserialize(json),
});
```

### Wiring UI Components

1. Access GameController via hook:
```typescript
import { useGameController } from '../context/GameContext.js';

function MyComponent() {
  const game = useGameController();
  const routeManager = game.getRouteManager();
  
  // ... use system
}
```

2. Use React state for UI:
```tsx
const [choices, setChoices] = useState<Choice[]>([]);

useEffect(() => {
  routeManager.getChoices().then(result => {
    if (result.ok) setChoices(result.value);
  });
}, []);
```

---

## Quick Reference: Important Files

### Core Systems
- `src/core/GameController.ts` - Composition root
- `src/core/SystemTemplate.ts` - Base class for systems

### Game Systems
- `src/map/MapManager.ts` - BSP procedural generation
- `src/battle/BattleManager.ts` - Turn-based combat
- `src/unit/UnitManager.ts` - Character management
- `src/economy/EconomyManager.ts` - Currency & shops
- `src/route/RouteManager.ts` - Meta-map progression
- `src/save/SaveManager.ts` - Persistence
- `src/save/SaveStore.ts` - Storage abstraction

### Utilities
- `src/util/AsyncQueue.ts` - Async serialization
- `src/util/Result.ts` - Result types
- `src/util/Rng.ts` - Deterministic RNG
- `src/util/Scope.ts` - Resource cleanup
- `src/util/Logger.ts` - Structured logging

### UI
- `src/main.tsx` - Entry point
- `src/App.tsx` - React Router setup
- `src/ui/context/GameContext.tsx` - GameController provider
- `src/ui/routes/MenuRoute.tsx` - Main menu
- `src/ui/routes/RouteRoute.tsx` - Route selection

### Types & Validation
- `src/types/contracts.ts` - All TypeScript interfaces
- `src/validation/validate.ts` - Valibot validation wrapper
- `src/validation/schemas.ts` - Shared schemas

### Configuration
- `package.json` - NPM scripts, dependencies
- `tsconfig.json` - TypeScript config (strict mode)
- `vitest.config.ts` - Test config (coverage thresholds)
- `eslint.config.js` - Linter rules (500 line limit, Math.random() banned)
- `vite.config.ts` - Vite config

### Documentation
- `README.md` - Project overview, features, usage
- `API.md` - Complete API reference
- `EXAMPLES.md` - Integration examples (Discord bot, CLI, REST API)
- `CHANGELOG.md` - Version history
- `docs/adr/0001-platform-and-stack.md` - Architecture decisions
- `docs/BUGS_LEARNED.md` - Bug tracking and prevention

---

## Critical Bug Fixes

### RNG Fork Independence Bug (Fixed 2025-10-14)

**Symptom**: Forked RNGs produced correlated sequences instead of independent streams.

**Root Cause**: Original `fork()` created new generator from the same seed.

**Fix**: Use generator's `jump()` method AND advance parent state:
```typescript
const fork = (childLabel?: string): IRng => {
  const childGen = g.jump();  // Jump to independent sub-stream
  g = childGen;  // ✅ CRITICAL: Advance parent state
  forks += 1;
  return makeFromGen(g.jump(), { seed, forks: 0, label: childLabel });
};
```

**Why It Matters**: Systems need independent random streams. Map generation shouldn't affect battle outcomes just because they share a root seed.

See `docs/BUGS_LEARNED.md` for more details and other bugs.

---

## Next Steps / Roadmap

### Completed (v1.0)
- ✅ Core utilities (AsyncQueue, Result, Rng, Scope, Logger)
- ✅ Map system (BSP procedural generation)
- ✅ Battle system (turn-based combat)
- ✅ Unit system (character management)
- ✅ Economy system (currency, shops, loot)
- ✅ Route system (meta-map progression)
- ✅ Save system (persistence)
- ✅ GameController (composition root)
- ✅ UI foundation (Vite + React + Router + Tailwind)
- ✅ 256 tests, 82% coverage

### In Progress (v1.1)
- ⏳ Battle visualization (canvas rendering)
- ⏳ Combat UI (action selection, turn display)
- ⏳ Shop/Inventory UI

### Future (v2.0+)
- Additional node types (shop, rest, elite, event)
- Multi-currency economy
- Crafting system
- Skill trees/abilities
- Multiplayer support
- Performance optimization (200+ units)

---

## Development Workflow

### Starting a Session

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Install dependencies** (if needed)
   ```bash
   npm install
   ```

3. **Run tests** to verify current state
   ```bash
   npm test
   ```

4. **Start dev server** (for UI work)
   ```bash
   npm run dev
   ```

### Making Changes

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make minimal changes** (surgical edits)

3. **Test frequently**
   ```bash
   npm test -- --watch   # Watch mode
   npm run lint          # Lint checks
   ```

4. **Build** to verify no errors
   ```bash
   npm run build
   ```

### Before Committing

1. **Run CI pipeline**
   ```bash
   npm run ci  # lint + circular + deps + test:coverage
   ```

2. **Verify coverage** didn't drop below thresholds

3. **Check no new circular dependencies**
   ```bash
   npm run circular
   ```

4. **Validate architecture rules**
   ```bash
   npm run deps
   ```

### Running Examples

**Headless demo** (5 battles):
```bash
npm run demo
```

**Performance benchmarks**:
```bash
npm run perf
```

---

## Troubleshooting

### Tests Failing

1. Check if RNG seeds are consistent
2. Verify AsyncQueue usage (no race conditions)
3. Check AbortSignal handling
4. Ensure cleanup in `afterEach` hooks

### Build Errors

1. Check TypeScript strict mode compliance
2. Verify `.js` extensions in imports (ESM requirement)
3. Check circular dependencies: `npm run circular`

### UI Not Loading

1. Check GameController initialization in `main.tsx`
2. Verify GameProvider wraps routes
3. Check console for errors
4. Verify systems initialized: `await game.initialize()`

### RNG Not Deterministic

1. Verify using `makeRng(seed)` not `Math.random()`
2. Check RNG is forked per system: `rng.fork('system-name')`
3. Don't use root RNG after forking
4. Check operation order (AsyncQueue guarantees FIFO)

### Memory Leaks

1. Verify `destroy()` called on all systems
2. Check event listeners removed (use Scope)
3. Check timers/intervals cleared
4. Run memory tests: `npm test -- memory`

---

## Summary of Key Principles

1. **Dependency Injection**: Constructor-only, never `new` inside methods
2. **AsyncQueue**: Serialize all async operations on shared state
3. **Result Types**: For expected failures, throw for programmer errors
4. **Deterministic RNG**: Fork per system, never use root after forking
5. **SystemTemplate**: Extend for lifecycle management
6. **Scope**: Use for resource cleanup
7. **Validation**: At boundaries (I/O, user input, network)
8. **Logging**: Structured with context
9. **Testing**: 256 tests, 82% coverage, property-based where applicable
10. **Code Quality**: ≤500 lines/file, complexity ≤12, 0 circular deps

---

**This background provides everything needed to understand, maintain, and extend NextRealDeal. Follow the patterns strictly, run tests frequently, and maintain coverage above 75%.**
