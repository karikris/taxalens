import type { ReactNode } from 'react'

import type { RecordGeographicContext } from './recordGeographicContext'

export type RecordPotentialContributionState =
  | 'release_ready_occurrence_candidate'
  | 'human_supported_additional_cell'
  | 'potential_coverage_gap_cell'
  | 'baseline_covered_candidate_cell'

export interface RecordGeographicFactsModel {
  readonly contributionState: RecordPotentialContributionState
  readonly contributionLabel: string
  readonly contributionDetail: string
  readonly reviewLabel: string
}

export function RecordGeographicFacts({
  context,
}: {
  readonly context: RecordGeographicContext
}) {
  const model = buildRecordGeographicFactsModel(context)
  return (
    <section className="record-geographic-facts" aria-labelledby="record-geographic-facts-title">
      <div>
        <p className="eyebrow">Selected record geography</p>
        <h4 id="record-geographic-facts-title">Artifact-grounded geographic facts</h4>
        <p>
          Exact values come from the precision-aware Flickr handoff and the same-resolution
          Geographic Impact cell. Missing baseline evidence remains unknown, not biological
          absence.
        </p>
      </div>
      <dl>
        <Fact label="Coordinate quality">
          <strong>{humanize(context.candidateCoordinate.quality)}</strong>
          <span>Flickr accuracy level {context.candidateCoordinate.accuracyLevel}</span>
        </Fact>
        <Fact label="Country and region">
          <strong>{context.selectedCell.country ?? 'Unavailable'}</strong>
          <span>
            {context.selectedCell.countryCode ?? 'No country code'}
            {context.selectedCell.admin1 === null ? '' : ` · ${context.selectedCell.admin1}`}
          </span>
        </Fact>
        <Fact label="Supported comparison cell">
          <strong>H3 resolution {context.selectedCell.spatialResolution}</strong>
          <code>{context.selectedCell.spatialCellId}</code>
        </Fact>
        <Fact label="Baseline records in cell">
          <strong>{formatCount(context.impact.baselineUnionCount)} baseline union</strong>
          <span>
            {formatCount(context.impact.baselineRangeInferenceEligibleCount)} range-inference eligible
          </span>
        </Fact>
        <Fact label="Flickr candidates in cell">
          <strong>{formatCount(context.impact.flickrCandidateCount)} candidate evidence</strong>
          <span>
            {formatCount(context.impact.reviewedPositiveCount)} reviewed target positive ·{' '}
            {formatCount(context.impact.releaseReadyCount)} release-ready
          </span>
        </Fact>
        <Fact label="Selected record review state">
          <strong>{model.reviewLabel}</strong>
          <span>
            {context.review.decisiveReviewCount} decisive · {context.review.reviewerAssignmentCount}{' '}
            assigned
          </span>
        </Fact>
        <Fact label="Nearest baseline distance">
          <strong>
            {context.impact.nearestBaselineDistanceKm === null
              ? humanize(context.impact.nearestBaselineDistanceStatus)
              : `${context.impact.nearestBaselineDistanceKm.toFixed(3)} km`}
          </strong>
          <span>
            {context.impact.nearestBaselineCellId === null
              ? 'No destination baseline cell available'
              : `to same-resolution cell ${context.impact.nearestBaselineCellId}`}
          </span>
        </Fact>
        <Fact label="Potential contribution">
          <strong>{model.contributionLabel}</strong>
          <span>{model.contributionDetail}</span>
        </Fact>
        <Fact label="Baseline data state">
          <strong>{humanize(context.impact.dataDeficientState)}</strong>
          <span>Data deficiency is not a species-absence claim.</span>
        </Fact>
      </dl>
    </section>
  )
}

export function buildRecordGeographicFactsModel(
  context: RecordGeographicContext,
): RecordGeographicFactsModel {
  const contribution = context.impact.releaseReadyAdditionalCell
    ? {
        contributionState: 'release_ready_occurrence_candidate' as const,
        contributionLabel: 'Release-ready occurrence candidate',
        contributionDetail:
          'Human support and every configured occurrence-release gate passed for this additional cell.',
      }
    : context.impact.reviewedAdditionalCell
      ? {
          contributionState: 'human_supported_additional_cell' as const,
          contributionLabel: 'Human-supported additional cell',
          contributionDetail:
            'Human review supports the target, but occurrence-release readiness remains separate.',
        }
      : context.impact.candidateOnlyCell
        ? {
            contributionState: 'potential_coverage_gap_cell' as const,
            contributionLabel: 'Potential coverage-gap cell',
            contributionDetail:
              'Flickr candidate evidence is present while baseline count is zero; human support and release readiness are absent.',
          }
        : {
            contributionState: 'baseline_covered_candidate_cell' as const,
            contributionLabel: 'Baseline-covered candidate cell',
            contributionDetail:
              'Baseline occurrence evidence and Flickr candidate evidence overlap at this resolution.',
          }
  return Object.freeze({
    ...contribution,
    reviewLabel:
      context.review.queueState === 'not_in_committed_campaign'
        ? 'Not in committed public campaign'
        : humanize(context.review.state),
  })
}

function Fact({
  children,
  label,
}: {
  readonly children: ReactNode
  readonly label: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}
