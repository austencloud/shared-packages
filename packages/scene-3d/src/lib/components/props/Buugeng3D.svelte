<script module lang="ts">
  import type { BufferGeometry } from "three";
  import {
    buildBuugengShape,
    buildTrigengShape,
    GENG_BLADE_WIDTH,
  } from "./geng-profile";
  import { bullnosePlate } from "./plate-extrude";
  import { getPlateMaterials, PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  type GengVariant = "buugeng" | "trigeng";

  const plates = new Map<string, BufferGeometry>();

  /**
   * Ceiling on how far the bevel may eat into the silhouette. The blade runs
   * about 4.6cm across at default size, and an inset past roughly a third of
   * its half-width folds the rolled edge through itself where the arms meet.
   */
  const MAX_BEVEL_INSET = GENG_BLADE_WIDTH / 6.8;

  function getGengPlate(
    length: number,
    depth: number,
    variant: GengVariant
  ): BufferGeometry {
    const key = `${length}:${depth}:${variant}`;
    const cached = plates.get(key);
    if (cached) return cached;

    const plate = bullnosePlate(
      variant === "trigeng"
        ? buildTrigengShape(length)
        : buildBuugengShape(length),
      depth,
      length * MAX_BEVEL_INSET
    );
    plates.set(key, plate);
    return plate;
  }
</script>

<script lang="ts">
  /**
   * Buugeng3D Component
   *
   * The geng family: a flat blade bent into circular arcs. `variant="buugeng"`
   * is the S — two arcs meeting at the hand, reaching in opposite directions.
   * `variant="trigeng"` is the same blade run three ways out of one hub, held
   * at the hub. Both outlines are transcribed from the props' SVGs in
   * `geng-profile.ts`, so the 3D prop and the pictograph prop are the same
   * shape by construction.
   *
   * Extrusion emits two material groups: group 0 is the pair of faces, group 1
   * is the rim, which is how the blade gets a darker turned edge.
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
    variant = "buugeng",
  }: Prop3DProps & { variant?: GengVariant } = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  /**
   * No length ratio here: the profile is normalized to the staff's own span, so
   * the artwork already carries how big a geng is next to a staff — the buugeng
   * reaches a little past one staff length tip to tip.
   */
  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  /**
   * Flat spinning props are plate stock, not tube. The blade runs about 4.6cm
   * across at default size, so it sits a little under 2cm thick — enough to
   * hold a rolled edge and to read edge-on, thin enough that a tilted blade
   * still shows mostly face rather than rim.
   */
  const plateDepth = $derived(baseRadius * 1.4);

  const plate = $derived(getGengPlate(effectiveLength, plateDepth, variant));
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
