import { useCallback, useEffect, useMemo, useState } from 'react'

import { EvidenceState } from '../design-system'
import type { TaxaLensProjectFacade } from '../data/projectFacade'
import { GeographicCountryRanking } from './GeographicCountryRanking'
import { GeographicImpactAccessibleSummary } from './GeographicImpactAccessibleSummary'
import { GeographicImpactExport } from './GeographicImpactExport'
import {
  GeographicEvidenceMaturityFilter,
  filterGeographicImpactCells,
} from './GeographicEvidenceMaturityFilter'
import { GeographicReviewProgress } from './GeographicReviewProgress'
import { GeographicMapQualitySnapshot } from './GeographicMapQualitySnapshot'
import { applyLocalGeographicReviewProjection } from './geographicReviewOverlay'
import type { GeographicReviewProjection } from './geographicReviewProjection'
import {
  useLocalGeographicReviewProjection,
  type LocalGeographicReviewProjectionState,
} from './publicGeographicReviewProjection'
import { GeographicBreadcrumbs } from './GeographicBreadcrumbs'
import { GeographicScopeSlicers } from './GeographicScopeSlicers'
import { GeographicImpactLegend } from './GeographicImpactLegend'
import { GeographicImpactTable } from './GeographicImpactTable'
import { SelectedGeographyDetails } from './SelectedGeographyDetails'
import { useGeographicScopeState } from './geographicScope'
import { OfflineWorldMap } from './OfflineWorldMap'
import { buildBoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'
import { GeographicImpactQueryController } from './geographicImpactQueryController'
import { loadGeographicImpactProjectContext } from './geographicImpactSources'
import {
  useGeographicImpactRecordRouteState,
} from './geographicImpactRecordRoute'
import type {
  GeographicEvidenceMode,
  GeographicImpactMetric,
} from './geographicImpactQuery'
import {
  buildPublicGeographicImpactMapData,
  geographicMapResolutionForScope,
  verifiedGeographicImpactParquetBytes,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

export function GeographicImpactLens({
  project,
  reviewProjection,
  webGlSupported,
}: {
  readonly project?: TaxaLensProjectFacade
  readonly reviewProjection?: GeographicReviewProjection
  readonly webGlSupported?: boolean
}) {
  const scope = useGeographicScopeState()
  const recordRoute = useGeographicImpactRecordRouteState()
  const [selectedCellId, setSelectedCellId] = useState<string | null>(
    recordRoute.target?.spatialCellId ?? null,
  )
  const [rankingMetric, setRankingMetric] =
    useState<GeographicImpactMetric>('candidate_only_cells')
  const [evidenceMode, setEvidenceMode] =
    useState<GeographicEvidenceMode>('comparison')
  const mapData = useGeographicImpactMapData(
    project,
    scope.selected,
    rankingMetric,
    typeof Worker !== 'undefined',
  )
  const localReview = useLocalGeographicReviewProjection({
    enabled:
      reviewProjection === undefined &&
      mapData.status === 'available' &&
      typeof Worker !== 'undefined' &&
      typeof globalThis.indexedDB !== 'undefined',
    project,
  })
  const activeReviewProjection =
    reviewProjection ??
    (localReview.status === 'available' ? localReview.projection : undefined)
  const evidenceData = useMemo(
    () =>
      mapData.status === 'available'
        ? activeReviewProjection === undefined
          ? mapData.data
          : applyLocalGeographicReviewProjection(
              mapData.data,
              activeReviewProjection,
            )
        : undefined,
    [activeReviewProjection, mapData],
  )
  const visibleCells = useMemo(
    () =>
      evidenceData === undefined
        ? undefined
        : filterGeographicImpactCells(evidenceData.cells, evidenceMode),
    [evidenceData, evidenceMode],
  )
  const visibleData = useMemo(
    () =>
      mapData.status === 'available' && visibleCells !== undefined
        ? Object.freeze({ ...(evidenceData ?? mapData.data), cells: visibleCells })
        : undefined,
    [evidenceData, mapData, visibleCells],
  )
  const scopedReviewProjection = useMemo(
    () =>
      activeReviewProjection === undefined || evidenceData === undefined
        ? undefined
        : scopeReviewProjection(activeReviewProjection, evidenceData),
    [activeReviewProjection, evidenceData],
  )
  const impactFeatures = useMemo(
    () =>
      visibleCells === undefined
        ? undefined
        : buildBoundedGeographicImpactFeatures(visibleCells, rankingMetric),
    [rankingMetric, visibleCells],
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
  useEffect(
    () => setSelectedCellId(null),
    [evidenceMode, scope.selected.scope_id],
  )
  useEffect(() => {
    if (recordRoute.target?.scopeId === scope.selected.scope_id) {
      setSelectedCellId(recordRoute.target.spatialCellId)
    }
  }, [recordRoute.target, scope.selected.scope_id])
  useEffect(() => {
    const target = recordRoute.target
    if (
      target === null ||
      visibleCells === undefined ||
      !visibleCells.some(({ spatialCellId }) => spatialCellId === target.spatialCellId)
    ) return
    if (target.focus === 'lens') {
      window.requestAnimationFrame(() => document.getElementById('geographic-impact-lens')?.focus())
    }
  }, [recordRoute.target, visibleCells])

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
      <MapEvidenceState state={mapData} evidenceData={evidenceData} />
      {recordRoute.error === null ? null : (
        <EvidenceState state="failure" title="Record geographic link stopped">
          {recordRoute.error}
        </EvidenceState>
      )}
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
      {mapData.status === 'available' && visibleCells !== undefined ? (
        <GeographicEvidenceMaturityFilter
          mode={evidenceMode}
          onChange={setEvidenceMode}
          sourceCellCount={(evidenceData ?? mapData.data).cells.length}
          visibleCellCount={visibleCells.length}
        />
      ) : null}
      {reviewProjection === undefined ? (
        <LocalReviewEvidenceState state={localReview} />
      ) : null}
      {impactFeatures === undefined ? null : (
        <GeographicImpactLegend features={impactFeatures} />
      )}
      {mapData.status === 'available' && visibleData !== undefined ? (
        <>
          {scopedReviewProjection === undefined ? null : (
            <>
              <GeographicReviewProgress
                projection={scopedReviewProjection}
                spatialResolution={(evidenceData ?? mapData.data).spatialResolution}
              />
              <GeographicMapQualitySnapshot projection={scopedReviewProjection} />
            </>
          )}
          <GeographicImpactAccessibleSummary
            cells={visibleData.cells}
            scope={scope.selected}
            selectedCellId={selectedCellId}
          />
          <SelectedGeographyDetails
            cells={visibleData.cells}
            scope={scope.selected}
            selectedCellId={selectedCellId}
          />
          <GeographicCountryRanking
            cells={visibleData.cells}
            metric={rankingMetric}
            onCountrySelect={selectCountry}
            onMetricChange={setRankingMetric}
          />
          <GeographicImpactTable
            cells={visibleData.cells}
            focusCellId={recordRoute.target?.focus === 'table' ? recordRoute.target.spatialCellId : null}
            selectedCellId={selectedCellId}
            onCellSelect={setSelectedCellId}
          />
          <GeographicImpactExport
            data={mapData.data}
            scope={scope.selected}
            sourceParquetBytes={mapData.sourceParquetBytes}
          />
        </>
      ) : null}
      <OfflineWorldMap
        {...(impactFeatures === undefined ? {} : { impactFeatures })}
        onCountrySelect={selectCountry}
        onImpactCellSelect={setSelectedCellId}
        selectedImpactCellId={selectedCellId}
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
  | {
      readonly status: 'available'
      readonly data: PublicGeographicImpactMapData
      readonly sourceParquetBytes: Uint8Array<ArrayBuffer>
    }

function useGeographicImpactMapData(
  project: TaxaLensProjectFacade | undefined,
  scope: ReturnType<typeof useGeographicScopeState>['selected'],
  metric: GeographicImpactMetric,
  enabled: boolean,
): GeographicImpactMapLoadState {
  const [controller] = useState(() => new GeographicImpactQueryController())
  const [state, setState] = useState<GeographicImpactMapLoadState>(
    enabled && project !== undefined ? { status: 'loading' } : { status: 'unavailable' },
  )
  useEffect(() => {
    if (!enabled || project === undefined) {
      setState({ status: 'unavailable' })
      return
    }
    let context: ReturnType<typeof loadGeographicImpactProjectContext>
    try {
      context = loadGeographicImpactProjectContext(project)
    } catch (error) {
      setState({
        status: 'failure',
        message: error instanceof Error ? error.message : 'unknown geographic project failure',
      })
      return
    }
    let current = true
    setState({ status: 'loading' })
    void controller.run(project, {
      evidenceScope: context.evidenceScope,
      spatialResolution: geographicMapResolutionForScope(scope),
      geographicScope: { level: scope.scope_level, id: scope.scope_id },
      // The full comparison remains loaded so local append-only reviews can
      // enter any maturity filter without manufacturing another source query.
      evidenceMode: 'comparison',
      metric,
    }).then(
      (result) => {
        if (current) {
          setState({
            status: 'available',
            data: buildPublicGeographicImpactMapData(project, result),
            sourceParquetBytes: verifiedGeographicImpactParquetBytes(project),
          })
        }
      },
      (error: unknown) => {
        if (current && !(error instanceof DOMException && error.name === 'AbortError')) {
          setState({
            status: 'failure',
            message: error instanceof Error ? error.message : 'unknown map-data failure',
          })
        }
      },
    )
    return () => {
      current = false
      controller.cancel()
    }
  }, [controller, enabled, metric, project, scope])
  return state
}

function MapEvidenceState({
  state,
  evidenceData,
}: {
  readonly state: GeographicImpactMapLoadState
  readonly evidenceData: PublicGeographicImpactMapData | undefined
}) {
  switch (state.status) {
    case 'unavailable':
      return (
        <EvidenceState state="review" title="Geographic evidence map unavailable">
          This runtime cannot start the local analytical worker or has no verified geographic
          project boundary. No geographic evidence is invented.
        </EvidenceState>
      )
    case 'loading':
      return (
        <EvidenceState state="loading" title="Verifying geographic impact cells">
          TaxaLens is running the scoped full-outer comparison over checksum-verified baseline and
          Flickr Parquets locally.
        </EvidenceState>
      )
    case 'failure':
      return (
        <EvidenceState state="failure" title="Geographic evidence map stopped">
          {state.message}
        </EvidenceState>
      )
    case 'available':
      const data = evidenceData ?? state.data
      return (
        <EvidenceState state="available" title="Baseline and Flickr evidence mapped">
          {data.cells.length.toLocaleString()} reconciled resolution-{data.spatialResolution} cells
          are shown for this scope from artifact{' '}
          <code>{data.source.artifactSha256.slice(0, 12)}</code>. Direct iNaturalist delta is{' '}
          {data.source.directInaturalistDeltaStatus};
          {data.localReviewOverlayApplied
            ? ` ${data.localReviewEventCount ?? 0} local append-only review events are projected without changing retained release-ready evidence.`
            : ' committed human-review and release states are shown without a local overlay.'}
        </EvidenceState>
      )
  }
}

function LocalReviewEvidenceState({
  state,
}: {
  readonly state: LocalGeographicReviewProjectionState
}) {
  switch (state.status) {
    case 'unavailable':
      return (
        <EvidenceState state="review" title="Local geographic review overlay unavailable">
          {state.reason} The committed map remains available and no review state is invented.
        </EvidenceState>
      )
    case 'loading':
      return (
        <EvidenceState state="loading" title="Projecting local geographic reviews">
          TaxaLens is verifying the committed audit bindings and reading the append-only IndexedDB
          ledger.
        </EvidenceState>
      )
    case 'failure':
      return (
        <EvidenceState state="failure" title="Local geographic review overlay stopped">
          {state.message}
        </EvidenceState>
      )
    case 'available':
      return (
        <EvidenceState state="available" title="Local geographic review overlay active">
          {state.localEventCount.toLocaleString('en-US')} append-only event
          {state.localEventCount === 1 ? '' : 's'} from campaign <code>{state.campaignId}</code>{' '}
          are projected locally. The targeted failure-discovery campaign is unavailable in this
          committed replay, and local outcomes cannot create a scientific release.
        </EvidenceState>
      )
  }
}

function scopeReviewProjection(
  projection: GeographicReviewProjection,
  data: PublicGeographicImpactMapData,
): GeographicReviewProjection {
  const visibleCellIds = new Set(data.cells.map(({ spatialCellId }) => spatialCellId))
  return Object.freeze({
    ...projection,
    cells: Object.freeze(
      projection.cells.filter(
        (cell) =>
          cell.spatialResolution === data.spatialResolution &&
          visibleCellIds.has(cell.spatialCellId),
      ),
    ),
  })
}
