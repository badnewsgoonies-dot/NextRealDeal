# Theme System Removal

**Date:** October 18, 2025  
**Objective:** Remove light/dark mode toggle and lock UI to single dark palette

## Changes Applied

### 1. ✅ Removed Theme Provider & Context

- **Deleted:** `src/ui/context/ThemeContext.tsx`
- **Modified:** `src/App.tsx` — removed `ThemeProvider` wrapper
  - Before: wrapped `<BrowserRouter>` in `<ThemeProvider>`
  - After: direct `<BrowserRouter>` rendering

### 2. ✅ Removed Theme Toggle UI

- **Modified:** `src/ui/components/layout/Navbar.tsx`
  - Removed `useTheme()` hook import and usage
  - Removed theme toggle button (sun/moon icon)
  
- **Modified:** `src/ui/pages/Settings.tsx`
  - Removed theme toggle section from Appearance settings
  - Replaced with generic "Game Settings" placeholder

### 3. ✅ Flattened Theme Tokens (Single Palette)

**File:** `src/ui/styles/theme-tokens.css`

**Before:**
```css
:root { /* light theme variables */ }
.dark { /* dark theme overrides */ }
```

**After:**
```css
:root {
  /* Single dark palette */
  --surface-0: #0b1220;
  --surface-1: #11182a;
  --surface-2: #1a2240;
  --text-primary: #ffffff;
  --text-secondary: #cbd5e0;
  --player-fill: #4aa3ff;
  --enemy-fill: #ef4444;
  /* ... */
}
```

### 4. ✅ Removed Dark Mode Variants

- **Modified:** `src/ui/components/battle/IsometricStage.tsx`
  - Before: `className="... dark:from-blue-900 dark:to-blue-950"`
  - After: `className="... from-blue-900 to-blue-950"`

- **Modified:** `src/ui/components/common/Form.tsx`
  - Before: `hover:bg-gray-50 dark:hover:bg-gray-800`
  - After: `hover:bg-gray-800`

### 5. ✅ Import Cleanup

- **Modified:** `src/App.tsx`
  - Removed: `import { ThemeProvider } from './ui/context/ThemeContext'`
  - Added explicit `React` import for proper TypeScript support

## Validation

All modified files checked with `get_errors` — **no errors found**.

## Impact

- **Runtime:** No theme toggle, no localStorage reads/writes, no theme state
- **Bundle:** Smaller (removed ThemeContext, toggle logic)
- **UX:** Consistent single-palette experience (clean dark theme)
- **Maintenance:** One color palette to maintain vs two

## Tailwind Config

`darkMode` setting in `tailwind.config.js` can stay as-is — JIT won't generate unused `dark:` utilities since we removed all `dark:` classes from components.

## CSS Variables (Kept)

We kept CSS custom properties in `:root` for easy palette tuning without touching component code. This is still "one theme", just easier to adjust colors later.

## Next Steps (Optional)

- Clean up unused imports across other files if theme-related
- Update any docs/README that reference theme toggle feature
- Consider adding theme variation without toggle (e.g., alternate palettes for different game zones)

---

**Status:** ✅ Complete — Light/dark mode removed, UI locked to clean dark palette
