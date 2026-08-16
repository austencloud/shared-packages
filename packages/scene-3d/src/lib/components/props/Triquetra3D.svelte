<script module lang="ts">
  import {
    type BufferGeometry,
    Color,
    ExtrudeGeometry,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    type Shape,
    SphereGeometry,
  } from "three";
  import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
  import {
    buildTriquetraGripShape,
    buildTriquetraShape,
    buildTriquetraShapes,
    triquetraGripMaxBevel,
    TRIQUETRA2_GRIP,
    TRIQUETRA2_GRIP_OFFSET,
    TRIQUETRA_GRIP,
    TRIQUETRA_RIBBON_WIDTH,
  } from "./triquetra-profile";

  type TriquetraVariant = "triquetra" | "triquetra2";

  interface TriquetraGeometrySet {
    plate: BufferGeometry;
    gripBand: BufferGeometry;
  }

  interface TriquetraMaterialSet {
    face: MeshPhysicalMaterial;
    edge: MeshStandardMaterial;
    grip: MeshStandardMaterial;
    gripEdge: MeshStandardMaterial;
    trail: MeshBasicMaterial;
  }

  const geometrySets = new Map<string, TriquetraGeometrySet>();
  const materialSets = new Map<"blue" | "red", TriquetraMaterialSet>();

  /**
   * The extruded plate carries a bullnose edge: a shallow straight section with
   * a generous rounded bevel on each face, so the rim reads as a turned edge
   * catching light rather than a laser-cut card.
   */
  const STRAIGHT_FRACTION = 0.16;
  const BEVEL_FRACTION = 0.42;

  /**
   * Ceiling on how far the bevel may eat into the silhouette. Bevel thickness
   * runs along z, where there is nothing to collide with; bevel SIZE insets
   * across the plane, and an inset past roughly a third of the ribbon's
   * half-width folds the wall through itself where the lobes cross and
   * scribbles stray edges over the faces.
   */
  const MAX_BEVEL_INSET = TRIQUETRA_RIBBON_WIDTH / 6.8;

  /**
   * Extrude a shape into a bullnose plate: a shallow straight section with a
   * generous rounded bevel on each face, welded into one smooth shell.
   *
   * ExtrudeGeometry is unindexed, so its normals come out per-triangle and the
   * bullnose rim shades as a stack of facets. Welding the seams and deriving
   * normals across them gives the honest surface, since the whole profile is
   * tangent-continuous. Groups survive the weld (triangle order is untouched),
   * which is what keeps face and rim on separate materials.
   */
  function bullnose(
    shape: Shape | Shape[],
    depth: number,
    maxInset: number
  ): BufferGeometry {
    const bevel = depth * BEVEL_FRACTION;
    const extruded = new ExtrudeGeometry(shape, {
      depth: depth * STRAIGHT_FRACTION,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: Math.min(bevel, maxInset),
      bevelOffset: 0,
      bevelSegments: 5,
      curveSegments: 14,
    });
    // Extrusion runs from z = -bevel to z = depth + bevel, so its middle sits
    // at depth/2. Recentre it: the plate has to spin around its own plane.
    extruded.translate(0, 0, -(depth * STRAIGHT_FRACTION) / 2);
    extruded.deleteAttribute("normal");
    extruded.deleteAttribute("uv");
    const welded = mergeVertices(extruded);
    welded.computeVertexNormals();
    extruded.dispose();
    return welded;
  }

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
      plate: bullnose(
        single
          ? buildTriquetraShape(length, TRIQUETRA2_GRIP_OFFSET)
          : buildTriquetraShapes(length),
        depth,
        length * MAX_BEVEL_INSET
      ),
      // The band stands proud of the plate on both faces, so it reads as
      // something added to the prop rather than printed on it.
      gripBand: bullnose(
        buildTriquetraGripShape(length, grip),
        depth * 1.3,
        length * triquetraGripMaxBevel(grip)
      ),
    };
    geometrySets.set(key, geometry);
    return geometry;
  }

  function getTriquetraMaterialSet(color: "blue" | "red"): TriquetraMaterialSet {
    const cached = materialSets.get(color);
    if (cached) return cached;

    const palette =
      color === "blue"
        ? { main: "#3b82f6", dark: "#1d4ed8" }
        : { main: "#ef4444", dark: "#b91c1c" };
    const materials = {
      // Faces read as polished anodized plate: a clearcoat lobe on top of the
      // base specular keeps a crisp highlight travelling around the knot as it
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
      // endpoint. On a ribbon this narrow the rim covers a lot of the
      // silhouette whenever the plate tilts, and the full dark red turns the
      // whole prop murky while the same treatment in blue barely shows. Meeting
      // the face 60% of the way down keeps both colours reading as themselves.
      edge: new MeshStandardMaterial({
        color: new Color(palette.main).lerp(new Color(palette.dark), 0.6),
        roughness: 0.42,
        metalness: 0.1,
      }),
      // Grip tape, not chrome: matte enough that it never competes with the
      // plate's highlight, with the rolled edge a shade down so the wrap has a
      // readable thickness of its own against the white face.
      grip: new MeshStandardMaterial({
        color: "#f2f4f8",
        roughness: 0.55,
        metalness: 0.04,
      }),
      gripEdge: new MeshStandardMaterial({
        color: "#c3c9d6",
        roughness: 0.6,
        metalness: 0.04,
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
  const materials = $derived(getTriquetraMaterialSet(color));

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
    geometry={trailGeometry}
    material={materials.trail}
    layers={propLayer}
    dispose={false}
  />
{/if}
