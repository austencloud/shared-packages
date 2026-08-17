<script module lang="ts">
  import type { BufferGeometry } from "three";
  import {
    buildEightringsShape,
    EIGHTRINGS_STOCK_WIDTH,
  } from "./eightrings-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette — roughly a third
   * of the stock's half-width, past which the rolled edge folds through itself
   * at the notches where the two rings cross.
   */
  const MAX_BEVEL_INSET = EIGHTRINGS_STOCK_WIDTH / 6.8;

  /**
   * The outline is all circular arc, so it needs more segments than the freehand
   * silhouettes to stay round at the size this prop is drawn.
   */
  const CURVE_SEGMENTS = 24;

  function getEightringsPlate(length: number, depth: number): BufferGeometry {
    const key = `${length}:${depth}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      buildEightringsShape(length),
      depth,
      length * MAX_BEVEL_INSET,
      CURVE_SEGMENTS
    );
    plates.set(key, plate);
    return plate;
  }
</script>

<script lang="ts">
  /**
   * Eightrings3D Component
   *
   * Two flat rings of identical section, set side by side along the prop and
   * joined where they overlap — the exact silhouette of the 2D eight rings,
   * extruded into a bullnose plate. Both circles and the union that joins them
   * are built from the drawing's own measurements in `eightrings-profile.ts`,
   * so the 3D prop and the pictograph prop are the same shape by construction.
   *
   * The rings are coplanar and untilted, because that is what the artwork
   * draws. The hand takes the prop at the waist where they cross.
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
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  /**
   * Flat spinning props are plate stock, not tube. The ring stock runs about
   * 5.5cm across at default size, so the plate sits a little under 2cm — thick
   * enough to hold a rolled edge and to read edge-on, thin enough that a tilted
   * ring still shows mostly face rather than rim.
   */
  const plateDepth = $derived(baseRadius * 1.4);

  const plate = $derived(getEightringsPlate(effectiveLength, plateDepth));
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
