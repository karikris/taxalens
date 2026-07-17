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
  return (
    <li>
      <h5>{quality.campaignTitle}</h5>
      <p>
        <strong>{formatToken(quality.samplingPurpose)}</strong> ·{' '}
        {formatToken(quality.samplingDesign)} ·{' '}
        {quality.samplingRepresentative ? 'representative design' : 'non-representative design'}
      </p>
      <dl>
        <div>
          <dt>Current decisive outcomes</dt>
          <dd>{formatCount(quality.currentDecisivelyReviewedCount)}</dd>
        </div>
        <div>
          <dt>Quality snapshot</dt>
          <dd>{quality.snapshot.availability}</dd>
        </div>
        <div>
          <dt>Interval state</dt>
          <dd>
            {quality.snapshot.availability === 'available'
              ? formatToken(quality.snapshot.intervalAvailability)
              : 'unavailable'}
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
      {quality.snapshot.availability === 'unavailable' ? (
        <p role="status">{quality.snapshot.reason}</p>
      ) : (
        <p>
          Retained snapshot <code>{quality.snapshot.snapshotId}</code>, captured{' '}
          <time dateTime={quality.snapshot.capturedAt}>{quality.snapshot.capturedAt}</time>.
        </p>
      )}
    </li>
  )
}

function formatToken(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
