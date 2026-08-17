<script lang="ts">
  /**
   * PerformerRig - Unified 3D Transform Hierarchy
   *
   * One T.Group owns position + facingAngle. Avatar, grid, props, and
   * effects are all children. The scene graph guarantees frame-perfect
   * attachment. No manual cos/sin. No STAGE_LIFT trick.
   *
   * Hierarchy:
   *   PerformerRig (T.Group) - position=[x, groundOffset, z], rotation.y=facingAngle
   *   ├── Avatar3D (conditional)
   *   ├── Grid (conditional, dual-wheel renders two wheel grids)
   *   ├── Blue HandAnchor → PropAnchor
   *   ├── Red HandAnchor → PropAnchor
   *   └── EffectsGroup → EffectOrchestrator3D
   */

  import { T } from "@threlte/core";
  import { untrack } from "svelte";
  import type { Snippet } from "svelte";
  import type { Group } from "three";
  import Avatar3D from "./Avatar3D.svelte";
  import Prop3D from "./props/Prop3D.svelte";
  import { Plane } from "../domain/enums/Plane";
  import { PlaneMode } from "../domain/enums/PlaneMode";
  import {
    GRID_OFFSETS,
    PLANE_MODE_CONFIGS,
  } from "../domain/constants/plane-mode-configs";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { PropType } from "../domain/enums/PropType";
  import type { PropState3D } from "../domain/models/PropState3D";
  import type { AvatarInstanceState } from "../domain/types/AvatarInstanceState";
  import type { GridMode } from "../domain/constants/grid-layout";
  import type { TipEffectMap } from "../domain/types/TipEffectTypes";
  import type { TurnRequest } from "../services/contracts/ITurnAnimator";
  import { derivePlaneModeFromHands } from "../domain/utils/plane-mode-utils";
  import { tryGetViewerVisibilityContext } from "../context/viewer-visibility-context";

  // Constant sets to avoid allocating new Set objects on every reactive update.
  const WHEEL_ONLY = new Set([Plane.WHEEL]);

  // Safe access to viewer visibility - PerformerRig is used in museum/realm
  // contexts where this context won't exist. Defaults to true (both visible).
  const _viewerVisibility = tryGetViewerVisibilityContext();
  const blueVisible = $derived(_viewerVisibility?.blueMotion ?? true);
  const redVisible = $derived(_viewerVisibility?.redMotion ?? true);

  interface Props {
    /** World position (x/z). y=0 is ground level. */
    position: { x: number; z: number };
    /** Avatar body facing direction (radians, 0 = +Z toward audience) */
    facingAngle: number;
    /** Determines grid offset, lateral hand positions */
    planeMode: PlaneMode;
    /** Avatar instance that provides prop states, step configs, etc. */
    avatarState: AvatarInstanceState;

    // Visibility toggles (all default true)
    showAvatar?: boolean;
    showGrid?: boolean;
    showProps?: boolean;
    showEffects?: boolean;

    // Grid config
    visiblePlanes?: Set<Plane>;
    gridMode?: GridMode;

    // Prop types
    bluePropType?: PropType;
    redPropType?: PropType;

    // Prop state overrides (for dual-wheel mode - caller swaps before passing)
    bluePropState?: PropState3D | null;
    redPropState?: PropState3D | null;

    // Effects
    tipEffectMap?: TipEffectMap;
    isPlaying?: boolean;
    staffHalfLength?: number;
    propLength?: number;

    // Vertical offset (museum platforms, stages)
    groundOffset?: number;

    // Avatar model selection
    avatarId?: import("../config/avatar-definitions").AvatarId;

    // Locomotion (walk/idle animation)
    enableLocomotion?: boolean;
    isMoving?: boolean;
    moveSpeed?: number;

    /** When true, facingAngle is driven by root motion yawDelta from
     *  the animation clip (accumulated each frame). When false (default),
     *  facingAngle is consumer-authoritative - the rig rotation matches
     *  whatever the consumer passes in. */
    animationDrivenYaw?: boolean;
    /** Callback fired after each yawDelta integration when animationDrivenYaw
     *  is true. The consumer receives the new accumulated angle so it can
     *  sync its own sequence/state representation if needed. */
    onYawIntegrated?: (newAngle: number) => void;
    /** Enable idle/walk locomotion animation on the avatar.
     *  When true, the avatar breathes/sways while standing. */
    enableRootMotion?: boolean;
    /** Enable foot planting IK on the avatar. Pins feet to the
     *  ground during contact phases. */
    enableFootPlanting?: boolean;
    /** Externally provided turn request. When null, PerformerRig
     *  derives its own from per-beat heading changes. */
    turnRequestOverride?: TurnRequest | null;

    /** Optional grid component rendered at appropriate offset */
    gridSlot?: Snippet;
    /**
     * Optional effects component rendered in rig-local space. Receives the
     * rig's live prop states, hand-anchor offsets, play flag, tip-effect map,
     * staff half length, and the effects group ref so a consumer-mounted
     * effect orchestrator can place tip-tracking effects (trails, LED, etc.)
     * in the correct rig-root-local frame without duplicating rig internals.
     */
    effectsSlot?: Snippet<[{
      bluePropState: PropState3D | null;
      redPropState: PropState3D | null;
      blueHandPos: { x: number; z: number };
      redHandPos: { x: number; z: number };
      isPlaying: boolean;
      tipEffectMap: TipEffectMap;
      staffHalfLength: number;
      effectsParentRef: Group | undefined;
    }]>;

    /** Stance yaw input track (radians), forwarded to Avatar3D: sustained
     *  torso facing offset distributed across the spine, feet planted.
     *  Planner-shaped - the caller (heuristic today, offline execution
     *  planner later) decides the stance; the rig just carries it. */
    stanceYaw?: number;
    /** Grip weld, forwarded to Avatar3D: render each prop locked into the
     *  ACHIEVED fist (rotated onto the post-solve knuckle line, grip point
     *  at the palm, unclamped). Default false = legacy clamped
     *  position-only contact lock. */
    weldGrip?: boolean;
    /** Avatar mesh opacity 0-1, forwarded to Avatar3D for swap cross-fades.
     *  1 = fully opaque (default). */
    avatarOpacity?: number;
    /** Fired with the avatar id when the avatar model finishes loading or
     *  swapping. Forwarded from Avatar3D for swap-transition wrappers. */
    onAvatarSwapped?: (avatarId: string) => void;
  }

  let {
    position,
    facingAngle,
    planeMode,
    avatarState,
    showAvatar = true,
    showGrid = true,
    showProps = true,
    showEffects = true,
    visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]),
    gridMode = "diamond" as GridMode,
    bluePropType = PropType.STAFF,
    redPropType = PropType.STAFF,
    bluePropState: bluePropStateOverride,
    redPropState: redPropStateOverride,
    tipEffectMap = {},
    isPlaying = false,
    staffHalfLength: staffHalfLengthProp,
    propLength,
    groundOffset = 0,
    avatarId,
    enableLocomotion = false,
    isMoving = false,
    moveSpeed = 0,
    animationDrivenYaw = false,
    onYawIntegrated,
    enableRootMotion = false,
    enableFootPlanting = false,
    turnRequestOverride,
    stanceYaw = 0,
    weldGrip = false,
    avatarOpacity = 1,
    onAvatarSwapped,
    gridSlot,
    effectsSlot,
  }: Props = $props();

  const staffHalfLength = $derived(
    staffHalfLengthProp ?? (propLength ? propLength / 2 : userProportionsState.staffLength / 2)
  );

  // Animation-driven yaw accumulator. When animationDrivenYaw is true, the
  // rig's rotation is advanced by yawDelta from Avatar3D's onRootMotion
  // callback each frame (the turn clip drives the rotation). When the flag
  // is false, this mirrors the consumer's facingAngle directly so the rig
  // behaves exactly as before.
  let accumulatedYaw = $state(untrack(() => facingAngle));

  // Resolve prop states: use overrides (for dual-wheel swap) or avatarState defaults
  const bluePropState = $derived(bluePropStateOverride ?? avatarState.bluePropState);
  const redPropState = $derived(redPropStateOverride ?? avatarState.redPropState);

  // Derive mode config and grid offset from the current plane mode
  const modeConfig = $derived(PLANE_MODE_CONFIGS[planeMode]);
  const gridOffset = $derived(GRID_OFFSETS[planeMode]);
  const isDualWheel = $derived(planeMode === PlaneMode.DUAL_WHEEL);

  // ── Turn scheduling ──
  // Derive per-beat heading from the avatar's plane mode configuration.
  // When consecutive beats have different headings (from per-beat plane
  // overrides), schedule a turn during that beat.

  // Track the target heading of the active turn. When the turn completes
  // (turnRequest goes null), snap the consumer's facing angle to the
  // target heading so the sync effect picks up the correct post-turn
  // angle instead of snapping back to the pre-turn heading.
  let turnTargetHeading: number | null = $state(null);

  function getHeadingForBeat(stepNumber: number): number {
    const override = avatarState.beatPlaneOverrides.get(stepNumber);
    if (override) {
      const mode = derivePlaneModeFromHands(
        override.blue ?? Plane.WALL,
        override.red ?? Plane.WALL
      );
      return PLANE_MODE_CONFIGS[mode].facingAngle;
    }
    return PLANE_MODE_CONFIGS[avatarState.planeMode].facingAngle;
  }

  const turnRequest = $derived.by((): TurnRequest | null => {
    // External override takes precedence
    if (turnRequestOverride !== undefined) return turnRequestOverride;

    // No sequence loaded or single-beat → no turns
    if (!avatarState.hasSequence || avatarState.totalSteps <= 1) return null;

    const currentIdx = avatarState.currentStepIndex;
    // Beat 0 is the start position - no "from" heading to compare
    if (currentIdx === 0) return null;

    const currentHeading = getHeadingForBeat(currentIdx);
    const prevHeading = getHeadingForBeat(currentIdx - 1);

    // Compute shortest-path angle
    let delta = currentHeading - prevHeading;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    // Skip tiny or zero heading changes
    if (Math.abs(delta) < 0.01) return null;

    return {
      fromHeading: prevHeading,
      toHeading: currentHeading,
      phase: avatarState.progress,
    };
  });

  // When a turn is active, enable animation-driven yaw so the rig
  // rotates from the turn clip's root motion rather than snapping.
  const effectiveAnimDrivenYaw = $derived(animationDrivenYaw || turnRequest !== null);

  // Turn completion snap: when turnRequest goes null after being active,
  // snap avatarState to the post-turn heading so the sync effect below
  // reads the correct angle instead of reverting to pre-turn heading.
  $effect(() => {
    if (turnRequest) {
      turnTargetHeading = turnRequest.toHeading;
    } else if (turnTargetHeading !== null) {
      // Turn just completed - snap avatarState to post-turn heading
      avatarState.snapFacingAngle(turnTargetHeading);
      turnTargetHeading = null;
    }
  });

  // When the consumer changes facingAngle externally (e.g., scrubbing the
  // timeline, snapping to a new beat), sync the accumulator. In animation-
  // driven mode we only re-sync on explicit external changes, not on
  // internal integrations - otherwise the external sync would immediately
  // undo every yawDelta increment.
  $effect(() => {
    if (!effectiveAnimDrivenYaw) {
      accumulatedYaw = facingAngle;
    }
  });

  // HandAnchor positions in rig-local space.
  // Wall mode: both hands at z=gridOffset (grid center is forward of body).
  // Dual-wheel: hands at half staff length laterally so endpoints touch
  // when staves are held out horizontally. z=0 (grid at solar plexus).
  const dualWheelOffset = $derived(staffHalfLength);
  const blueHandPos = $derived({
    x: isDualWheel ? dualWheelOffset : modeConfig.blueLateralOffset,
    z: isDualWheel ? 0 : gridOffset,
  });
  const redHandPos = $derived({
    x: isDualWheel ? -dualWheelOffset : modeConfig.redLateralOffset,
    z: isDualWheel ? 0 : gridOffset,
  });

  // PropAnchor refs - Avatar3D reads world positions from these for IK targeting.
  let bluePropAnchorRef = $state<Group | undefined>(undefined);
  let redPropAnchorRef = $state<Group | undefined>(undefined);

  // Contact-lock correction groups nested inside each PropAnchor. Avatar3D
  // writes their local position each frame with the clamped anchor->palm
  // residual, so the RENDERED prop stays glued to the hand while the IK
  // target (the anchor itself) stays untouched - no feedback loop.
  let bluePropCorrectionRef = $state<Group | undefined>(undefined);
  let redPropCorrectionRef = $state<Group | undefined>(undefined);

  // Effects group ref - imperative renderers add meshes here so they
  // inherit the rig's transform.
  let effectsGroupRef = $state<Group | undefined>(undefined);
</script>

<!-- Root: position in world space, apply facing rotation -->
<T.Group
  position.x={position.x}
  position.y={groundOffset}
  position.z={position.z}
  rotation.y={effectiveAnimDrivenYaw ? accumulatedYaw : facingAngle}
>
  <!-- Avatar3D uses groundY (~-1.56) internally to position its mesh,
       so shoulders end up near y=0 in rig space. -->
  {#if showAvatar}
    <Avatar3D
      id={avatarState.id}
      {avatarId}
      opacity={avatarOpacity}
      onModelSwapped={onAvatarSwapped}
      bluePropState={bluePropState}
      redPropState={redPropState}
      facingAngle={0}
      position={{ x: 0, z: 0 }}
      isActive={false}
      {isMoving}
      {moveSpeed}
      {enableLocomotion}
      {enableRootMotion}
      {enableFootPlanting}
      turnRequest={turnRequest}
      bluePropAnchorRef={bluePropAnchorRef}
      redPropAnchorRef={redPropAnchorRef}
      bluePropCorrectionRef={bluePropCorrectionRef}
      redPropCorrectionRef={redPropCorrectionRef}
      stanceYaw={stanceYaw}
      weldGrip={weldGrip}
      disableSpineTwist={isDualWheel}
      stepNumber={avatarState.currentStepIndex}
      beatProgress={avatarState.progress}
      onRootMotion={effectiveAnimDrivenYaw
        ? (delta) => {
            if (delta.yawDelta !== 0) {
              accumulatedYaw += delta.yawDelta;
              onYawIntegrated?.(accumulatedYaw);
            }
          }
        : undefined}
    />
  {/if}

  <!-- Grid (consumer-provided via gridSlot) -->
  {#if showGrid && gridSlot}
    {@render gridSlot()}
  {/if}

  <!-- Blue HandAnchor + PropAnchor -->
  <T.Group
    position.x={blueHandPos.x}
    position.z={blueHandPos.z}
  >
    {#if bluePropState && blueVisible}
      <T.Group
        bind:ref={bluePropAnchorRef}
        position.x={bluePropState.worldPosition.x}
        position.y={bluePropState.worldPosition.y}
        position.z={bluePropState.worldPosition.z}
      >
        <T.Group bind:ref={bluePropCorrectionRef}>
          {#if showProps}
            <Prop3D
              propType={bluePropType}
              propState={bluePropState}
              color="blue"
              length={propLength}
            />
          {/if}
        </T.Group>
      </T.Group>
    {/if}
  </T.Group>

  <!-- Red HandAnchor + PropAnchor -->
  <T.Group
    position.x={redHandPos.x}
    position.z={redHandPos.z}
  >
    {#if redPropState && redVisible}
      <T.Group
        bind:ref={redPropAnchorRef}
        position.x={redPropState.worldPosition.x}
        position.y={redPropState.worldPosition.y}
        position.z={redPropState.worldPosition.z}
      >
        <T.Group bind:ref={redPropCorrectionRef}>
          {#if showProps}
            <Prop3D
              propType={redPropType}
              propState={redPropState}
              color="red"
              length={propLength}
            />
          {/if}
        </T.Group>
      </T.Group>
    {/if}
  </T.Group>

  <!-- Effects (consumer-provided via effectsSlot) -->
  {#if showEffects && effectsSlot}
    <T.Group bind:ref={effectsGroupRef}>
      {@render effectsSlot({
        bluePropState,
        redPropState,
        blueHandPos,
        redHandPos,
        isPlaying,
        tipEffectMap,
        staffHalfLength,
        effectsParentRef: effectsGroupRef,
      })}
    </T.Group>
  {/if}
</T.Group>
