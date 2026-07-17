import type { CSSProperties } from 'react'

import type { BoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'
import { GEOGRAPHIC_BUBBLE_SCALE_CAPTION } from './geographicBubbleScale'

export interface GeographicImpactLegendCounts {
  readonly baseline: number
  readonly flickrCandidate: number
  readonly pending: number
  readonly reviewedPositive: number
  readonly reviewedNegative: number
  readonly uncertain: number
  readonly releaseReady: number
  readonly skippedOrCannotView: number
}

export function GeographicImpactLegend({
  features,
}: {
  readonly features: BoundedGeographicImpactFeatures
}) {
  const counts = summarizeGeographicImpactLegend(features)
  const scale = features.bubbleScale
  const evidenceRows = [
    {
      className: 'geographic-impact-legend__swatch--baseline',
      count: counts.baseline,
      label: 'Baseline occurrence evidence',
      explanation: 'Blue filled bubble · range-inference eligible',
    },
    {
      className: 'geographic-impact-legend__swatch--pending',
      count: counts.pending,
      label: 'Unreviewed Flickr candidate',
      explanation: 'Hollow amber ring',
    },
    {
      className: 'geographic-impact-legend__swatch--positive',
      count: counts.reviewedPositive,
      label: 'Human-reviewed target positive',
      explanation: 'Solid amber fill',
    },
    {
      className: 'geographic-impact-legend__swatch--negative',
      count: counts.reviewedNegative,
      label: 'Human-reviewed non-target',
      explanation: 'Amber ring with exclusion cross',
    },
    {
      className: 'geographic-impact-legend__swatch--uncertain',
      count: counts.uncertain,
      label: 'Uncertain Flickr candidate',
      explanation: 'Dashed amber ring',
    },
    {
      className: 'geographic-impact-legend__swatch--release',
      count: counts.releaseReady,
      label: 'Release-ready occurrence candidate',
      explanation: 'Solid amber fill with dark external stroke',
    },
  ] as const

  return (
    <section
      className="geographic-impact-legend"
      aria-labelledby="geographic-impact-legend-title"
    >
      <div>
        <p className="eyebrow">Map key</p>
        <h4 id="geographic-impact-legend-title">Evidence and bubble scale</h4>
      </div>
      <div className="geographic-impact-legend__columns">
        <div>
          <h5>Evidence states</h5>
          <ul className="geographic-impact-legend__states">
            {evidenceRows.map(({ className, count, explanation, label }) => (
              <li key={label}>
                <span
                  className={`geographic-impact-legend__swatch ${className}`}
                  aria-hidden="true"
                />
                <span>
                  <strong>{label}</strong>
                  <small>
                    {explanation} · {formatCount(count)} in this scope
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5>Absolute record count</h5>
          {scale.legendValues.length === 0 ? (
            <p>No positive count exists in this scope.</p>
          ) : (
            <ul className="geographic-impact-legend__sizes" aria-label="Bubble size examples">
              {scale.legendValues.map((count) => {
                const diameter = scale.radiusForCount(count) * 2
                return (
                  <li key={count}>
                    <span
                      className="geographic-impact-legend__size"
                      aria-hidden="true"
                      style={
                        {
                          '--geographic-legend-diameter': `${diameter}px`,
                        } as CSSProperties
                      }
                    />
                    <span>{formatCount(count)} records</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="geographic-impact-legend__scale-contract">
            {GEOGRAPHIC_BUBBLE_SCALE_CAPTION} Shared domain {scale.domainMinimum}–
            {formatCount(scale.domainMaximum)} · mode <code>{scale.scaleMode}</code> · visible
            radius {scale.minimumVisibleRadius}–{scale.maximumRadius}px · zero counts hidden.
          </p>
        </div>
      </div>
      <p className="geographic-impact-legend__disclosure">
        Flickr candidate evidence totals {formatCount(counts.flickrCandidate)} in this scope.
        Release-ready is a gated subset of reviewed target-positive evidence. Skip and Can’t view
        total {formatCount(counts.skippedOrCannotView)} and do not count as human-supported
        contribution.
      </p>
    </section>
  )
}

export function summarizeGeographicImpactLegend(
  features: BoundedGeographicImpactFeatures,
): GeographicImpactLegendCounts {
  return Object.freeze(
    features.collection.features.reduce<GeographicImpactLegendCounts>(
      (totals, feature) => {
        const properties = feature.properties
        return {
          baseline: totals.baseline + properties.baselineCount,
          flickrCandidate: totals.flickrCandidate + properties.flickrCandidateCount,
          pending: totals.pending + properties.pendingCount,
          reviewedPositive:
            totals.reviewedPositive + properties.reviewedPositiveCount,
          reviewedNegative:
            totals.reviewedNegative + properties.reviewedNegativeCount,
          uncertain: totals.uncertain + properties.uncertainCount,
          releaseReady: totals.releaseReady + properties.releaseReadyCount,
          skippedOrCannotView:
            totals.skippedOrCannotView +
            properties.skippedCount +
            properties.mediaFailureCount,
        }
      },
      {
        baseline: 0,
        flickrCandidate: 0,
        pending: 0,
        reviewedPositive: 0,
        reviewedNegative: 0,
        uncertain: 0,
        releaseReady: 0,
        skippedOrCannotView: 0,
      },
    ),
  )
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value)
}
