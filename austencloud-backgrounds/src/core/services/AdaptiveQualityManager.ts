/**
 * AdaptiveQualityManager - FPS-based automatic quality adjustment
 *
 * Monitors frame rate via a rolling window average and steps quality up or down
 * based on sustained performance. Integrated into the BackgroundController's
 * animation loop so consumers get adaptive quality for free.
 *
 * Design decisions:
 * - Rolling window of ~60 frames for stable FPS estimation
 * - Downgrades after sustained low FPS (default: <30 for 3s)
 * - Upgrades after sustained high FPS (default: >55 for 10s)
 * - Steps one level at a time to avoid oscillation
 * - 5-second cooldown between adjustments
 * - Respects a quality ceiling set by device detection
 */

import type { QualityLevel } from "../domain/types.js";

/** Ordered quality levels from lowest to highest fidelity. */
const QUALITY_LADDER: readonly QualityLevel[] = [
  "ultra-minimal",
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export interface AdaptiveQualityOptions {
  /** FPS threshold below which quality downgrades. Default: 30. */
  downgradeThresholdFps?: number;

  /** FPS threshold above which quality upgrades. Default: 55. */
  upgradeThresholdFps?: number;

  /** How long FPS must stay below downgrade threshold before acting. Default: 3000ms. */
  downgradeSustainMs?: number;

  /** How long FPS must stay above upgrade threshold before acting. Default: 10000ms. */
  upgradeSustainMs?: number;

  /** Minimum time between quality adjustments. Default: 5000ms. */
  cooldownMs?: number;

  /** Whether adaptive quality is active. Default: true. */
  enabled?: boolean;
}

type QualityChangeCallback = (
  newQuality: QualityLevel,
  oldQuality: QualityLevel
) => void;

/**
 * Tracks FPS and auto-adjusts quality level.
 *
 * Call `tick(timestamp)` every animation frame. The manager handles the rest.
 */
export class AdaptiveQualityManager {
  private currentQuality: QualityLevel;
  private qualityCeiling: QualityLevel;
  private enabled: boolean;

  // FPS tracking - rolling window
  private readonly frameTimes: number[] = [];
  private readonly maxFrameSamples = 60;
  private lastTimestamp = 0;

  // Sustained threshold tracking
  private lowFpsSince: number | null = null;
  private highFpsSince: number | null = null;
  private lastAdjustmentTime = 0;

  // Thresholds
  private readonly downgradeThresholdFps: number;
  private readonly upgradeThresholdFps: number;
  private readonly downgradeSustainMs: number;
  private readonly upgradeSustainMs: number;
  private readonly cooldownMs: number;

  // Callbacks
  private readonly callbacks: QualityChangeCallback[] = [];

  constructor(initialQuality: QualityLevel, options?: AdaptiveQualityOptions) {
    this.currentQuality = initialQuality;
    this.qualityCeiling = "high";
    this.enabled = options?.enabled ?? true;

    this.downgradeThresholdFps = options?.downgradeThresholdFps ?? 30;
    this.upgradeThresholdFps = options?.upgradeThresholdFps ?? 55;
    this.downgradeSustainMs = options?.downgradeSustainMs ?? 3000;
    this.upgradeSustainMs = options?.upgradeSustainMs ?? 10000;
    this.cooldownMs = options?.cooldownMs ?? 5000;
  }

  /**
   * Called every animation frame with the rAF timestamp.
   * Computes rolling FPS and triggers quality changes when thresholds are sustained.
   */
  tick(timestamp: number): void {
    if (!this.enabled) return;

    // First frame - just record timestamp
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return;
    }

    // Compute frame delta and add to rolling window
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Skip obviously bad deltas (tab was hidden, etc.)
    if (delta <= 0 || delta > 500) return;

    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // Need at least 10 frames for a meaningful average
    if (this.frameTimes.length < 10) return;

    const avgDelta =
      this.frameTimes.reduce((sum, d) => sum + d, 0) / this.frameTimes.length;
    const fps = 1000 / avgDelta;

    this.evaluateQuality(fps, timestamp);
  }

  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  setQualityCeiling(level: QualityLevel): void {
    this.qualityCeiling = level;

    // If current quality exceeds the new ceiling, downgrade immediately
    const currentIndex = QUALITY_LADDER.indexOf(this.currentQuality);
    const ceilingIndex = QUALITY_LADDER.indexOf(this.qualityCeiling);
    if (currentIndex > ceilingIndex) {
      this.applyQualityChange(this.qualityCeiling);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.lowFpsSince = null;
      this.highFpsSince = null;
    }
  }

  onQualityChange(callback: QualityChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Reset tracking state. Optionally set a new quality level.
   * Call this after background switches to avoid stale FPS data
   * from the old background triggering adjustments.
   */
  reset(quality?: QualityLevel): void {
    this.frameTimes.length = 0;
    this.lastTimestamp = 0;
    this.lowFpsSince = null;
    this.highFpsSince = null;
    this.lastAdjustmentTime = 0;

    if (quality !== undefined) {
      this.currentQuality = quality;
    }
  }

  dispose(): void {
    this.callbacks.length = 0;
    this.frameTimes.length = 0;
    this.enabled = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  private evaluateQuality(fps: number, now: number): void {
    // Respect cooldown
    if (now - this.lastAdjustmentTime < this.cooldownMs) {
      return;
    }

    const currentIndex = QUALITY_LADDER.indexOf(this.currentQuality);

    // Check for downgrade (low FPS)
    if (fps < this.downgradeThresholdFps) {
      // Reset upgrade tracking
      this.highFpsSince = null;

      if (this.lowFpsSince === null) {
        this.lowFpsSince = now;
      } else if (now - this.lowFpsSince >= this.downgradeSustainMs) {
        // Sustained low FPS - step down one level
        if (currentIndex > 0) {
          const newQuality = QUALITY_LADDER[currentIndex - 1]!;
          this.applyQualityChange(newQuality);
          this.lastAdjustmentTime = now;
          this.lowFpsSince = null;
        }
      }
      return;
    }

    // FPS is above downgrade threshold - reset downgrade tracking
    this.lowFpsSince = null;

    // Check for upgrade (high FPS)
    if (fps > this.upgradeThresholdFps) {
      const ceilingIndex = QUALITY_LADDER.indexOf(this.qualityCeiling);
      const canUpgrade = currentIndex < ceilingIndex;

      if (canUpgrade) {
        if (this.highFpsSince === null) {
          this.highFpsSince = now;
        } else if (now - this.highFpsSince >= this.upgradeSustainMs) {
          const newQuality = QUALITY_LADDER[currentIndex + 1]!;
          this.applyQualityChange(newQuality);
          this.lastAdjustmentTime = now;
          this.highFpsSince = null;
        }
      }
    } else {
      // FPS between thresholds - stable, reset upgrade tracking
      this.highFpsSince = null;
    }
  }

  private applyQualityChange(newQuality: QualityLevel): void {
    const old = this.currentQuality;
    if (old === newQuality) return;

    this.currentQuality = newQuality;
    for (const cb of this.callbacks) {
      cb(newQuality, old);
    }
  }
}
