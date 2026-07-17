import { useEffect, useState } from 'react'

import { geographicScopeStateFromHash, TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import { geographicMapResolutionForScope } from './publicGeographicImpactMapData'

export const GEOGRAPHIC_RECORD_CELL_QUERY_KEY = 'geo-cell' as const
export const GEOGRAPHIC_RECORD_RESOLUTION_QUERY_KEY = 'geo-resolution' as const
export const GEOGRAPHIC_RECORD_FOCUS_QUERY_KEY = 'geo-focus' as const

export type GeographicRecordFocus = 'lens' | 'table'

export interface GeographicImpactRecordRouteTarget {
  readonly scopeId: string
  readonly spatialCellId: string
  readonly spatialResolution: number
  readonly focus: GeographicRecordFocus
}

export interface GeographicImpactRecordRouteState {
  readonly target: GeographicImpactRecordRouteTarget | null
  readonly error: string | null
}

export function geographicImpactRecordHash(
  target: GeographicImpactRecordRouteTarget,
): string {
  const scope = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(target.scopeId)
  if (scope === undefined) throw new Error(`Unknown record geographic scope: ${target.scopeId}`)
  if (geographicMapResolutionForScope(scope) !== target.spatialResolution) {
    throw new Error('Record geographic link resolution differs from its scope')
  }
  if (!isH3CellId(target.spatialCellId)) {
    throw new Error('Record geographic link cell is not a supported H3 identity')
  }
  const query = new URLSearchParams()
  if (scope.scope_level !== 'global') query.set('geo', scope.scope_id)
  query.set(GEOGRAPHIC_RECORD_CELL_QUERY_KEY, target.spatialCellId)
  query.set(GEOGRAPHIC_RECORD_RESOLUTION_QUERY_KEY, String(target.spatialResolution))
  query.set(GEOGRAPHIC_RECORD_FOCUS_QUERY_KEY, target.focus)
  return `#dashboard?${query.toString()}`
}

export function geographicImpactRecordRouteStateFromHash(
  hash: string,
): GeographicImpactRecordRouteState {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [view = '', rawQuery = ''] = fragment.split('?', 2)
  const query = new URLSearchParams(rawQuery)
  const hasRecordRoute = [
    GEOGRAPHIC_RECORD_CELL_QUERY_KEY,
    GEOGRAPHIC_RECORD_RESOLUTION_QUERY_KEY,
    GEOGRAPHIC_RECORD_FOCUS_QUERY_KEY,
  ].some((key) => query.has(key))
  if (!hasRecordRoute) return Object.freeze({ target: null, error: null })
  if (view !== 'dashboard') {
    return Object.freeze({ target: null, error: 'Record geographic links require the Dashboard.' })
  }
  const cell = singleValue(query, GEOGRAPHIC_RECORD_CELL_QUERY_KEY)
  const resolutionValue = singleValue(query, GEOGRAPHIC_RECORD_RESOLUTION_QUERY_KEY)
  const focusValue = singleValue(query, GEOGRAPHIC_RECORD_FOCUS_QUERY_KEY)
  if (cell === null || resolutionValue === null || focusValue === null) {
    return Object.freeze({ target: null, error: 'Record geographic link parameters are incomplete.' })
  }
  if (!isH3CellId(cell)) {
    return Object.freeze({ target: null, error: 'Record geographic link cell is invalid.' })
  }
  const spatialResolution = Number(resolutionValue)
  if (!Number.isInteger(spatialResolution) || spatialResolution < 0 || spatialResolution > 15) {
    return Object.freeze({ target: null, error: 'Record geographic link resolution is invalid.' })
  }
  if (focusValue !== 'lens' && focusValue !== 'table') {
    return Object.freeze({ target: null, error: 'Record geographic link focus is invalid.' })
  }
  const scopeState = geographicScopeStateFromHash(hash)
  if (scopeState.urlError !== null) {
    return Object.freeze({ target: null, error: scopeState.urlError })
  }
  if (geographicMapResolutionForScope(scopeState.selected) !== spatialResolution) {
    return Object.freeze({
      target: null,
      error: 'Record geographic link resolution is unsupported for the selected scope.',
    })
  }
  return Object.freeze({
    target: Object.freeze({
      scopeId: scopeState.selected.scope_id,
      spatialCellId: cell,
      spatialResolution,
      focus: focusValue,
    }),
    error: null,
  })
}

export function useGeographicImpactRecordRouteState(): GeographicImpactRecordRouteState {
  const [state, setState] = useState(() =>
    geographicImpactRecordRouteStateFromHash(window.location.hash),
  )
  useEffect(() => {
    const synchronize = () => setState(geographicImpactRecordRouteStateFromHash(window.location.hash))
    window.addEventListener('hashchange', synchronize)
    return () => window.removeEventListener('hashchange', synchronize)
  }, [])
  return state
}

export function geographicImpactCellRowId(spatialCellId: string): string {
  if (spatialCellId.trim() === '') throw new Error('Geographic Impact table cell identity is empty')
  return `geographic-impact-cell-${encodeURIComponent(spatialCellId)}`
}

function singleValue(query: URLSearchParams, key: string): string | null {
  const values = query.getAll(key)
  return values.length === 1 && values[0] !== undefined && values[0] !== '' ? values[0] : null
}

function isH3CellId(value: string): boolean {
  return /^[0-9a-f]{15}$/u.test(value)
}
