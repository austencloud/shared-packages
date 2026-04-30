import type { Vector3, Quaternion } from 'three';
import type { GripType } from './GripPose.js';

export interface PropState {
  position: Vector3;
  rotation: Quaternion;
  gripType?: GripType;
}

export interface SceneConfig {
  lighting?: LightingConfig;
  camera?: CameraConfig;
  postProcessing?: PostProcessingConfig;
  grid?: GridConfig;
}

export interface LightingConfig {
  ambientIntensity?: number;
  ambientColor?: string;
  mainLightIntensity?: number;
  mainLightColor?: string;
  mainLightPosition?: [number, number, number];
  isNightEnvironment?: boolean;
}

export interface CameraConfig {
  mode?: 'orbit' | 'first-person';
  preset?: 'front' | 'top' | 'side' | 'perspective';
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
}

export interface PostProcessingConfig {
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
}

export interface GridConfig {
  visible?: boolean;
  size?: number;
  divisions?: number;
  color?: string;
}

export interface AvatarProps {
  avatarModelUrl?: string;
  leftHandTarget?: Vector3 | null;
  rightHandTarget?: Vector3 | null;
  leftGripType?: GripType;
  rightGripType?: GripType;
  enableLocomotion?: boolean;
  visible?: boolean;
}

export const PROP_COLORS = {
  blue: { main: '#3b82f6', dark: '#1d4ed8', light: '#60a5fa' },
  red: { main: '#ef4444', dark: '#b91c1c', light: '#f87171' },
} as const;

export type PropColor = 'blue' | 'red';

export type MotionPlane = 'wall' | 'wheel' | 'floor';
