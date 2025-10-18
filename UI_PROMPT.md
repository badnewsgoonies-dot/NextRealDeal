# NextRealDeal UI System Prompt

## Project Context
You are working on **NextRealDeal**, a production-ready headless game engine for battle-first roguelikes. The engine is 86% complete with 5 fully implemented systems (Map, Battle, Unit, Economy, Route) and 210 passing tests.

**Current Status:**
- ✅ 5 Core Systems Complete (Map, Battle, Unit, Economy, Route)
- ✅ GameController integration
- ✅ 90% test coverage, 0 architectural violations
- 🚧 **Next: UI System (System 7)** - Canvas-based renderer

## Architecture Principles
Follow these **Phase-0 patterns** strictly:

### 1. **Strict Dependency Injection**
```typescript
class UIManager extends SystemTemplate {
  constructor(
    log: ILogger,
    rng: IRng,
    canvas: HTMLCanvasElement,        // External dependency
    gameController: IGameController   // Read-only game access
  ) {
    super({ name: 'UIManager' });
    this.log = log.child({ system: 'ui', version: 'v1' });
    this.rng = rng.fork('ui:v1');
    this.queue = makeAsyncQueue();
  }
}
```

### 2. **AsyncQueue Serialization**
```typescript
async operation(signal?: AbortSignal): Promise<Result<T, string>> {
  return await this.queue.run(async () => {
    if (signal?.aborted) return err('aborted');
    // ... operation logic
    return ok(result);
  }, { signal });
}
```

### 3. **Result Types (No Exceptions)**
```typescript
type Result<T, E> = Ok<T> | Err<E>;
const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const err = <E>(error: E): Err<E> => ({ ok: false, error });
```

### 4. **Deterministic RNG**
```typescript
const rng = makeRng(seed);          // Root RNG
const systemRng = rng.fork('ui');   // Independent sub-stream
const value = systemRng.int(0, 100); // Reproducible
```

## UI System Requirements

### **Core Responsibilities**
- **Canvas rendering** (maps, units, effects)
- **Input handling** (keyboard, mouse, gamepad)
- **Animation system** (tweens, effects)
- **Scene management** (route, battle, shop, inventory)
- **Asset loading** (sprites, fonts)

### **What UI Does NOT Do**
- ❌ Game logic (delegated to systems)
- ❌ State management (read-only access)
- ❌ RNG for gameplay (only for visual effects)
- ❌ Save/load (uses SaveManager)

## File Structure
```
src/ui/
├── UIManager.ts              (~400 lines) - Main system, scene coordination
├── renderers/
│   ├── MapRenderer.ts        (~300 lines) - Tile rendering, camera
│   ├── UnitRenderer.ts       (~250 lines) - Character sprites, HP bars
│   ├── BattleRenderer.ts     (~300 lines) - Combat effects, animations
│   ├── RouteRenderer.ts      (~250 lines) - Node graph, path display
│   ├── UIRenderer.ts         (~200 lines) - HUD, menus, overlays
├── input/
│   ├── InputManager.ts       (~300 lines) - Keyboard, mouse, gamepad
│   ├── KeyBindings.ts        (~100 lines) - Configurable controls
├── animation/
│   ├── AnimationSystem.ts    (~250 lines) - Tween engine, effects
│   ├── ParticleSystem.ts     (~200 lines) - Particles (hits, loot)
├── assets/
│   ├── AssetLoader.ts        (~200 lines) - Sprite/font loading
│   ├── SpriteAtlas.ts        (~150 lines) - Sprite sheet management
├── scenes/
│   ├── RouteScene.ts         (~300 lines) - Meta-map view
│   ├── BattleScene.ts        (~350 lines) - Combat view
│   ├── ShopScene.ts          (~200 lines) - Shop interface
│   ├── InventoryScene.ts     (~200 lines) - Inventory management
│   ├── MenuScene.ts          (~150 lines) - Main menu, settings
└── UIValidator.ts            (~100 lines) - Input validation
```

## Key Scenes to Implement

### 1. **Route Scene** (Slay the Spire-style)
- Node graph with A/B/C choices
- Current position indicator
- Path history (completed nodes)
- Walk animation between nodes
- Player stats overlay

### 2. **Battle Scene** (Tactical Grid)
- 48×48 tile tactical map
- Units with HP bars and status effects
- Turn order indicator
- Damage numbers (floating)
- Combat log (scrolling text)
- Camera system with smooth following

### 3. **Shop Scene**
- Item grid (purchasable items)
- Player gold display
- Item details (hover tooltips)
- Purchase confirmation

### 4. **Inventory Scene**
- Player items (grid layout)
- Equipped items (character preview)
- Stats panel
- Drag-and-drop functionality

## Input System

### **Default Key Bindings**
```typescript
const DEFAULT_BINDINGS = {
  // Route
  choiceA: 'a',
  choiceB: 'b', 
  choiceC: 'c',
  
  // Battle
  endTurn: 'space',
  ability1: '1',
  ability2: '2',
  ability3: '3',
  
  // Navigation
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  
  // System
  menu: 'Escape',
  inventory: 'i',
  save: 'F5',
  load: 'F9',
};
```

## Rendering Architecture

### **Main Render Loop**
```typescript
class UIManager {
  render(deltaTime: number): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render current scene
    switch (this.currentScene) {
      case 'route':
        this.routeScene.render(this.ctx, deltaTime);
        break;
      case 'battle':
        this.battleScene.render(this.ctx, deltaTime);
        break;
      // ... other scenes
    }
    
    // Render overlay (HUD, menus)
    this.uiRenderer.render(this.ctx, deltaTime);
  }
}
```

## Animation System

### **Tween Engine**
```typescript
interface Tween {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly easing: EasingFunction;
  readonly onUpdate: (value: number) => void;
  readonly onComplete?: () => void;
}
```

### **Easing Functions**
```typescript
const Easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};
```

## Performance Targets

### **v1.2 Benchmarks**
```
Render Time (60 FPS):    <16ms per frame
  - Map rendering:       <4ms (48×48 grid)
  - Unit rendering:      <2ms (20 units)
  - UI overlay:          <2ms
  - Animations:          <3ms
  - Overhead:            <5ms

Memory Usage:            <100 MB total
  - Assets:              <30 MB (sprites, fonts)
  - Game state:          <20 MB
  - Render buffers:      <20 MB
  - Overhead:            <30 MB

Asset Loading:           <5 seconds
  - Initial load:        <3 seconds
  - Lazy loading:        <100ms per asset
```

## Testing Requirements

### **Unit Tests (~120 tests)**
- **UIManager** (15 tests): Lifecycle, scene switching, render timing
- **Renderers** (40 tests): Map, Unit, Battle, Route, UI rendering
- **Input** (20 tests): Key bindings, mouse detection, commands
- **Animation** (15 tests): Tween creation, easing, particle lifetime
- **Scenes** (30 tests): Route, Battle, Shop, Inventory functionality

### **Integration Tests (~10 tests)**
- Full route → battle → shop cycle
- Input → command → game state update
- Save/load preserves UI state
- Performance (60 FPS with 200 units)

## Implementation Phases

### **Phase 1: Foundation** (Week 1)
- [ ] UIManager skeleton with DI
- [ ] Canvas setup and render loop
- [ ] Basic input handling
- [ ] Scene switching mechanism
- [ ] ~30 tests

### **Phase 2: Route Scene** (Week 2)
- [ ] Node graph rendering
- [ ] Choice selection (click + keyboard)
- [ ] Walk animation
- [ ] Path history display
- [ ] ~20 tests

### **Phase 3: Battle Scene** (Week 3)
- [ ] Map tile rendering
- [ ] Unit sprites and HP bars
- [ ] Camera system
- [ ] Turn order display
- [ ] ~30 tests

### **Phase 4: Combat Polish** (Week 4)
- [ ] Damage numbers
- [ ] Attack animations
- [ ] Particle effects
- [ ] Combat log
- [ ] ~20 tests

### **Phase 5: Additional Scenes** (Week 5)
- [ ] Shop scene
- [ ] Inventory scene
- [ ] Menu scene
- [ ] ~20 tests

## Code Quality Gates

### **File Limits**
- ✅ Max 500 lines per file
- ✅ Max complexity 12 per function
- ✅ TypeScript strict mode
- ✅ ESLint compliance

### **Architecture Validation**
- ✅ No circular dependencies
- ✅ Dependency injection only
- ✅ AsyncQueue for all async operations
- ✅ Result types for error handling

## Example Usage

```typescript
// main.ts - Browser entry point
import { UIManager } from './src/ui/UIManager.js';
import { GameController } from './src/core/GameController.js';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 720;

// Create game
const log = new ConsoleLogger('info');
const rng = makeRng(Date.now());
const game = createGameController(log, rng);
await game.initialize();

// Create UI
const ui = new UIManager(log, rng, canvas, game);
await ui.initialize();

// Load assets
await ui.loadAssets({
  sprites: {
    floor: '/assets/tiles/floor.png',
    wall: '/assets/tiles/wall.png',
    warrior: '/assets/units/warrior.png',
  },
  fonts: {
    main: '/assets/fonts/main.woff2',
  },
});

// Start render loop
let lastTime = 0;
function gameLoop(currentTime: number) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  ui.render(deltaTime);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

// Start game
await game.getRouteManager().startRun('game-001', Date.now());
ui.setScene('route');
```

## Success Criteria

### **Functional**
- [ ] All 5 scenes implemented and tested
- [ ] Input handling for keyboard + mouse
- [ ] Smooth 60 FPS rendering
- [ ] Asset loading working
- [ ] Scene transitions smooth

### **Quality**
- [ ] 350+ total tests (120 UI + 256 existing)
- [ ] 80%+ coverage maintained
- [ ] No memory leaks in render loop
- [ ] Cross-browser compatibility

### **Performance**
- [ ] <16ms render time (60 FPS)
- [ ] <100 MB memory usage
- [ ] <5s asset loading
- [ ] Smooth with 200 units

## Integration Notes

**UI System is REACTIVE, not imperative:**
- UI reads game state, doesn't modify it
- Commands go through game loop, not directly to systems
- Maintains clean separation from game logic
- Can be skipped for headless deployments

## Dependencies

**Production:**
- `pure-rand` (existing) - For particle effects RNG
- `valibot` (existing) - For input validation

**No additional dependencies** - Uses raw Canvas API only.

---

**Ready to implement System 7 (UI) following NextRealDeal's strict architectural patterns!** 🚀
