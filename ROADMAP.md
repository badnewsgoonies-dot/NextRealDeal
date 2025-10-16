# NextRealDeal Roadmap

## Current Status: v1.0.0 (Production Release)

**Released:** October 16, 2025  
**Systems Complete:** 6/7 (86%)  
**Tests:** 256 passing (79% coverage)  
**Status:** Production-ready headless engine

---

## v1.1 - Polish & Enhancements

**Theme:** Quality of life improvements and content expansion  
**Prerequisites:** v1.0 released, community feedback gathered

### Core Systems Improvements

#### Map System
- [ ] **Refactor to <500 lines** - Extract BSP algorithm to `MapGenerator.ts`
- [ ] **Additional tile types** - Hazards, teleporters, one-way tiles
- [ ] **Room templates** - Predefined room layouts for variety
- [ ] **Map themes** - Forest, dungeon, ice, fire aesthetics (metadata only)
- [ ] **Performance optimization** - Cache room generation for reuse

#### Battle System
- [ ] **Status effects** - Poison, stun, buff, debuff
- [ ] **Multi-target abilities** - AOE attacks, group healing
- [ ] **Battle AI improvements** - Smart target selection
- [ ] **Ability system foundation** - Skills beyond basic attack
- [ ] **Turn preview** - Show upcoming turn order

#### Unit System
- [ ] **Stat respec** - Reset stats/equipment
- [ ] **Unit templates** - Warrior, Mage, Archer presets
- [ ] **Inventory management** - Sort, filter, stack items
- [ ] **Equipment sets** - Bonus for wearing matched items
- [ ] **Unit portraits** - Metadata for visual representation

#### Economy System
- [ ] **Multi-currency** - Gems, tokens, special currencies
- [ ] **Dynamic pricing** - Shop prices vary by run/step
- [ ] **Crafting system** - Combine items to create new ones
- [ ] **Item durability** - Equipment degrades over time
- [ ] **Black market** - Rare items with high costs

#### Route System
- [ ] **Node types** - Shop, rest, elite, event, treasure
- [ ] **Route visualization data** - Coordinates for UI rendering
- [ ] **Branching depth config** - Customize choices (2-4 per step)
- [ ] **Special events** - Random encounters, mini-games
- [ ] **Run modifiers** - Difficulty modes, special rules

#### Save System
- [ ] **Compression** - Reduce save file size (base64 + deflate)
- [ ] **Cloud sync** - Optional remote storage adapter
- [ ] **Save file encryption** - Prevent tampering
- [ ] **Migration system** - v1 → v2 data migration
- [ ] **Save thumbnails** - Metadata for UI previews

### New Features

#### Content
- [ ] **Enemy catalog** - 20+ enemy types with unique stats
- [ ] **Item catalog** - 50+ weapons, armor, consumables
- [ ] **Loot tables** - Tiered drops (common, rare, legendary)
- [ ] **Balance tuning** - Damage, costs, rewards optimized
- [ ] **Story events** - Text-based narrative nodes

#### Developer Experience
- [ ] **Debug UI** - In-game console for testing
- [ ] **Replay viewer** - Visualize recorded runs
- [ ] **Scenario editor** - Create test scenarios
- [ ] **Performance profiler** - Built-in timing tools
- [ ] **Save file inspector** - Debug save data

#### Quality Improvements
- [ ] **AsyncQueue edge cases** - Abort during drain, multiple aborts
- [ ] **Extended property tests** - More fast-check coverage
- [ ] **Stress testing** - 1000+ unit battles
- [ ] **Memory profiling** - Long-run leak detection
- [ ] **Documentation examples** - More integration patterns

### Technical Debt
- [ ] **MapManager file size** - Split to <500 lines
- [ ] **GameController complexity** - Extract initialization logic
- [ ] **Type refinements** - Stricter type constraints
- [ ] **Error message improvements** - More descriptive errors

### Testing
- [ ] **E2E integration tests** - Full 100-battle runs
- [ ] **Performance benchmarks** - Automated perf regression tests
- [ ] **Browser compatibility** - Cross-browser save/load tests
- [ ] **Chaos testing** - Random operation order validation

**Target Metrics:**
- Tests: 300+ (from 256)
- Coverage: 85%+ (from 79%)
- Performance: <50 MB heap growth in stress test

**Dependencies:** v1.0 stable, content catalog defined

---

## v1.2 - UI System

**Theme:** Visual representation and player interaction  
**Prerequisites:** v1.1 content complete, performance validated

### System 7: UI

#### Core Rendering
- [ ] **Canvas renderer** - Draw maps, units, effects
- [ ] **Sprite system** - Load and display sprites
- [ ] **Animation framework** - Tween movements, effects
- [ ] **Camera system** - Pan, zoom, follow
- [ ] **Tile rendering** - Floor, wall, water, etc.

#### User Interface
- [ ] **Route map display** - Node graph visualization
- [ ] **Choice selection** - Click-based or keyboard
- [ ] **Battle HUD** - HP bars, turn order, stats
- [ ] **Inventory screen** - Grid-based item display
- [ ] **Shop interface** - Buy/sell UI
- [ ] **Save/load menu** - Slot selection UI

#### Input System
- [ ] **Keyboard handling** - Arrow keys, hotkeys
- [ ] **Mouse handling** - Click, hover, drag
- [ ] **Gamepad support** - Controller input
- [ ] **Touch support** - Mobile-friendly

#### Visual Polish
- [ ] **Particle effects** - Hit sparks, loot drops
- [ ] **Screen transitions** - Fade, slide, zoom
- [ ] **Combat animations** - Attack, dodge, critical
- [ ] **Sound hooks** - Event triggers for audio
- [ ] **Visual feedback** - Damage numbers, status icons

**Target Metrics:**
- Tests: 350+ (UI tests added)
- Performance: 60 FPS sustained
- File size: <500 lines per UI component

**Dependencies:** v1.1 systems stable, asset pipeline defined

---

## v2.0 - Advanced Features

**Theme:** Deep gameplay systems and multiplayer  
**Prerequisites:** v1.2 UI complete, player base established

### Major Features

#### Progression System Overhaul
- [ ] **Skill trees** - Unlock abilities, passives
- [ ] **Class system** - Warrior, Mage, Archer, Rogue
- [ ] **Prestige mechanic** - Reset with bonuses
- [ ] **Achievements** - Track milestones
- [ ] **Leaderboards** - Score tracking

#### Multiplayer Support
- [ ] **PvP battles** - Player vs player
- [ ] **Co-op runs** - Shared route progression
- [ ] **Trading system** - Player-to-player economy
- [ ] **Guilds/clans** - Group features
- [ ] **Daily challenges** - Fixed seed competitions

#### Advanced Combat
- [ ] **Positioning system** - Tactical movement matters
- [ ] **Line of sight** - Cover and flanking
- [ ] **Combo system** - Chain attacks
- [ ] **Ultimate abilities** - Charge-based powers
- [ ] **Weather effects** - Environmental modifiers

#### Content
- [ ] **100+ enemy types** - Diverse encounters
- [ ] **200+ items** - Deep itemization
- [ ] **Boss battles** - Multi-phase encounters
- [ ] **Story mode** - Narrative campaign
- [ ] **Endless mode** - Infinite scaling

**Dependencies:** v1.2 rendering pipeline proven, balance data collected

---

## v3.0 - Platform Expansion

**Theme:** Mobile, console, and extended platforms  
**Prerequisites:** v2.0 multiplayer stable, commercial viability proven

### Platform Support
- [ ] **Mobile optimization** - Touch controls, reduced memory
- [ ] **Console ports** - Xbox, PlayStation, Switch
- [ ] **Steam release** - PC distribution
- [ ] **Mobile app** - iOS/Android native
- [ ] **Web version** - Browser-playable

### Advanced Features
- [ ] **Mod support** - Custom content loading
- [ ] **Level editor** - User-created maps
- [ ] **Tournament mode** - Competitive play
- [ ] **Replay system** - Watch recorded runs
- [ ] **Analytics dashboard** - Player behavior insights

**Dependencies:** v2.0 feature-complete, platform partnerships secured

---

## Ongoing (All Versions)

### Community
- [ ] **Discord server** - Community hub
- [ ] **Documentation site** - docs.nextrealdeal.com
- [ ] **Tutorial videos** - YouTube series
- [ ] **Developer blog** - Architecture deep-dives

### Quality
- [ ] **Continuous CI/CD** - Automated releases
- [ ] **Security audits** - Dependency scanning
- [ ] **Performance monitoring** - Regression tracking
- [ ] **User feedback** - Issue triage and feature requests

### Content Updates
- [ ] **Monthly content drops** - New enemies, items
- [ ] **Seasonal events** - Limited-time content
- [ ] **Balance patches** - Meta adjustments
- [ ] **Bug fixes** - Ongoing maintenance

---

## Long-Term Vision

### Engine as a Platform
- [ ] **Engine licensing** - Commercial use
- [ ] **Game maker tool** - No-code game creation
- [ ] **Asset marketplace** - Community content
- [ ] **Cross-game progression** - Shared accounts

### Technology
- [ ] **WebGPU rendering** - High-performance graphics
- [ ] **WASM compilation** - Near-native speed
- [ ] **AI opponents** - Machine learning NPCs
- [ ] **Procedural content** - AI-generated content

---

## Version Comparison

| Feature | v1.0 | v1.1 | v1.2 | v2.0 | v3.0 |
|---------|------|------|------|------|------|
| Core Systems | ✅ 6 | ✅ 6 | ✅ 7 | ✅ 8+ | ✅ 10+ |
| Tests | 256 | 300+ | 350+ | 500+ | 750+ |
| UI | ❌ | ❌ | ✅ | ✅ | ✅ |
| Multiplayer | ❌ | ❌ | ❌ | ✅ | ✅ |
| Mobile | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| Modding | ❌ | ❌ | ❌ | ⚠️ | ✅ |

**Legend:** ✅ Complete | ⚠️ Partial | ❌ Not available

---

## Community Feedback Integration

**Post-v1.0 Release:**
- Gather user feedback (GitHub issues, Discord)
- Prioritize most-requested features
- Adjust roadmap based on usage patterns
- Community voting on v1.1 features

---

## Success Metrics

### v1.1 Goals
- 300+ tests (from 256)
- 85% coverage (from 79%)
- 5+ integration examples
- 10+ content additions (enemies/items)

### v1.2 Goals
- 350+ tests
- 60 FPS UI rendering
- Visual polish complete
- Mobile-ready architecture

### v2.0 Goals
- 500+ tests
- Multiplayer infrastructure
- 1000+ concurrent users supported
- Advanced combat systems

---

**This roadmap is a living document and will evolve based on community needs and technical discoveries.**

**Last Updated:** v1.0.0 release  
**Review Cadence:** After each major version release

