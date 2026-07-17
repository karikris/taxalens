import { useMemo } from 'react'

import {
  geographicScopeAncestors,
  type GeographicScopeController,
} from './geographicScope'

export function GeographicScopeSlicers({
  controller,
}: {
  readonly controller: GeographicScopeController
}) {
  const { index, selected, selectScope } = controller
  const ancestors = useMemo(
    () => geographicScopeAncestors(selected.scope_id, index),
    [index, selected.scope_id],
  )
  const continent = ancestors.find(({ scope_level }) => scope_level === 'continent')
  const country = ancestors.find(({ scope_level }) => scope_level === 'country')
  const countries =
    continent === undefined
      ? []
      : (index.childrenByParent.get(continent.scope_id) ?? []).filter(
          ({ scope_level }) => scope_level === 'country',
        )

  return (
    <fieldset className="geographic-slicers" aria-describedby="geographic-slicers-help">
      <legend>Geographic scope</legend>
      <p id="geographic-slicers-help">
        Choose a verified hierarchy scope. Changing continent clears any finer country or regional
        selection.
      </p>
      <label>
        <span>Continent</span>
        <select
          value={continent?.scope_id ?? 'global'}
          onChange={(event) => selectScope(event.currentTarget.value)}
        >
          <option value="global">All continents</option>
          {index.byLevel.continent.map((node) => (
            <option key={node.scope_id} value={node.scope_id}>
              {node.scope_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Country</span>
        <select
          value={country?.scope_id ?? continent?.scope_id ?? ''}
          disabled={continent === undefined}
          onChange={(event) => selectScope(event.currentTarget.value)}
        >
          {continent === undefined ? (
            <option value="">Select a continent first</option>
          ) : (
            <>
              <option value={continent.scope_id}>
                All countries in {continent.scope_name}
              </option>
              {countries.map((node) => (
                <option key={node.scope_id} value={node.scope_id}>
                  {node.scope_name}
                </option>
              ))}
            </>
          )}
        </select>
      </label>
      <button
        type="button"
        disabled={selected.scope_level === 'global'}
        onClick={() => selectScope('global')}
      >
        Reset to Global
      </button>
    </fieldset>
  )
}
