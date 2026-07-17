import type { GeographicImpactMapFeature } from './geographicImpactFeatureCollection'

export function GeographicImpactCellTooltip({
  feature,
}: {
  readonly feature: GeographicImpactMapFeature
}) {
  const { properties } = feature
  const baselineExcludedCount =
    properties.baselineUnionCount - properties.baselineCount
  return (
    <section
      className="geographic-impact-tooltip"
      aria-labelledby="geographic-impact-tooltip-title"
    >
      <p className="eyebrow">Exact cell counts</p>
      <h4 id="geographic-impact-tooltip-title">{properties.spatialCellId}</h4>
      <p>
        Resolution {properties.spatialResolution} · committed centroid{' '}
        {formatCoordinate(feature.geometry.coordinates[1])},{' '}
        {formatCoordinate(feature.geometry.coordinates[0])}
      </p>
      <dl>
        <div>
          <dt>Baseline union</dt>
          <dd>{formatCount(properties.baselineUnionCount)}</dd>
        </div>
        <div>
          <dt>Range-inference eligible baseline</dt>
          <dd>{formatCount(properties.baselineCount)}</dd>
        </div>
        <div>
          <dt>Excluded baseline occurrences</dt>
          <dd>{formatCount(baselineExcludedCount)}</dd>
        </div>
        <div>
          <dt>Flickr candidate evidence</dt>
          <dd>{formatCount(properties.flickrCandidateCount)}</dd>
        </div>
        <div>
          <dt>Visually eligible Flickr candidates</dt>
          <dd>{formatCount(properties.flickrVisuallyEligibleCount)}</dd>
        </div>
        <div>
          <dt>Unreviewed</dt>
          <dd>{formatCount(properties.pendingCount)}</dd>
        </div>
        <div>
          <dt>Human-reviewed target positive</dt>
          <dd>{formatCount(properties.reviewedPositiveCount)}</dd>
        </div>
        <div>
          <dt>Human-reviewed non-target</dt>
          <dd>{formatCount(properties.reviewedNegativeCount)}</dd>
        </div>
        <div>
          <dt>Uncertain</dt>
          <dd>{formatCount(properties.uncertainCount)}</dd>
        </div>
        <div>
          <dt>Release-ready occurrence candidate</dt>
          <dd>{formatCount(properties.releaseReadyCount)}</dd>
        </div>
      </dl>
      <p>
        {contributionLabel(feature)} Nearest baseline distance:{' '}
        {properties.nearestBaselineDistanceKm === null
          ? 'unavailable'
          : `${formatDistance(properties.nearestBaselineDistanceKm)} km`}
        . Baseline state: {properties.dataDeficientState.replaceAll('_', ' ')}.
      </p>
      <p className="geographic-impact-tooltip__disclosure">
        Flickr evidence remains a hypothesis. Human-reviewed target-positive evidence is not
        release-ready unless the occurrence-release gates pass.
      </p>
    </section>
  )
}

function contributionLabel(feature: GeographicImpactMapFeature): string {
  const properties = feature.properties
  if (properties.releaseReadyAdditionalCell) {
    return 'Release-ready additional cell.'
  }
  if (properties.reviewedAdditionalCell) {
    return 'Human-supported additional cell; release gates remain pending.'
  }
  if (properties.candidateOnlyCell) {
    return 'Candidate-only spatial cell; human support remains pending.'
  }
  if (properties.matchedCell) {
    return 'Baseline and Flickr evidence share this cell.'
  }
  if (properties.baselineOnlyCell) {
    return 'Baseline-only evidence cell.'
  }
  return 'No additional-cell classification is available.'
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value)
}

function formatCoordinate(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits: 5,
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDistance(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}
