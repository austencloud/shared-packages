/**
 * Flat-prop finish
 *
 * Every plate prop wears the same finish, so they read as one family of objects
 * cut from the same stock. Shared and cached per colour: the meshes differ, the
 * material does not.
 */

import {
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

export interface PlateMaterialSet {
  /** The two flat faces (extrusion group 0). */
  readonly face: MeshPhysicalMaterial;
  /** The rolled rim (extrusion group 1). */
  readonly edge: MeshStandardMaterial;
  /** Path-visualization marker at the prop's position. */
  readonly trail: MeshBasicMaterial;
}

const PALETTES = {
  blue: { main: "#3b82f6", dark: "#1d4ed8" },
  red: { main: "#ef4444", dark: "#b91c1c" },
} as const;

const materialSets = new Map<"blue" | "red", PlateMaterialSet>();

export function getPlateMaterials(color: "blue" | "red"): PlateMaterialSet {
  const cached = materialSets.get(color);
  if (cached) return cached;

  const palette = PALETTES[color];
  const materials: PlateMaterialSet = {
    // Faces read as polished anodized plate: a clearcoat lobe on top of the
    // base specular keeps a crisp highlight travelling across the prop as it
    // turns, which is what sells the shape in motion.
    //
    // Metalness stays low on purpose. A metal's diffuse response is black — it
    // can only show what the environment reflects — and these scenes run dark
    // with few lights, so a metallic plate goes muddy while the staffs beside
    // it stay saturated. Keep the base dielectric like Staff3D and let the
    // clearcoat carry the shine.
    face: new MeshPhysicalMaterial({
      color: palette.main,
      roughness: 0.26,
      metalness: 0.12,
      clearcoat: 0.7,
      clearcoatRoughness: 0.16,
    }),
    // The rim tells the eye this is solid plate rather than a sticker, so it
    // sits clearly below the face — but only part way to the palette's dark
    // endpoint. On a ribbon this narrow the rim covers a lot of the silhouette
    // whenever the plate tilts, and the full dark red turns the whole prop
    // murky while the same treatment in blue barely shows. Meeting the face 60%
    // of the way down keeps both colours reading as themselves.
    edge: new MeshStandardMaterial({
      color: new Color(palette.main).lerp(new Color(palette.dark), 0.6),
      roughness: 0.42,
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

/** Shared marker geometry for the trail indicator. */
export const PLATE_TRAIL_GEOMETRY = new SphereGeometry(0.015, 8, 8);
