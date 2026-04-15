/**
 * cursor-glow-effect.ts - Pointer-driven cursor glow effect
 *
 * Attaches pointer listeners to an element and sets CSS custom properties:
 *   --glow-x        (cursor X relative to element, in px)
 *   --glow-y        (cursor Y relative to element, in px)
 *   --glow-opacity  (0 when inactive, 1 when hovering)
 *   --glow-size     (glow radius in px)
 *
 * The consuming CSS renders the glow via a pseudo-element or overlay div
 * that reads these variables in a radial-gradient.
 *
 * Skips touch pointers. Respects prefers-reduced-motion.
 */

export interface CursorGlowEffectOptions {
  /** Glow radius in px (default 120) */
  size?: number;
}

export interface CursorGlowEffectHandle {
  destroy(): void;
}

export function attachCursorGlowEffect(
  element: HTMLElement,
  options: CursorGlowEffectOptions = {},
): CursorGlowEffectHandle {
  const { size = 120 } = options;

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = mql.matches;

  function onMotionChange(e: MediaQueryListEvent) {
    reducedMotion = e.matches;
    if (reducedMotion) {
      element.style.setProperty("--glow-opacity", "0");
    }
  }
  mql.addEventListener("change", onMotionChange);

  element.style.setProperty("--glow-size", `${size}px`);
  element.style.setProperty("--glow-opacity", "0");

  function onPointerEnter(e: PointerEvent) {
    if (e.pointerType === "touch" || reducedMotion) return;
    element.style.setProperty("--glow-opacity", "1");
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === "touch" || reducedMotion) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    element.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }

  function onPointerLeave() {
    element.style.setProperty("--glow-opacity", "0");
  }

  element.addEventListener("pointerenter", onPointerEnter);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerleave", onPointerLeave);

  return {
    destroy() {
      mql.removeEventListener("change", onMotionChange);
      element.removeEventListener("pointerenter", onPointerEnter);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}
