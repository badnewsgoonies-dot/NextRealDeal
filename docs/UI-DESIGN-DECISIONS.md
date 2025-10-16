# UI System Design Decisions

**System:** UI (System 7)  
**Version:** ui:v1  
**Last Updated:** v1.0.0 release

---

## Core Decisions

### 1. Isometric Projection

**Question:** Include isometric rendering in v1.2 MVP or defer?

**Decision:** ✅ **DEFER to v2.0**

**Rationale:**
- MVP needs to prove rendering patterns work
- Top-down 2D is simpler (no coordinate transforms)
- Isometric requires world→screen and screen→world transforms
- Can add as visual skin layer later without changing game logic
- Don't block shipping on visual complexity

**v1.2 Approach:**
```typescript
// Simple orthographic (top-down)
screenX = worldX * TILE_SIZE - camera.x;
screenY = worldY * TILE_SIZE - camera.y;
```

**v2.0+ Enhancement:**
```typescript
// Isometric transform (optional skin)
function worldToIso(worldX: number, worldY: number): Position {
  return {
    x: (worldX - worldY) * (TILE_SIZE / 2),
    y: (worldX + worldY) * (TILE_SIZE / 4),
  };
}
```

---

### 2. Animation Gating

**Question:** Block next game action until animation completes? Add skip toggle?

**Decision:** ✅ **BLOCK with SKIP TOGGLE**

**Rationale:**
- Blocking gives proper game feel (see attacks before next action)
- Matches JRPG conventions (animations play, then proceed)
- Skip toggle respects player preference (speedrunners, testing)
- Easy to implement (await promise or immediate resolve)

**Implementation:**

```typescript
class BattleScene {
  private settings = {
    skipAnimations: false,      // User preference
    animationSpeed: 1.0,        // 1.0 = normal, 2.0 = double speed
  };
  
  async executeAction(action: CombatAction): Promise<void> {
    if (this.settings.skipAnimations) {
      // Instant: just update state, no animation
      this.applyActionInstant(action);
      return;
    }
    
    // Animated: wait for completion
    const speed = this.settings.animationSpeed;
    
    if (action.type === 'attack') {
      await this.playAttackAnimation(action, speed);  // ~500ms / speed
      
      if (action.damage && !action.dodged) {
        await this.playDamageNumber(action.damage, action.critical, speed);  // ~1000ms / speed
      }
    }
    
    if (action.type === 'dodge') {
      await this.playDodgeAnimation(action, speed);  // ~300ms / speed
    }
  }
}
```

**Settings Panel:**
```
Animation Settings:
  ☐ Skip Animations (instant combat)
  ☐ Fast Mode (2x speed)
  ☐ Very Fast Mode (4x speed)
```

**Benefits:**
- Default: Cinematic, satisfying combat experience
- Speed options: Faster battles without losing visual feedback
- Skip mode: Testing, speedruns, accessibility
- Configurable per-player preference

---

### 3. Color Palette

**Question:** Use fixed colors from reference images or theme tokens?

**Decision:** ✅ **THEME TOKENS**

**Rationale:**
- Reference images are inspiration, not specification
- Theme tokens allow dark/light mode
- Enables color-blind palettes
- Makes UI themeable/skinnable
- No brand lock-in

**Approach:**
```typescript
// ❌ BAD: Hardcoded colors
ctx.fillStyle = '#3b82f6';  // Blue

// ✅ GOOD: Theme tokens
ctx.fillStyle = theme.player.fill;
```

**Future Extensions:**
- High contrast theme
- Protanopia-friendly palette
- Deuteranopia-friendly palette
- Custom themes (modding)

---

### 4. DOM vs Canvas

**Question:** Pure Canvas or hybrid (Canvas + DOM overlays)?

**Decision:** ✅ **HYBRID** (Canvas for game world, DOM for UI chrome)

**Rationale:**
- Canvas: Best for game world (tiles, units, effects) - high performance
- DOM: Best for UI chrome (buttons, text, forms) - accessibility, styling
- Hybrid gives best of both worlds

**Split:**

**Rendered on Canvas:**
- Map tiles (48×48 grid)
- Units with HP bars
- Damage numbers
- Particle effects
- Route node graph
- Walk animations

**Rendered in DOM (Overlays):**
- HUD (gold, step, turn) - positioned absolutely over canvas
- Combat log (scrolling div)
- Action buttons (Attack, Spells, Items, Defend)
- Modal dialogs (save/load, settings)
- Inventory grid (drag-and-drop easier in DOM)
- Shop interface

**Example:**
```html
<div class="game-container">
  <canvas id="game-canvas"></canvas>
  
  <!-- DOM overlays -->
  <div class="hud">
    <span>Gold: <span id="gold">500</span>g</span>
    <span>Step: <span id="step">5</span></span>
  </div>
  
  <div class="combat-log">
    <!-- Scrolling battle messages -->
  </div>
  
  <div class="action-buttons">
    <button id="attack">Attack</button>
    <button id="spells">Spells</button>
    <button id="items">Items</button>
    <button id="defend">Defend</button>
  </div>
</div>
```

---

### 5. Asset Loading Strategy

**Question:** Block initialization on assets or graceful fallback?

**Decision:** ✅ **GRACEFUL FALLBACK** (colored rectangles)

**Rationale:**
- Don't block shipping on art assets
- Colored rectangles are perfectly functional
- Assets can be added later without code changes
- Artists can work in parallel

**Implementation:**

```typescript
class UnitRenderer {
  render(ctx: CanvasRenderingContext2D, unit: Unit): void {
    const sprite = this.assetLoader.getSprite(`unit-${unit.kind}`);
    
    if (sprite) {
      // Use sprite if available
      ctx.drawImage(sprite, x, y, 32, 32);
    } else {
      // Fallback: colored rectangle
      ctx.fillStyle = unit.team === 'player' ? theme.player.fill : theme.enemy.fill;
      ctx.fillRect(x, y, 32, 32);
      
      // Add text label
      ctx.fillStyle = theme.text.primary;
      ctx.font = '10px monospace';
      ctx.fillText(unit.name.substring(0, 3), x + 4, y + 20);
    }
  }
}
```

**Asset Manifest (Optional):**
```typescript
const ASSET_MANIFEST = {
  tiles: {
    floor: '/assets/tiles/floor.png',
    wall: '/assets/tiles/wall.png',
    // ... optional
  },
  units: {
    warrior: '/assets/units/warrior.png',
    mage: '/assets/units/mage.png',
    // ... optional
  },
};
```

---

### 6. Render Loop Ownership

**Question:** UI owns render loop or external?

**Decision:** ✅ **EXTERNAL** (main.ts owns loop, calls ui.render())

**Rationale:**
- Keeps UI as a pure system (doesn't manage RAF)
- Matches SystemTemplate pattern (update() called externally)
- Easier to test (no global RAF in UI code)
- Can control frame rate externally

**Pattern:**

```typescript
// main.ts
let lastTime = 0;

function renderLoop(currentTime: number) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  // Call UI system (doesn't own the loop)
  uiManager.render(deltaTime);
  
  requestAnimationFrame(renderLoop);
}

// Start
requestAnimationFrame(renderLoop);
```

---

## Implementation Guidelines

### v1.2 MVP Scope (MUST + Critical SHOULD)

**Scene Priority:**
1. **Route Scene** (highest value, simplest)
   - 3 nodes, labels, click/keyboard selection
   - Walk animation (simple tween)
   
2. **Battle Scene** (core gameplay)
   - 48×48 grid rendering
   - Unit rendering with HP bars
   - Turn order panel
   - Damage numbers

3. **Menu Scene** (entry point)
   - New game, load game, settings buttons
   - Simple modal overlays

4. **Shop/Inventory** (defer if time-constrained)
   - Can use DOM-only modals initially
   - Canvas versions in polish phase

**Features to Include:**
- ✅ Theme tokens (dark/light)
- ✅ Animation blocking (with skip setting)
- ✅ Keyboard controls
- ✅ Basic HUD
- ✅ Combat log

**Features to Defer:**
- ⏳ Isometric projection (v2.0)
- ⏳ Advanced particle effects
- ⏳ Character portraits
- ⏳ Detailed stat panels

---

## Testing Strategy

**Minimal Test Suite (2-3 tests):**

```typescript
// tests/ui/UIManager.test.ts
test('render loop executes without errors', () => {
  const canvas = createCanvas(1280, 720);
  const ui = new UIManager(log, rng, canvas as any, mockGame);
  
  ui.render(16.67);  // One frame
  ui.render(16.67);  // Two frames
  
  const stats = ui.getDebugStats();
  expect(stats?.fps).toBeCloseTo(60, 0);
});

// tests/ui/MapRenderer.test.ts
test('camera transforms world to screen correctly', () => {
  const renderer = new MapRenderer(theme);
  const camera = { x: 100, y: 50, zoom: 1 };
  
  const screen = renderer.worldToScreen({ x: 10, y: 5 }, camera);
  
  expect(screen.x).toBe(10 * 32 - 100);  // tileSize=32
  expect(screen.y).toBe(5 * 32 - 50);
});

// tests/ui/InputManager.test.ts
test('maps key to command correctly', () => {
  const input = new InputManager(bindings);
  
  const command = input.handleKeyPress('a');
  
  expect(command?.type).toBe('choose');
  expect(command?.label).toBe('A');
});
```

---

## 📝 **Summary of Decisions**

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| **Iso-skin** | ❌ Defer | v2.0+ | Prove patterns with simple 2D first |
| **Animation gating** | ✅ Block + skip | v1.2 | Game feel + user control |
| **Color palette** | ✅ Tokens | v1.2 | Themeable, accessible |
| **DOM vs Canvas** | ✅ Hybrid | v1.2 | Best tool for each job |
| **Asset loading** | ✅ Fallback | v1.2 | Don't block on art |
| **Render loop** | ✅ External | v1.2 | Clean separation |

---

## ✅ **Ready to Implement**

**v1.2 UI System with:**
- Top-down 2D (no isometric)
- Animation blocking with skip toggle
- Theme tokens (dark/light)
- Hybrid Canvas + DOM
- Graceful asset fallback
- External render loop ownership

**All decisions locked. Ready to build!** 🚀

Want me to update the UI system prompt with these decisions explicitly included?
