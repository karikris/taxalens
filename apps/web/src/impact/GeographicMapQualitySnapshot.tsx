import type {
  GeographicReviewProjection,
  GeographicReviewQualityProjection,
} from './geographicReviewProjection'

export function GeographicMapQualitySnapshot({
  projection,
}: {
  readonly projection: GeographicReviewProjection
}) {
  return (
    <section
      className="geographic-map-quality"
      aria-labelledby="geographic-map-quality-title"
      data-scientific-claim-allowed="false"
    >
      <div>
        <p className="eyebrow">QualitySnapshot gate</p>
        <h4 id="geographic-map-quality-title">Campaign quality evidence</h4>
        <p>
          Reviewed examples and population-quality estimates are separate. Only an immutable,
          validated campaign snapshot can support interval or release-gate statements.
        </p>
      </div>
      {projection.quality.length === 0 ? (
        <p role="status">No mapped verification campaign quality state is available.</p>
      ) : (
        <ul aria-label="Geographic campaign quality snapshots">
          {projection.quality.map((quality) => (
            <QualityCampaign key={quality.campaignId} quality={quality} />
          ))}
        </ul>
      )}
    </section>
  )
}

function QualityCampaign({
  quality,
}: {
  readonly quality: GeographicReviewQualityProjection
}) {
  const populationInferenceEligible =
    quality.samplingRepresentative && quality.qualityEstimationAllowed
  return (
    <li data-population-inference={populationInferenceEligible ? 'eligible' : 'blocked'}>
      <h5>{quality.campaignTitle}</h5>
      <p>
        <strong>{formatToken(quality.samplingPurpose)}</strong> ·{' '}
        {formatToken(quality.samplingDesign)} ·{' '}
        {quality.samplingRepresentative ? 'representative design' : 'non-representative design'}
      </p>
      <dl>
        <div>
          <dt>Reviewed examples</dt>
          <dd>{formatCount(quality.currentDecisivelyReviewedCount)}</dd>
        </div>
        <div>
          <dt>Quality snapshot</dt>
          <dd>{quality.snapshot.availability}</dd>
        </div>
        <div>
          <dt>Snapshot decisive sample</dt>
          <dd>
            {quality.snapshot.availability === 'available'
              ? formatCount(quality.snapshot.snapshotDecisiveSampleCount)
              : 'not retained'}
          </dd>
        </div>
        <div>
          <dt>Next review milestone</dt>
          <dd>
            {quality.snapshot.availability === 'available' &&
            quality.snapshot.nextMilestone !== null
              ? formatCount(quality.snapshot.nextMilestone)
              : 'unavailable'}
          </dd>
        </div>
        <div>
          <dt>Milestone status</dt>
          <dd>
            {quality.snapshot.availability === 'available'
              ? formatToken(quality.snapshot.milestoneStatus)
              : 'not evaluated'}
          </dd>
        </div>
        <div>
          <dt>Population inference</dt>
          <dd>
            {populationInferenceEligible ? 'sampling design eligible' : 'blocked'}
          </dd>
        </div>
        <div>
          <dt>Release gate</dt>
          <dd>
            {quality.snapshot.availability === 'available'
              ? formatToken(quality.snapshot.releaseStatus)
              : 'not evaluated'}
          </dd>
        </div>
      </dl>
      {populationInferenceEligible ? (
        <EligibleQualityEstimate quality={quality} />
      ) : (
        <p role="status">
          Population-quality claims are blocked.{' '}
          {quality.qualityEstimationBlockedReason ??
            'This campaign sampling design is not representative.'}{' '}
          The {formatCount(quality.currentDecisivelyReviewedCount)} decisive outcome
          {quality.currentDecisivelyReviewedCount === 1 ? '' : 's'} remain reviewed examples only.
        </p>
      )}
      {quality.snapshot.availability === 'unavailable' ? (
        <p role="status">{quality.snapshot.reason}</p>
      ) : (
        <>
          <p>
            Retained snapshot <code>{quality.snapshot.snapshotId}</code>, captured{' '}
            <time dateTime={quality.snapshot.capturedAt}>{quality.snapshot.capturedAt}</time>.
          </p>
          {quality.snapshot.releaseBlockers.length === 0 ? (
            <p>Campaign quality release blockers: none retained.</p>
          ) : (
            <div>
              <p>Campaign quality release blockers:</p>
              <ul aria-label={`${quality.campaignTitle} release blockers`}>
                {quality.snapshot.releaseBlockers.map((blocker) => (
                  <li key={blocker}>{formatToken(blocker)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p>
        Campaign quality release status does not make an individual candidate release-ready;
        every occurrence-release gate must still pass.
      </p>
    </li>
  )
}

function EligibleQualityEstimate({
  quality,
}: {
  readonly quality: GeographicReviewQualityProjection
}) {
  if (quality.snapshot.availability === 'unavailable') {
    return <p>Population-quality estimate unavailable until a retained snapshot is attached.</p>
  }
  if (
    quality.snapshot.precisionAvailability !== 'available' ||
    quality.snapshot.pointEstimate === null
  ) {
    return <p>Population-quality estimate unavailable in the retained snapshot.</p>
  }
  const interval =
    quality.snapshot.intervalAvailability === 'available' &&
    quality.snapshot.interval !== null &&
    quality.snapshot.confidenceLevel !== null
      ? ` ${formatPercent(quality.snapshot.confidenceLevel)} confidence interval ${formatPercent(quality.snapshot.interval.lower)}–${formatPercent(quality.snapshot.interval.upper)}.`
      : ' Confidence interval unavailable.'
  return (
    <p>
      Snapshot quality estimate {formatPercent(quality.snapshot.pointEstimate)}.{interval}
    </p>
  )
}

function formatToken(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}
