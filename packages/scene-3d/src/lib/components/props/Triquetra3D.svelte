<script module lang="ts">
  import type { BufferGeometry } from "three";
  import {
    buildTriquetraShape,
    TRIQUETRA2_HAND,
    TRIQUETRA_HAND,
    TRIQUETRA_RIBBON_WIDTH,
  } from "./triquetra-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  type TriquetraVariant = "triquetra" | "triquetra2";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette — roughly a third
   * of the ribbon's half-width, past which the rolled edge folds through itself
   * where the lobes cross.
   */
  const MAX_BEVEL_INSET = TRIQUETRA_RIBBON_WIDTH / 6.8;

  function getTriquetraPlate(
    length: number,
    depth: number,
    variant: TriquetraVariant
  ): BufferGeometry {
    const key = `${length}:${depth}:${variant}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      buildTriquetraShape(
        length,
        variant === "triquetra2" ? TRIQUETRA2_HAND : TRIQUETRA_HAND
      ),
      depth,
      length * MAX_BEVEL_INSET
    );
    plates.set(key, plate);
    return plate;
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
   * Both props are the same single knot. The only difference is where the hand
   * meets it: `triquetra` grips the base, `triquetra2` reaches through the
   * middle of the weave. Each drawing's viewBox centre says which.
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

  const plate = $derived(getTriquetraPlate(effectiveLength, plateDepth, variant));
  const materials = $derived(getPlateMaterials(color));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <T.Mesh
      geometry={plate}
      material={[materials.face, materials.edge]}
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
