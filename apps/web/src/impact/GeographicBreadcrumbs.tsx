import { useMemo } from 'react'

import {
  geographicScopeAncestors,
  type GeographicScopeController,
} from './geographicScope'

export function GeographicBreadcrumbs({
  controller,
}: {
  readonly controller: GeographicScopeController
}) {
  const ancestors = useMemo(
    () => geographicScopeAncestors(controller.selected.scope_id, controller.index),
    [controller.index, controller.selected.scope_id],
  )

  return (
    <nav className="geographic-breadcrumbs" aria-label="Geographic breadcrumb">
      <ol>
        {ancestors.map((node, index) => {
          const current = index === ancestors.length - 1
          return (
            <li key={node.scope_id}>
              {index === 0 ? null : <span aria-hidden="true">›</span>}
              {current ? (
                <span aria-current="page">{node.scope_name}</span>
              ) : (
                <button type="button" onClick={() => controller.selectScope(node.scope_id)}>
                  {node.scope_name}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
