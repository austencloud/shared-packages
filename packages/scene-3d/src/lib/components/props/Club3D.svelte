<script module lang="ts">
  import type { BufferGeometry } from "three";
  import { revolvedProfile } from "./prop-lathe";
  import { CLUB_BANDS, type ClubBand } from "./club-profile";
  import { getClubMaterials, type ClubMaterialSet } from "./frame-materials";
  import { PLATE_TRAIL_GEOMETRY } from "./plate-materials";

  interface ClubPart {
    readonly id: ClubBand["id"];
    readonly geometry: BufferGeometry;
  }

  const builds = new Map<number, ClubPart[]>();

  function getClubParts(scale: number): ClubPart[] {
    const cached = builds.get(scale);
    if (cached) return cached;

    const parts = CLUB_BANDS.map((band) => ({
      id: band.id,
      geometry: revolvedProfile(
        band.stops.map((stop) => ({
          at: stop.at * scale,
          radius: stop.radius * scale,
        })),
        // The body is the widest thing on any prop in the scene, so it needs
        // more sides than the torch's shaft did before the facets show.
        32
      ),
    }));
    builds.set(scale, parts);
    return parts;
  }

  function materialFor(
    id: ClubBand["id"],
    materials: ClubMaterialSet
  ): ClubMaterialSet[keyof ClubMaterialSet] {
    switch (id) {
      case "knob":
        return materials.knob;
      case "handle":
        return materials.handle;
      case "marker":
        return materials.marker;
      case "cap":
        // Same EVA as the knob, which is what a club's cap is.
        return materials.knob;
      default:
        return materials.body;
    }
  }
</script>

<script lang="ts">
  /**
   * Club3D Component
   *
   * A real juggling club. Butt to tip: a semi-round EVA knob, a taped handle, the
   * dark band at the shoulder, the body, and a broad domed cap.
   *
   * The silhouette comes from `club.svg`, rescaled to real dimensions — 52cm
   * overall, 22cm of handle, 30cm of body, 8cm at the widest, 56% up the body.
   * `club-profile.ts` carries the numbers, where each one came from, and the two
   * earlier attempts that got it wrong (one too short, one shaped like a
   * balloon).
   *
   * Because a club is a standardized object, its size is absolute — it does not
   * scale with the user's staff length the way Staff3D does. `scale` still
   * applies, for callers that render the prop smaller than life.
   *
   * The hand sits just above the knob, where the pinky goes, so the knob is the
   * only band that hangs below the origin.
   *
   * Colour is on the body alone. The old component tinted the whole club, which
   * no real club is. The invented white grip torus is gone with it — the
   * shoulder band is a material band on the turned surface, not a separate piece
   * of geometry sitting proud of it.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { LAYER_WORLD, LAYER_PLAYER_BODY } from "../../layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const parts = $derived(getClubParts(scale));
  const materials = $derived(getClubMaterials(color));

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
