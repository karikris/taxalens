import { useEffect, useMemo, useRef, useState } from 'react'

import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

export interface GeographicImpactAccessibleSummaryModel {
  readonly scopeName: string
  readonly spatialResolution: number | null
  readonly cellCount: number
  readonly baselineEligibleCount: number
  readonly flickrCandidateCount: number
  readonly pendingCount: number
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly releaseReadyCount: number
  readonly candidateOnlyCellCount: number
  readonly reviewedAdditionalCellCount: number
  readonly releaseReadyAdditionalCellCount: number
  readonly selectedCellId: string | null
  readonly selectedCellSummary: string
  readonly announcement: string
}

export function GeographicImpactAccessibleSummary({
  cells,
  scope,
  selectedCellId,
}: {
  readonly cells: readonly PublicGeographicImpactMapCell[]
  readonly scope: CountryHierarchyNode
  readonly selectedCellId: string | null
}) {
  const summary = useMemo(
    () => buildGeographicImpactAccessibleSummary(cells, scope, selectedCellId),
    [cells, scope, selectedCellId],
  )
  const lastAnnouncement = useRef(summary.announcement)
  const [liveMessage, setLiveMessage] = useState(summary.announcement)
  useEffect(() => {
    if (summary.announcement === lastAnnouncement.current) return
    lastAnnouncement.current = summary.announcement
    setLiveMessage(summary.announcement)
  }, [summary.announcement])

  return (
    <section
      className="geographic-impact-accessible-summary"
      aria-labelledby="geographic-impact-summary-title"
    >
      <div>
        <p className="eyebrow">Textual map summary</p>
        <h4 id="geographic-impact-summary-title">Geographic evidence at a glance</h4>
        <p>
          {summary.scopeName} contains {formatCount(summary.cellCount)} resolution-
          {summary.spatialResolution ?? 'unavailable'} cells: {formatCount(summary.baselineEligibleCount)}
          {' '}range-inference-eligible baseline observations and{' '}
          {formatCount(summary.flickrCandidateCount)} Flickr candidates.
        </p>
      </div>
      <dl>
        <SummaryValue label="Pending amber rings" value={summary.pendingCount} />
        <SummaryValue label="Reviewed-target solid amber markers" value={summary.reviewedPositiveCount} />
        <SummaryValue label="Reviewed non-target excluded marks" value={summary.reviewedNegativeCount} />
        <SummaryValue label="Uncertain dashed amber markers" value={summary.uncertainCount} />
        <SummaryValue label="Release-ready dark-stroked amber markers" value={summary.releaseReadyCount} />
        <SummaryValue label="Potential coverage-gap cells" value={summary.candidateOnlyCellCount} />
        <SummaryValue label="Human-supported additional cells" value={summary.reviewedAdditionalCellCount} />
        <SummaryValue label="Release-ready additional cells" value={summary.releaseReadyAdditionalCellCount} />
      </dl>
      <p>{summary.selectedCellSummary}</p>
      <p className="geographic-impact-accessible-summary__disclosure">
        Blue filled bubbles mean baseline occurrence evidence. Amber color is always paired with
        a ring, fill, excluded mark, dash or dark external stroke. Flickr candidates remain
        hypotheses until human review and occurrence-release gates pass.
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
    </section>
  )
}

export function buildGeographicImpactAccessibleSummary(
  cells: readonly PublicGeographicImpactMapCell[],
  scope: CountryHierarchyNode,
  selectedCellId: string | null,
): GeographicImpactAccessibleSummaryModel {
  const selected =
    selectedCellId === null
      ? undefined
      : cells.find(({ spatialCellId }) => spatialCellId === selectedCellId)
  const model = {
    scopeName: scope.scope_name,
    spatialResolution: cells[0]?.spatialResolution ?? null,
    cellCount: cells.length,
    baselineEligibleCount: sum(cells, 'baselineRangeInferenceEligibleCount'),
    flickrCandidateCount: sum(cells, 'flickrCandidateCount'),
    pendingCount: sum(cells, 'pendingCount'),
    reviewedPositiveCount: sum(cells, 'reviewedPositiveCount'),
    reviewedNegativeCount: sum(cells, 'reviewedNegativeCount'),
    uncertainCount: sum(cells, 'uncertainCount'),
    releaseReadyCount: sum(cells, 'releaseReadyCount'),
    candidateOnlyCellCount: countTrue(cells, 'candidateOnlyCell'),
    reviewedAdditionalCellCount: countTrue(cells, 'reviewedAdditionalCell'),
    releaseReadyAdditionalCellCount: countTrue(cells, 'releaseReadyAdditionalCell'),
    selectedCellId: selected?.spatialCellId ?? null,
    selectedCellSummary:
      selected === undefined
        ? 'No spatial cell is selected. Use the map or exact evidence table to inspect one cell.'
        : selectedSummary(selected),
  }
  return Object.freeze({
    ...model,
    announcement: [
      `Geographic scope ${model.scopeName}.`,
      `${formatCount(model.cellCount)} cells.`,
      `${formatCount(model.baselineEligibleCount)} range-inference-eligible baseline observations.`,
      `${formatCount(model.flickrCandidateCount)} Flickr candidates: ${formatCount(model.pendingCount)} pending, ${formatCount(model.reviewedPositiveCount)} reviewed target positive, ${formatCount(model.reviewedNegativeCount)} reviewed non-target, ${formatCount(model.uncertainCount)} uncertain, and ${formatCount(model.releaseReadyCount)} release-ready.`,
      model.selectedCellSummary,
    ].join(' '),
  })
}

function SummaryValue({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatCount(value)}</dd>
    </div>
  )
}

type CountField = keyof Pick<
  PublicGeographicImpactMapCell,
  | 'baselineRangeInferenceEligibleCount'
  | 'flickrCandidateCount'
  | 'pendingCount'
  | 'reviewedPositiveCount'
  | 'reviewedNegativeCount'
  | 'uncertainCount'
  | 'releaseReadyCount'
>

function sum(cells: readonly PublicGeographicImpactMapCell[], field: CountField): number {
  return cells.reduce((total, cell) => total + cell[field], 0)
}

function countTrue(
  cells: readonly PublicGeographicImpactMapCell[],
  field: 'candidateOnlyCell' | 'reviewedAdditionalCell' | 'releaseReadyAdditionalCell',
): number {
  return cells.filter((cell) => cell[field]).length
}

function selectedSummary(cell: PublicGeographicImpactMapCell): string {
  return [
    `Selected cell ${cell.spatialCellId}.`,
    `${formatCount(cell.baselineRangeInferenceEligibleCount)} eligible baseline observations.`,
    `${formatCount(cell.flickrCandidateCount)} Flickr candidates: ${formatCount(cell.pendingCount)} pending, ${formatCount(cell.reviewedPositiveCount)} reviewed target positive, ${formatCount(cell.reviewedNegativeCount)} reviewed non-target, ${formatCount(cell.uncertainCount)} uncertain, and ${formatCount(cell.releaseReadyCount)} release-ready.`,
    cell.candidateOnlyCell
      ? 'This is a candidate-only spatial cell, not a biological absence claim.'
      : 'This is not a candidate-only spatial cell.',
  ].join(' ')
}

function formatCount(value: number): string {
  return value.toLocaleString('en-AU')
}
