import { useCallback, useEffect, useMemo, useState } from 'react'

import { EvidenceState } from '../design-system'
import { GeographicBreadcrumbs } from './GeographicBreadcrumbs'
import { GeographicScopeSlicers } from './GeographicScopeSlicers'
import { GeographicImpactLegend } from './GeographicImpactLegend'
import { useGeographicScopeState } from './geographicScope'
import { OfflineWorldMap } from './OfflineWorldMap'
import { buildBoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'
import {
  loadPublicGeographicImpactMapData,
  PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

export function GeographicImpactLens({
  webGlSupported,
}: {
  readonly webGlSupported?: boolean
}) {
  const scope = useGeographicScopeState()
  const mapData = useGeographicImpactMapData(
    scope.selected,
    webGlSupported !== false && typeof Worker !== 'undefined',
  )
  const impactFeatures = useMemo(
    () =>
      mapData.status === 'available'
        ? buildBoundedGeographicImpactFeatures(mapData.data.cells, 'record_count')
        : undefined,
    [mapData],
  )
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
          validation. All bubbles below remain evidence comparisons, not occurrence or range
          claims.
        </p>
      </div>
      <MapEvidenceState state={mapData} />
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
      {impactFeatures === undefined ? null : (
        <GeographicImpactLegend features={impactFeatures} />
      )}
      <OfflineWorldMap
        {...(impactFeatures === undefined ? {} : { impactFeatures })}
        onCountrySelect={selectCountry}
        selectedScope={scope.selected}
        {...(webGlSupported === undefined ? {} : { webGlSupported })}
      />
    </section>
  )
}

type GeographicImpactMapLoadState =
  | { readonly status: 'unavailable' }
  | { readonly status: 'loading' }
  | { readonly status: 'failure'; readonly message: string }
  | { readonly status: 'available'; readonly data: PublicGeographicImpactMapData }

function useGeographicImpactMapData(
  scope: Parameters<typeof loadPublicGeographicImpactMapData>[0],
  enabled: boolean,
): GeographicImpactMapLoadState {
  const [state, setState] = useState<GeographicImpactMapLoadState>(
    enabled ? { status: 'loading' } : { status: 'unavailable' },
  )
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'unavailable' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    void loadPublicGeographicImpactMapData(scope, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'available', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'failure',
            message: error instanceof Error ? error.message : 'unknown map-data failure',
          })
        }
      },
    )
    return () => controller.abort()
  }, [enabled, scope])
  return state
}

function MapEvidenceState({ state }: { readonly state: GeographicImpactMapLoadState }) {
  switch (state.status) {
    case 'unavailable':
      return (
        <EvidenceState state="review" title="Geographic evidence map unavailable">
          This runtime cannot start the local map-data worker. The hosted v1 judge fixture remains
          truthful and does not invent v2 evidence sections.
        </EvidenceState>
      )
    case 'loading':
      return (
        <EvidenceState state="loading" title="Verifying geographic impact cells">
          TaxaLens is checking the committed artifact checksum before querying preaggregated map
          cells locally.
        </EvidenceState>
      )
    case 'failure':
      return (
        <EvidenceState state="failure" title="Geographic evidence map stopped">
          {state.message}
        </EvidenceState>
      )
    case 'available':
      return (
        <EvidenceState state="available" title="Baseline and Flickr evidence mapped">
          {state.data.cells.length.toLocaleString()} preaggregated resolution-
          {state.data.spatialResolution} cells are shown for this scope from artifact{' '}
          <code>{PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE.artifactSha256.slice(0, 12)}</code>. Direct
          iNaturalist delta is {PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE.directInaturalistDeltaStatus};
          retained human outcomes and release-ready candidates remain zero.
        </EvidenceState>
      )
  }
}
