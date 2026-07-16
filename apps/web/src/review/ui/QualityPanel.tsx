import { EvidenceState } from '../../design-system'
import type {
  VerificationQualityRelease,
  VerificationQualitySnapshot,
} from '../domain'

export function QualityPanel({
  snapshot,
}: {
  readonly snapshot?: VerificationQualitySnapshot
}) {
  return (
    <section
      className="verification-quality"
      aria-labelledby="verification-quality-title"
    >
      <h3 id="verification-quality-title">Verification quality</h3>
      {snapshot === undefined ? (
        <EvidenceState
          state="blocked"
          title="Quality estimates are not available"
        >
          No fingerprinted QualitySnapshot is attached to this campaign.
          Coverage, precision, reviewer agreement, and release status are
          withheld instead of being reconstructed in the interface.
        </EvidenceState>
      ) : (
        <FlickrQualitySnapshot snapshot={snapshot} />
      )}
    </section>
  )
}

function FlickrQualitySnapshot({
  snapshot,
}: {
  readonly snapshot: VerificationQualitySnapshot
}) {
  const { coverage, precision } = snapshot
  return (
    <section
      className="verification-quality__section"
      aria-labelledby="flickr-quality-title"
    >
      <div>
        <p className="eyebrow">Fingerprint-bound campaign evidence</p>
        <h4 id="flickr-quality-title">Flickr verification quality</h4>
        <p>
          Coverage describes workflow completion. Precision and its interval
          are shown only when the persisted snapshot marks them available.
        </p>
      </div>

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
        <QualityMetric
          label="Estimated target precision"
          value={
            precision.availability === 'available'
              ? formatRate(precision.pointEstimate)
              : 'Not available'
          }
          detail={methodLabel(precision.method)}
        />
        <QualityMetric
          label={`${formatConfidenceLevel(
            precision.confidenceLevel,
          )} interval`}
          value={formatInterval(
            precision.intervalAvailability === 'available'
              ? precision.interval
              : null,
          )}
          detail={methodLabel(precision.intervalMethod)}
        />
        <QualityMetric
          label="Effective sample size"
          value={formatNumber(precision.effectiveSampleSize)}
          detail={`${precision.decisiveSampleCount} decisive sampled items`}
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
        <StateCount
          label="Review milestone"
          value={milestoneLabel(snapshot)}
        />
        <StateCount
          label="Snapshot captured"
          value={formatInstant(snapshot.capturedAt)}
        />
        <StateCount
          label="Snapshot fingerprint"
          value={shortFingerprint(snapshot.snapshotSha256)}
          code
        />
      </dl>

      <StrataTable snapshot={snapshot} />
      <ReleaseState release={snapshot.release} />
    </section>
  )
}

function StrataTable({
  snapshot,
}: {
  readonly snapshot: VerificationQualitySnapshot
}) {
  return (
    <div className="verification-quality__table-wrap">
      <table className="verification-quality__table">
        <caption>Persisted sampling-stratum quality</caption>
        <thead>
          <tr>
            <th scope="col">Stratum</th>
            <th scope="col">Decisive sample</th>
            <th scope="col">Population weight</th>
            <th scope="col">Estimate</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.precision.strata.map((stratum) => (
            <tr key={stratum.stratumId}>
              <th scope="row">{stratum.label}</th>
              <td>{stratum.decisiveSampleCount}</td>
              <td>{formatRate(stratum.populationWeight)}</td>
              <td>{formatRate(stratum.estimate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReleaseState({
  release,
}: {
  readonly release: VerificationQualityRelease
}) {
  if (release.status === 'release_ready') {
    return (
      <EvidenceState state="available" title="Release quality gate passed">
        Every configured threshold passed at decisive-review milestone{' '}
        {release.evaluatedAtMilestone}.
      </EvidenceState>
    )
  }
  if (release.status === 'blocked') {
    return (
      <EvidenceState state="blocked" title="Release quality gate blocked">
        {release.blockers.map(humanizeIdentifier).join('; ')}.
      </EvidenceState>
    )
  }
  return (
    <EvidenceState
      state="review"
      title="Release quality gate not evaluated"
    >
      {release.blockers.map(humanizeIdentifier).join('; ')}.
    </EvidenceState>
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

function QualityMetric({
  detail,
  label,
  value,
}: {
  readonly detail: string
  readonly label: string
  readonly value: string
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function StateCount({
  code = false,
  label,
  value,
}: {
  readonly code?: boolean
  readonly label: string
  readonly value: number | string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{code ? <code>{value}</code> : value}</dd>
    </div>
  )
}

function milestoneLabel(snapshot: VerificationQualitySnapshot): string {
  const { milestone } = snapshot
  if (milestone.currentMilestone !== null) {
    return `${milestone.currentMilestone} · ${humanizeIdentifier(
      milestone.status,
    )}`
  }
  if (milestone.nextMilestone !== null) {
    return `Next at ${milestone.nextMilestone}`
  }
  return humanizeIdentifier(milestone.status)
}

function methodLabel(
  method: VerificationQualitySnapshot['precision']['method' | 'intervalMethod'],
): string {
  switch (method) {
    case 'simple_random_wilson':
      return 'Simple-random Wilson'
    case 'stratified_hajek':
      return 'Stratified Hájek'
    case 'grouped_percentile_bootstrap':
      return 'Grouped percentile bootstrap'
  }
}

function formatRate(value: number | null): string {
  return value === null
    ? 'Not available'
    : new Intl.NumberFormat('en-AU', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value)
}

function formatNumber(value: number | null): string {
  return value === null
    ? 'Not available'
    : new Intl.NumberFormat('en-AU', {
        maximumFractionDigits: 1,
      }).format(value)
}

function formatInterval(
  interval: { readonly lower: number; readonly upper: number } | null,
): string {
  return interval === null
    ? 'Not available'
    : `${formatRate(interval.lower)} – ${formatRate(interval.upper)}`
}

function formatConfidenceLevel(value: number | null): string {
  return value === null ? 'Confidence' : formatRate(value)
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function shortFingerprint(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`
}

function humanizeIdentifier(value: string): string {
  const text = value.replaceAll('_', ' ')
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
