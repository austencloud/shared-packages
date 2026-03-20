# @austencloud/media-spotlight

A premium full-screen media viewer for Svelte 5 applications.

## Features

- **Gesture-First**: Swipe left/right to navigate, swipe down to dismiss, pinch to zoom, double-tap to zoom at tap point
- **Auto-Hiding Chrome**: UI appears on interaction, fades after timeout
- **Thumbnail Filmstrip**: Quick navigation strip with auto-scroll
- **Tag Management**: Number key shortcuts (1-9) for quick tagging
- **Keyboard Support**: Full navigation without mouse
- **Accessibility**: WCAG AAA compliant, 48px touch targets, reduced motion support
- **Native Dialog**: Uses `<dialog>` with CSS-only animations via `@starting-style`
- **Composition-Based**: Slots for custom actions, tags, and hints

## Installation

```bash
# Using pnpm (recommended)
pnpm add @austencloud/media-spotlight

# Using npm
npm install @austencloud/media-spotlight

# Or via git dependency
# package.json:
"dependencies": {
  "@austencloud/media-spotlight": "github:austencloud/shared-packages#media-spotlight-v1.0.0"
}
```

## Quick Start

```svelte
<script lang="ts">
  import { MediaSpotlight, SpotlightTagBar, SpotlightDeleteButton } from '@austencloud/media-spotlight';
  import '@austencloud/media-spotlight/css/spotlight-tokens.css';
  import type { MediaItem, MediaTag } from '@austencloud/media-spotlight';

  let items = $state<MediaItem[]>([
    { id: '1', url: '/images/photo1.jpg', type: 'image', alt: 'Photo 1' },
    { id: '2', url: '/images/photo2.jpg', type: 'image', alt: 'Photo 2' },
    { id: '3', url: '/videos/clip.mp4', type: 'video', alt: 'Video clip' },
  ]);

  const tags: MediaTag[] = [
    { id: 'favorite', name: 'Favorite', color: 'gold' },
    { id: 'approved', name: 'Approved', color: 'green' },
    { id: 'review', name: 'Review', color: 'flame' },
  ];

  let currentIndex = $state(0);
  let open = $state(false);

  function handleTagToggle(tagId: string) {
    const item = items[currentIndex];
    if (!item) return;

    if (item.tags?.includes(tagId)) {
      item.tags = item.tags.filter(t => t !== tagId);
    } else {
      item.tags = [...(item.tags ?? []), tagId];
    }
  }

  function handleDelete() {
    items = items.filter((_, i) => i !== currentIndex);
    if (currentIndex >= items.length) currentIndex = Math.max(0, items.length - 1);
    if (items.length === 0) open = false;
  }
</script>

<button onclick={() => open = true}>View Gallery</button>

<MediaSpotlight
  {items}
  bind:currentIndex
  bind:open
  config={{ showFilmstrip: true, chromeTimeout: 3000 }}
  callbacks={{
    onclose: () => console.log('Closed'),
    onchange: (i) => console.log('Now viewing:', i),
  }}
>
  {#snippet default()}
    <SpotlightTagBar
      {tags}
      activeTags={items[currentIndex]?.tags ?? []}
      ontoggle={handleTagToggle}
      keyboardActive={open}
    />
  {/snippet}

  {#snippet actions()}
    <SpotlightDeleteButton ondelete={handleDelete} />
  {/snippet}
</MediaSpotlight>
```

## Components

### MediaSpotlight

The main orchestrator component.

```svelte
<MediaSpotlight
  {items}
  bind:currentIndex
  bind:open
  config={...}
  callbacks={...}
>
  <!-- Optional slots -->
</MediaSpotlight>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `MediaItem[]` | required | Media items to display |
| `currentIndex` | `number` | `0` | Currently active index (bindable) |
| `open` | `boolean` | `false` | Whether viewer is open (bindable) |
| `config` | `SpotlightConfig` | `{}` | Configuration options |
| `callbacks` | `SpotlightCallbacks` | `{}` | Event callbacks |

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showFilmstrip` | `boolean` | `true` | Show thumbnail strip |
| `showArrows` | `boolean` | `true` | Show navigation arrows |
| `showClose` | `boolean` | `true` | Show close button |
| `enableSwipeNav` | `boolean` | `true` | Enable swipe navigation |
| `enableSwipeDismiss` | `boolean` | `true` | Enable swipe-to-dismiss |
| `enablePinchZoom` | `boolean` | `true` | Enable pinch-to-zoom |
| `enableDoubleTapZoom` | `boolean` | `true` | Enable double-tap zoom |
| `loop` | `boolean` | `false` | Loop at edges |
| `chromeTimeout` | `number` | `3000` | Auto-hide delay (ms), 0 = never |
| `preloadAdjacent` | `boolean` | `true` | Preload prev/next images |

**Callbacks:**

| Callback | Parameters | Description |
|----------|------------|-------------|
| `onclose` | - | Viewer closed |
| `onchange` | `index: number` | Navigation occurred |
| `ondelete` | `item: MediaItem` | Item deleted |
| `ontag` | `item: MediaItem, tagId: string` | Tag toggled |
| `oncrop` | `item: MediaItem, crop: CropSettings` | Crop applied |
| `onsnip` | `item: MediaItem, snip: SnipSettings` | Video trim applied |
| `oneditflag` | `item: MediaItem, needsEditing: boolean` | Edit flag toggled |

**Slots:**

| Slot | Purpose |
|------|---------|
| `default` | Bottom content (tag bar, etc.) |
| `actions` | Top-right action buttons |
| `hints` | Keyboard hints bar |

### SpotlightTagBar

Tag management with number key shortcuts.

```svelte
<SpotlightTagBar
  {tags}
  activeTags={['tag1', 'tag2']}
  ontoggle={(tagId) => ...}
  keyboardActive={open}
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tags` | `MediaTag[]` | required | Available tags |
| `activeTags` | `string[]` | `[]` | Currently active tag IDs |
| `ontoggle` | `(tagId: string) => void` | - | Called when tag toggled |
| `keyboardActive` | `boolean` | `true` | Whether 1-9 shortcuts are active |

### SpotlightDeleteButton

Pre-built delete button with confirmation dialog.

```svelte
<SpotlightDeleteButton
  ondelete={() => ...}
  confirmText="Delete this item?"
  requireConfirmation={true}
/>
```

### SpotlightKeyboardHints

Floating keyboard shortcuts display.

```svelte
<SpotlightKeyboardHints
  hints={[
    { keys: ['←', '→'], action: 'Navigate' },
    { keys: ['Esc'], action: 'Close' },
    { keys: ['1-9'], action: 'Toggle tag' },
  ]}
/>
```

## Types

### MediaItem

```typescript
interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  srcset?: string;      // Responsive images: "img-800.jpg 800w, img-1600.jpg 1600w"
  sizes?: string;       // Sizes attribute: "100vw" (default)
  alt?: string;
  name?: string;
  needsEditing?: boolean;
  tags?: string[];
  crop?: CropSettings;
  snip?: SnipSettings;
}
```

### MediaTag

```typescript
interface MediaTag {
  id: string;
  name: string;
  color: TagColor;
}

type TagColor =
  | 'flame' | 'gold' | 'royal' | 'cyan' | 'green'
  | 'red' | 'purple' | 'navy' | 'teal' | 'pink'
  | 'lime' | 'gray';
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next |
| `Escape` | Close viewer |
| `1-9` | Toggle tag by position |

## CSS Customization

Import the CSS tokens and override any variable:

```css
@import '@austencloud/media-spotlight/css/spotlight-tokens.css';

:root {
  /* Animation timing */
  --spotlight-duration-in: 350ms;
  --spotlight-duration-out: 250ms;
  --spotlight-duration-nav: 300ms;

  /* Gesture thresholds */
  --spotlight-swipe-threshold: 80px;
  --spotlight-dismiss-threshold: 150px;

  /* Chrome styling */
  --spotlight-backdrop: rgba(0, 0, 0, 0.95);
  --spotlight-chrome-timeout: 3000ms;

  /* Arrows */
  --spotlight-arrow-size: 64px;
  --spotlight-arrow-bg: rgba(0, 0, 0, 0.4);

  /* Tags */
  --spotlight-tag-flame: #f97316;
  --spotlight-tag-gold: #eab308;
  /* ... see spotlight-tokens.css for all variables */
}
```

## Accessibility

- Full keyboard navigation
- Focus trapping within dialog
- ARIA labels on all interactive elements
- `prefers-reduced-motion` support (disables animations)
- 48px minimum touch targets (WCAG AAA)
- Proper dialog semantics with `<dialog>`

## Browser Support

- Chrome 111+
- Firefox 113+
- Safari 17.2+
- Edge 111+

Requires support for `@starting-style` for CSS-only dialog animations.

## License

MIT
