# @austencloud/theme

Shared theming system with luminance-aware theme generation for Svelte 5 applications.

## Features

- **Luminance-based theme calculation** - Automatically adapts UI colors based on background brightness
- **Glass morphism themes** - Semi-transparent overlays that look good on any background
- **Matte themes** - Solid, accessible surfaces for content panels
- **Danger zone themes** - Appropriate styling for destructive actions
- **Scrollbar theming** - Themed scrollbars that adapt to light/dark mode
- **WCAG AAA compliance** - All generated themes meet accessibility standards

## Installation

```bash
npm install @austencloud/theme
```

Or for local development:

```bash
npm install file:../path/to/austencloud-theme
```

## Quick Start

### 1. Import CSS

In your root layout:

```typescript
import '@austencloud/theme/css/index.css';
```

Or cherry-pick what you need:

```typescript
import '@austencloud/theme/css/tokens.css';
import '@austencloud/theme/css/panel-utilities.css';
```

### 2. Configure and Initialize

```typescript
import {
  setStorageKey,
  setThemeColorPalette,
  applyThemeFromColors,
  ensureThemeApplied
} from '@austencloud/theme';

// Configure storage key (for localStorage persistence)
setStorageKey('my-app-settings');

// Register your color palettes
setThemeColorPalette('AURORA', ['#667eea', '#764ba2', '#f093fb']);
setThemeColorPalette('OCEAN', ['#0c4a6e', '#0891b2', '#22d3ee']);

// Apply theme on init (reads from localStorage)
ensureThemeApplied();
```

### 3. Apply Themes

```typescript
// Apply theme based on a solid color
applyThemeFromColors('#1a1a2e');

// Or apply theme for a registered background type
applyThemeForBackground('AURORA');
```

### 4. React to Theme Changes

```typescript
import { getThemeMode, isLightMode, onThemeModeChange } from '@austencloud/theme';

// Get current mode
const mode = getThemeMode(); // 'light' or 'dark'

// Check mode
if (isLightMode()) {
  // bright background
}

// Subscribe to changes
const unsubscribe = onThemeModeChange((mode) => {
  console.log('Theme changed to:', mode);
});
```

## CSS Variables

The package injects the following CSS variables on `:root`:

### Dynamic Theme Variables (--theme-*)

These adapt based on background luminance:

- `--theme-panel-bg` - Panel background
- `--theme-card-bg` - Card background
- `--theme-accent` - Accent color
- `--theme-stroke` - Border color
- `--theme-text` - Primary text
- `--theme-text-dim` - Secondary text
- `--theme-shadow` - Shadow
- `--theme-danger-bg` - Danger zone background

### Semantic Colors (--semantic-*)

Status colors that stay constant:

- `--semantic-error` - Red
- `--semantic-success` - Green
- `--semantic-warning` - Amber
- `--semantic-info` - Blue

### Static Tokens

From `tokens.css`:

- Typography scale (`--font-size-*`)
- Spacing scale (`--spacing-*`)
- Transitions (`--duration-*`, `--ease-*`)
- Border radius (`--radius-2026-*`)
- Shadows (`--shadow-*`)

## CSS Files

| File | Purpose |
|------|---------|
| `css/index.css` | Imports all CSS in correct order |
| `css/tokens.css` | Static design tokens (spacing, typography, timing) |
| `css/panel-utilities.css` | Panel, card, and overlay utility classes |
| `css/modal-tokens.css` | Modal sizing and animation tokens |
| `css/keyframes.css` | Animation keyframes with reduced-motion support |

## API Reference

### Configuration

- `setStorageKey(key: string)` - Set localStorage key for theme persistence
- `setThemeColorPalette(name: string, colors: string[])` - Register a color palette

### Theme Application

- `applyThemeFromColors(solidColor?: string, gradientColors?: string[])` - Apply theme from colors
- `applyThemeForBackground(name: string)` - Apply theme for registered background
- `ensureThemeApplied(options?)` - Apply theme from localStorage

### Theme State

- `getThemeMode()` - Get current mode ('light' or 'dark')
- `isLightMode()` - Check if light mode
- `isDarkMode()` - Check if dark mode
- `onThemeModeChange(listener)` - Subscribe to mode changes

### Theme Generation

- `generateGlassMorphismTheme(mode, accentColor?)` - Generate glass morphism tokens
- `generateMatteTheme(mode, accentColor?)` - Generate matte surface tokens
- `generateDangerTheme(mode)` - Generate danger zone tokens

### Utilities

- `calculateLuminance(hex)` - Calculate WCAG luminance for a color
- `calculateGradientLuminance(colors)` - Calculate weighted luminance for gradient
- `extractAccentColor(colors)` - Extract accent from color palette

## License

MIT
