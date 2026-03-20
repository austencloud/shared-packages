/**
 * tilt-effect.ts - Pointer-driven 3D tilt effect
 *
 * Attaches pointer listeners to an element and sets CSS custom properties:
 *   --rot-x, --rot-y   (rotation in deg)
 *   --tilt-x, --tilt-y  (normalized -1..1 for parallax offsets)
 *   --rot-perspective   (perspective value in px)
 *
 * Does NOT set style.transform — the consuming CSS composes the transform
 * from these variables so tilt never conflicts with scale or other transforms.
 *
 * Skips touch pointers. Respects prefers-reduced-motion.
 */

export interface TiltEffectOptions {
  /** Maximum tilt angle in degrees (default 4) */
  maxDegrees?: number;
  /** CSS perspective value in px (default 800) */
  perspective?: number;
}

export interface TiltEffectHandle {
  destroy(): void;
}

const LERP_SPEED = 0.12;

export function attachTiltEffect(
  element: HTMLElement,
  options: TiltEffectOptions = {},
): TiltEffectHandle {
  const { maxDegrees = 4, perspective = 800 } = options;

  let rafId = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let active = false;

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = mql.matches;

  function onMotionChange(e: MediaQueryListEvent) {
    reducedMotion = e.matches;
    if (reducedMotion) reset();
  }
  mql.addEventListener("change", onMotionChange);

  element.style.setProperty("--rot-perspective", `${perspective}px`);

  function onPointerEnter(e: PointerEvent) {
    if (e.pointerType === "touch" || reducedMotion) return;
    active = true;
    tick();
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || e.pointerType === "touch") return;
    const rect = element.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  }

  function onPointerLeave() {
    active = false;
    targetX = 0;
    targetY = 0;
  }

  function tick() {
    if (!active && Math.abs(currentX) < 0.001 && Math.abs(currentY) < 0.001) {
      currentX = 0;
      currentY = 0;
      applyVars(0, 0, 0, 0);
      return;
    }

    currentX += (targetX - currentX) * LERP_SPEED;
    currentY += (targetY - currentY) * LERP_SPEED;

    const rotY = currentX * maxDegrees;
    const rotX = -currentY * maxDegrees;

    applyVars(rotX, rotY, currentX, currentY);
    rafId = requestAnimationFrame(tick);
  }

  function applyVars(rotX: number, rotY: number, tiltX: number, tiltY: number) {
    element.style.setProperty("--rot-x", `${rotX.toFixed(2)}deg`);
    element.style.setProperty("--rot-y", `${rotY.toFixed(2)}deg`);
    element.style.setProperty("--tilt-x", tiltX.toFixed(4));
    element.style.setProperty("--tilt-y", tiltY.toFixed(4));
  }

  function reset() {
    cancelAnimationFrame(rafId);
    active = false;
    currentX = currentY = targetX = targetY = 0;
    applyVars(0, 0, 0, 0);
  }

  element.addEventListener("pointerenter", onPointerEnter);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerleave", onPointerLeave);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      mql.removeEventListener("change", onMotionChange);
      element.removeEventListener("pointerenter", onPointerEnter);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}
