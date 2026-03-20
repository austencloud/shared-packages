/**
 * Media Spotlight Types
 *
 * Core type definitions for the media spotlight component.
 */

/**
 * A single media item to display in the spotlight.
 */
export interface MediaItem {
  /** Unique identifier for this item */
  id: string;

  /** URL to the media file */
  url: string;

  /** Media type */
  type: 'image' | 'video';

  /** Optional thumbnail URL for faster loading */
  thumbnailUrl?: string;

  /** Optional ~1200px preview URL for sharp hero animation (loads faster than full-res) */
  previewUrl?: string;

  /** Srcset for responsive images (e.g., "image-800.jpg 800w, image-1600.jpg 1600w") */
  srcset?: string;

  /** Sizes attribute for responsive images (e.g., "100vw") */
  sizes?: string;

  /** Alt text for accessibility */
  alt?: string;

  /** Original filename */
  name?: string;

  /** Original width in pixels (for aspect ratio morphing) */
  width?: number;

  /** Original height in pixels (for aspect ratio morphing) */
  height?: number;

  /** Whether this item needs editing/review */
  needsEditing?: boolean;

  /** Tag IDs applied to this item */
  tags?: string[];

  /** Crop settings for the media */
  crop?: CropSettings;

  /** Trim settings for video */
  snip?: SnipSettings;
}

/**
 * Tag definition for categorizing media.
 */
export interface MediaTag {
  id: string;
  name: string;
  color: TagColor;
}

/**
 * Available tag colors.
 */
export type TagColor =
  | 'flame'
  | 'gold'
  | 'royal'
  | 'cyan'
  | 'green'
  | 'red'
  | 'purple'
  | 'navy'
  | 'teal'
  | 'pink'
  | 'lime'
  | 'gray';

/**
 * Crop settings for an image or video.
 * Uses normalized offset (-1 to 1), scale factor, and aspect ratio.
 */
export interface CropSettings {
  position: { x: number; y: number };
  scale: number;
  aspect: number;
  aspectLabel: string;
}

/**
 * Convert CropSettings to CSS style strings for rendering.
 * Returns styles for both the crop container (aspect ratio, overflow)
 * and the media element (scale + translate).
 */
export function getCropStyles(crop: CropSettings | undefined): {
  mediaStyle: string;
  containerStyle: string;
} {
  if (!crop) {
    return { mediaStyle: '', containerStyle: '' };
  }

  const scale = crop.scale || 1;
  const maxOffset = ((scale - 1) / scale) * 50;
  const translateX = crop.position.x * maxOffset;
  const translateY = crop.position.y * maxOffset;

  const mediaStyle = `transform: scale(${scale}) translate(${translateX}%, ${translateY}%); transform-origin: center center;`;
  const containerStyle = crop.aspectLabel !== 'original' ? `aspect-ratio: ${crop.aspect};` : '';

  return { mediaStyle, containerStyle };
}

/**
 * Trim/snip settings for a video.
 */
export interface SnipSettings {
  startTime: number;
  endTime: number;
}

/**
 * Spotlight mode - determines which UI is shown.
 */
export type SpotlightMode = 'view' | 'curate' | 'crop' | 'snip';

/**
 * Navigation direction for animations.
 */
export type NavigationDirection = 'prev' | 'next' | null;

/**
 * Keyboard shortcut hint for display.
 */
export interface KeyboardHint {
  keys: string[];
  action: string;
}

/**
 * Gesture event types emitted by the gesture controller.
 */
export interface GestureState {
  /** Current horizontal swipe offset */
  swipeX: number;

  /** Current vertical swipe offset */
  swipeY: number;

  /** Current pinch scale factor */
  scale: number;

  /** Pan offset X when zoomed */
  panX: number;

  /** Pan offset Y when zoomed */
  panY: number;

  /** Whether a gesture is currently active */
  isGestureActive: boolean;

  /** Velocity of horizontal swipe (px/ms) */
  velocityX: number;

  /** Velocity of vertical swipe (px/ms) */
  velocityY: number;
}

/**
 * Callbacks for spotlight events.
 */
export interface SpotlightCallbacks {
  /** Called when spotlight is closed */
  onclose?: () => void;

  /** Called when navigating to a different item */
  onchange?: (index: number) => void;

  /** Called when an item is deleted */
  ondelete?: (item: MediaItem) => void;

  /** Called when a tag is toggled on an item */
  ontag?: (item: MediaItem, tagId: string) => void;

  /** Called when crop is applied */
  oncrop?: (item: MediaItem, crop: CropSettings) => void;

  /** Called when snip/trim is applied */
  onsnip?: (item: MediaItem, snip: SnipSettings) => void;

  /** Called when needsEditing flag is toggled */
  oneditflag?: (item: MediaItem, needsEditing: boolean) => void;
}

/**
 * Configuration options for the spotlight.
 */
export interface SpotlightConfig {
  /** Whether to show the filmstrip thumbnail bar */
  showFilmstrip?: boolean;

  /** Whether to show navigation arrows */
  showArrows?: boolean;

  /** Whether to show the close button */
  showClose?: boolean;

  /** Whether to enable swipe navigation */
  enableSwipeNav?: boolean;

  /** Whether to enable swipe-to-dismiss */
  enableSwipeDismiss?: boolean;

  /** Whether to enable pinch-to-zoom */
  enablePinchZoom?: boolean;

  /** Whether to enable double-tap zoom */
  enableDoubleTapZoom?: boolean;

  /** Whether to loop navigation at edges */
  loop?: boolean;

  /** Auto-hide chrome after this many milliseconds (0 = never hide) */
  chromeTimeout?: number;

  /** Whether to preload adjacent images */
  preloadAdjacent?: boolean;

  /** Enable hero animation when opening from a thumbnail */
  enableHeroAnimation?: boolean;

  /** Autoplay videos when they become the current item */
  autoplayVideo?: boolean;

  /** Padding around media to avoid overlapping UI elements (px or CSS value) */
  mediaPadding?: string | number;
}

/**
 * Origin rect for hero animation - the source thumbnail's position.
 */
export interface HeroOrigin {
  /** Bounding rect of the source thumbnail */
  rect: DOMRect | { top: number; left: number; width: number; height: number };
  /** URL of the thumbnail image to show during animation */
  thumbnailUrl?: string;
  /** URL of the ~1200px preview image for sharp animation (preferred over thumbnail) */
  previewUrl?: string;
}
