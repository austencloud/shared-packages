<script module lang="ts">
  import type { BufferGeometry } from "three";
  import { buildDoublestarShape } from "./doublestar-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette, normalized to
   * length. Roughly a third of the waist bar's half-width — past that the
   * rolled edge self-intersects at the prop's narrowest features.
   */
  const MAX_BEVEL_INSET = 0.008;

  function getDoublestarPlate(length: number, depth: number): BufferGeometry {
    const key = `${length}:${depth}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      buildDoublestarShape(length),
      depth,
      length * MAX_BEVEL_INSET,
      12
    );
    plates.set(key, plate);
    return plate;
  }

</script>

<script lang="ts">
  /**
   * Doublestar3D Component
   *
   * Two four-pointed stars fused at a central bar — the exact silhouette of the
   * 2D doublestar, extruded into a bullnose plate. The outline and both star
   * holes are transcribed from the prop's SVG in `doublestar-profile.ts`, so
   * the 3D prop and the pictograph prop are the same shape by construction.
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

  /**
   * The doublestar draws longer than a staff in the pictograph — 300 units of
   * span against the staff's 252.8 — and the 3D prop keeps that relationship
   * so the two read at the same relative size they do on the grid.
   */
  const DOUBLESTAR_LENGTH_RATIO = 300 / 252.8;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) *
      DOUBLESTAR_LENGTH_RATIO *
      scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  /**
   * Flat spinning props are plate stock, not tube — about 2cm at default size,
   * against a central bar some 5.5cm across. Thick enough to hold a rolled edge
   * and to read edge-on, thin enough that a tilted plate still shows mostly
   * face rather than rim.
   */
  const plateDepth = $derived(baseRadius * 1.7);

  const plate = $derived(getDoublestarPlate(effectiveLength, plateDepth));
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
