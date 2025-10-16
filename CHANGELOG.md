# Changelog

All notable changes to NextRealDeal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-16

### 🎉 Initial Release - Production-Ready Headless Game Engine

The first stable release of NextRealDeal, a battle-first roguelike engine with deterministic gameplay and comprehensive save/load support.

### Added

#### Systems (6/7 Core Systems)

**Map System (v1.0)** - *Procedural Arena Generation*
- Binary Space Partitioning (BSP) algorithm
- Configurable arena sizes (16×16 to 128×128, even dimensions only)
- Automatic connectivity validation via BFS flood fill
- Spawn/exit placement with distance constraints
- Extra corridor loops (10-15% configurable)
- Border wall enforcement
- **37 tests,** 96% coverage
- Fully deterministic (same seed → same map every time)

**Battle System (v1.0)** - *Turn-Based Combat*
- Initiative-based turn order (speed DESC → input index ASC)
- 5-step damage calculation:
  1. Dodge check (5%)
  2. Base damage = `atk - ⌊def/2⌋`
  3. Variance: ±2 random
  4. Critical hit (10%, ×1.5 damage)
  5. Clamp to non-negative
- Battle-local RNG streams (prevents cross-battle contamination)
- Combat logging with sequence numbers (not timestamps)
- Team-based targeting (v1: first living opponent)
- Victory detection (player/enemy/draw)
- **34 tests**, 93% coverage

**Unit System (v1.0)** - *Character Management*
- Level-based stat scaling (HP, ATK, DEF, SPD)
- 3-slot equipment system (weapon/armor/accessory)
- Stat bonus calculations (equipment stacking)
- Position tracking for map integration
- Team designation (player/enemy)
- Battle-ready unit conversion with equipment bonuses
- **34 tests**, 93% coverage

**Economy System (v1.0)** - *Currency & Items*
- Single currency (gold, 0 to 999,999,999)
- Item inventory per player (max 100 items)
- Shop system:
  - Iron Sword: 100g, stock: 10, +10 ATK
  - Wooden Shield: 80g, stock: 10, +5 DEF  
  - Health Potion: 50g, stock: ∞, +50 HP
- Sell items for 50% value
- Deterministic loot drops (first-match algorithm)
- Battle reward distribution
- Transaction rollback on failures
- **45 tests**, 90% coverage

**Route System (v1.0)** - *Meta-Map Progression*
- Slay the Spire-style branching choices
- 3 deterministic options per step (A/B/C)
- Versioned RNG hierarchy (`route:v1 → run:v1 → step:v1`)
- Choice caching (prevents RNG drift)
- Guaranteed unique arena seeds per step
- Run lifecycle management (start/end with guards)
- Serialization/deserialization with version validation
- Step limit: 10,000
- **43 tests**, 97% coverage

**Save System (v1.0)** - *Cross-Platform Persistence*
- Dual mode operation:
  - Registry mode: Auto-gather from subsystems
  - Payload mode: Manual SaveData
- Storage abstraction:
  - InMemorySaveStore (tests/headless)
  - LocalStorageSaveStore (browser)
  - Custom store support via ISaveStore
- Versioned save format (v1, migration-ready)
- Reserved key protection (_payload)
- Deterministic slot ordering (newest first)
- Auto-save functionality
- **40 tests**, 88% coverage

**GameController** - *System Coordination*
- Strict dependency injection (all systems injected)
- Proper initialization cascade
- Reverse-order destruction
- Wiring-only (zero game logic)
- **6 integration tests**, 78% coverage

#### Core Utilities

**AsyncQueue**
- Serializes async operations (prevents race conditions)
- AbortSignal support
- FIFO execution order
- `pending` invariant (always ≤ 1)
- **7 tests**, 96% coverage

**RNG (IRng)**
- Deterministic PRNG based on pure-rand's xoroshiro128plus
- Independent stream forking with jump()
- Methods: `int()`, `float()`, `bool()`, `choose()`, `shuffleInPlace()`
- **9 tests**, 95% coverage
- **Critical fix:** Double-jump pattern with parent state advancement

**Result<T, E>**
- Type-safe error handling (no throws for business logic)
- Helpers: `ok()`, `err()`, `unwrap()`, `map()`, `andThen()`
- Pattern matches Rust's Result type

**Logger**
- Structured logging with levels (debug/info/warn/error)
- Child context support
- ConsoleLogger class for tests/scripts
- Environment-aware (silence in tests)

**Scope**
- Resource cleanup via dispose pattern
- LIFO disposal order
- Error aggregation
- (Not yet used in v1.0 - reserved for future systems)

**Validation**
- Valibot schemas for external data
- `validate()` wrapper returns Result
- Schemas for maps, units, items, saves, routes

### Features

#### Deterministic Gameplay
- All randomness through seeded IRng
- Math.random() banned (ESLint rule)
- Same seed + same inputs = same outcomes
- Full replay capability

#### Type Safety
- Strict TypeScript throughout
- No `any` types (ESLint enforced)
- Explicit function return types
- Full IDE autocomplete support

#### Testing
- 256 comprehensive tests
- Unit tests (80%)
- Property-based tests with fast-check (5%)
- Memory leak tests (5%)
- Integration tests (10%)
- **100% pass rate**

#### Code Quality
- ≤500 lines per file (ESLint enforced)
- No circular dependencies (madge verified)
- Layered architecture (dependency-cruiser enforced)
- Consistent patterns across all systems

### Breaking Changes

None (initial release)

### Deprecated

None

### Known Limitations

1. **MapManager File Size**: 526 lines (slightly over 500 target)
   - Recommendation: Extract BSP generator to separate file in v1.1
   
2. **Single Currency**: Only gold supported
   - Planned: Multi-currency in v2.0

3. **Fixed Choice Count**: Always 3 per step
   - Planned: Configurable in v2.0

4. **No UI System**: Headless only
   - Use cases: Discord bots, CLI games, REST APIs, testing
   - Planned: Optional canvas/HTML renderer in v2.0

### Security

No known vulnerabilities. All dependencies audited.

---

## [Unreleased]

### Planned for v1.1
- MapManager refactoring (<500 lines)
- Additional route node types (shop, rest)
- Skill/ability system basics

### Planned for v2.0
- Multi-currency economy
- Skill trees and abilities
- Advanced AI targeting
- Performance optimization (200+ units)
- Optional UI system

---

## Development Stats

**Developed:** October 16, 2025
**Language:** TypeScript 5.5+
**Test Framework:** Vitest
**Dependencies:** pure-rand, valibot
**Lines of Code:** 3,453 (production), ~3,500 (tests)
**Development Time:** ~6-7 hours (single session)

---

## Contributors

- Primary Developer: [Your Name]
- Powered by: Claude AI (Anthropic)

---

## Links

- [GitHub Repository](https://github.com/yourusername/NextRealDeal)
- [Issue Tracker](https://github.com/yourusername/NextRealDeal/issues)
- [API Documentation](./API.md)
- [Integration Examples](./EXAMPLES.md)

