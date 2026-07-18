import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
  geographicScopeAncestors,
  geographicScopeHash,
  geographicScopeStateFromHash,
  useGeographicScopeState,
} from './geographicScope'

const TEST_COUNTRY = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country[0]!
const TEST_CONTINENT = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(TEST_COUNTRY.parent_scope_id!)!
const TEST_COUNTRY_HASH = `#dashboard?geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`
const TEST_CONTINENT_HASH = `#dashboard?geo=${encodeURIComponent(TEST_CONTINENT.scope_id)}`

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
      geographicScopeStateFromHash(TEST_CONTINENT_HASH).selected.scope_name,
    ).toBe(TEST_CONTINENT.scope_name)
    expect(
      geographicScopeStateFromHash(TEST_COUNTRY_HASH).selected.scope_name,
    ).toBe(TEST_COUNTRY.scope_name)

    const invalid = geographicScopeStateFromHash('#dashboard?geo=country%3AXX')
    expect(invalid.selected.scope_id).toBe('global')
    expect(invalid.urlError).toMatch(/not present in the verified hierarchy/u)

    const repeated = geographicScopeStateFromHash(`#dashboard?geo=global&geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`)
    expect(repeated.selected.scope_id).toBe('global')
    expect(repeated.urlError).toMatch(/repeated/u)
  })

  it('creates canonical dashboard hashes and preserves unrelated query state', () => {
    expect(geographicScopeHash(TEST_COUNTRY.scope_id)).toBe(TEST_COUNTRY_HASH)
    expect(geographicScopeHash('global', `${TEST_COUNTRY_HASH}&metric=records`))
      .toBe('#dashboard?metric=records')
  })

  it('returns the complete verified scope ancestry', () => {
    expect(geographicScopeAncestors(TEST_COUNTRY.scope_id).map(({ scope_name }) => scope_name))
      .toEqual(['Global', TEST_CONTINENT.scope_name, TEST_COUNTRY.scope_name])
  })

  it('pushes semantic scope changes and restores state from hash history events', () => {
    const { result } = renderHook(() => useGeographicScopeState())
    expect(result.current.selected.scope_id).toBe('global')

    act(() => result.current.selectScope(TEST_COUNTRY.scope_id))
    expect(window.location.hash).toBe(TEST_COUNTRY_HASH)
    expect(result.current.selected.scope_name).toBe(TEST_COUNTRY.scope_name)

    act(() => {
      window.history.replaceState(null, '', `/${TEST_CONTINENT_HASH}`)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current.selected.scope_name).toBe(TEST_CONTINENT.scope_name)
  })

  it('drills from Global to continent and country, then resets without losing query state', () => {
    window.history.replaceState(
      null,
      '',
      '/#dashboard?metric=candidate_only_cells',
    )
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useGeographicScopeState())

    act(() => result.current.selectScope(TEST_CONTINENT.scope_id))
    expect(result.current.selected.scope_name).toBe(TEST_CONTINENT.scope_name)
    expect(window.location.hash).toBe(
      `#dashboard?metric=candidate_only_cells&geo=${encodeURIComponent(TEST_CONTINENT.scope_id)}`,
    )

    act(() => result.current.selectScope(TEST_COUNTRY.scope_id))
    expect(result.current.selected.scope_name).toBe(TEST_COUNTRY.scope_name)
    expect(
      geographicScopeAncestors(result.current.selected.scope_id).map(
        ({ scope_id }) => scope_id,
      ),
    ).toEqual(['global', TEST_CONTINENT.scope_id, TEST_COUNTRY.scope_id])
    expect(window.location.hash).toBe(
      `#dashboard?metric=candidate_only_cells&geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`,
    )

    const historyEntriesAfterCountry = pushState.mock.calls.length
    act(() => result.current.selectScope(TEST_COUNTRY.scope_id))
    expect(pushState).toHaveBeenCalledTimes(historyEntriesAfterCountry)

    act(() => result.current.selectScope('global'))
    expect(result.current.selected.scope_name).toBe('Global')
    expect(window.location.hash).toBe('#dashboard?metric=candidate_only_cells')
    expect(pushState).toHaveBeenCalledTimes(historyEntriesAfterCountry + 1)
  })

  it('rejects unknown selection identities before changing the URL', () => {
    const initialHash = window.location.hash

    expect(() => geographicScopeHash('country:XX', initialHash)).toThrow(
      'Unknown geographic scope: country:XX',
    )
    expect(window.location.hash).toBe(initialHash)
  })
})
