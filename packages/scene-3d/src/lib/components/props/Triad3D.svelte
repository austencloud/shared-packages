<script module lang="ts">
  import { BufferGeometry, TorusGeometry } from "three";
  import {
    TRIAD_ARM_LENGTH,
    TRIAD_DAY,
    TRIAD_FIRE,
    type TriadFrame,
    type TriadSection,
  } from "./triad-frame";
  import { roundedCylinder } from "./prop-lathe";
  import { getFrameMaterials, type FrameVariant } from "./frame-materials";
  import { PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  const FRAMES: Record<FrameVariant, TriadFrame> = {
    fire: TRIAD_FIRE,
    day: TRIAD_DAY,
  };

  /** One turned part, placed on the arm axis. */
  interface Part {
    readonly geometry: BufferGeometry;
    /** Centre of the part, measured out along the arm in scene units. */
    readonly at: number;
  }

  interface TriadParts {
    readonly hubArm: Part;
    readonly innerCollar: Part;
    readonly spine: Part;
    readonly outerCollar?: Part;
    readonly tip: Part;
    readonly ring: BufferGeometry;
  }

  const builds = new Map<string, TriadParts>();

  function turn(section: TriadSection, arm: number, fillet: number): Part {
    return {
      geometry: roundedCylinder({
        length: (section.to - section.from) * arm,
        radius: section.radius * arm,
        radiusEnd: section.radiusEnd ? section.radiusEnd * arm : undefined,
        fillet: fillet * arm,
      }),
      at: ((section.from + section.to) / 2) * arm,
    };
  }

  function getTriadParts(length: number, variant: FrameVariant): TriadParts {
    const key = `${length}:${variant}`;
    const cached = builds.get(key);
    if (cached) return cached;

    const frame = FRAMES[variant];
    const arm = TRIAD_ARM_LENGTH * length;
    const parts: TriadParts = {
      hubArm: turn(frame.hubArm, arm, frame.fillet),
      innerCollar: turn(frame.innerCollar, arm, frame.fillet * 0.5),
      spine: turn(frame.spine, arm, frame.fillet * 0.3),
      outerCollar: frame.outerCollar
        ? turn(frame.outerCollar, arm, frame.fillet * 0.5)
        : undefined,
      tip: turn(frame.tip, arm, frame.fillet),
      ring: new TorusGeometry(
        frame.ringRadius * arm,
        frame.ringTube * arm,
        12,
        28
      ),
    };
    builds.set(key, parts);
    return parts;
  }

  /** One arm pointing +Y, the other two swung back 120 degrees each. */
  const ARM_ANGLES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
</script>

<script lang="ts">
  /**
   * Triad3D Component
   *
   * A hub with a finger ring, three spines out of it at 120 degrees, and a wick
   * on the end of each — the object people actually hold, not the pictograph's
   * silhouette given depth. `triad-frame.ts` carries the dimensions and the
   * reason there are two builds of it.
   *
   * `variant="fire"` is the steel-and-kevlar prop. `variant="day"` is the
   * printed-hub practice build with glow heads. Both keep the artwork's reach
   * to the last decimal, so the mandala a triad draws is the same either way.
   *
   * The hand goes through the ring at the hub, which is the origin — the same
   * point the pictograph puts the hand on.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import { LAYER_WORLD, LAYER_PLAYER_BODY } from "../../layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    length,
    isActivePlayer = false,
    scale = 1,
    variant = "fire",
  }: Prop3DProps & { variant?: FrameVariant } = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );

  const parts = $derived(getTriadParts(effectiveLength, variant));
  const materials = $derived(getFrameMaterials(color, variant));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    {#each ARM_ANGLES as angle}
      <T.Group rotation={[0, 0, angle]}>
        <T.Mesh
          geometry={parts.hubArm.geometry}
          material={materials.hub}
          position={[0, parts.hubArm.at, 0]}
          dispose={false}
        />
        <T.Mesh
          geometry={parts.innerCollar.geometry}
          material={materials.collar}
          position={[0, parts.innerCollar.at, 0]}
          dispose={false}
        />
        <T.Mesh
          geometry={parts.spine.geometry}
          material={materials.spine}
          position={[0, parts.spine.at, 0]}
          dispose={false}
        />
        {#if parts.outerCollar}
          <T.Mesh
            geometry={parts.outerCollar.geometry}
            material={materials.collar}
            position={[0, parts.outerCollar.at, 0]}
            dispose={false}
          />
        {/if}
        <T.Mesh
          geometry={parts.tip.geometry}
          material={materials.tip}
          position={[0, parts.tip.at, 0]}
          dispose={false}
        />
      </T.Group>
    {/each}

    <!-- Finger ring, lying in the prop's plane so the finger goes through it -->
    <T.Mesh geometry={parts.ring} material={materials.ring} dispose={false} />
  </T.Group>

  <!-- Trail indicator (small sphere at prop position for path visualization) -->
  <T.Mesh
    geometry={PLATE_TRAIL_GEOMETRY}
    material={materials.trail}
    layers={propLayer}
    dispose={false}
  />
{/if}
