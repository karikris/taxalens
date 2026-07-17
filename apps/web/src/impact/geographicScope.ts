import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  COUNTRY_HIERARCHY_SCHEMA_VERSION,
  type CountryHierarchyDocument,
  type CountryHierarchyNode,
  type GeographicScopeLevel,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import hierarchyText from '../../../../demo/source/geography/country_hierarchy.json?raw'

export const GEOGRAPHIC_SCOPE_QUERY_KEY = 'geo' as const

export interface GeographicScopeIndex {
  readonly hierarchy: CountryHierarchyDocument
  readonly byId: ReadonlyMap<string, CountryHierarchyNode>
  readonly byLevel: Readonly<Record<GeographicScopeLevel, readonly CountryHierarchyNode[]>>
  readonly childrenByParent: ReadonlyMap<string, readonly CountryHierarchyNode[]>
  readonly root: CountryHierarchyNode
}

export interface GeographicScopeState {
  readonly selected: CountryHierarchyNode
  readonly urlError: string | null
}

export interface GeographicScopeController extends GeographicScopeState {
  readonly index: GeographicScopeIndex
  readonly selectScope: (scopeId: string) => void
}

const hierarchyDocument = JSON.parse(hierarchyText) as CountryHierarchyDocument

export const TAXALENS_GEOGRAPHIC_SCOPE_INDEX = buildGeographicScopeIndex(hierarchyDocument)

export function buildGeographicScopeIndex(
  hierarchy: CountryHierarchyDocument,
): GeographicScopeIndex {
  if (hierarchy.schema_version !== COUNTRY_HIERARCHY_SCHEMA_VERSION) {
    throw new Error(`Unsupported country hierarchy schema: ${hierarchy.schema_version}`)
  }
  const byId = new Map<string, CountryHierarchyNode>()
  const mutableByLevel: Record<GeographicScopeLevel, CountryHierarchyNode[]> = {
    global: [],
    continent: [],
    country: [],
    admin1: [],
  }
  const mutableChildren = new Map<string, CountryHierarchyNode[]>()

  for (const node of hierarchy.nodes) {
    if (byId.has(node.scope_id)) {
      throw new Error(`Duplicate country hierarchy scope: ${node.scope_id}`)
    }
    assertScopeIdentity(node)
    byId.set(node.scope_id, node)
    mutableByLevel[node.scope_level].push(node)
    if (node.parent_scope_id !== null) {
      const siblings = mutableChildren.get(node.parent_scope_id) ?? []
      siblings.push(node)
      mutableChildren.set(node.parent_scope_id, siblings)
    }
  }

  const root = byId.get(hierarchy.root_scope_id)
  if (root === undefined || root.scope_level !== 'global') {
    throw new Error('Country hierarchy root must resolve to the global node')
  }
  for (const node of hierarchy.nodes) {
    if (node.parent_scope_id !== null && !byId.has(node.parent_scope_id)) {
      throw new Error(`Country hierarchy parent is missing: ${node.parent_scope_id}`)
    }
  }

  const byLevel = Object.freeze({
    global: freezeSorted(mutableByLevel.global),
    continent: freezeSorted(mutableByLevel.continent),
    country: freezeSorted(mutableByLevel.country),
    admin1: freezeSorted(mutableByLevel.admin1),
  })
  const childrenByParent = new Map<string, readonly CountryHierarchyNode[]>()
  for (const [parent, children] of mutableChildren) {
    childrenByParent.set(parent, freezeSorted(children))
  }

  return Object.freeze({
    hierarchy,
    byId,
    byLevel,
    childrenByParent,
    root,
  })
}

export function geographicScopeStateFromHash(
  hash: string,
  index: GeographicScopeIndex = TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
): GeographicScopeState {
  const { query } = hashQuery(hash)
  const values = query.getAll(GEOGRAPHIC_SCOPE_QUERY_KEY)
  if (values.length > 1) {
    return Object.freeze({
      selected: index.root,
      urlError: 'The geographic scope parameter is repeated; Global is shown.',
    })
  }
  if (values.length === 0 || values[0] === 'global') {
    return Object.freeze({ selected: index.root, urlError: null })
  }
  const scopeId = values[0]
  const selected = scopeId === undefined ? undefined : index.byId.get(scopeId)
  if (selected === undefined) {
    return Object.freeze({
      selected: index.root,
      urlError: 'The geographic scope is not present in the verified hierarchy; Global is shown.',
    })
  }
  return Object.freeze({ selected, urlError: null })
}

export function geographicScopeHash(
  scopeId: string,
  currentHash = '#dashboard',
  index: GeographicScopeIndex = TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
): string {
  const selected = index.byId.get(scopeId)
  if (selected === undefined) {
    throw new Error(`Unknown geographic scope: ${scopeId}`)
  }
  const { query } = hashQuery(currentHash)
  query.delete(GEOGRAPHIC_SCOPE_QUERY_KEY)
  if (selected.scope_level !== 'global') {
    query.set(GEOGRAPHIC_SCOPE_QUERY_KEY, selected.scope_id)
  }
  const suffix = query.toString()
  return `#dashboard${suffix === '' ? '' : `?${suffix}`}`
}

export function geographicScopeAncestors(
  scopeId: string,
  index: GeographicScopeIndex = TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
): readonly CountryHierarchyNode[] {
  const selected = index.byId.get(scopeId)
  if (selected === undefined) throw new Error(`Unknown geographic scope: ${scopeId}`)
  const reversed: CountryHierarchyNode[] = []
  const visited = new Set<string>()
  let current: CountryHierarchyNode | undefined = selected
  while (current !== undefined) {
    if (visited.has(current.scope_id)) {
      throw new Error(`Country hierarchy cycle at ${current.scope_id}`)
    }
    visited.add(current.scope_id)
    reversed.push(current)
    current =
      current.parent_scope_id === null
        ? undefined
        : index.byId.get(current.parent_scope_id)
  }
  return Object.freeze(reversed.reverse())
}

export function useGeographicScopeState(
  index: GeographicScopeIndex = TAXALENS_GEOGRAPHIC_SCOPE_INDEX,
): GeographicScopeController {
  const readState = useCallback(
    () => geographicScopeStateFromHash(window.location.hash, index),
    [index],
  )
  const [state, setState] = useState<GeographicScopeState>(readState)

  useEffect(() => {
    const synchronize = () => setState(readState())
    window.addEventListener('hashchange', synchronize)
    return () => window.removeEventListener('hashchange', synchronize)
  }, [readState])

  const selectScope = useCallback(
    (scopeId: string) => {
      const hash = geographicScopeHash(scopeId, window.location.hash, index)
      if (window.location.hash !== hash) {
        window.history.pushState(null, '', hash)
      }
      setState(geographicScopeStateFromHash(hash, index))
    },
    [index],
  )

  return useMemo(
    () => Object.freeze({ ...state, index, selectScope }),
    [index, selectScope, state],
  )
}

function hashQuery(hash: string): { readonly query: URLSearchParams } {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const question = fragment.indexOf('?')
  return {
    query: new URLSearchParams(question < 0 ? '' : fragment.slice(question + 1)),
  }
}

function assertScopeIdentity(node: CountryHierarchyNode): void {
  const prefixes: Readonly<Record<GeographicScopeLevel, string>> = {
    global: 'global',
    continent: 'continent:',
    country: 'country:',
    admin1: 'admin1:',
  }
  const prefix = prefixes[node.scope_level]
  if (
    (node.scope_level === 'global' && node.scope_id !== prefix) ||
    (node.scope_level !== 'global' && !node.scope_id.startsWith(prefix))
  ) {
    throw new Error(`Scope identity does not match its level: ${node.scope_id}`)
  }
  if (
    node.bounds.length !== 4 ||
    !node.bounds.every(Number.isFinite) ||
    !Number.isFinite(node.centroid_latitude) ||
    !Number.isFinite(node.centroid_longitude)
  ) {
    throw new Error(`Scope geometry is invalid: ${node.scope_id}`)
  }
}

function freezeSorted(
  nodes: CountryHierarchyNode[],
): readonly CountryHierarchyNode[] {
  return Object.freeze([...nodes].sort((left, right) => left.sort_key.localeCompare(right.sort_key)))
}
