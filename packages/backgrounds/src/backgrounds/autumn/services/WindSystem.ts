import type {
  AutumnWindPreset,
  WindState,
} from "../domain/models/autumn-models.js";
import { AUTUMN_WIND_PRESETS } from "../domain/constants/autumn-constants.js";

export interface WindSystem {
  state: WindState;
  initialize(): void;
  update(frameMultiplier: number): void;
  getWindForce(): number;
  setPreset(preset: AutumnWindPreset): void;
  triggerGust(strength?: number): void;
}

export function getGustEnvelope(progress: number): number {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return Math.sin(clampedProgress * Math.PI) ** 1.25;
}

export function createWindSystem(random: () => number = Math.random): WindSystem {
  let preset: AutumnWindPreset = "breezy";
  let ambientPhase = 0;

  const state: WindState = {
    gust: {
      active: false,
      strength: 0,
      duration: 0,
      totalDuration: 0,
      currentStrength: 0,
    },
    framesSinceLastGust: 0,
    nextGustIn: 0,
  };

  function getConfig() {
    return AUTUMN_WIND_PRESETS[preset];
  }

  function getNextGustInterval(): number {
    const config = getConfig();
    return (
      config.gustIntervalMin +
      random() * (config.gustIntervalMax - config.gustIntervalMin)
    );
  }

  function getGustDuration(): number {
    const config = getConfig();
    return (
      config.gustDurationMin +
      random() * (config.gustDurationMax - config.gustDurationMin)
    );
  }

  function getGustStrength(): number {
    const config = getConfig();
    const magnitude =
      config.gustStrengthMin +
      random() * (config.gustStrengthMax - config.gustStrengthMin);

    return random() < 0.78 ? magnitude : -magnitude;
  }

  function initialize(): void {
    ambientPhase = random() * Math.PI * 2;
    state.framesSinceLastGust = 0;
    state.nextGustIn = getNextGustInterval();
    state.gust = {
      active: false,
      strength: 0,
      duration: 0,
      totalDuration: 0,
      currentStrength: 0,
    };
  }

  function update(frameMultiplier: number): void {
    ambientPhase += 0.008 * frameMultiplier;
    state.framesSinceLastGust += frameMultiplier;

    if (!state.gust.active && state.framesSinceLastGust >= state.nextGustIn) {
      triggerGust();
    }

    if (!state.gust.active) return;

    state.gust.duration = Math.max(0, state.gust.duration - frameMultiplier);
    const elapsed = state.gust.totalDuration - state.gust.duration;
    const progress = state.gust.totalDuration > 0
      ? elapsed / state.gust.totalDuration
      : 1;
    state.gust.currentStrength =
      state.gust.strength * getGustEnvelope(progress);

    if (state.gust.duration <= 0) {
      state.gust.active = false;
      state.gust.currentStrength = 0;
      state.framesSinceLastGust = 0;
      state.nextGustIn = getNextGustInterval();
    }
  }

  function getWindForce(): number {
    const ambient = getConfig().ambientStrength * (0.78 + Math.sin(ambientPhase) * 0.22);
    return ambient + state.gust.currentStrength;
  }

  function setPreset(nextPreset: AutumnWindPreset): void {
    preset = nextPreset;
    state.framesSinceLastGust = 0;
    state.nextGustIn = getNextGustInterval();
  }

  function triggerGust(strength?: number): void {
    const duration = getGustDuration();
    state.gust = {
      active: true,
      strength: strength ?? getGustStrength(),
      duration,
      totalDuration: duration,
      currentStrength: 0,
    };
  }

  return {
    get state() {
      return state;
    },
    initialize,
    update,
    getWindForce,
    setPreset,
    triggerGust,
  };
}
