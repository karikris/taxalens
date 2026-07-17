import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
  geographicScopeAncestors,
  geographicScopeHash,
  geographicScopeStateFromHash,
  useGeographicScopeState,
} from './geographicScope'

describe('geographic scope state', () => {
  beforeEach(() => window.history.replaceState(null, '', '/#dashboard'))

  it('indexes only the committed hierarchy levels that are available', () => {
    expect(TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.global).toHaveLength(1)
    expect(TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.continent).toHaveLength(7)
    expect(TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country).toHaveLength(175)
    expect(TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.admin1).toHaveLength(0)
  })

  it('decodes exact hierarchy identities and fails closed to Global', () => {
    expect(geographicScopeStateFromHash('#dashboard').selected.scope_id).toBe('global')
    expect(
      geographicScopeStateFromHash('#dashboard?geo=continent%3Aasia').selected.scope_name,
    ).toBe('Asia')
    expect(
      geographicScopeStateFromHash('#dashboard?geo=country%3AIN').selected.scope_name,
    ).toBe('India')

    const invalid = geographicScopeStateFromHash('#dashboard?geo=country%3AXX')
    expect(invalid.selected.scope_id).toBe('global')
    expect(invalid.urlError).toMatch(/not present in the verified hierarchy/u)

    const repeated = geographicScopeStateFromHash('#dashboard?geo=global&geo=country%3AIN')
    expect(repeated.selected.scope_id).toBe('global')
    expect(repeated.urlError).toMatch(/repeated/u)
  })

  it('creates canonical dashboard hashes and preserves unrelated query state', () => {
    expect(geographicScopeHash('country:IN')).toBe('#dashboard?geo=country%3AIN')
    expect(geographicScopeHash('global', '#dashboard?geo=country%3AIN&metric=records'))
      .toBe('#dashboard?metric=records')
  })

  it('returns the complete verified scope ancestry', () => {
    expect(geographicScopeAncestors('country:IN').map(({ scope_name }) => scope_name))
      .toEqual(['Global', 'Asia', 'India'])
  })

  it('pushes semantic scope changes and restores state from hash history events', () => {
    const { result } = renderHook(() => useGeographicScopeState())
    expect(result.current.selected.scope_id).toBe('global')

    act(() => result.current.selectScope('country:IN'))
    expect(window.location.hash).toBe('#dashboard?geo=country%3AIN')
    expect(result.current.selected.scope_name).toBe('India')

    act(() => {
      window.history.replaceState(null, '', '/#dashboard?geo=continent%3Aasia')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current.selected.scope_name).toBe('Asia')
  })
})
