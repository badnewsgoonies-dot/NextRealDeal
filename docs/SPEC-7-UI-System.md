# SPEC-7: UI System (Canvas Renderer)

**Version:** ui:v1  
**Status:** Design Phase  
**Target Release:** v1.2  
**Prerequisites:** v1.1 content complete, performance benchmarks passed

---

## Overview

The UI System provides visual representation and player interaction for NextRealDeal. It's designed as an **optional layer** on top of the headless engine, maintaining clean separation from game logic.

**Design Principles:**
- Headless-first (engine works without UI)
- Reactive (responds to state changes, doesn't drive logic)
- Platform-agnostic (Canvas API, works in browser/Electron)
- Deterministic rendering (same state = same visuals)

---

## Architecture

### **System Responsibilities**

**UIManager (System 7):**
- Canvas rendering (maps, units, effects)
- Input handling (keyboard, mouse, gamepad)
- Animation system (tweens, effects)
- Scene management (route, battle, shop, inventory)
- Asset loading (sprites, fonts)

**What UI Does NOT Do:**
- Game logic (delegated to systems)
- State management (read-only access)
- RNG for gameplay (only for visual effects)
- Save/load (uses SaveManager)

---

## Phase-0 Pattern Compliance

### **Constructor Pattern**
```typescript
class UIManager extends SystemTemplate {
  constructor(
    log: ILogger,
    rng: IRng,
    canvas: HTMLCanvasElement,  // External dependency (injected)
    gameController: IGameController  // Read-only game access
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

### **Patterns:**
- ✅ Strict DI (canvas + game controller injected)
- ✅ Own AsyncQueue for async operations
- ✅ Result types for expected failures
- ✅ Deterministic animations (seeded RNG for particle effects)
- ✅ Test-only debug hook
- ✅ ≤500 lines per file (split into multiple renderers)

---

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

tests/ui/
├── UIManager.test.ts         (~40 tests)
├── MapRenderer.test.ts       (~15 tests)
├── InputManager.test.ts      (~20 tests)
├── AnimationSystem.test.ts   (~15 tests)
└── scenes/                   (~30 tests total)
```

**Total Estimate:** ~3,500 lines, ~120 tests

---

## Public API

### **Interface (contracts.ts)**

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

export type SceneName = 'menu' | 'route' | 'battle' | 'shop' | 'inventory';

export interface InputEvent {
  readonly type: 'keydown' | 'keyup' | 'click' | 'mousemove';
  readonly key?: string;
  readonly position?: Position;
}

export interface AssetManifest {
  readonly sprites: Record<string, string>;  // name -> URL
  readonly fonts: Record<string, string>;
}

export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}
```

---

## Rendering Architecture

### **Main Render Loop**

```typescript
class UIManager {
  private lastFrameTime = 0;
  private fps = 0;
  
  render(deltaTime: number): void {
    // Update FPS
    this.fps = 1000 / deltaTime;
    
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
      case 'shop':
        this.shopScene.render(this.ctx, deltaTime);
        break;
      // ... other scenes
    }
    
    // Render overlay (HUD, menus)
    this.uiRenderer.render(this.ctx, deltaTime);
  }
}
```

**Called by external game loop:**
```typescript
let lastTime = 0;

function gameLoop(currentTime: number) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  uiManager.render(deltaTime);
  
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

---

## Scene Breakdown

### **1. Route Scene**

**Displays:**
- Node graph (A/B/C choices)
- Current position indicator
- Path history (completed nodes)
- Player stats overlay

**Interactions:**
- Click nodes to select
- Keyboard (A/B/C keys)
- Hover preview (node details)

**Animation:**
- Walk animation (icon moves along path)
- Node reveal (fade in)
- Choice highlight (pulse effect)

```typescript
class RouteScene {
  render(ctx: CanvasRenderingContext2D, dt: number): void {
    // Get choices from RouteManager
    const pointer = this.game.getRouteManager().current();
    const choices = this.cachedChoices;  // From last getChoices()
    
    // Draw completed path
    this.renderHistory(ctx);
    
    // Draw current position
    this.renderCurrentNode(ctx, pointer);
    
    // Draw 3 choice nodes
    choices.forEach((choice, i) => {
      const pos = this.calculateNodePosition(i);
      this.renderNode(ctx, choice, pos);
    });
    
    // Draw connections
    this.renderConnections(ctx, choices);
    
    // Animate "walking" if in transition
    if (this.walkAnimation) {
      this.walkAnimation.update(dt);
      this.renderWalkingCharacter(ctx, this.walkAnimation.position);
    }
  }
  
  private calculateNodePosition(index: number): Position {
    // Layout: current node at bottom, 3 choices spread above
    const baseX = this.canvas.width / 2;
    const baseY = this.canvas.height - 100;
    
    const spacing = 150;
    const offsetX = (index - 1) * spacing;  // -150, 0, +150
    
    return { x: baseX + offsetX, y: baseY - 200 };
  }
}
```

---

### **2. Battle Scene**

**Displays:**
- Tactical grid (48×48 tiles)
- Units with HP bars
- Turn order indicator
- Damage numbers (floating)
- Combat log (scrolling text)

**Interactions:**
- Click unit to select
- Click tile to move/attack
- Keyboard shortcuts (1-9 for abilities)
- Escape to open menu

**Animations:**
- Attack effects (sword slash, fireball)
- Damage numbers (pop up and fade)
- Unit movement (smooth tween)
- Critical hit flash
- Dodge animation (unit shifts)

```typescript
class BattleScene {
  render(ctx: CanvasRenderingContext2D, dt: number): void {
    // Get battle state
    const battleState = this.game.getBattleManager().getBattleState();
    if (!battleState) return;
    
    // Get current map
    const map = this.currentArena;  // MapData from generation
    
    // Render map tiles
    this.mapRenderer.render(ctx, map, this.camera);
    
    // Render units
    battleState.units.forEach(unit => {
      const sprite = this.getUnitSprite(unit);
      this.unitRenderer.render(ctx, unit, sprite, this.camera);
      
      // HP bar
      this.renderHPBar(ctx, unit);
    });
    
    // Render active animations
    this.animations.forEach(anim => {
      anim.update(dt);
      anim.render(ctx);
    });
    
    // Render turn order
    this.renderTurnOrder(ctx, battleState.turnOrder);
    
    // Render combat log
    this.renderCombatLog(ctx);
  }
}
```

---

### **3. Shop Scene**

**Displays:**
- Item grid (purchasable items)
- Player gold
- Item details (hover)
- Purchase confirmation

**Interactions:**
- Click item to buy
- Right-click to sell
- Keyboard navigation

---

### **4. Inventory Scene**

**Displays:**
- Player items (grid layout)
- Equipped items (character preview)
- Stats panel
- Item tooltips

**Interactions:**
- Click to equip/unequip
- Drag-and-drop items
- Right-click for quick actions

---

## Input System

### **KeyBindings (Configurable)**

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

### **Input Manager**

```typescript
class InputManager {
  private bindings: KeyBindings;
  private mousePos: Position = { x: 0, y: 0 };
  
  handleKeyDown(event: KeyboardEvent): InputCommand | null {
    const key = event.key;
    
    // Map to command
    if (key === this.bindings.choiceA) return { type: 'choose', label: 'A' };
    if (key === this.bindings.menu) return { type: 'toggleMenu' };
    // ... etc
    
    return null;
  }
  
  handleMouseClick(event: MouseEvent): InputCommand | null {
    const canvasRect = this.canvas.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;
    
    // Check what was clicked
    if (this.currentScene === 'route') {
      const node = this.routeScene.getNodeAt({ x, y });
      if (node) return { type: 'choose', choiceId: node.id };
    }
    
    return null;
  }
}
```

---

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

class AnimationSystem {
  private tweens = new Map<string, Tween & { elapsed: number }>();
  
  createTween(config: Tween): string {
    this.tweens.set(config.id, { ...config, elapsed: 0 });
    return config.id;
  }
  
  update(deltaTime: number): void {
    for (const [id, tween] of this.tweens.entries()) {
      tween.elapsed += deltaTime;
      
      if (tween.elapsed >= tween.duration) {
        tween.onUpdate(tween.to);
        tween.onComplete?.();
        this.tweens.delete(id);
      } else {
        const t = tween.elapsed / tween.duration;
        const eased = tween.easing(t);
        const value = tween.from + (tween.to - tween.from) * eased;
        tween.onUpdate(value);
      }
    }
  }
}
```

**Easing Functions:**
```typescript
const Easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};
```

---

## Asset Management

### **AssetLoader**

```typescript
interface AssetManifest {
  sprites: Record<string, string>;  // name -> URL
  fonts: Record<string, string>;
}

class AssetLoader {
  private sprites = new Map<string, HTMLImageElement>();
  private fonts = new Map<string, FontFace>();
  
  async loadAssets(manifest: AssetManifest, signal?: AbortSignal): Promise<Result<void, string>> {
    try {
      return await this.queue.run(async () => {
        if (signal?.aborted) return err('aborted');
        
        // Load sprites
        for (const [name, url] of Object.entries(manifest.sprites)) {
          const img = await this.loadImage(url);
          this.sprites.set(name, img);
        }
        
        // Load fonts
        for (const [name, url] of Object.entries(manifest.fonts)) {
          const font = new FontFace(name, `url(${url})`);
          await font.load();
          this.fonts.set(name, font);
        }
        
        this.log.info('Assets loaded', { 
          sprites: Object.keys(manifest.sprites).length,
          fonts: Object.keys(manifest.fonts).length 
        });
        
        return ok(undefined);
      }, { signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') return err('aborted');
      return err('asset-load-failed');
    }
  }
  
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }
}
```

---

## Rendering Examples

### **Map Tiles**

```typescript
class MapRenderer {
  private tileSize = 32;  // pixels per tile
  
  renderTile(ctx: CanvasRenderingContext2D, tile: Tile, camera: Camera): void {
    const screenX = (tile.x * this.tileSize) - camera.x;
    const screenY = (tile.y * this.tileSize) - camera.y;
    
    // Check if in viewport
    if (!this.isInViewport(screenX, screenY)) return;
    
    // Get sprite for tile type
    const sprite = this.getTileSprite(tile.t);
    
    if (sprite) {
      ctx.drawImage(sprite, screenX, screenY, this.tileSize, this.tileSize);
    } else {
      // Fallback: colored rectangles
      ctx.fillStyle = this.getTileColor(tile.t);
      ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
    }
  }
  
  private getTileColor(type: number): string {
    const colors = {
      0: '#cccccc',  // floor
      1: '#333333',  // wall
      2: '#4444ff',  // water
      3: '#8b4513',  // door
      4: '#00ff00',  // spawn
      5: '#ff0000',  // exit
    };
    return colors[type] || '#ffffff';
  }
}
```

### **Units with HP Bars**

```typescript
class UnitRenderer {
  renderUnit(ctx: CanvasRenderingContext2D, unit: Unit, camera: Camera): void {
    const screenX = (unit.position.x * 32) - camera.x;
    const screenY = (unit.position.y * 32) - camera.y;
    
    // Draw unit sprite
    const sprite = this.getUnitSprite(unit.kind);
    if (sprite) {
      ctx.drawImage(sprite, screenX, screenY, 32, 32);
    }
    
    // Draw HP bar
    this.renderHPBar(ctx, unit, screenX, screenY - 8);
    
    // Draw status effects (if any)
    this.renderStatusEffects(ctx, unit, screenX, screenY);
  }
  
  private renderHPBar(ctx: CanvasRenderingContext2D, unit: Unit, x: number, y: number): void {
    const width = 32;
    const height = 4;
    const hpPercent = unit.hp / unit.maxHp;
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, height);
    
    // HP bar
    ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(x, y, width * hpPercent, height);
    
    // Border
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);
  }
}
```

### **Damage Numbers**

```typescript
class DamageNumberAnimation {
  constructor(
    private damage: number,
    private position: Position,
    private critical: boolean
  ) {}
  
  render(ctx: CanvasRenderingContext2D, elapsed: number): void {
    const y = this.position.y - (elapsed * 50);  // Float upward
    const alpha = Math.max(0, 1 - elapsed / 1000);  // Fade out
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = this.critical ? 'bold 24px Arial' : '18px Arial';
    ctx.fillStyle = this.critical ? '#ff0000' : '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    const text = String(this.damage);
    ctx.strokeText(text, this.position.x, y);
    ctx.fillText(text, this.position.x, y);
    
    ctx.restore();
  }
  
  isDone(elapsed: number): boolean {
    return elapsed >= 1000;  // 1 second lifetime
  }
}
```

---

## Input Handling

### **Event Binding**

```typescript
class UIManager {
  private bindInputEvents(): void {
    // Keyboard
    this.scope.on(window, 'keydown', (e: KeyboardEvent) => {
      const command = this.inputManager.handleKeyDown(e);
      if (command) {
        this.handleCommand(command);
        e.preventDefault();
      }
    });
    
    // Mouse
    this.scope.on(this.canvas, 'click', (e: MouseEvent) => {
      const command = this.inputManager.handleMouseClick(e);
      if (command) this.handleCommand(command);
    });
    
    // Prevent context menu on right-click
    this.scope.on(this.canvas, 'contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  private async handleCommand(command: InputCommand): Promise<void> {
    switch (command.type) {
      case 'choose':
        if (this.currentScene === 'route') {
          const result = await this.game.getRouteManager().choose(command.choiceId);
          if (result.ok) {
            await this.transitionToBattle(result.value.choice);
          }
        }
        break;
        
      case 'toggleMenu':
        this.toggleMenu();
        break;
        
      // ... other commands
    }
  }
}
```

---

## Scene Transitions

### **Smooth Transitions**

```typescript
async transitionToBattle(choice: Choice): Promise<void> {
  // 1. Walk animation (1 second)
  await this.playWalkAnimation(choice);
  
  // 2. Fade out route scene (0.5 seconds)
  await this.fadeOut(500);
  
  // 3. Generate arena
  const arena = await this.game.getMapManager().generate({
    width: choice.arenaHint.width,
    height: choice.arenaHint.height,
    seed: choice.arenaSeed,
  });
  
  if (!arena.ok) {
    this.showError(arena.error);
    return;
  }
  
  // 4. Switch scene
  this.currentScene = 'battle';
  this.battleScene.setArena(arena.value);
  
  // 5. Fade in battle scene (0.5 seconds)
  await this.fadeIn(500);
}
```

---

## Camera System

```typescript
class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  
  // Smooth follow
  followTarget(target: Position, deltaTime: number): void {
    const speed = 5 * deltaTime / 1000;
    
    const targetX = target.x * 32 - (this.viewportWidth / 2);
    const targetY = target.y * 32 - (this.viewportHeight / 2);
    
    this.x += (targetX - this.x) * speed;
    this.y += (targetY - this.y) * speed;
  }
  
  // Zoom with limits
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.5, Math.min(2.0, zoom));
  }
  
  worldToScreen(worldPos: Position): Position {
    return {
      x: (worldPos.x * 32 - this.x) * this.zoom,
      y: (worldPos.y * 32 - this.y) * this.zoom,
    };
  }
  
  screenToWorld(screenPos: Position): Position {
    return {
      x: Math.floor((screenPos.x / this.zoom + this.x) / 32),
      y: Math.floor((screenPos.y / this.zoom + this.y) / 32),
    };
  }
}
```

---

## Testing Strategy

### **Unit Tests (~120 tests)**

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
- Shop scene: item display, purchase flow
- Inventory scene: equip/unequip

### **Integration Tests (~10 tests)**
- Full route → battle → shop cycle
- Input → command → game state update
- Save/load preserves UI state
- Performance (60 FPS with 200 units)

### **Visual Tests (Manual)**
- Screenshot comparison
- Animation smoothness
- UI responsiveness
- Cross-browser compatibility

---

## Performance Targets

### **v1.2 Benchmarks:**

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

---

## Implementation Phases

### **Phase 1: Foundation**
**Blockers:** None  
**Deliverables:**
- [ ] UIManager skeleton
- [ ] Canvas setup and render loop
- [ ] Basic input handling
- [ ] Scene switching
- [ ] ~30 tests

### **Phase 2: Route Scene**
**Blockers:** Phase 1 complete  
**Deliverables:**
- [ ] Node graph rendering
- [ ] Choice selection (click + keyboard)
- [ ] Walk animation
- [ ] Path history display
- [ ] ~20 tests

### **Phase 3: Battle Scene**
**Blockers:** Phase 1 complete  
**Deliverables:**
- [ ] Map tile rendering
- [ ] Unit sprites and HP bars
- [ ] Camera system
- [ ] Turn order display
- [ ] ~30 tests

### **Phase 4: Combat Polish**
**Blockers:** Phase 3 complete  
**Deliverables:**
- [ ] Damage numbers
- [ ] Attack animations
- [ ] Particle effects
- [ ] Combat log
- [ ] ~20 tests

### **Phase 5: Additional Scenes**
**Blockers:** Phase 2 complete  
**Deliverables:**
- [ ] Shop scene
- [ ] Inventory scene
- [ ] Menu scene
- [ ] ~20 tests

### **Phase 6: Polish**
**Blockers:** Phases 2-5 complete  
**Deliverables:**
- [ ] Scene transitions
- [ ] Sound hooks
- [ ] Visual effects
- [ ] Performance optimization
- [ ] Documentation

**Completion Criteria:**
- All ~120 tests passing
- 60 FPS sustained
- ~3,500 lines implemented
- All 5 scenes functional

---

## Dependencies

### **Required:**
```json
{
  "dependencies": {
    "pure-rand": "^6.1.0",   // Existing (for particle RNG)
    "valibot": "^0.42.1"     // Existing (for validation)
  }
}
```

### **Optional (for enhanced features):**
```json
{
  "optionalDependencies": {
    "howler": "^2.2.4",      // Audio (if adding sound)
    "pixi.js": "^7.3.0"      // Alternative to raw Canvas (if scaling up)
  }
}
```

**Note:** v1 uses **raw Canvas API** only (no framework dependencies).

---

## Minimal Viable UI (MVP)

**For v1.2 initial release, focus on:**

### **Must Have:**
- ✅ Route scene (node selection)
- ✅ Battle scene (grid + units)
- ✅ Basic animations (walk, attack)
- ✅ Input handling (keyboard + mouse)
- ✅ HUD (gold, HP, step counter)

### **Nice to Have (v1.3):**
- Shop scene (can use text menu initially)
- Inventory scene (can use text menu initially)
- Advanced effects (particles, screen shake)
- Sound integration
- Settings menu

### **Can Defer (v2.0):**
- Multiple art styles/themes
- Mod support for custom sprites
- Level editor integration
- Replay viewer UI

---

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
    // ... more assets
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

---

## Testing Approach

### **Headless Canvas Testing**

```typescript
import { describe, test, expect } from 'vitest';
import { createCanvas } from 'canvas';  // node-canvas for tests
import { UIManager } from '../../../src/ui/UIManager.js';

describe('UIManager', () => {
  test('renders without errors', () => {
    const canvas = createCanvas(800, 600);
    const ui = new UIManager(log, rng, canvas as any, game);
    
    ui.render(16.67);  // One frame at 60 FPS
    
    expect(ui.getDebugStats()?.fps).toBeCloseTo(60, 0);
  });
  
  test('scene switching clears previous scene', async () => {
    const ui = new UIManager(log, rng, canvas as any, game);
    
    await ui.setScene('route');
    expect(ui.getCurrentScene()).toBe('route');
    
    await ui.setScene('battle');
    expect(ui.getCurrentScene()).toBe('battle');
  });
});
```

---

## Visual Reference

### **Route Scene Layout**

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
│                                         │
└─────────────────────────────────────────┘
```

### **Battle Scene Layout**

```
┌─────────────────────────────────────────┐
│  Turn: 3/10    Gold: 500g     [Menu]   │ ← HUD
├─────────────────────────────────────────┤
│ ┌────────────────────┐ ┌──────────────┐│
│ │                    │ │ Turn Order:  ││
│ │   48×48 Grid       │ │  1. Hero     ││ ← Turn list
│ │   [Tactical Map]   │ │  2. Goblin   ││
│ │                    │ │  3. Archer   ││
│ │   [Units with HP]  │ └──────────────┘│
│ │                    │ ┌──────────────┐│
│ └────────────────────┘ │ Combat Log:  ││
│                        │  Hero hits!  ││ ← Log
│                        │  12 damage   ││
│                        └──────────────┘│
└─────────────────────────────────────────┘
```

---

## Success Criteria for v1.2

### **Functional:**
- [ ] All 5 scenes implemented and tested
- [ ] Input handling for keyboard + mouse
- [ ] Smooth 60 FPS rendering
- [ ] Asset loading working
- [ ] Scene transitions smooth

### **Quality:**
- [ ] 350+ total tests (120 UI + 256 existing)
- [ ] 80%+ coverage maintained
- [ ] No memory leaks in render loop
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)

### **Performance:**
- [ ] <16ms render time (60 FPS)
- [ ] <100 MB memory usage
- [ ] <5s asset loading
- [ ] Smooth with 200 units

---

## Integration with Existing Systems

**UI System does NOT modify game state directly:**

```typescript
// ❌ BAD: UI calling game logic directly
async handleChoiceClick(choiceId: string) {
  await this.game.getRouteManager().choose(choiceId);  // Don't do this!
}

// ✅ GOOD: UI emits commands, game loop handles them
async handleChoiceClick(choiceId: string) {
  this.commandQueue.push({ type: 'choose', choiceId });
}

// In game loop:
for (const cmd of commandQueue) {
  if (cmd.type === 'choose') {
    await game.getRouteManager().choose(cmd.choiceId);
  }
}
```

**Keeps UI reactive, not imperative.**

---

## Summary

**System 7 (UI) Design:**
- ~3,500 lines across 15+ files
- ~120 comprehensive tests
- Canvas-based rendering (no framework)
- Scene-based architecture
- Input abstraction layer
- Animation system
- Asset management
- Performance optimized for 60 FPS

**Scope:** ~3,500 lines across 15+ files, ~120 tests  
**Release Target:** v1.2  
**Prerequisites:** v1.1 complete, asset pipeline ready

**Can be skipped for headless deployments** - Engine is fully functional without UI!

---

**Files created:**
- ✅ ROADMAP.md - Complete product roadmap
- ✅ docs/SPEC-7-UI-System.md - Detailed UI system design

**Ready for v1.0 release and v1.1/v1.2 planning!** 🚀

