import { useCallback } from 'react'

import { EvidenceState } from '../design-system'
import { GeographicBreadcrumbs } from './GeographicBreadcrumbs'
import { GeographicScopeSlicers } from './GeographicScopeSlicers'
import { useGeographicScopeState } from './geographicScope'
import { OfflineWorldMap } from './OfflineWorldMap'

export function GeographicImpactLens({
  webGlSupported,
}: {
  readonly webGlSupported?: boolean
}) {
  const scope = useGeographicScopeState()
  const selectCountry = useCallback(
    (countryCode: string) => {
      const country = scope.index.byLevel.country.find(
        (node) => node.country_code === countryCode,
      )
      if (country !== undefined) scope.selectScope(country.scope_id)
    },
    [scope.index, scope.selectScope],
  )

  return (
    <section
      id="geographic-impact-lens"
      className="geographic-impact-lens"
      aria-labelledby="geographic-impact-lens-title"
      tabIndex={-1}
      data-map-purpose="geographic-evidence-comparison"
      data-scientific-claim-allowed="false"
    >
      <div className="geographic-impact-lens__heading">
        <p className="eyebrow">Baseline and candidate evidence</p>
        <h3 id="geographic-impact-lens-title">TaxaLens Geographic Impact Lens</h3>
        <p>
          This scientific view asks where baseline occurrence evidence exists and where Flickr
          candidate evidence could add potential coverage after human review and release-gate
          validation. The map below is the local cartographic foundation; it does not yet display
          an impact claim.
        </p>
      </div>
      <EvidenceState state="review" title="Geographic evidence layers remain quality-gated">
        The current hosted v1 replay does not publish the v2 Geographic Impact sections. Countries
        are visible for orientation, but blue baseline and amber Flickr layers remain unavailable
        here until their verified bundle inputs are connected.
      </EvidenceState>
      <div className="geographic-impact-lens__scope" role="status" aria-live="polite">
        <span>Geographic scope</span>
        <strong>{scope.selected.scope_name}</strong>
        <small>
          {scope.selected.scope_level} · verified hierarchy identity{' '}
          <code>{scope.selected.scope_id}</code>
        </small>
        {scope.urlError === null ? null : <p>{scope.urlError}</p>}
      </div>
      <GeographicBreadcrumbs controller={scope} />
      <GeographicScopeSlicers controller={scope} />
      <OfflineWorldMap
        onCountrySelect={selectCountry}
        selectedScope={scope.selected}
        {...(webGlSupported === undefined ? {} : { webGlSupported })}
      />
    </section>
  )
}
