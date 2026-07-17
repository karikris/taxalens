import type { GeographicImpactMetric } from './geographicImpactQuery'
import { countPotentialCoverageGapCells } from './geographicContributionMetrics'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

export const GEOGRAPHIC_COUNTRY_RANKING_METRICS = Object.freeze([
  'candidate_only_cells',
  'reviewed_additional_cells',
  'release_ready_additional_cells',
  'range_edge_distance',
  'review_backlog',
] as const satisfies readonly GeographicImpactMetric[])

export interface GeographicCountryRankingRow {
  readonly countryCode: string
  readonly country: string
  readonly sourceCellCount: number
  readonly candidateOnlyCellCount: number
  readonly reviewedAdditionalCellCount: number
  readonly releaseReadyAdditionalCellCount: number
  readonly maximumRangeEdgeDistanceKm: number | null
  readonly reviewBacklog: number
  readonly selectedMetricValue: number | null
}

export interface GeographicCountryRankingModel {
  readonly rows: readonly GeographicCountryRankingRow[]
  readonly metric: GeographicImpactMetric
  readonly unassignedCellCount: number
}

const METRIC_COPY: Readonly<
  Record<
    (typeof GEOGRAPHIC_COUNTRY_RANKING_METRICS)[number],
    { readonly label: string; readonly description: string }
  >
> = Object.freeze({
  candidate_only_cells: {
    label: 'Potential coverage-gap cells',
    description: 'Cells with no selected baseline evidence and at least one Flickr candidate.',
  },
  reviewed_additional_cells: {
    label: 'Human-supported additional cells',
    description: 'Candidate-only cells containing a human-reviewed target-positive result.',
  },
  release_ready_additional_cells: {
    label: 'Release-ready additional cells',
    description: 'Additional cells containing a candidate that passed every occurrence-release gate.',
  },
  range_edge_distance: {
    label: 'Range-edge distance',
    description: 'Largest nearest-baseline distance among Flickr candidate cells.',
  },
  review_backlog: {
    label: 'Review backlog',
    description: 'Flickr candidates whose committed verification state is pending.',
  },
})

export function GeographicCountryRanking({
  cells,
  metric,
  onCountrySelect,
  onMetricChange,
}: {
  readonly cells: readonly PublicGeographicImpactMapCell[]
  readonly metric: GeographicImpactMetric
  readonly onCountrySelect: (countryCode: string) => void
  readonly onMetricChange: (metric: GeographicImpactMetric) => void
}) {
  const ranking = buildGeographicCountryRanking(cells, metric)
  const metricCopy = rankingMetricCopy(metric)
  return (
    <section className="geographic-country-ranking" aria-labelledby="country-ranking-title">
      <div className="geographic-country-ranking__heading">
        <div>
          <p className="eyebrow">Country comparison</p>
          <h4 id="country-ranking-title">Geographic contribution ranking</h4>
        </div>
        <label>
          <span>Rank countries by</span>
          <select
            value={metric}
            onChange={(event) => onMetricChange(requiredRankingMetric(event.currentTarget.value))}
          >
            {GEOGRAPHIC_COUNTRY_RANKING_METRICS.map((value) => (
              <option key={value} value={value}>
                {METRIC_COPY[value].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p id="country-ranking-description">{metricCopy.description} Exact values are shown.</p>
      {ranking.rows.length === 0 ? (
        <p>No committed cells in this scope have a canonical country identity.</p>
      ) : (
        <ol aria-describedby="country-ranking-description">
          {ranking.rows.slice(0, 10).map((row) => (
            <li key={row.countryCode}>
              <div>
                <button type="button" onClick={() => onCountrySelect(row.countryCode)}>
                  <span>{row.country}</span>
                  <small>{row.countryCode}</small>
                </button>
                <output aria-label={`${row.country}: ${metricCopy.label}`}>
                  {formatMetricValue(row.selectedMetricValue, metric)}
                </output>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="geographic-country-ranking__disclosure">
        {ranking.unassignedCellCount.toLocaleString('en-AU')} cell
        {ranking.unassignedCellCount === 1 ? '' : 's'} without canonical country identity are kept
        outside this ranking. Missing baseline evidence remains unknown, not biological absence.
      </p>
    </section>
  )
}

export function buildGeographicCountryRanking(
  cells: readonly PublicGeographicImpactMapCell[],
  metric: GeographicImpactMetric,
): GeographicCountryRankingModel {
  requiredRankingMetric(metric)
  const countryCells = new Map<string, PublicGeographicImpactMapCell[]>()
  let unassignedCellCount = 0
  for (const cell of cells) {
    if (cell.countryCode === null || cell.country === null) {
      unassignedCellCount += 1
      continue
    }
    const existing = countryCells.get(cell.countryCode)
    if (existing === undefined) countryCells.set(cell.countryCode, [cell])
    else existing.push(cell)
  }
  const rows = [...countryCells.entries()]
    .map(([countryCode, groupedCells]) => countryRankingRow(countryCode, groupedCells, metric))
    .sort((left, right) => {
      const leftValue = left.selectedMetricValue ?? Number.NEGATIVE_INFINITY
      const rightValue = right.selectedMetricValue ?? Number.NEGATIVE_INFINITY
      if (rightValue !== leftValue) return rightValue - leftValue
      const nameOrder = left.country.localeCompare(right.country)
      return nameOrder === 0 ? left.countryCode.localeCompare(right.countryCode) : nameOrder
    })
  return Object.freeze({
    rows: Object.freeze(rows),
    metric,
    unassignedCellCount,
  })
}

function countryRankingRow(
  countryCode: string,
  cells: readonly PublicGeographicImpactMapCell[],
  metric: GeographicImpactMetric,
): GeographicCountryRankingRow {
  const candidateDistances = cells
    .filter(({ flickrCandidateCount }) => flickrCandidateCount > 0)
    .map(({ nearestBaselineDistanceKm }) => nearestBaselineDistanceKm)
    .filter((distance): distance is number => distance !== null)
  const row = {
    countryCode,
    country: cells[0]?.country ?? countryCode,
    sourceCellCount: cells.length,
    candidateOnlyCellCount: countPotentialCoverageGapCells(cells),
    reviewedAdditionalCellCount: countTrue(cells, 'reviewedAdditionalCell'),
    releaseReadyAdditionalCellCount: countTrue(cells, 'releaseReadyAdditionalCell'),
    maximumRangeEdgeDistanceKm:
      candidateDistances.length === 0 ? null : Math.max(...candidateDistances),
    reviewBacklog: cells.reduce((total, { pendingCount }) => total + pendingCount, 0),
  }
  return Object.freeze({ ...row, selectedMetricValue: countryMetricValue(row, metric) })
}

function countryMetricValue(
  row: Omit<GeographicCountryRankingRow, 'selectedMetricValue'>,
  metric: GeographicImpactMetric,
): number | null {
  switch (metric) {
    case 'candidate_only_cells':
      return row.candidateOnlyCellCount
    case 'reviewed_additional_cells':
      return row.reviewedAdditionalCellCount
    case 'release_ready_additional_cells':
      return row.releaseReadyAdditionalCellCount
    case 'range_edge_distance':
      return row.maximumRangeEdgeDistanceKm
    case 'review_backlog':
      return row.reviewBacklog
    case 'record_count':
      throw new Error('record_count is not a country contribution ranking metric')
  }
}

function countTrue(
  cells: readonly PublicGeographicImpactMapCell[],
  field: 'candidateOnlyCell' | 'reviewedAdditionalCell' | 'releaseReadyAdditionalCell',
): number {
  return cells.filter((cell) => cell[field]).length
}

function requiredRankingMetric(value: string): GeographicImpactMetric {
  if (!(GEOGRAPHIC_COUNTRY_RANKING_METRICS as readonly string[]).includes(value)) {
    throw new Error(`unsupported country ranking metric: ${value}`)
  }
  return value as GeographicImpactMetric
}

function rankingMetricCopy(metric: GeographicImpactMetric) {
  requiredRankingMetric(metric)
  return METRIC_COPY[metric as (typeof GEOGRAPHIC_COUNTRY_RANKING_METRICS)[number]]
}

function formatMetricValue(value: number | null, metric: GeographicImpactMetric): string {
  if (value === null) return 'Unavailable'
  if (metric === 'range_edge_distance') {
    return `${value.toLocaleString('en-AU', { maximumFractionDigits: 2 })} km`
  }
  return value.toLocaleString('en-AU')
}
