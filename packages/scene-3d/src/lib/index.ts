// Components
export { default as Avatar3D } from "./components/Avatar3D.svelte";
export { default as PerformerRig } from "./components/PerformerRig.svelte";
export { default as IKFigure3D } from "./components/IKFigure3D.svelte";
export { default as LimbSegment } from "./components/LimbSegment.svelte";
export { default as Staff3D } from "./components/Staff3D.svelte";
export { default as AvatarLoadingIndicator } from "./components/AvatarLoadingIndicator.svelte";

// Prop components
export { default as Prop3D } from "./components/props/Prop3D.svelte";
export { default as Ball3D } from "./components/props/Ball3D.svelte";
export { default as Buugeng3D } from "./components/props/Buugeng3D.svelte";
export { default as Chicken3D } from "./components/props/Chicken3D.svelte";
export { default as Club3D } from "./components/props/Club3D.svelte";
export { default as Doublestar3D } from "./components/props/Doublestar3D.svelte";
export { default as Eightrings3D } from "./components/props/Eightrings3D.svelte";
export { default as Fan3D } from "./components/props/Fan3D.svelte";
export { default as GltfProp3D } from "./components/props/GltfProp3D.svelte";
export { default as Guitar3D } from "./components/props/Guitar3D.svelte";
export { default as Hoop3D } from "./components/props/Hoop3D.svelte";
export { default as Poi3D } from "./components/props/Poi3D.svelte";
export { default as Sword3D } from "./components/props/Sword3D.svelte";
export { default as Torch3D } from "./components/props/Torch3D.svelte";
export { default as Triad3D } from "./components/props/Triad3D.svelte";
export { default as Triquetra3D } from "./components/props/Triquetra3D.svelte";

// Domain enums
export { PropType } from "./domain/enums/PropType";
export { Plane, PLANE_LABELS, PLANE_COLORS, PRIMARY_PLANES } from "./domain/enums/Plane";
export { PlaneMode } from "./domain/enums/PlaneMode";
export { RotationDirection } from "./domain/enums/RotationDirection";

// Domain models & types
export type { PropState3D, PropState2D, PropStates3D, InterpolationResult3D } from "./domain/models/PropState3D";
export type { GripPose, FingerBoneName } from "./domain/models/GripPose";
export { GripType, FINGER_BONES } from "./domain/models/GripPose";
export type { AvatarInstanceState, BeatPlaneOverride } from "./domain/types/AvatarInstanceState";
export type { TipEffectMap, TipEffectAssignment } from "./domain/types/TipEffectTypes";
export type { CameraStateSnapshot } from "./domain/types/CameraStateSnapshot";
export type { GridMode } from "./domain/constants/grid-layout";

// Domain constants
export { PLANE_MODE_CONFIGS, GRID_OFFSETS } from "./domain/constants/plane-mode-configs";
export type { PlaneModeConfig } from "./domain/constants/plane-mode-configs";

// Performer positions
export { getDefaultPositions, getPerformerPosition, WALL_OFFSET, MAX_PERFORMERS, PERFORMER_GRID_SPACING } from "./domain/constants/performer-positions";
export type { PerformerPosition } from "./domain/constants/performer-positions";

// Domain utilities
export { derivePlaneModeFromHands } from "./domain/utils/plane-mode-utils";

// Formation
export { calculateFacingAngle } from "./domain/formation";
export type { FormationPreset } from "./domain/formation";

// Camera choreography
export type { CameraChoreography, CameraKeyframe, CameraState, CameraPosition, CameraInterpolation } from "./domain/camera-choreography";
export { createCameraChoreography, createDefaultCameraState, easingFunctions, lerpCameraPosition, lerpCameraState } from "./domain/camera-choreography";

// Config
export { AVATAR_DEFINITIONS, DEFAULT_AVATAR_ID, getAvatarModelPath } from "./config/avatar-definitions";
export type { AvatarId, AvatarDefinition } from "./config/avatar-definitions";
export { cmToUnits, deriveSceneProportions, AUSTEN_STAFF } from "./config/avatar-proportions";
export { DEFAULT_SCENE_DIMENSIONS, inchesToCm, COMMON_HEIGHTS, COMMON_STAFF_LENGTHS } from "./config/user-proportions";
export { PRESET_VALID_COUNTS, createFormationFromPreset, FORMATION_PRESET_INFO } from "./config/formation-presets";

// Scale & layers
export { SCALE, STAGE, WORLDS } from "./scale/scale-constants";
export { LAYER_WORLD, LAYER_PLAYER_BODY, LAYER_VIEWMODEL, getCameraLayers, shouldUsePlayerBodyLayer } from "./layers/layer-constants";

// State
export { userProportionsState } from "./state/user-proportions-state.svelte";
export { propFinishState, type PropFinish } from "./state/prop-finish-state.svelte";

// Context
export { setViewer3DContext, getViewer3DContext, tryGetViewer3DContext } from "./context/viewer-3d-context";
export { setViewerVisibilityContext, getViewerVisibilityContext, tryGetViewerVisibilityContext } from "./context/viewer-visibility-context";
export type { ViewerVisibilityState } from "./context/viewer-visibility-context";

// Services - contracts
export type { IAvatarAnimator } from "./services/contracts/IAvatarAnimator";
export type { IAvatarSkeletonBuilder, BoneName } from "./services/contracts/IAvatarSkeletonBuilder";
export type { IIKSolver } from "./services/contracts/IIKSolver";
export type { ILocomotionAnimator } from "./services/contracts/ILocomotionAnimator";
export type { IAnimationStateMachine } from "./services/contracts/IAnimationStateMachine";
export { LocomotionState } from "./services/contracts/IAnimationStateMachine";
export type { IFootPlanter } from "./services/contracts/IFootPlanter";
export type { IRootMotionExtractor } from "./services/contracts/IRootMotionExtractor";
export type { IFingerAnimator } from "./services/contracts/IFingerAnimator";
export type { IClavicleRaiser } from "./services/contracts/IClavicleRaiser";
export type { ISpineTwister } from "./services/contracts/ISpineTwister";
export type { IElbowPoleComputer } from "./services/contracts/IElbowPoleComputer";
export type { IAngleMathCalculator } from "./services/contracts/IAngleMathCalculator";
export type { ICollisionDetector, CollisionEvent, BodySnapshot, PropSegment } from "./services/contracts/ICollisionDetector";
export type { ICameraChoreographer, PerformerPositionProvider } from "./services/contracts/ICameraChoreographer";
export type { IFormationManager } from "./services/contracts/IFormationManager";
export type { IContactCurveCache } from "./services/contracts/IContactCurveCache";
export type { ILegAnimator } from "./services/contracts/ILegAnimator";
export type { ILegIKSolver, LegIKInput } from "./services/contracts/ILegIKSolver";
export type { ITurnAnimator, TurnRequest } from "./services/contracts/ITurnAnimator";
export type { IAvatarCustomizer, BodyType } from "./services/contracts/IAvatarCustomizer";
export type { IPerformerSynchronizer } from "./services/contracts/IPerformerSynchronizer";
export type { ISceneOrchestrator } from "./services/contracts/ISceneOrchestrator";
export type { IViewer3DEffectPlugin } from "./services/contracts/IViewer3DEffectPlugin";
export type { IViewer3DUndoManager, PerformerSnapshot, ViewerSnapshot, ViewerOperationType } from "./services/contracts/IViewer3DUndoManager";

// Services - implementations
export { createAvatarServices } from "./services/implementations/AvatarServicesFactory";
export { AngleMathCalculator } from "./services/implementations/AngleMathCalculator";
export { AvatarAnimator } from "./services/implementations/AvatarAnimator";
export { AvatarSkeletonBuilder } from "./services/implementations/AvatarSkeletonBuilder";
export { IKSolver } from "./services/implementations/IKSolver";
export { LocomotionAnimator } from "./services/implementations/LocomotionAnimator";
export { AnimationStateMachine } from "./services/implementations/AnimationStateMachine";
export { FootPlanter } from "./services/implementations/FootPlanter";
export { RootMotionExtractor } from "./services/implementations/RootMotionExtractor";
export { FingerAnimator } from "./services/implementations/FingerAnimator";
export { ClavicleRaiser } from "./services/implementations/ClavicleRaiser";
export { SpineTwister } from "./services/implementations/SpineTwister";
export { ElbowPoleComputer } from "./services/implementations/ElbowPoleComputer";
export { CollisionDetector } from "./services/implementations/CollisionDetector";
export { HingeConstrainedLegIKSolver } from "./services/implementations/HingeConstrainedLegIKSolver";
export { ContactCurveCache } from "./services/implementations/ContactCurveCache";
export { ClipBasedTurnAnimator } from "./services/implementations/ClipBasedTurnAnimator";
export { createCameraChoreographer } from "./services/implementations/CameraChoreographer";
export { createFormationManager } from "./services/implementations/FormationManager";
export { AvatarCustomizer } from "./services/implementations/AvatarCustomizer";
export { KneeHingeAxisCalibrator } from "./services/implementations/KneeHingeAxisCalibrator";
export { LegAnimator } from "./services/implementations/LegAnimator";
export { solveCylinderGrasp } from "./services/implementations/CylinderGraspSolver";
export type { GraspResult } from "./services/implementations/CylinderGraspSolver";
export { createPerformerSynchronizer } from "./services/implementations/PerformerSynchronizer";
export { Viewer3DUndoManager } from "./services/implementations/Viewer3DUndoManager";
export { SeatedAudienceLoader, seatedAudienceLoader } from "./services/implementations/SeatedAudienceLoader";
export type { PreparedFigure } from "./services/implementations/SeatedAudienceLoader";

// Utilities
export { getAngleMath3D } from "./getAngleMath3D";
export { getAngleMathCalculator } from "./getAngleMathCalculator";

// Debug
export { installAvatarDebugHooks } from "./debug/avatar-debug-hooks";
export { installMocapDebugHooks } from "./debug/mocap-debug";

// Prop utilities
export { PROP_MODEL_REGISTRY } from "./components/props/prop-model-registry";

// Prop types
export type { Prop3DProps } from "./components/props/Prop3DProps";
export { PROP_COLORS, METAL_COLORS } from "./components/props/Prop3DProps";

// Data
export { STAFF_GRIP_POSES } from "./data/grip-poses/staff-grip-poses";
