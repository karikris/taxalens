import type { GeographicReviewProjection } from './geographicReviewProjection'

export interface GeographicReviewProgressModel {
  readonly campaignItemCount: number
  readonly assignedCount: number
  readonly decisivelyReviewedCount: number
  readonly uncertainCount: number
  readonly mediaFailureCount: number
  readonly pendingCount: number
  readonly skippedCount: number
  readonly qualityValidReviewedCount: number
  readonly populationQualityEligibleCount: number
  readonly targetedFailureDiscoveryReviewedCount: number
  readonly releaseReadyCount: number
}

export function buildGeographicReviewProgress(
  projection: GeographicReviewProjection,
  spatialResolution: number,
): GeographicReviewProgressModel {
  const cells = projection.cells.filter(
    (cell) => cell.spatialResolution === spatialResolution,
  )
  return Object.freeze({
    campaignItemCount: sum(cells, 'campaignItemCount'),
    assignedCount: sum(cells, 'assignedCount'),
    decisivelyReviewedCount: sum(cells, 'decisivelyReviewedCount'),
    uncertainCount: sum(cells, 'uncertainCount'),
    mediaFailureCount: sum(cells, 'mediaFailureCount'),
    pendingCount: sum(cells, 'pendingCount'),
    skippedCount: sum(cells, 'skippedCount'),
    qualityValidReviewedCount: sum(cells, 'qualityValidReviewedCount'),
    populationQualityEligibleCount: sum(
      cells,
      'populationQualityEligibleCount',
    ),
    targetedFailureDiscoveryReviewedCount: sum(
      cells,
      'targetedFailureDiscoveryReviewedCount',
    ),
    releaseReadyCount: sum(cells, 'releaseReadyCount'),
  })
}

export function GeographicReviewProgress({
  projection,
  spatialResolution,
}: {
  readonly projection: GeographicReviewProjection
  readonly spatialResolution: number
}) {
  const model = buildGeographicReviewProgress(projection, spatialResolution)
  const metrics = [
    ['Assigned', model.assignedCount],
    ['Decisively reviewed', model.decisivelyReviewedCount],
    ['Uncertain', model.uncertainCount],
    ['Media failure', model.mediaFailureCount],
    ['Pending', model.pendingCount],
    ['Skipped', model.skippedCount],
    ['Quality-valid reviewed', model.qualityValidReviewedCount],
    ['Population-quality eligible', model.populationQualityEligibleCount],
    ['Release-ready', model.releaseReadyCount],
  ] as const

  return (
    <section
      className="geographic-review-progress"
      aria-labelledby="geographic-review-progress-title"
      data-scientific-claim-allowed="false"
    >
      <div>
        <p className="eyebrow">Human verification maturity</p>
        <h4 id="geographic-review-progress-title">Review progress in mapped campaign cells</h4>
        <p>
          Exact campaign-item counts at H3 resolution {spatialResolution}. Assignment and review
          maturity overlap; they are not mutually exclusive categories.
        </p>
      </div>
      <dl aria-label="Geographic human-review counts">
        <div>
          <dt>Mapped campaign items</dt>
          <dd>{formatCount(model.campaignItemCount)}</dd>
        </div>
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd aria-label={`${label}: ${formatCount(value)}`}>{formatCount(value)}</dd>
          </div>
        ))}
      </dl>
      <p role="status" aria-live="polite">
        {model.campaignItemCount === 0
          ? 'No verification campaign items have supported cells at this resolution.'
          : `${formatCount(model.decisivelyReviewedCount)} of ${formatCount(model.campaignItemCount)} mapped campaign items are decisively reviewed; ${formatCount(model.releaseReadyCount)} pass retained occurrence-release gates.`}
      </p>
      <p>
        Skip and Can’t view remain workflow outcomes and add no human-supported contribution.
        {model.targetedFailureDiscoveryReviewedCount > 0
          ? ` ${formatCount(model.targetedFailureDiscoveryReviewedCount)} reviewed item${model.targetedFailureDiscoveryReviewedCount === 1 ? '' : 's'} came from targeted failure discovery and cannot support unweighted population inference.`
          : ' No targeted failure-discovery review is used for unweighted population inference.'}
      </p>
    </section>
  )
}

function sum<K extends keyof GeographicReviewProgressModel>(
  cells: GeographicReviewProjection['cells'],
  key: K,
): number {
  return cells.reduce((total, cell) => total + cell[key], 0)
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
