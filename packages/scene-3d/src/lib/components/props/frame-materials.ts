/**
 * Assembled-prop finish
 *
 * Props that are built rather than cut — a hub with spines and wicks, a torch —
 * are made of several real materials at once, and the finish has to say which
 * is which: kevlar reads dry and matte, a steel spine reads hard and bright, a
 * printed hub reads soft and matte, a glow head reads lit from inside.
 *
 * Two builds of the same prop, matching what people actually own:
 *
 *   fire  — steel frame, bare spines, unburnt kevlar wicks, a chrome finger
 *           ring. Colour lives on the spines, which is the only part long
 *           enough to tell blue from red across a dark stage.
 *   day   — a printed hub with a fat finger ring, textured grip tube, and
 *           translucent heads. The heads glow in the prop's colour, because an
 *           LED practice prop does exactly that and it doubles as identity.
 *
 * Metalness stays low on the big coloured parts for the same reason as
 * `plate-materials.ts`: a metal's diffuse response is black, so in these dark
 * scenes a metallic body goes muddy while the staffs beside it stay saturated.
 * Real metal is reserved for the small steel bits, where it belongs.
 */

import {
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

export type FrameVariant = "fire" | "day";

export interface FrameMaterialSet {
  /** The long rod between hub and tip. Carries the prop's colour. */
  readonly spine: MeshPhysicalMaterial;
  /** The centre piece the spines run out of. */
  readonly hub: MeshStandardMaterial;
  /** The finger ring. */
  readonly ring: MeshStandardMaterial;
  /** Short sleeves where a spine enters the hub or the tip. */
  readonly collar: MeshStandardMaterial;
  /** The business end: kevlar wick, or translucent glow head. */
  readonly tip: MeshStandardMaterial;
  /** Path-visualization marker at the prop's position. */
  readonly trail: MeshBasicMaterial;
}

const PALETTES = {
  blue: { main: "#3b82f6", dark: "#1d4ed8" },
  red: { main: "#ef4444", dark: "#b91c1c" },
} as const;

/**
 * Unburnt kevlar, a pale sand — not the black of a used wick. Measured off the
 * wick in `torch.svg`, which is the one piece of prop artwork that draws the
 * material in colour rather than as a pictograph silhouette.
 */
const KEVLAR = "#f6e5b6";
/** Polished spine steel. */
const STEEL = "#c8ced8";
/** The near-black of a moulded sleeve. */
const SLEEVE = "#26262a";

const materialSets = new Map<string, FrameMaterialSet>();

export function getFrameMaterials(
  color: "blue" | "red",
  variant: FrameVariant
): FrameMaterialSet {
  const key = `${color}:${variant}`;
  const cached = materialSets.get(key);
  if (cached) return cached;

  const palette = PALETTES[color];
  const fire = variant === "fire";

  const materials: FrameMaterialSet = {
    spine: new MeshPhysicalMaterial({
      color: palette.main,
      // A bare fire spine is hard and bright; a day grip is wrapped in
      // textured tube, which kills the highlight almost completely.
      roughness: fire ? 0.24 : 0.62,
      metalness: fire ? 0.18 : 0.04,
      clearcoat: fire ? 0.8 : 0,
      clearcoatRoughness: 0.14,
    }),
    hub: new MeshStandardMaterial({
      color: fire ? STEEL : palette.dark,
      roughness: fire ? 0.28 : 0.58,
      metalness: fire ? 0.62 : 0.05,
    }),
    ring: new MeshStandardMaterial({
      color: fire ? STEEL : palette.dark,
      roughness: fire ? 0.2 : 0.58,
      metalness: fire ? 0.7 : 0.05,
    }),
    collar: new MeshStandardMaterial({
      color: SLEEVE,
      roughness: 0.78,
      metalness: 0.05,
    }),
    tip: fire
      ? new MeshStandardMaterial({
          color: KEVLAR,
          roughness: 0.95,
          metalness: 0,
        })
      : new MeshStandardMaterial({
          color: "#f7f7fa",
          roughness: 0.46,
          metalness: 0,
          emissive: new Color(palette.main),
          emissiveIntensity: 0.55,
        }),
    trail: new MeshBasicMaterial({
      color: palette.main,
      opacity: 0.3,
      transparent: true,
    }),
  };

  materialSets.set(key, materials);
  return materials;
}

export interface TorchMaterialSet {
  /** The knob at the butt, and the two white ferrules. Chrome hardware. */
  readonly hardware: MeshStandardMaterial;
  /** The wrapped handle. */
  readonly grip: MeshStandardMaterial;
  /**
   * The flare cone. Carries the prop's colour, because that cone is the part
   * every manufacturer sells in a colour — red, blue, gold, green, silver.
   */
  readonly flare: MeshPhysicalMaterial;
  /** The thin rod between the flare and the wick. Real chrome, and small. */
  readonly shaft: MeshStandardMaterial;
  /** Kevlar. */
  readonly wick: MeshStandardMaterial;
  /** Path-visualization marker at the prop's position. */
  readonly trail: MeshBasicMaterial;
}

const torchSets = new Map<string, TorchMaterialSet>();

/**
 * A torch is one build, not two: the fire and practice versions of this prop
 * are the same object with a different wick, so there is no `variant` here.
 */
export function getTorchMaterials(color: "blue" | "red"): TorchMaterialSet {
  const cached = torchSets.get(color);
  if (cached) return cached;

  const palette = PALETTES[color];

  const materials: TorchMaterialSet = {
    hardware: new MeshStandardMaterial({
      color: "#e6e8ec",
      roughness: 0.3,
      metalness: 0.45,
    }),
    grip: new MeshStandardMaterial({
      color: "#231f20",
      // Grip tape and knurling: no highlight at all, or it reads as plastic.
      roughness: 0.86,
      metalness: 0.03,
    }),
    flare: new MeshPhysicalMaterial({
      color: palette.main,
      // The real cone is anodized or moulded acrylic under a gloss coat, and
      // the clearcoat is what separates it from the matte grip below it.
      roughness: 0.26,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    }),
    shaft: new MeshStandardMaterial({
      color: "#b9bec6",
      roughness: 0.22,
      metalness: 0.72,
    }),
    wick: new MeshStandardMaterial({
      color: KEVLAR,
      roughness: 0.95,
      metalness: 0,
    }),
    trail: new MeshBasicMaterial({
      color: palette.main,
      opacity: 0.3,
      transparent: true,
    }),
  };

  torchSets.set(color, materials);
  return materials;
}

export interface ClubMaterialSet {
  /** The rubber cap at the butt. Matte, and darker than the marker ring. */
  readonly knob: MeshStandardMaterial;
  /** The thin straight grip between knob and body. */
  readonly handle: MeshStandardMaterial;
  /** The ring at the handle/body corner every club sold wears. */
  readonly marker: MeshStandardMaterial;
  /**
   * The barrel. Carries the prop's colour, because it is the only part big
   * enough to tell blue from red across a dark stage — and because on a real
   * club the body is the part that comes in a colour at all.
   */
  readonly body: MeshPhysicalMaterial;
  /** Path-visualization marker at the prop's position. */
  readonly trail: MeshBasicMaterial;
}

const clubSets = new Map<string, ClubMaterialSet>();

/**
 * A club is one turned body whose colour changes along its length, so unlike
 * the frame props there is no `variant` here: every build people own — moulded,
 * LED, practice — shares this material split and differs only in the body.
 */
export function getClubMaterials(color: "blue" | "red"): ClubMaterialSet {
  const cached = clubSets.get(color);
  if (cached) return cached;

  const palette = PALETTES[color];

  const materials: ClubMaterialSet = {
    knob: new MeshStandardMaterial({
      color: "#1b1b1e",
      // Moulded rubber, so it keeps a little sheen the tape ring does not.
      roughness: 0.72,
      metalness: 0.02,
    }),
    handle: new MeshStandardMaterial({
      color: "#eceef1",
      roughness: 0.55,
      metalness: 0.02,
    }),
    marker: new MeshStandardMaterial({
      color: "#141416",
      // Vinyl tape: flatter than the knob, and it should read as a decal.
      roughness: 0.88,
      metalness: 0.02,
    }),
    body: new MeshPhysicalMaterial({
      color: palette.main,
      // Blow-moulded polyethylene under a gloss skin. Same reasoning as the
      // torch's flare: the clearcoat is what separates it from the matte
      // handle it sits against.
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    }),
    trail: new MeshBasicMaterial({
      color: palette.main,
      opacity: 0.3,
      transparent: true,
    }),
  };

  clubSets.set(color, materials);
  return materials;
}
