// @austencloud/juggling-physics
// Pure math juggling animation engine. No rendering dependencies.
// See ATTRIBUTION.md for reference sources.

export { type Vec3, vec3, add, sub, scale, lerp, length, distance, normalize, dot, cross } from './vec3.js';
export { type Quaternion, identity, fromAxisAngle, slerp, multiply } from './quaternion.js';

export {
  GRAVITY,
  ThrowTrajectory,
  BounceTrajectory,
  type TrajectoryParams,
  type TrajectoryState,
} from './trajectory.js';

export {
  CubicDwellCurve,
  CircularDwellCurve,
  LinearDwellCurve,
  type DwellParams,
  type CircularDwellParams,
} from './dwell-curve.js';

export {
  solveIK2Link,
  type IKConfig,
  type IKResult,
} from './ik-solver.js';

export {
  Movement,
  type MovementSegment,
} from './movement.js';

export {
  JIFAnimator,
  type JIFData,
  type JugglerLayout,
  type AnimationFrame,
  type AnimationConfig,
} from './jif-animator.js';
