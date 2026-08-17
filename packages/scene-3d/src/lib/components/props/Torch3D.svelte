<script module lang="ts">
  import type { BufferGeometry } from "three";
  import { revolvedProfile } from "./prop-lathe";
  import { TORCH_BANDS, type TorchBand } from "./torch-profile";
  import { getTorchMaterials, type TorchMaterialSet } from "./frame-materials";
  import { PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  interface TorchPart {
    readonly id: TorchBand["id"];
    readonly geometry: BufferGeometry;
  }

  const builds = new Map<number, TorchPart[]>();

  function getTorchParts(length: number): TorchPart[] {
    const cached = builds.get(length);
    if (cached) return cached;

    const parts = TORCH_BANDS.map((band) => ({
      id: band.id,
      geometry: revolvedProfile(
        band.stops.map((stop) => ({
          at: stop.at * length,
          radius: stop.radius * length,
        }))
      ),
    }));
    builds.set(length, parts);
    return parts;
  }

  /** Which material each band is made of. */
  function materialFor(
    id: TorchBand["id"],
    materials: TorchMaterialSet
  ): TorchMaterialSet[keyof TorchMaterialSet] {
    switch (id) {
      case "grip":
        return materials.grip;
      case "flare":
        return materials.flare;
      case "shaft":
        return materials.shaft;
      case "wick":
        return materials.wick;
      // The pommel and both ferrules are the same white chrome hardware.
      default:
        return materials.hardware;
    }
  }
</script>

<script lang="ts">
  /**
   * Torch3D Component
   *
   * A fire torch, turned from the profile measured off `torch.svg`. Butt to
   * tip: a chrome knob, a wrapped grip, a white ferrule, the coloured flare
   * cone, a second ferrule, a thin chrome shaft, and a kevlar wick.
   *
   * Every radius comes from the artwork, so this reaches 0.593 of a staff, not
   * the 0.9 the old procedural one guessed at, and the parts sit where the
   * drawing puts them. `torch-profile.ts` carries the numbers and how they were
   * measured.
   *
   * The hand is the artwork's viewBox centre, which lands inside the pommel —
   * where you actually hold one, with the knob under your fist. The pommel is
   * therefore the only part that hangs below the origin.
   *
   * There is no live flame here. That is the `fire` effect's job, and putting a
   * second one on the mesh would fight it.
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
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );

  const parts = $derived(getTorchParts(effectiveLength));
  const materials = $derived(getTorchMaterials(color));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    {#each parts as part (part.id)}
      <T.Mesh
        geometry={part.geometry}
        material={materialFor(part.id, materials)}
        dispose={false}
      />
    {/each}
  </T.Group>

  <!-- Trail indicator (small sphere at prop position for path visualization) -->
  <T.Mesh
    geometry={PLATE_TRAIL_GEOMETRY}
    material={materials.trail}
    layers={propLayer}
    dispose={false}
  />
{/if}
