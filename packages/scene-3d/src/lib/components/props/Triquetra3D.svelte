<script module lang="ts">
  import type { BufferGeometry } from "three";
  import {
    buildTriquetraShape,
    buildTriquetraShapes,
    TRIQUETRA2_GRIP,
    TRIQUETRA2_GRIP_OFFSET,
    TRIQUETRA_GRIP,
    TRIQUETRA_RIBBON_WIDTH,
  } from "./triquetra-profile";
  import {
    bullnosePlate,
    gripBandMaxBevel,
    gripBandShape,
  } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  type TriquetraVariant = "triquetra" | "triquetra2";

  interface TriquetraGeometrySet {
    plate: BufferGeometry;
    gripBand: BufferGeometry;
  }

  const geometrySets = new Map<string, TriquetraGeometrySet>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette — roughly a third
   * of the ribbon's half-width, past which the rolled edge folds through itself
   * where the lobes cross.
   */
  const MAX_BEVEL_INSET = TRIQUETRA_RIBBON_WIDTH / 6.8;

  function getTriquetraGeometrySet(
    length: number,
    depth: number,
    variant: TriquetraVariant
  ): TriquetraGeometrySet {
    const key = `${length}:${depth}:${variant}`;
    const cached = geometrySets.get(key);
    if (cached) return cached;

    const single = variant === "triquetra2";
    const grip = single ? TRIQUETRA2_GRIP : TRIQUETRA_GRIP;
    const geometry = {
      plate: bullnosePlate(
        single
          ? buildTriquetraShape(length, TRIQUETRA2_GRIP_OFFSET)
          : buildTriquetraShapes(length),
        depth,
        length * MAX_BEVEL_INSET
      ),
      // The band stands proud of the plate on both faces, so it reads as
      // something added to the prop rather than printed on it.
      gripBand: bullnosePlate(
        gripBandShape(length, grip),
        depth * 1.3,
        length * gripBandMaxBevel(grip)
      ),
    };
    geometrySets.set(key, geometry);
    return geometry;
  }

</script>

<script lang="ts">
  /**
   * Triquetra3D Component
   *
   * Three interlocked vesica lobes woven through a ring — the exact silhouette
   * of the 2D triquetra, extruded into a bullnose plate. The outline and all
   * four holes are transcribed from the prop's SVG in `triquetra-profile.ts`,
   * so the 3D prop and the pictograph prop are the same shape by construction.
   *
   * The default prop is DOUBLE, because the drawing is: two knots mirrored
   * about the hand, reaching in opposite directions, joined by the grip band
   * that fills the channel between their cusps. `variant="triquetra2"` is a
   * single one of those knots, held through the middle of the weave — the only
   * thing that drawing changes is where the hand meets the plate.
   *
   * Extrusion emits two material groups: group 0 is the pair of faces, group 1
   * is the rim, which is how the plate gets a darker turned edge.
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
    thickness,
    isActivePlayer = false,
    scale = 1,
    variant = "triquetra",
  }: Prop3DProps & { variant?: TriquetraVariant } = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  /**
   * Flat spinning props are plate stock, not tube. The triquetra's ribbon runs
   * about 4.7cm across at default size, so the plate sits a little under 2cm —
   * thick enough to hold a rolled edge and to read edge-on, thin enough that a
   * tilted ribbon still shows mostly face rather than rim.
   */
  const plateDepth = $derived(baseRadius * 1.4);

  const geometry = $derived(
    getTriquetraGeometrySet(effectiveLength, plateDepth, variant)
  );
  const materials = $derived(getPlateMaterials(color));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <T.Mesh
      geometry={geometry.plate}
      material={[materials.face, materials.edge]}
      dispose={false}
    />

    <!--
      Every prop marks the hand with white. A ring would hoop out of a plate
      this flat, so the triquetra wears a band instead — and on the double prop
      that band is structural, bridging the channel between the two knots and
      lapping onto both. Sized to the material it lands on, so it never
      overhangs into a hole.
    -->
    <T.Mesh
      geometry={geometry.gripBand}
      material={[materials.grip, materials.gripEdge]}
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
