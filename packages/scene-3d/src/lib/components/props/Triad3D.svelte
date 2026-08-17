<script module lang="ts">
  import type { BufferGeometry } from "three";
  import { buildTriadShape, TRIAD_ARM_WIDTH } from "./triad-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette — roughly a third
   * of an arm's half-width, past which the rolled edge folds through itself at
   * the notches where two arms meet.
   */
  const MAX_BEVEL_INSET = TRIAD_ARM_WIDTH / 6.8;

  function getTriadPlate(length: number, depth: number): BufferGeometry {
    const key = `${length}:${depth}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      buildTriadShape(length),
      depth,
      length * MAX_BEVEL_INSET
    );
    plates.set(key, plate);
    return plate;
  }
</script>

<script lang="ts">
  /**
   * Triad3D Component
   *
   * Three straight arms of equal width meeting at a hub, 120 degrees apart,
   * each ending in a round cap — the exact silhouette of the 2D triad,
   * extruded into a bullnose plate. The outline comes from the drawing itself
   * in `triad-profile.ts`, so the 3D prop and the pictograph prop are the same
   * shape by construction.
   *
   * The hand takes the hub, with one arm running away from it and two behind.
   * There is no separate handle and no hub boss — the artwork does not draw
   * either, so neither does this.
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
   * Flat spinning props are plate stock, not tube. The triad's arms run about
   * 8cm across at default size — the widest stock in the flat family — so the
   * plate sits a little under 2cm: thick enough to hold a rolled edge and to
   * read edge-on, thin enough that a tilted arm still shows mostly face.
   */
  const plateDepth = $derived(baseRadius * 1.4);

  const plate = $derived(getTriadPlate(effectiveLength, plateDepth));
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
