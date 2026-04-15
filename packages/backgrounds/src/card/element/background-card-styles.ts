/**
 * background-card-styles.ts - Shadow DOM CSS for <background-card>
 *
 * Ported from the working Ringmaster BackgroundCard.svelte CSS.
 * Uses :host for the outer element, ::slotted for light DOM icon content,
 * and ::part attributes for consumer-side style overrides.
 */

export const BACKGROUND_CARD_STYLES = /* css */ `
  :host {
    display: block;
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    min-height: 80px;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    contain: layout style;

    transform:
      perspective(var(--rot-perspective, 800px))
      rotateX(var(--rot-x, 0deg))
      rotateY(var(--rot-y, 0deg))
      scale(var(--card-scale, 1));
    transform-style: preserve-3d;
    will-change: transform;

    border: 1.5px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

    transition:
      border-color 0.25s ease,
      box-shadow 0.25s ease,
      opacity 0.3s ease;

    /* Dimmed by default (not selected) */
    opacity: 0.55;
  }

  :host(:hover),
  :host(:focus-visible) {
    opacity: 0.85;
  }

  :host([selected]) {
    opacity: 1;
    border-color: var(--card-accent, #818cf8);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 0 0 2px color-mix(in srgb, var(--card-accent, #818cf8) 30%, transparent),
      0 4px 20px color-mix(in srgb, var(--card-accent, #818cf8) 25%, transparent);
  }

  :host(:focus-visible) {
    outline: 2px solid var(--card-accent, #818cf8);
    outline-offset: 3px;
  }

  :host(:active) {
    transition-duration: 0.1s;
  }

  :host([disabled]) {
    opacity: 0.3;
    pointer-events: none;
    cursor: default;
  }

  /* ── Gradient fill ────────────────────────────────── */

  .card-fill {
    position: absolute;
    inset: 0;
    background: var(--card-gradient);
    z-index: 0;
  }

  /* ── Cursor glow layer ────────────────────────────── */

  .glow-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: var(--glow-opacity, 0);
    background: radial-gradient(
      circle var(--glow-size, 120px) at var(--glow-x, 50%) var(--glow-y, 50%),
      rgba(255, 255, 255, 0.25) 0%,
      transparent 100%
    );
    transition: opacity 0.3s ease;
  }

  /* ── Icon area ────────────────────────────────────── */

  .card-icon {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    font-size: 1.25rem;
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
    transform: translate(
      calc(var(--tilt-x, 0) * 3px),
      calc(var(--tilt-y, 0) * 3px)
    );
    pointer-events: none;
    line-height: 1;
  }

  /* Fallback SVG icon sizing */
  .fallback-icon svg {
    width: 1.25em;
    height: 1.25em;
    display: block;
  }

  /* Slotted light DOM icon inherits consumer styles */
  ::slotted(*) {
    font-size: inherit;
    color: inherit;
    line-height: inherit;
  }

  /* ── Label ────────────────────────────────────────── */

  .card-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    padding: 8px 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
    pointer-events: none;
    transform: translate(
      calc(var(--tilt-x, 0) * -2px),
      calc(var(--tilt-y, 0) * -2px)
    );
  }

  .card-name {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
    color: white;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
  }

  /* ── Selection ring ───────────────────────────────── */

  .selection-ring {
    position: absolute;
    inset: -1px;
    z-index: 3;
    border-radius: inherit;
    border: 2px solid var(--card-accent, #818cf8);
    pointer-events: none;
    animation: ring-pulse 2s ease-in-out infinite;
    display: none;
  }

  :host([selected]) .selection-ring {
    display: block;
  }

  @keyframes ring-pulse {
    0%, 100% {
      box-shadow: 0 0 6px color-mix(in srgb, var(--card-accent, #818cf8) 40%, transparent);
    }
    50% {
      box-shadow: 0 0 14px color-mix(in srgb, var(--card-accent, #818cf8) 60%, transparent);
    }
  }

  /* ── Accessibility: reduced motion ────────────────── */

  @media (prefers-reduced-motion: reduce) {
    :host {
      transform: none;
      transition:
        opacity 0.15s ease,
        border-color 0.15s ease;
    }

    .card-icon,
    .card-label {
      transform: none;
    }

    .selection-ring {
      animation: none;
      box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent, #818cf8) 50%, transparent);
    }

    .glow-layer {
      display: none;
    }
  }

  /* ── Accessibility: high contrast ─────────────────── */

  @media (prefers-contrast: high) {
    :host {
      border: 2px solid rgba(255, 255, 255, 0.4);
    }

    :host([selected]) {
      border: 3px solid var(--card-accent, #818cf8);
    }
  }

  @media (prefers-contrast: high) and (prefers-color-scheme: light) {
    :host {
      border: 2px solid rgba(0, 0, 0, 0.4);
    }
  }
`;
