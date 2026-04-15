/**
 * spring.ts - rAF-based damped harmonic oscillator
 *
 * Drop-in replacement for svelte/motion Spring in framework-agnostic code.
 * Same physics: stiffness controls return force, damping controls friction.
 * Snaps to target when velocity is negligible.
 */

export interface SpringOptions {
  /** Spring stiffness (default 300). Higher = snappier. */
  stiffness?: number;
  /** Damping coefficient (default 15). Higher = less bounce. */
  damping?: number;
}

export interface Spring {
  /** Current interpolated value. */
  readonly current: number;
  /** Set to animate toward a new value. */
  target: number;
  /** Register a callback fired every animation frame. */
  onUpdate(fn: (value: number) => void): void;
  /** Stop animation and remove listeners. */
  destroy(): void;
}

const VELOCITY_THRESHOLD = 0.001;
const DISPLACEMENT_THRESHOLD = 0.001;

export function createSpring(initial: number, opts: SpringOptions = {}): Spring {
  const stiffness = opts.stiffness ?? 300;
  const damping = opts.damping ?? 15;

  let current = initial;
  let _target = initial;
  let velocity = 0;
  let rafId = 0;
  let lastTime = 0;
  const listeners: Array<(value: number) => void> = [];

  function notify() {
    for (const fn of listeners) fn(current);
  }

  function tick(now: number) {
    if (lastTime === 0) lastTime = now;
    // Cap dt to avoid large jumps on tab-switch
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;

    const displacement = current - _target;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = springForce + dampingForce;

    velocity += acceleration * dt;
    current += velocity * dt;

    notify();

    if (
      Math.abs(velocity) < VELOCITY_THRESHOLD &&
      Math.abs(current - _target) < DISPLACEMENT_THRESHOLD
    ) {
      // Snap to target and stop
      current = _target;
      velocity = 0;
      notify();
      rafId = 0;
      lastTime = 0;
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function ensureRunning() {
    if (rafId === 0) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  return {
    get current() {
      return current;
    },
    get target() {
      return _target;
    },
    set target(v: number) {
      _target = v;
      ensureRunning();
    },
    onUpdate(fn: (value: number) => void) {
      listeners.push(fn);
    },
    destroy() {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      listeners.length = 0;
    },
  };
}
