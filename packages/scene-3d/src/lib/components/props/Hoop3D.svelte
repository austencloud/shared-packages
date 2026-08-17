<script module lang="ts">
  import { TorusGeometry } from "three";
  import {
    HOOP_CENTERLINE_RADIUS_M,
    HOOP_TUBE_RADIUS_M,
    HOOP_RING_SEGMENTS,
    HOOP_TUBE_SEGMENTS,
  } from "./hoop-geometry";

  const builds = new Map<number, TorusGeometry>();

  function getHoopGeometry(scale: number): TorusGeometry {
    const cached = builds.get(scale);
    if (cached) return cached;

    const geometry = new TorusGeometry(
      HOOP_CENTERLINE_RADIUS_M * scale,
      HOOP_TUBE_RADIUS_M * scale,
      HOOP_TUBE_SEGMENTS,
      HOOP_RING_SEGMENTS
    );
    builds.set(scale, geometry);
    return geometry;
  }
</script>

<script lang="ts">
  /**
   * Hoop3D Component
   *
   * A mini hoop: one 5/8in HDPE tube bent into an 18.5in ring.
   * `hoop-geometry.ts` carries the numbers and where each came from — the
   * diameter off `minihoop.svg` (whose 18.36in lands inside the range minis are
   * sold at, unlike the club's length), the tube off the tubing spec, where 5/8in
   * is forced: 3/4in tube will not hold a round hoop at this diameter, which is
   * why no vendor sells that combination.
   *
   * The hand grips the tube's CENTRELINE at the near side of the ring, which is
   * where `minihoop.svg` puts its 2D hand point — measured 0.7% off the
   * centreline, so the 2D and 3D grips are in register. `TorusGeometry`'s
   * `radius` is a centreline radius too, so offsetting the mesh up by exactly
   * that radius puts the grip at the group origin.
   *
   * Because a hoop is sold in discrete inch sizes, its size is absolute — it does
   * not scale with the user's staff length the way Staff3D does. `scale` still
   * applies, which is what the BIGHOOP prop type uses.
   *
   * The invented white grip torus is gone. Nothing on a real hoop marks the grip
   * — the ring is one uniform tube from end to end, which is also what the glyph
   * draws. The same fake grip ring came off the club for the same reason.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { getHoopMaterials } from "./frame-materials";
  import { PLATE_TRAIL_GEOMETRY } from "./plate-materials";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "../../layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const geometry = $derived(getHoopGeometry(scale));
  const materials = $derived(getHoopMaterials(color));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Lifted by the centreline radius so the tube's centreline passes through
         the origin at the bottom of the ring, which is where the hand is. -->
    <T.Mesh
      {geometry}
      material={materials.tube}
      position={[0, HOOP_CENTERLINE_RADIUS_M * scale, 0]}
      dispose={false}
    />
  </T.Group>

  <!-- Trail indicator (small sphere at prop position for path visualization) -->
  <T.Mesh
    geometry={PLATE_TRAIL_GEOMETRY}
    material={materials.trail}
    layers={propLayer}
    dispose={false}
  />
{/if}
