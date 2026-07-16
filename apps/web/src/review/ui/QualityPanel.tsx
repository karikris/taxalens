import { EvidenceState } from '../../design-system'
import type { VerificationCoverage } from '../domain'

export function QualityPanel({
  coverage,
}: {
  readonly coverage?: VerificationCoverage
}) {
  return (
    <section
      className="verification-quality"
      aria-labelledby="verification-quality-title"
    >
      <h3 id="verification-quality-title">Verification quality</h3>
      {coverage !== undefined && (
        <>
          <p>
            Coverage describes workflow completion and media availability. It
            is not an accuracy or precision estimate.
          </p>
          <div className="verification-quality__metrics">
            <CoverageMetric
              label="Review coverage"
              numerator={coverage.attemptedItems}
              denominator={coverage.eligibleItems}
              value={coverage.reviewCoverage}
            />
            <CoverageMetric
              label="Inspection coverage"
              numerator={coverage.inspectedItems}
              denominator={coverage.eligibleItems}
              value={coverage.inspectionCoverage}
            />
            <CoverageMetric
              label="Viewability rate"
              numerator={coverage.viewableItems}
              denominator={coverage.inspectedItems}
              value={coverage.viewabilityRate}
            />
          </div>
          <dl className="verification-quality__states">
            <StateCount
              label="Decisively reviewed"
              value={coverage.decisivelyReviewedItems}
            />
            <StateCount label="Uncertain" value={coverage.uncertainItems} />
            <StateCount
              label="Media failures"
              value={coverage.mediaFailureItems}
            />
            <StateCount label="Deferred" value={coverage.deferredItems} />
            <StateCount label="Pending" value={coverage.pendingItems} />
            <StateCount
              label="Decisive review events"
              value={coverage.decisiveReviewCount}
            />
          </dl>
        </>
      )}
      <EvidenceState state="blocked" title="Quality estimates are not available">
        Accuracy, precision intervals, and exclusion-adjusted estimates remain
        withheld until a leakage-safe sampling design and quality estimator are
        present.
      </EvidenceState>
    </section>
  )
}

function CoverageMetric({
  denominator,
  label,
  numerator,
  value,
}: {
  readonly denominator: number
  readonly label: string
  readonly numerator: number
  readonly value: number | null
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{formatRate(value)}</strong>
      <small>
        {numerator} / {denominator}
      </small>
    </article>
  )
}

function StateCount({
  label,
  value,
}: {
  readonly label: string
  readonly value: number
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function formatRate(value: number | null): string {
  return value === null
    ? 'Not available'
    : new Intl.NumberFormat('en-AU', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value)
}
