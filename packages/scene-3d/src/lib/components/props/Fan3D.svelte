<script module lang="ts">
  import type { BufferGeometry } from "three";
  import { buildFanShape, FAN_FRAME_WIDTH } from "./fan-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette — roughly a third
   * of the frame's half-width, past which the rolled edge folds through itself
   * on the web between the grip ring and the flank wedges.
   */
  const MAX_BEVEL_INSET = FAN_FRAME_WIDTH / 6.8;

  function getFanPlate(length: number, depth: number): BufferGeometry {
    const key = `${length}:${depth}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      buildFanShape(length),
      depth,
      length * MAX_BEVEL_INSET
    );
    plates.set(key, plate);
    return plate;
  }
</script>

<script lang="ts">
  /**
   * Fan3D Component
   *
   * A flow fan: a grip ring at the hand, four spokes running out from it, and a
   * rim closing the outside — the exact silhouette of the 2D fan, extruded into
   * a bullnose plate. The outline and all five holes are transcribed from the
   * prop's SVG in `fan-profile.ts`, so the 3D prop and the pictograph prop are
   * the same shape by construction.
   *
   * Not a folding fan. There is no fabric, no pleats, and no handle below the
   * pivot; the artwork draws none of those, and the hand goes through the ring.
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
   * Flat spinning props are plate stock, not tube. The fan's frame runs about
   * 3.2cm across at default size, so the plate sits a little under 2cm — thick
   * enough to hold a rolled edge and to read edge-on, thin enough that a tilted
   * spoke still shows mostly face rather than rim.
   */
  const plateDepth = $derived(baseRadius * 1.4);

  const plate = $derived(getFanPlate(effectiveLength, plateDepth));
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
