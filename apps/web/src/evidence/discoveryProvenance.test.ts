import { describe, expect, it } from 'vitest'

import { parseQueryTier } from './discoveryProvenance'

describe('parseQueryTier', () => {
  it('preserves BioMiner query term type, confidence, and search field semantics', () => {
    expect(parseQueryTier('species_scientific:high:tags')).toEqual({
      rank: 'species_scientific',
      trustTier: 'high',
      searchField: 'tags',
    })
    expect(parseQueryTier('host_plant:broad:text')).toEqual({
      rank: 'host_plant',
      trustTier: 'broad',
      searchField: 'text',
    })
  })

  it('rejects a tier that cannot support all three displayed fields', () => {
    expect(() => parseQueryTier('genus:high')).toThrow('unsupported shape')
    expect(() => parseQueryTier('genus::text')).toThrow('unsupported shape')
  })
})
