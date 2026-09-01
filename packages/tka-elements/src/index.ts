/**
 * The Kinetic Alphabet elemental icons.
 *
 * Artwork by Austen Cloud (https://tkaflowarts.com), licensed CC BY 4.0
 * (see LICENSE-ARTWORK). These are the exact files TKA renders on its
 * pictographs; consumers get updates by bumping this package.
 *
 * Image files live at `@austencloud/tka-elements/icons/<element>.webp` and are
 * meant to be imported through a bundler (Vite, webpack, etc.) so they resolve
 * to hashed asset URLs:
 *
 *   import airIconUrl from '@austencloud/tka-elements/icons/air.webp'
 */

export const ELEMENT_NAMES = ['earth', 'water', 'air', 'fire', 'sun', 'moon'] as const

export type ElementName = (typeof ELEMENT_NAMES)[number]

/** Timing: Together / Split / Quarter. Direction: Same / Opposite. */
export type ElementTiming = 'T' | 'S' | 'Q'
export type ElementDirection = 'S' | 'O'

export interface ElementRelationship {
  timing: ElementTiming
  direction: ElementDirection
}

/**
 * The timing-and-direction relationship each element stands for, as used on
 * TKA pictographs. Earth/Water/Air/Fire are the folk-community elemental
 * labels for VTG categories; Sun and Moon extend the model to quarter timing.
 */
export const ELEMENT_RELATIONSHIPS: Readonly<Record<ElementName, ElementRelationship>> = {
  earth: { timing: 'T', direction: 'S' },
  air: { timing: 'T', direction: 'O' },
  water: { timing: 'S', direction: 'S' },
  fire: { timing: 'S', direction: 'O' },
  sun: { timing: 'Q', direction: 'S' },
  moon: { timing: 'Q', direction: 'O' },
}

/** Two-letter code as written on pictographs, e.g. `TS` for Earth. */
export const elementCode = (element: ElementName): `${ElementTiming}${ElementDirection}` => {
  const { timing, direction } = ELEMENT_RELATIONSHIPS[element]
  return `${timing}${direction}`
}

/** Inverse lookup: which element visualizes a timing-and-direction pair. */
export const elementForRelationship = (relationship: ElementRelationship): ElementName => {
  const match = ELEMENT_NAMES.find((name) => {
    const candidate = ELEMENT_RELATIONSHIPS[name]
    return candidate.timing === relationship.timing && candidate.direction === relationship.direction
  })
  // Every timing/direction pair has an element by construction (3 x 2 = 6).
  return match ?? 'earth'
}

/** Display label, capitalized. */
export const elementLabel = (element: ElementName): string =>
  element.charAt(0).toUpperCase() + element.slice(1)

/** Package-relative path of each icon, for tooling that resolves files itself. */
export const ELEMENT_ICON_FILES: Readonly<Record<ElementName, `icons/${ElementName}.webp`>> = {
  earth: 'icons/earth.webp',
  water: 'icons/water.webp',
  air: 'icons/air.webp',
  fire: 'icons/fire.webp',
  sun: 'icons/sun.webp',
  moon: 'icons/moon.webp',
}

export const ATTRIBUTION = {
  artist: 'Austen Cloud',
  project: 'The Kinetic Alphabet',
  url: 'https://tkaflowarts.com',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const
