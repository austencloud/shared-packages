import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  ELEMENT_ICON_FILES,
  ELEMENT_NAMES,
  ELEMENT_RELATIONSHIPS,
  elementCode,
  elementForRelationship,
} from './index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('@austencloud/tka-elements', () => {
  it('ships a non-empty WebP for every element', () => {
    for (const name of ELEMENT_NAMES) {
      const file = join(root, ELEMENT_ICON_FILES[name])
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(1000)
    }
  })

  it('maps every timing/direction pair to exactly one element', () => {
    const codes = ELEMENT_NAMES.map(elementCode)
    expect(new Set(codes).size).toBe(6)
    expect([...codes].sort()).toEqual(['QO', 'QS', 'SO', 'SS', 'TO', 'TS'])
    for (const name of ELEMENT_NAMES) {
      expect(elementForRelationship(ELEMENT_RELATIONSHIPS[name])).toBe(name)
    }
  })
})
