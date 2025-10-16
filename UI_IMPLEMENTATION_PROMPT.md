# UI System Implementation Prompt

## Project Context
NextRealDeal is a production-ready, deterministic TypeScript game engine featuring turn-based tactical combat, procedural map generation, and branching roguelike progression. We need to implement a **Canvas-based UI System** that provides visual representation and player interaction while maintaining clean separation from game logic.

## Core Requirements

### 1. Architecture Principles
- **Headless-first**: UI is an optional layer on top of the engine
- **Reactive**: Responds to state changes, doesn't drive logic
- **Platform-agnostic**: Uses Canvas API (browser/Electron compatible)
- **Deterministic rendering**: Same state = same visuals
- **Strictly follows Phase-0 patterns**: DI, AsyncQueue, Result types, deterministic RNG

### 2. System Structure

Create the following files in `src/ui/`:

```
src/ui/
├── UIManager.ts              (~400 lines) - Main system, scene coordination
├── renderers/
│   ├── MapRenderer.ts        (~300 lines) - Tile rendering, camera
│   ├── UnitRenderer.ts       (~250 lines) - Character sprites, HP bars
│   ├── BattleRenderer.ts     (~300 lines) - Combat effects, animations
│   ├── RouteRenderer.ts      (~250 lines) - Node graph, path display
│   └── UIRenderer.ts         (~200 lines) - HUD, menus, overlays
├── input/
│   ├── InputManager.ts       (~300 lines) - Keyboard, mouse, gamepad
│   └── KeyBindings.ts        (~100 lines) - Configurable controls
├── animation/
│   ├── AnimationSystem.ts    (~250 lines) - Tween engine, effects
│   └── ParticleSystem.ts     (~200 lines) - Particles (hits, loot)
├── assets/
│   ├── AssetLoader.ts        (~200 lines) - Sprite/font loading
│   └── SpriteAtlas.ts        (~150 lines) - Sprite sheet management
├── scenes/
│   ├── RouteScene.ts         (~300 lines) - Meta-map view
│   ├── BattleScene.ts        (~350 lines) - Combat view
│   ├── ShopScene.ts          (~200 lines) - Shop interface
│   ├── InventoryScene.ts     (~200 lines) - Inventory management
│   └── MenuScene.ts          (~150 lines) - Main menu, settings
└── UIValidator.ts            (~100 lines) - Input validation
```

### 3. UIManager Implementation

```typescript
export interface IUISystem extends ISystem {
  // Rendering
  render(deltaTime: number): void;  // Synchronous render loop
  
  // Scene management
  setScene(scene: SceneName): Promise<Result<void, string>>;
  getCurrentScene(): SceneName;
  
  // Input
  onInput(event: InputEvent): Promise<Result<void, string>>;
  
  // Assets
  loadAssets(manifest: AssetManifest, signal?: AbortSignal): Promise<Result<void, string>>;
  
  // Camera
  setCamera(target: Position): void;
  getViewport(): Viewport;
  
  // Test-only
  getDebugStats(): {
    queuePending: number;
    currentScene: SceneName;
    fps: number;
    renderTime: number;
    assetCount: number;
  } | undefined;
}

class UIManager extends SystemTemplate implements IUISystem {
  constructor(
    log: ILogger,
    rng: IRng,
    canvas: HTMLCanvasElement,
    gameController: IGameController
  ) {
    super({ name: 'UIManager' });
    this.log = log.child({ system: 'ui', version: 'v1' });
    this.rng = rng.fork('ui:v1');
    this.queue = makeAsyncQueue();
    this.canvas = canvas;
    this.game = gameController;
  }
}
```

### 4. Key Features to Implement

#### **Route Scene**
- Node graph visualization (A/B/C choices)
- Current position indicator
- Path history (completed nodes)
- Player stats overlay
- Click/keyboard selection (A/B/C keys)
- Walk animation (icon moves along path)
- Node reveal animations (fade in)

#### **Battle Scene**
- Tactical grid rendering (48×48 tiles)
- Units with HP bars and status effects
- Turn order indicator
- Damage numbers (floating, animated)
- Combat log (scrolling text)
- Camera system with smooth follow
- Attack animations (sword slash, fireball)
- Critical hit flash, dodge animations

#### **Input System**
```typescript
const DEFAULT_BINDINGS = {
  choiceA: 'a', choiceB: 'b', choiceC: 'c',
  endTurn: 'space',
  ability1: '1', ability2: '2', ability3: '3',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  menu: 'Escape', inventory: 'i', save: 'F5', load: 'F9',
};
```

#### **Animation System**
- Tween engine with easing functions (linear, easeIn, easeOut, easeInOut)
- Damage number animations (float upward, fade out)
- Particle system for combat effects
- Scene transitions (fade in/out)

### 5. Rendering Architecture

**Main Render Loop:**
```typescript
render(deltaTime: number): void {
  this.fps = 1000 / deltaTime;
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
  // Render current scene
  switch (this.currentScene) {
    case 'route': this.routeScene.render(this.ctx, deltaTime); break;
    case 'battle': this.battleScene.render(this.ctx, deltaTime); break;
    // ... other scenes
  }
  
  // Render overlay (HUD, menus)
  this.uiRenderer.render(this.ctx, deltaTime);
}
```

**Tile Rendering:**
```typescript
// Map tiles with camera transform
const screenX = (tile.x * this.tileSize) - camera.x;
const screenY = (tile.y * this.tileSize) - camera.y;

// Fallback: colored rectangles if no sprites
const colors = {
  0: '#cccccc',  // floor
  1: '#333333',  // wall
  2: '#4444ff',  // water
  3: '#8b4513',  // door
  4: '#00ff00',  // spawn
  5: '#ff0000',  // exit
};
```

### 6. Performance Targets

- **60 FPS sustained**: <16ms per frame render time
- **Memory usage**: <100 MB total
- **Asset loading**: <5 seconds initial load
- **Smooth with 200 units** on screen

Breakdown:
- Map rendering: <4ms (48×48 grid)
- Unit rendering: <2ms (20 units)
- UI overlay: <2ms
- Animations: <3ms
- Overhead: <5ms

### 7. Testing Requirements

Create comprehensive test suite in `tests/ui/`:

**UIManager** (15 tests):
- Lifecycle (init, destroy)
- Scene switching
- Render loop timing
- Asset loading
- Debug stats

**Renderers** (40 tests):
- MapRenderer: tile colors, sprite mapping, camera transforms
- UnitRenderer: HP bars, status effects, team colors
- BattleRenderer: damage numbers, effects
- RouteRenderer: node positions, connections

**Input** (20 tests):
- Key bindings
- Mouse click detection
- Command mapping
- Event handling

**Animation** (15 tests):
- Tween creation, update, completion
- Easing functions
- Particle lifetime
- Animation queueing

**Scenes** (30 tests):
- Route scene: node layout, choice selection
- Battle scene: unit rendering, combat log
- Shop/Inventory scenes

### 8. Critical Implementation Details

#### **Phase-0 Pattern Compliance:**
- ✅ Strict DI (canvas + game controller injected)
- ✅ Own AsyncQueue for async operations
- ✅ Result types for expected failures
- ✅ Deterministic animations (seeded RNG for particle effects)
- ✅ Test-only debug hook
- ✅ ≤500 lines per file

#### **Asset Management:**
```typescript
interface AssetManifest {
  sprites: Record<string, string>;  // name -> URL
  fonts: Record<string, string>;
}

// Load with AbortSignal support
async loadAssets(manifest: AssetManifest, signal?: AbortSignal): Promise<Result<void, string>>
```

#### **Camera System:**
```typescript
class Camera {
  followTarget(target: Position, deltaTime: number): void {
    const speed = 5 * deltaTime / 1000;
    const targetX = target.x * 32 - (this.viewportWidth / 2);
    const targetY = target.y * 32 - (this.viewportHeight / 2);
    this.x += (targetX - this.x) * speed;
    this.y += (targetY - this.y) * speed;
  }
  
  worldToScreen(worldPos: Position): Position;
  screenToWorld(screenPos: Position): Position;
}
```

### 9. Integration Points

**UI does NOT modify game state directly:**
```typescript
// ❌ BAD: UI calling game logic directly
async handleChoiceClick(choiceId: string) {
  await this.game.getRouteManager().choose(choiceId);  // Don't do this!
}

// ✅ GOOD: UI emits commands, external loop handles them
async handleChoiceClick(choiceId: string) {
  this.commandQueue.push({ type: 'choose', choiceId });
}
```

### 10. Success Criteria

**Functional:**
- All 5 scenes implemented and tested
- Input handling for keyboard + mouse
- Smooth 60 FPS rendering
- Asset loading working
- Scene transitions smooth

**Quality:**
- 120+ UI-specific tests (all passing)
- 80%+ coverage maintained
- No memory leaks in render loop
- All files ≤500 lines

**Performance:**
- <16ms render time (60 FPS)
- <100 MB memory usage
- <5s asset loading

## Implementation Steps

1. **Phase 1: Foundation** - UIManager skeleton, canvas setup, render loop, basic input, scene switching (~30 tests)
2. **Phase 2: Route Scene** - Node graph rendering, choice selection, animations (~20 tests)
3. **Phase 3: Battle Scene** - Map/unit rendering, camera system (~30 tests)
4. **Phase 4: Combat Polish** - Damage numbers, attack animations, particles (~20 tests)
5. **Phase 5: Additional Scenes** - Shop, inventory, menu (~20 tests)
6. **Phase 6: Polish** - Transitions, visual effects, optimization

## Visual Reference

**Route Scene Layout:**
```
┌─────────────────────────────────────────┐
│  Step: 5          Gold: 500g            │ ← HUD
├─────────────────────────────────────────┤
│                                         │
│         [A]    [B]    [C]               │ ← Choice nodes
│          │      │      │                │
│           ╲    │    ╱                   │ ← Connections
│              [●]                        │ ← Current position
│               │                         │
│             (completed path)            │ ← History
└─────────────────────────────────────────┘
```

**Battle Scene Layout:**
```
┌─────────────────────────────────────────┐
│  Turn: 3/10    Gold: 500g     [Menu]   │ ← HUD
├─────────────────────────────────────────┤
│ ┌────────────────────┐ ┌──────────────┐│
│ │   48×48 Grid       │ │ Turn Order:  ││
│ │   [Tactical Map]   │ │  1. Hero     ││
│ │   [Units with HP]  │ │  2. Goblin   ││
│ └────────────────────┘ │  3. Archer   ││
│                        └──────────────┘│
└─────────────────────────────────────────┘
```

## Notes

- Use **raw Canvas API only** (no framework dependencies like Pixi.js for v1)
- Optional dependencies can be considered for v2: howler (audio), pixi.js (enhanced graphics)
- System is **completely optional** - engine works without UI (headless mode)
- Follow existing project patterns from Map, Battle, Unit, Economy, Route systems
- Use existing utilities: AsyncQueue, Scope, Result, RNG, Logger, SystemTemplate
