// Cosmic Background Types

export type CosmicTheme = "default" | "aurora" | "nebula" | "cosmic";

export type StarSize = "small" | "medium" | "large";

export type AnimationSpeed = "slow" | "normal" | "fast";

export interface CosmicSettings {
  theme: CosmicTheme;
  starCount: number;
  animationSpeed: AnimationSpeed;
  enableTwinkle: boolean;
  enableDrift: boolean;
}
