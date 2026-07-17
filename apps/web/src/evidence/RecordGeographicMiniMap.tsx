import { useId } from 'react'

import { TAXALENS_COUNTRY_BOUNDARIES } from '../impact/offlineMapStyle'
import type { RecordGeographicContext } from './recordGeographicContext'

const WIDTH = 720
const HEIGHT = 360

export function RecordGeographicMiniMap({
  context,
}: {
  readonly context: RecordGeographicContext
}) {
  const titleId = useId()
  const descriptionId = useId()
  const bounds = mapBounds(context)
  const candidate = project(
    context.candidateCoordinate.longitude,
    context.candidateCoordinate.latitude,
    bounds,
  )
  const nearest =
    context.impact.nearestBaselineCellId === null
      ? null
      : context.nearbyBaselineCells.find(
          ({ spatialCellId }) => spatialCellId === context.impact.nearestBaselineCellId,
        ) ?? null
  const nearestPoint =
    nearest === null ? null : project(nearest.longitude, nearest.latitude, bounds)
  const paths = boundaryPaths(bounds)

  return (
    <figure className="record-geographic-mini-map">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>Record geographic context mini-map</title>
        <desc id={descriptionId}>
          Hollow amber marker at the selected Flickr candidate coordinate, {context.nearbyBaselineCells.length}{' '}
          blue filled baseline cell centroid markers, and a dashed line to the nearest baseline cell.
        </desc>
        <rect width={WIDTH} height={HEIGHT} className="record-geographic-mini-map__ocean" />
        <g aria-hidden="true" className="record-geographic-mini-map__boundaries">
          {paths.map((path, index) => <path d={path} key={index} />)}
        </g>
        {nearestPoint === null ? null : (
          <line
            aria-hidden="true"
            className="record-geographic-mini-map__distance"
            x1={candidate.x}
            y1={candidate.y}
            x2={nearestPoint.x}
            y2={nearestPoint.y}
          />
        )}
        <g aria-label="Nearby baseline occurrence evidence cell centroids">
          {context.nearbyBaselineCells.map((cell) => {
            const point = project(cell.longitude, cell.latitude, bounds)
            return (
              <circle
                key={cell.spatialCellId}
                className="record-geographic-mini-map__baseline"
                cx={point.x}
                cy={point.y}
                r={cell.spatialCellId === context.impact.nearestBaselineCellId ? 7 : 5}
                aria-label={`${cell.baselineRangeInferenceEligibleCount} range-inference-eligible baseline observations at cell ${cell.spatialCellId}`}
              />
            )
          })}
        </g>
        <circle
          className="record-geographic-mini-map__candidate-halo"
          cx={candidate.x}
          cy={candidate.y}
          r={12}
          aria-hidden="true"
        />
        <circle
          className="record-geographic-mini-map__candidate"
          cx={candidate.x}
          cy={candidate.y}
          r={8}
          aria-label={`Flickr candidate at ${context.candidateCoordinate.latitude.toFixed(6)}, ${context.candidateCoordinate.longitude.toFixed(6)}`}
        />
      </svg>
      <figcaption>
        <strong>Candidate and same-resolution baseline context</strong>
        <span>
          Hollow amber: exact Flickr candidate coordinate · blue filled: baseline cell centroid · dashed:
          nearest baseline relationship at H3 resolution {context.selectedCell.spatialResolution}.
        </span>
        <small>Fixed marker sizes show evidence role, not record count.</small>
      </figcaption>
    </figure>
  )
}

interface Bounds {
  readonly west: number
  readonly east: number
  readonly south: number
  readonly north: number
}

function mapBounds(context: RecordGeographicContext): Bounds {
  const longitudes = [
    context.candidateCoordinate.longitude,
    ...context.nearbyBaselineCells.map(({ longitude }) => longitude),
  ]
  const latitudes = [
    context.candidateCoordinate.latitude,
    ...context.nearbyBaselineCells.map(({ latitude }) => latitude),
  ]
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const longitudePadding = Math.max(3, (east - west) * 0.18)
  const latitudePadding = Math.max(2, (north - south) * 0.22)
  return Object.freeze({
    west: Math.max(-180, west - longitudePadding),
    east: Math.min(180, east + longitudePadding),
    south: Math.max(-85, south - latitudePadding),
    north: Math.min(85, north + latitudePadding),
  })
}

function project(longitude: number, latitude: number, bounds: Bounds) {
  return Object.freeze({
    x: ((longitude - bounds.west) / (bounds.east - bounds.west)) * WIDTH,
    y: ((bounds.north - latitude) / (bounds.north - bounds.south)) * HEIGHT,
  })
}

function boundaryPaths(bounds: Bounds): readonly string[] {
  const paths: string[] = []
  for (const feature of TAXALENS_COUNTRY_BOUNDARIES.features) {
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates
          : []
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (!ringIntersectsBounds(ring, bounds)) continue
        const points = ring.map(([longitude, latitude]) =>
          project(longitude ?? 0, latitude ?? 0, bounds),
        )
        if (points.length < 3) continue
        paths.push(
          `${points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join('')}Z`,
        )
      }
    }
  }
  return Object.freeze(paths)
}

function ringIntersectsBounds(
  ring: readonly (readonly number[])[],
  bounds: Bounds,
): boolean {
  const longitudes = ring.map(([longitude = 0]) => longitude)
  const latitudes = ring.map(([, latitude = 0]) => latitude)
  return !(
    Math.max(...longitudes) < bounds.west ||
    Math.min(...longitudes) > bounds.east ||
    Math.max(...latitudes) < bounds.south ||
    Math.min(...latitudes) > bounds.north
  )
}
