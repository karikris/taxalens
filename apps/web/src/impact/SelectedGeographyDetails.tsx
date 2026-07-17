import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import { countPotentialCoverageGapCells } from './geographicContributionMetrics'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

export interface SelectedGeographyDetailModel {
  readonly title: string
  readonly context: 'scope' | 'cell'
  readonly cellCount: number
  readonly baselineUnionCount: number
  readonly baselineEligibleCount: number
  readonly baselineExcludedCount: number
  readonly gbifOnlyCount: number
  readonly inaturalistOriginThroughGbifCount: number
  readonly directInaturalistDeltaStatus: 'available' | 'unavailable'
  readonly directInaturalistDeltaCount: number | null
  readonly duplicatesRemovedCount: number
  readonly unresolvedProviderDuplicateGroupCount: number
  readonly flickrCandidateCount: number
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly releaseReadyCount: number
  readonly candidateOnlyCellCount: number
  readonly reviewedAdditionalCellCount: number
  readonly releaseReadyAdditionalCellCount: number
  readonly nearestBaselineDistanceKm: number | null
  readonly latestBaselineEventDate: string | null
  readonly latestFlickrCandidateDate: string | null
  readonly dataDeficientCellCount: number
  readonly unavailableCellCount: number
  readonly temporalContribution: string
}

export function SelectedGeographyDetails({
  cells,
  scope,
  selectedCellId,
}: {
  readonly cells: readonly PublicGeographicImpactMapCell[]
  readonly scope: CountryHierarchyNode
  readonly selectedCellId: string | null
}) {
  const details = buildSelectedGeographyDetails(cells, scope, selectedCellId)
  return (
    <section
      className="selected-geography-details"
      aria-labelledby="selected-geography-details-title"
    >
      <div>
        <p className="eyebrow">
          {details.context === 'cell' ? 'Selected spatial cell' : 'Selected geography'}
        </p>
        <h4 id="selected-geography-details-title">{details.title}</h4>
        <p>
          {formatCount(details.cellCount)} preaggregated cell
          {details.cellCount === 1 ? '' : 's'} · exact artifact values
        </p>
      </div>
      <div className="selected-geography-details__groups">
        <DetailGroup title="Baseline occurrence evidence">
          <Detail label="Baseline union" value={formatCount(details.baselineUnionCount)} />
          <Detail
            label="Range-inference eligible"
            value={formatCount(details.baselineEligibleCount)}
          />
          <Detail label="Excluded occurrence total" value={formatCount(details.baselineExcludedCount)} />
          <Detail label="GBIF-only" value={formatCount(details.gbifOnlyCount)} />
          <Detail
            label="iNaturalist-origin through GBIF"
            value={formatCount(details.inaturalistOriginThroughGbifCount)}
          />
          <Detail
            label="Direct iNaturalist delta"
            value={
              details.directInaturalistDeltaStatus === 'available' &&
              details.directInaturalistDeltaCount !== null
                ? formatCount(details.directInaturalistDeltaCount)
                : 'Unavailable'
            }
          />
          <Detail
            label="Cross-provider duplicates removed"
            value={formatCount(details.duplicatesRemovedCount)}
          />
          <Detail
            label="Unresolved provider duplicate groups"
            value={formatCount(details.unresolvedProviderDuplicateGroupCount)}
          />
        </DetailGroup>
        <DetailGroup title="Flickr candidate evidence">
          <Detail label="Candidates" value={formatCount(details.flickrCandidateCount)} />
          <Detail label="Pending" value={formatCount(details.pendingCount)} />
          <Detail
            label="Human-reviewed target positive"
            value={formatCount(details.reviewedPositiveCount)}
          />
          <Detail
            label="Human-reviewed non-target"
            value={formatCount(details.reviewedNegativeCount)}
          />
          <Detail label="Uncertain" value={formatCount(details.uncertainCount)} />
          <Detail
            label="Release-ready occurrence candidates"
            value={formatCount(details.releaseReadyCount)}
          />
        </DetailGroup>
        <DetailGroup title="Potential contribution">
          <Detail
            label="Candidate-only spatial cells"
            value={formatCount(details.candidateOnlyCellCount)}
          />
          <Detail
            label="Human-supported additional cells"
            value={formatCount(details.reviewedAdditionalCellCount)}
          />
          <Detail
            label="Release-ready additional cells"
            value={formatCount(details.releaseReadyAdditionalCellCount)}
          />
          <Detail
            label={
              details.context === 'cell'
                ? 'Nearest baseline distance'
                : 'Maximum nearest baseline distance'
            }
            value={
              details.nearestBaselineDistanceKm === null
                ? 'Unavailable'
                : `${formatDistance(details.nearestBaselineDistanceKm)} km`
            }
          />
          <Detail
            label="Latest credible baseline date"
            value={details.latestBaselineEventDate ?? 'Unavailable'}
          />
          <Detail
            label="Latest Flickr candidate date"
            value={details.latestFlickrCandidateDate ?? 'Unavailable'}
          />
          <Detail
            label="Data-deficient cells"
            value={formatCount(details.dataDeficientCellCount)}
          />
          <Detail
            label="Unavailable baseline-state cells"
            value={formatCount(details.unavailableCellCount)}
          />
        </DetailGroup>
      </div>
      <p className="selected-geography-details__temporal">
        {details.temporalContribution}
      </p>
      <p className="selected-geography-details__disclosure">
        Missing baseline evidence is unknown, not proof of biological absence. Flickr candidates
        remain hypotheses until human review and occurrence-release gates pass.
      </p>
    </section>
  )
}

export function buildSelectedGeographyDetails(
  cells: readonly PublicGeographicImpactMapCell[],
  scope: CountryHierarchyNode,
  selectedCellId: string | null,
): SelectedGeographyDetailModel {
  const selected =
    selectedCellId === null
      ? undefined
      : cells.find(({ spatialCellId }) => spatialCellId === selectedCellId)
  const selectedCells = selected === undefined ? cells : [selected]
  const latestBaselineEventDate = latestDate(
    selectedCells.map(({ latestBaselineEventDate }) => latestBaselineEventDate),
  )
  const latestFlickrCandidateDate = latestDate(
    selectedCells.map(({ latestFlickrCandidateDate }) => latestFlickrCandidateDate),
  )
  const directAvailable =
    selectedCells.length > 0 &&
    selectedCells.every(
      ({ directInaturalistDeltaCount, directInaturalistDeltaStatus }) =>
        directInaturalistDeltaStatus === 'available' &&
        directInaturalistDeltaCount !== null,
    )

  return Object.freeze({
    title: selected?.spatialCellId ?? scope.scope_name,
    context: selected === undefined ? 'scope' as const : 'cell' as const,
    cellCount: selectedCells.length,
    baselineUnionCount: sum(selectedCells, 'baselineUnionCount'),
    baselineEligibleCount: sum(selectedCells, 'baselineRangeInferenceEligibleCount'),
    baselineExcludedCount: sum(selectedCells, 'baselineExcludedOccurrenceCount'),
    gbifOnlyCount: sum(selectedCells, 'gbifOnlyCount'),
    inaturalistOriginThroughGbifCount: sum(
      selectedCells,
      'inaturalistOriginThroughGbifCount',
    ),
    directInaturalistDeltaStatus: directAvailable ? 'available' as const : 'unavailable' as const,
    directInaturalistDeltaCount: directAvailable
      ? selectedCells.reduce(
          (total, { directInaturalistDeltaCount }) =>
            total + (directInaturalistDeltaCount ?? 0),
          0,
        )
      : null,
    duplicatesRemovedCount: sum(selectedCells, 'duplicatesRemovedCount'),
    unresolvedProviderDuplicateGroupCount: sum(
      selectedCells,
      'unresolvedProviderDuplicateGroupCount',
    ),
    flickrCandidateCount: sum(selectedCells, 'flickrCandidateCount'),
    reviewedPositiveCount: sum(selectedCells, 'reviewedPositiveCount'),
    reviewedNegativeCount: sum(selectedCells, 'reviewedNegativeCount'),
    uncertainCount: sum(selectedCells, 'uncertainCount'),
    pendingCount: sum(selectedCells, 'pendingCount'),
    releaseReadyCount: sum(selectedCells, 'releaseReadyCount'),
    candidateOnlyCellCount: countPotentialCoverageGapCells(selectedCells),
    reviewedAdditionalCellCount: countTrue(selectedCells, 'reviewedAdditionalCell'),
    releaseReadyAdditionalCellCount: countTrue(
      selectedCells,
      'releaseReadyAdditionalCell',
    ),
    nearestBaselineDistanceKm: maximumNullable(
      selectedCells.map(({ nearestBaselineDistanceKm }) => nearestBaselineDistanceKm),
    ),
    latestBaselineEventDate,
    latestFlickrCandidateDate,
    dataDeficientCellCount: selectedCells.filter(
      ({ dataDeficientState }) => dataDeficientState === 'data_deficient',
    ).length,
    unavailableCellCount: selectedCells.filter(
      ({ dataDeficientState }) => dataDeficientState === 'unavailable',
    ).length,
    temporalContribution: temporalContribution(
      latestBaselineEventDate,
      latestFlickrCandidateDate,
    ),
  })
}

function DetailGroup({
  children,
  title,
}: {
  readonly children: React.ReactNode
  readonly title: string
}) {
  return (
    <section>
      <h5>{title}</h5>
      <dl>{children}</dl>
    </section>
  )
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

type SummableCellField = keyof Pick<
  PublicGeographicImpactMapCell,
  | 'baselineUnionCount'
  | 'baselineRangeInferenceEligibleCount'
  | 'baselineExcludedOccurrenceCount'
  | 'gbifOnlyCount'
  | 'inaturalistOriginThroughGbifCount'
  | 'duplicatesRemovedCount'
  | 'unresolvedProviderDuplicateGroupCount'
  | 'flickrCandidateCount'
  | 'reviewedPositiveCount'
  | 'reviewedNegativeCount'
  | 'uncertainCount'
  | 'pendingCount'
  | 'releaseReadyCount'
>

function sum(
  cells: readonly PublicGeographicImpactMapCell[],
  field: SummableCellField,
): number {
  return cells.reduce((total, cell) => total + cell[field], 0)
}

function countTrue(
  cells: readonly PublicGeographicImpactMapCell[],
  field: keyof Pick<
    PublicGeographicImpactMapCell,
    'candidateOnlyCell' | 'reviewedAdditionalCell' | 'releaseReadyAdditionalCell'
  >,
): number {
  return cells.filter((cell) => cell[field]).length
}

function maximumNullable(values: readonly (number | null)[]): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length === 0 ? null : Math.max(...available)
}

function latestDate(values: readonly (string | null)[]): string | null {
  const available = values.filter((value): value is string => value !== null)
  return available.length === 0 ? null : available.sort().at(-1) ?? null
}

function temporalContribution(
  latestBaseline: string | null,
  latestFlickr: string | null,
): string {
  if (latestFlickr === null) {
    return 'Temporal contribution is unavailable because this selection has no dated Flickr candidate evidence.'
  }
  if (latestBaseline === null) {
    return 'The selected baseline has no credible latest date; temporal contribution is data-deficient and no novelty is inferred.'
  }
  const days = Math.round(
    (Date.parse(`${latestFlickr}T00:00:00Z`) -
      Date.parse(`${latestBaseline}T00:00:00Z`)) /
      86_400_000,
  )
  if (days > 0) {
    return `Potential temporal contribution: the latest Flickr candidate date is ${formatCount(days)} days later than the latest credible baseline date. This remains candidate evidence.`
  }
  return 'The latest Flickr candidate date is not later than the latest credible baseline date in this selection.'
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value)
}

function formatDistance(value: number): string {
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(value)
}
