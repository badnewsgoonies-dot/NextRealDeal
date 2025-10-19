# BattleScreen Fixes Applied

## Issues Fixed

### 1. React Hooks Ordering Error
**Problem:** Conditional hook calls caused "Rendered more hooks than during the previous render" error.

**Solution:**
- Moved all hooks to the top of the component (before any conditional returns)
- Moved `activeUnit` calculation after early returns (only runs when battleState exists)
- Added `handleUnitClick` to useEffect dependencies
- Fixed useEffect dependency from `battleState?.enemies` to `battleState`

### 2. Responsive IsometricStage
**Problem:** Hard-coded dimensions (centerX=400, centerY=300) caused tiny/off-screen battle grid.

**Solution:**
- Added `ResizeObserver` to dynamically measure container
- Calculate tile size based on grid dimensions and available space:
  - `tileW = min(width / (gridW + gridH) * 0.8, 60px)`
  - `tileH = tileW * 0.5` (isometric ratio)
- Auto-center the grid using container dimensions
- Support both `x/y` and `tx/ty` coordinate naming
- Applied max-width constraint: `max-w-[1100px]`
- Applied responsive height: `h-[min(70vh,640px)]`

### 3. Layout Fixes
**Container Height:**
```tsx
// Before: h-screen (blocks entire viewport)
// After: min-h-[calc(100vh-4rem)] (accounts for navbar)
```

**Targeting Overlay:**
```tsx
// Before: Blocked pointer events
// After: pointer-events-none select-none (non-blocking)
```

## Files Modified

1. **src/ui/pages/BattleScreen.tsx**
   - Fixed hook ordering (all hooks before early returns)
   - Changed container height to `min-h-[calc(100vh-4rem)]`
   - Made targeting instruction non-blocking with `pointer-events-none`

2. **src/ui/components/battle/IsometricStage.tsx**
   - Complete rewrite with responsive sizing
   - Added ResizeObserver for dynamic container measurement
   - Implemented automatic tile size calculation
   - Proper isometric centering math
   - Support for both x/y and tx/ty coordinates

## Expected Results

✅ Battle screen loads without React errors
✅ Isometric stage scales to fit container
✅ Unit markers appear at correct diamond grid positions
✅ All UI panels (EnemyList, PartyMini, StatusHud, CommandMenu) render in correct corners
✅ No overlapping elements
✅ Targeting overlay doesn't block clicks
✅ Keyboard navigation works correctly
✅ Stage adapts on window resize

## Testing Checklist

- [x] React hook error resolved
- [x] Isometric stage visible and centered
- [x] Responsive tile sizing implemented
- [x] Container height accounts for navbar
- [x] Targeting overlay non-blocking
- [ ] Verify unit markers clickable (test in browser)
- [ ] Verify keyboard targeting works (test in browser)
- [ ] Verify all HUD panels visible (test in browser)