import type { Dimensions } from "../../../core/domain/types.js";
import { PerlinNoise } from "../../forest/services/noise/PerlinNoise.js";

export interface WinterWindVector {
  x: number;
  y: number;
}

export interface WinterWindStats {
  gustActive: boolean;
  gustProgress: number;
  pointerSpeed: number;
}

interface WinterWindFieldOptions {
  seed?: number;
  random?: () => number;
}

interface GustState {
  active: boolean;
  elapsed: number;
  duration: number;
  direction: -1 | 1;
}

interface PointerState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  active: boolean;
}

interface PointerWake {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  influence: number;
  spin: -1 | 1;
}

const MIN_GUST_DELAY_FRAMES = 240;
const MAX_GUST_DELAY_FRAMES = 720;
const MIN_GUST_DURATION_FRAMES = 180;
const MAX_GUST_DURATION_FRAMES = 300;
const MAX_POINTER_DELTA = 48;
const MAX_POINTER_WAKES = 12;
const POINTER_WAKE_SPACING = 32;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampVector(
  x: number,
  y: number,
  maxLength: number,
): WinterWindVector {
  const length = Math.hypot(x, y);
  if (length <= maxLength || length === 0) return { x, y };

  const scale = maxLength / length;
  return { x: x * scale, y: y * scale };
}

/**
 * Produces one continuous velocity field for the winter snow.
 *
 * Neighboring flakes sample neighboring parts of the same field, so a gust
 * reads as weather crossing the screen instead of hundreds of unrelated
 * particles changing direction at once.
 */
export class WinterWindField {
  private readonly noise: PerlinNoise;
  private readonly random: () => number;

  private time = 0;
  private framesUntilGust = 0;
  private reducedMotion = false;
  private gust: GustState = {
    active: false,
    elapsed: 0,
    duration: MIN_GUST_DURATION_FRAMES,
    direction: 1,
  };
  private pointer: PointerState = {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    active: false,
  };
  private pointerWakes: PointerWake[] = [];
  private nextPointerWakeSpin: -1 | 1 = 1;

  constructor(options: WinterWindFieldOptions = {}) {
    this.random = options.random ?? Math.random;
    this.noise = new PerlinNoise(options.seed);
    this.initialize();
  }

  initialize(): void {
    this.time = this.random() * 1000;
    this.framesUntilGust = this.randomRange(
      MIN_GUST_DELAY_FRAMES * 0.5,
      MAX_GUST_DELAY_FRAMES * 0.65,
    );
    this.gust = {
      active: false,
      elapsed: 0,
      duration: MIN_GUST_DURATION_FRAMES,
      direction: 1,
    };
    this.pointer = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      active: false,
    };
    this.pointerWakes = [];
    this.nextPointerWakeSpin = 1;
  }

  update(frameMultiplier: number = 1): void {
    const step = clamp(frameMultiplier, 0, 4);
    this.time += step;

    const pointerDecay = Math.pow(0.84, step);
    this.pointer.velocityX *= pointerDecay;
    this.pointer.velocityY *= pointerDecay;
    const wakeDecay = Math.pow(0.94, step);
    const wakeVelocityDecay = Math.pow(0.985, step);
    const wakeInfluenceRise = 1 - Math.pow(0.84, step);
    this.pointerWakes = this.pointerWakes
      .map((wake) => ({
        ...wake,
        x: wake.x + wake.velocityX * 0.035 * step,
        y: wake.y + wake.velocityY * 0.035 * step,
        velocityX: wake.velocityX * wakeVelocityDecay,
        velocityY: wake.velocityY * wakeVelocityDecay,
        life: wake.life * wakeDecay,
        influence: wake.influence + (1 - wake.influence) * wakeInfluenceRise,
      }))
      .filter((wake) => wake.life > 0.02);

    if (this.reducedMotion) return;

    if (this.gust.active) {
      this.gust.elapsed += step;
      if (this.gust.elapsed >= this.gust.duration) {
        this.gust.active = false;
        this.gust.elapsed = this.gust.duration;
        this.framesUntilGust = this.randomRange(
          MIN_GUST_DELAY_FRAMES,
          MAX_GUST_DELAY_FRAMES,
        );
      }
      return;
    }

    this.framesUntilGust -= step;
    if (this.framesUntilGust <= 0) this.triggerGust();
  }

  sample(
    x: number,
    y: number,
    depth: number,
    dimensions: Dimensions,
  ): WinterWindVector {
    const safeDepth = clamp(depth, 0, 1);
    const depthScale = 0.28 + safeDepth * 0.72;
    const ambientScale = this.reducedMotion ? 0.025 : 0.13;

    const noiseX = x * 0.0022 + this.time * 0.0007;
    const noiseY = y * 0.0022 - this.time * 0.00045;
    const epsilon = 0.025;

    // Rotating the gradient of one scalar noise field gives curl motion. It
    // creates eddies without pulling the snow into visible clumps or sinks.
    const curlX =
      (this.noise.noise2D(noiseX, noiseY + epsilon) -
        this.noise.noise2D(noiseX, noiseY - epsilon)) /
      (epsilon * 2);
    const curlY =
      -(
        this.noise.noise2D(noiseX + epsilon, noiseY) -
        this.noise.noise2D(noiseX - epsilon, noiseY)
      ) /
      (epsilon * 2);

    let forceX =
      (curlX * ambientScale +
        Math.sin(y * 0.006 + this.time * 0.006) * ambientScale * 0.65) *
      depthScale;
    let forceY = curlY * ambientScale * 0.32 * depthScale;

    if (this.gust.active && !this.reducedMotion) {
      const progress = clamp(this.gust.elapsed / this.gust.duration, 0, 1);
      const pulse = Math.sin(progress * Math.PI) ** 2;
      const travel = this.gust.direction === 1 ? progress : 1 - progress;
      const frontX = dimensions.width * (-0.18 + travel * 1.36);
      const bandWidth = clamp(dimensions.width * 0.24, 180, 680);
      const normalizedDistance = (x - frontX) / bandWidth;
      const front = Math.exp(-normalizedDistance * normalizedDistance * 2.2);
      const texture = 0.9 + Math.sin(y * 0.015 + this.time * 0.045) * 0.1;
      const gustStrength =
        this.gust.direction *
        pulse *
        front *
        texture *
        (0.75 + safeDepth * 1.15);

      forceX += gustStrength;
      forceY -= Math.abs(gustStrength) * (0.1 + safeDepth * 0.08);
    }

    const pointerForce = this.samplePointerWake(x, y, depthScale, dimensions);
    forceX += pointerForce.x;
    forceY += pointerForce.y;

    // The cap keeps a fast pointer swipe or overlapping gust from turning the
    // snow into horizontal rain after a stalled frame.
    return clampVector(forceX, forceY, 2.4);
  }

  setPointer(x: number, y: number, active: boolean): void {
    if (this.reducedMotion) return;

    if (!active) {
      this.pointer.active = false;
      return;
    }

    if (!this.pointer.active) {
      this.pointer = {
        x,
        y,
        velocityX: 0,
        velocityY: 0,
        active: true,
      };
      return;
    }

    const delta = clampVector(
      x - this.pointer.x,
      y - this.pointer.y,
      MAX_POINTER_DELTA,
    );
    const velocityX = this.pointer.velocityX * 0.45 + delta.x * 0.55;
    const velocityY = this.pointer.velocityY * 0.45 + delta.y * 0.55;
    const speed = Math.hypot(velocityX, velocityY);

    const wakeX = (this.pointer.x + x) * 0.5;
    const wakeY = (this.pointer.y + y) * 0.5;
    const previousWake = this.pointerWakes.at(-1);
    const farEnoughFromPrevious =
      !previousWake ||
      Math.hypot(wakeX - previousWake.x, wakeY - previousWake.y) >=
        POINTER_WAKE_SPACING;

    if (speed >= 0.35 && farEnoughFromPrevious) {
      this.pointerWakes.push({
        x: wakeX,
        y: wakeY,
        velocityX,
        velocityY,
        life: 1,
        influence: 0.37,
        spin: this.nextPointerWakeSpin,
      });
      this.nextPointerWakeSpin = this.nextPointerWakeSpin === 1 ? -1 : 1;
      if (this.pointerWakes.length > MAX_POINTER_WAKES) {
        this.pointerWakes.splice(
          0,
          this.pointerWakes.length - MAX_POINTER_WAKES,
        );
      }
    }

    this.pointer.velocityX = velocityX;
    this.pointer.velocityY = velocityY;
    this.pointer.x = x;
    this.pointer.y = y;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (!reducedMotion) return;

    this.gust.active = false;
    this.pointer.active = false;
    this.pointer.velocityX = 0;
    this.pointer.velocityY = 0;
    this.pointerWakes = [];
  }

  triggerGust(direction?: -1 | 1): void {
    if (this.reducedMotion) return;

    this.gust = {
      active: true,
      elapsed: 0,
      duration: this.randomRange(
        MIN_GUST_DURATION_FRAMES,
        MAX_GUST_DURATION_FRAMES,
      ),
      direction: direction ?? (this.random() < 0.5 ? -1 : 1),
    };
  }

  getStats(): WinterWindStats {
    return {
      gustActive: this.gust.active,
      gustProgress: this.gust.active
        ? clamp(this.gust.elapsed / this.gust.duration, 0, 1)
        : 0,
      pointerSpeed: Math.hypot(this.pointer.velocityX, this.pointer.velocityY),
    };
  }

  private samplePointerWake(
    x: number,
    y: number,
    depthScale: number,
    dimensions: Dimensions,
  ): WinterWindVector {
    if (this.reducedMotion || this.pointerWakes.length === 0) {
      return { x: 0, y: 0 };
    }

    const radius = clamp(
      Math.min(dimensions.width, dimensions.height) * 0.2,
      100,
      220,
    );
    const coreRadius = radius * 0.12;
    let forceX = 0;
    let forceY = 0;

    for (const wake of this.pointerWakes) {
      const offsetX = x - wake.x;
      const offsetY = y - wake.y;
      const distance = Math.hypot(offsetX, offsetY);
      if (distance >= radius) continue;

      const speed = Math.hypot(wake.velocityX, wake.velocityY);
      if (speed < 0.05) continue;

      const directionX = wake.velocityX / speed;
      const directionY = wake.velocityY / speed;
      const radialScale = clamp(distance / coreRadius, 0, 1);
      const normalX = distance > 0.001 ? (offsetX / distance) * radialScale : 0;
      const normalY = distance > 0.001 ? (offsetY / distance) * radialScale : 0;
      const tangentX = -normalY * wake.spin;
      const tangentY = normalX * wake.spin;
      const falloff = (1 - distance / radius) ** 2;
      const speedScale = clamp(speed / 10, 0.18, 1);
      const strength =
        falloff *
        speedScale *
        wake.life *
        wake.influence *
        (0.55 + depthScale * 0.95);

      // A new pocket gathers strength over a few frames, and its center stays
      // soft. Without both transitions, a flake under the pointer can visibly
      // snap as the next curl appears or the pointer crosses its center.
      forceX +=
        directionX * strength * 0.48 +
        normalX * strength * 0.62 +
        tangentX * strength * 1.1;
      forceY +=
        directionY * strength * 0.48 +
        normalY * strength * 0.62 +
        tangentY * strength * 1.1;
    }

    return clampVector(forceX, forceY, 2.1);
  }

  private randomRange(min: number, max: number): number {
    return min + this.random() * (max - min);
  }
}
