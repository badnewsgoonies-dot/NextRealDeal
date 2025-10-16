# 🎉 NextRealDeal v1.0.0 - Production Headless Game Engine

**First stable release** of NextRealDeal, a production-ready TypeScript game engine for battle-first roguelikes with deterministic gameplay, cross-platform persistence, and comprehensive testing.

---

## 🎮 What is NextRealDeal?

A **headless game engine** combining:
- **Pokémon Battle Tower** progression (endless battles with choices)
- **Slay the Spire** meta-map (branching route selection)
- **Golden Sun** combat (turn-based tactical battles)

**Battle-first loop:** No exploration—just strategic choices and tactical combat.

**Headless design:** Use as a library/API for Discord bots, REST APIs, CLI games, or any custom frontend.

---

## ✨ Features

### **6 Complete Systems**

#### 🗺️ **Map System** - Procedural Battle Arenas
- Binary Space Partitioning (BSP) algorithm
- Deterministic generation (same seed = same map)
- Connectivity validation (all tiles reachable)
- Configurable sizes (16×16 to 128×128, even dimensions)
- **37 tests, 96% coverage**

#### ⚔️ **Battle System** - Turn-based Combat
- Initiative-based turn order (speed + stable sort)
- Damage formula: `max(0, atk - ⌊def/2⌋ + variance)`
- 5% dodge, 10% critical hit mechanics
- Battle-local RNG (prevents cross-battle contamination)
- Combat logging with deterministic sequences
- **34 tests, 93% coverage**

#### 👥 **Unit System** - Character Management
- Level-based stat scaling
- Equipment system (weapon/armor/accessory slots)
- Position tracking on battle maps
- Team management (player/enemy designation)
- **34 tests, 93% coverage**

#### 💰 **Economy System** - Currency & Items
- Gold currency (0 to 999,999,999 with overflow protection)
- Item inventory (max 100 items per player)
- Shop system with stock management (finite/infinite items)
- Deterministic loot drops (first-match algorithm)
- Battle reward distribution
- Transaction rollback on failures
- **45 tests, 90% coverage**

#### 🛤️ **Route System** - Meta-Map Progression
- Slay the Spire-style branching choices
- 3 deterministic options per step (A/B/C)
- Versioned RNG streams (`route:v1 → run:v1 → step:v1`)
- Choice caching (prevents RNG drift)
- Run lifecycle management
- Serialization/deserialization
- **43 tests, 97% coverage**

#### 💾 **Save System** - Cross-Platform Persistence
- Subsystem registry pattern (auto-gather state)
- Payload mode (manual control for special cases)
- Storage adapters (in-memory for tests, localStorage for browser)
- Versioned envelopes (migration-ready)
- Multiple save slots with deterministic ordering
- Auto-save support
- **40 tests, 88% coverage**

### **GameController** - Composition Root
- Strict dependency injection (6 systems coordinated)
- Lifecycle management (init: Map → Battle → Unit → Economy → Route → Save)
- Wiring-only (zero game logic)
- **6 integration tests, 78% coverage**

---

## 🏗️ Architecture Highlights

### **Deterministic Gameplay**
```typescript
const rng1 = makeRng(12345);
const rng2 = makeRng(12345);

// Same seed → identical results
const map1 = await mapManager.generate({ seed: 100 });
const map2 = await mapManager.generate({ seed: 100 });
// map1 === map2 (perfectly identical)
```

**Perfect for:**
- Testing (reproducible scenarios)
- Debugging (replay exact runs)
- Speedrunning (share seeds)
- Daily challenges (everyone gets same seed)

### **Zero Race Conditions**
All async operations automatically serialize via AsyncQueue:
```typescript
// Concurrent calls execute sequentially (safe)
await Promise.all([
  manager.operation1(),
  manager.operation2(),
  manager.operation3(),
]); // Guaranteed order: 1 → 2 → 3
```

### **Type-Safe Error Handling**
```typescript
const result = await system.operation();

if (result.ok) {
  console.log(result.value);  // TypeScript knows the type
} else {
  console.error(result.error); // Typed error code
}
```

### **Strict Dependency Injection**
```typescript
// ✅ Dependencies injected
class BattleManager {
  constructor(log: ILogger, rng: IRng) { ... }
}

// ❌ Never construct dependencies
class BattleManager {
  constructor() {
    this.log = new Logger();  // Violation!
  }
}
```

---

## 📊 Stats

```
Systems:            6/7 (86% - UI optional for headless)
Tests:              256 (100% passing)
Coverage:           79% average
Lines of Code:      3,453 (production)
Test Code:          ~3,500 lines
Build Time:         ~21 seconds
Dependencies:       2 production (pure-rand, valibot)
Dev Dependencies:   10 (TypeScript, Vitest, ESLint, etc.)
Circular Deps:      0
Lint Errors:        0
Architectural Violations: 0
```

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/NextRealDeal.git
cd NextRealDeal

# Install dependencies
npm install

# Run tests
npm test

# Run demo
npm run demo

# Full CI
npm run ci
```

### Usage Example

```typescript
import { GameController } from './src/core/GameController.js';
import { makeRng } from './src/util/Rng.js';
import { ConsoleLogger } from './src/util/Logger.js';

// Initialize game
const log = new ConsoleLogger('info');
const rng = makeRng(20251016);
const game = createGame(log, rng);
await game.initialize();

// Start adventure
await game.getRouteManager().startRun('adventure-001', 12345);

// Game loop
const choices = await game.getRouteManager().getChoices();
const chosen = await game.getRouteManager().choose(choices.value[0].id);

// Generate arena
const arena = await game.getMapManager().generate({
  width: 48,
  height: 48,
  seed: chosen.value.choice.arenaSeed,
});

// Battle, rewards, save...
```

See [EXAMPLES.md](EXAMPLES.md) for complete integration examples.

---

## 📚 Documentation

- **[README.md](README.md)** - Project overview and quick start
- **[API.md](API.md)** - Complete API reference
- **[EXAMPLES.md](EXAMPLES.md)** - Discord bot, CLI, REST API examples
- **[CHANGELOG.md](CHANGELOG.md)** - What's new in v1.0.0
- **[ROADMAP.md](ROADMAP.md)** - Future versions and features

---

## 🎯 Use Cases

### ✅ What You Can Build

**Discord Bot Roguelike:**
```
!start → Begin adventure with unique seed
!choose B → Select path on meta-map
!battle → Execute turn-based combat
!inventory → Manage equipment
!save → Persist progress
```

**REST API Backend:**
```
POST /api/game/start → Initialize game session
GET  /api/game/choices → Fetch available paths
POST /api/game/choose → Progress through route
GET  /api/game/battle → Get battle state
```

**CLI Terminal Game:**
```
$ npm start
Choose path: A/B/C
> B
Generating arena... 48×48
Battle! Winner: player
Gold: 100g
[Auto-saved]
```

**Game Simulation Framework:**
```
Run 10,000 battles with different seeds
Collect balance data
Test mechanics at scale
Deterministic regression testing
```

---

## 🔬 Technical Highlights

### Core Utilities
- **AsyncQueue** - Serializes async operations (prevents race conditions)
- **RNG** - Deterministic PRNG with fork/jump (pure-rand based)
- **Result** - Type-safe error handling (no exceptions)
- **Logger** - Structured logging with child contexts
- **Scope** - Resource cleanup manager (prevents memory leaks)
- **SystemTemplate** - Base class enforcing patterns

### Quality Guarantees
- ✅ **Deterministic** - Same seed = same gameplay
- ✅ **Type-safe** - Strict TypeScript throughout
- ✅ **No race conditions** - AsyncQueue serialization
- ✅ **No memory leaks** - Scope cleanup (tested with 100 cycles)
- ✅ **Comprehensive validation** - Valibot schemas
- ✅ **Full replay support** - Save/load with versioning

---

## ⚠️ Known Limitations

- **MapManager.ts:** 526 lines (target: ≤500) - Will refactor in v1.1
- **UI System:** Not included (headless only) - Planned for v1.2
- **Single currency:** Gold only - Multi-currency in v2.0
- **3 choices per step:** Fixed in v1.0 - Configurable in v1.1

See [ROADMAP.md](ROADMAP.md) for planned improvements.

---

## 🛣️ What's Next

### **v1.1** (Next Release)
- Content expansion (enemies, items, balance)
- Route node types (shop, rest, elite)
- MapManager refactoring (<500 lines)
- Extended test coverage (300+ tests, 85%)

### **v1.2** (Future)
- Canvas 2D UI system
- Visual representation of all systems
- Input handling and animations
- 60 FPS rendering target

### **v2.0+** (Long-term)
- Multiplayer support
- Advanced combat (positioning, combos)
- Skill trees and progression
- Mobile and console platforms

See [ROADMAP.md](ROADMAP.md) for complete roadmap.

---

## 🤝 Contributing

This project follows strict architectural patterns:

1. Read [docs/adr/0001-platform-and-stack.md](docs/adr/0001-platform-and-stack.md)
2. Review [docs/BUGS_LEARNED.md](docs/BUGS_LEARNED.md)
3. Follow Phase-0 patterns (DI, AsyncQueue, Result types)
4. Ensure all tests pass (`npm run ci`)
5. Maintain coverage (≥75%)

See system completion checklist in [README.md](README.md).

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

Built with:
- **Claude Sonnet 4.5** - Implementation partner
- **TypeScript** - Type safety
- **Vitest** - Testing framework
- **Valibot** - Runtime validation
- **pure-rand** - Deterministic RNG

Special thanks to the open-source community for the excellent tools and libraries.

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/NextRealDeal/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/NextRealDeal/discussions)
- **Documentation:** See [API.md](API.md) and [EXAMPLES.md](EXAMPLES.md)

---

**Built with ❤️ and strict architectural patterns.**

**Download, star, and build amazing roguelike experiences!** 🚀

