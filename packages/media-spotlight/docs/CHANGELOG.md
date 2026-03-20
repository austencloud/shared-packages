# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-30

### Added

- Initial release
- `MediaSpotlight` - Main orchestrator with native `<dialog>` and `@starting-style` animations
- `SpotlightImage` - Image display with zoom and pan support
- `SpotlightVideo` - Video player with custom controls
- `SpotlightChrome` - Auto-hiding UI overlay with navigation arrows
- `SpotlightFilmstrip` - Thumbnail navigation strip
- `SpotlightTagBar` - Tag management with number key shortcuts (1-9)
- `SpotlightActions` - Container for custom action buttons
- `SpotlightDeleteButton` - Pre-built delete button with confirmation
- `SpotlightKeyboardHints` - Keyboard shortcuts display
- `GestureController` - Touch/pointer gesture handling
  - Horizontal swipe navigation
  - Vertical swipe-to-dismiss
  - Pinch-to-zoom
  - Double-tap zoom to tap point (not just center)
  - Pan when zoomed
- Responsive image support via `srcset` and `sizes` attributes
- CSS custom properties for full customization
- WCAG AAA accessibility compliance
- `prefers-reduced-motion` support
