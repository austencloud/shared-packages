// Domain types
export type { PropState, SceneConfig, LightingConfig, CameraConfig, PostProcessingConfig, GridConfig, AvatarProps, PropColor, MotionPlane } from './lib/domain/types.js';
export { PROP_COLORS } from './lib/domain/types.js';
export { GripType, FINGER_BONES, mirrorQuaternion } from './lib/domain/GripPose.js';
export type { GripPose, FingerChains, FingerBoneName } from './lib/domain/GripPose.js';

// Services
export { createAvatarServices } from './lib/services/AvatarServicesFactory.js';
export type { AvatarServices, AvatarServicesOptions } from './lib/services/AvatarServicesFactory.js';
export type { IAvatarSkeletonBuilder, BoneName, BoneChain, SkeletonState } from './lib/services/contracts/IAvatarSkeletonBuilder.js';
export type { IIKSolver, IKTarget, IKSolution, IKAlgorithm, JointConstraints } from './lib/services/contracts/IIKSolver.js';

// Components (Svelte)
export { default as Scene3D } from './lib/components/Scene3D.svelte';
export { default as Avatar3D } from './lib/components/Avatar3D.svelte';
export { default as IKFigure3D } from './lib/components/IKFigure3D.svelte';
export { default as OrbitControls } from './lib/components/OrbitControls.svelte';
export { default as Ball3D } from './lib/components/props/Ball3D.svelte';
export { default as Club3D } from './lib/components/props/Club3D.svelte';

// Utils
export { computePropRotation } from './lib/utils/prop3d-transforms.js';
