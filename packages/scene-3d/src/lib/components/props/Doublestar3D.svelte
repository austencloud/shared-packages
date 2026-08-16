<script module lang="ts">
  import {
    BoxGeometry,
    type BufferGeometry,
    Color,
    ExtrudeGeometry,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    SphereGeometry,
  } from "three";
  import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
  import {
    buildDoublestarShape,
    DOUBLESTAR_WAIST_HALF_WIDTH,
  } from "./doublestar-profile";

  interface DoublestarGeometrySet {
    plate: BufferGeometry;
    gripBand: BoxGeometry;
  }

  interface DoublestarMaterialSet {
    face: MeshPhysicalMaterial;
    edge: MeshStandardMaterial;
    grip: MeshStandardMaterial;
    trail: MeshBasicMaterial;
  }

  const geometrySets = new Map<string, DoublestarGeometrySet>();
  const materialSets = new Map<"blue" | "red", DoublestarMaterialSet>();

  /**
   * The extruded plate carries a bullnose edge: a shallow straight section with
   * a generous rounded bevel on each face, so the rim reads as a turned edge
   * catching light rather than a laser-cut card.
   */
  const STRAIGHT_FRACTION = 0.16;
  const BEVEL_FRACTION = 0.42;

  /**
   * Ceiling on how far the bevel may eat into the silhouette, normalized to
   * length. Roughly a third of the waist bar's half-width — past that the
   * rolled edge self-intersects at the prop's narrowest features.
   */
  const MAX_BEVEL_INSET = 0.008;

  /** Half the grip band's extent along the prop, normalized to length. */
  const GRIP_BAND_HALF_HEIGHT = 0.028;

  function getDoublestarGeometrySet(
    length: number,
    depth: number
  ): DoublestarGeometrySet {
    const key = `${length}:${depth}`;
    const cached = geometrySets.get(key);
    if (cached) return cached;

    // Bevel thickness runs along z, where there is nothing to collide with.
    // Bevel SIZE eats inward across the silhouette, and this outline has narrow
    // features — the waist bar and the holes' concave notches — where an inset
    // larger than the local half-width folds the wall through itself and
    // scribbles stray edges across the face. Clamp it to what the waist can
    // take; the bullnose ends up slightly flatter in plane than in depth, which
    // reads as a rolled edge rather than a defect.
    const bevel = depth * BEVEL_FRACTION;
    const extruded = new ExtrudeGeometry(buildDoublestarShape(length), {
      depth: depth * STRAIGHT_FRACTION,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: Math.min(bevel, length * MAX_BEVEL_INSET),
      bevelOffset: 0,
      bevelSegments: 5,
      curveSegments: 12,
    });
    // Extrusion runs from z = -bevel to z = depth + bevel, so its middle sits
    // at depth/2. Recentre it: the plate has to spin around its own plane.
    extruded.translate(0, 0, -(depth * STRAIGHT_FRACTION) / 2);

    // ExtrudeGeometry is unindexed, so its normals come out per-triangle and
    // the bullnose rim shades as a stack of facets. Weld the seams and derive
    // normals across them — the whole profile is tangent-continuous, so a
    // single smooth shell is the honest surface. Groups survive the weld
    // (triangle order is untouched), which is what keeps face and rim on
    // separate materials.
    extruded.deleteAttribute("normal");
    extruded.deleteAttribute("uv");
    const plate = mergeVertices(extruded);
    plate.computeVertexNormals();
    extruded.dispose();

    const bandWidth = length * DOUBLESTAR_WAIST_HALF_WIDTH * 2.24;
    const geometry = {
      plate,
      gripBand: new BoxGeometry(
        bandWidth,
        length * GRIP_BAND_HALF_HEIGHT * 2,
        depth * 1.2
      ),
    };
    geometrySets.set(key, geometry);
    return geometry;
  }

  function getDoublestarMaterialSet(
    color: "blue" | "red"
  ): DoublestarMaterialSet {
    const cached = materialSets.get(color);
    if (cached) return cached;

    const palette =
      color === "blue"
        ? { main: "#3b82f6", dark: "#1d4ed8" }
        : { main: "#ef4444", dark: "#b91c1c" };
    const materials = {
      // Faces read as polished anodized plate: a clearcoat lobe on top of the
      // base specular keeps a crisp highlight travelling across the star as it
      // turns, which is what sells the shape in motion.
      //
      // Metalness stays low on purpose. A metal's diffuse response is black —
      // it can only show what the environment reflects — and these scenes run
      // dark with few lights, so a metallic plate goes muddy while the staffs
      // beside it stay saturated. Keep the base dielectric like Staff3D and let
      // the clearcoat carry the shine.
      face: new MeshPhysicalMaterial({
        color: palette.main,
        roughness: 0.26,
        metalness: 0.12,
        clearcoat: 0.7,
        clearcoatRoughness: 0.16,
      }),
      // The rim tells the eye this is solid plate rather than a sticker, so it
      // sits clearly below the face — but only part way to the palette's dark
      // endpoint. On arms this narrow the rim covers a lot of the silhouette
      // whenever the plate tilts, and the full dark red turns the whole prop
      // murky while the same treatment in blue barely shows. Meeting the face
      // 60% of the way down keeps both colours reading as themselves.
      edge: new MeshStandardMaterial({
        color: new Color(palette.main).lerp(new Color(palette.dark), 0.6),
        roughness: 0.42,
        metalness: 0.1,
      }),
      grip: new MeshStandardMaterial({
        color: "white",
        roughness: 0.4,
        metalness: 0.1,
      }),
      trail: new MeshBasicMaterial({
        color: palette.main,
        opacity: 0.3,
        transparent: true,
      }),
    };
    materialSets.set(color, materials);
    return materials;
  }

  const trailGeometry = new SphereGeometry(0.015, 8, 8);
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

  const geometry = $derived(
    getDoublestarGeometrySet(effectiveLength, plateDepth)
  );
  const materials = $derived(getDoublestarMaterialSet(color));

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
      this flat, so the doublestar wears its grip as a band wrapped around the
      central bar, proud of the plate on all four sides.
    -->
    <T.Mesh
      geometry={geometry.gripBand}
      material={materials.grip}
      dispose={false}
    />
  </T.Group>

  <!-- Trail indicator (small sphere at prop position for path visualization) -->
  <T.Mesh
    geometry={trailGeometry}
    material={materials.trail}
    layers={propLayer}
    dispose={false}
  />
{/if}
