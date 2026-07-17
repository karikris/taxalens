import { useEffect, useMemo, useState } from 'react'

import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

const DEFAULT_PAGE_SIZE = 25

export const GEOGRAPHIC_IMPACT_TABLE_SORT_KEYS = Object.freeze([
  'spatialCellId',
  'country',
  'baseline',
  'flickrCandidates',
  'pending',
  'reviewedPositive',
  'releaseReady',
  'nearestBaselineDistance',
  'dataDeficiency',
] as const)

export type GeographicImpactTableSortKey =
  (typeof GEOGRAPHIC_IMPACT_TABLE_SORT_KEYS)[number]
export type GeographicImpactTableSortDirection = 'ascending' | 'descending'

export interface GeographicImpactTableSort {
  readonly key: GeographicImpactTableSortKey
  readonly direction: GeographicImpactTableSortDirection
}

export function GeographicImpactTable({
  cells,
  selectedCellId,
  onCellSelect,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  readonly cells: readonly PublicGeographicImpactMapCell[]
  readonly selectedCellId: string | null
  readonly onCellSelect: (spatialCellId: string) => void
  readonly pageSize?: number
}) {
  const [sort, setSort] = useState<GeographicImpactTableSort>({
    key: 'flickrCandidates',
    direction: 'descending',
  })
  const [page, setPage] = useState(0)
  const sortedCells = useMemo(() => sortGeographicImpactCells(cells, sort), [cells, sort])
  const pageCount = Math.max(1, Math.ceil(sortedCells.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visibleCells = sortedCells.slice(safePage * pageSize, (safePage + 1) * pageSize)

  useEffect(() => setPage(0), [cells, pageSize, sort])
  useEffect(() => {
    if (selectedCellId === null) return
    const selectedIndex = sortedCells.findIndex(
      ({ spatialCellId }) => spatialCellId === selectedCellId,
    )
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize))
  }, [pageSize, selectedCellId, sortedCells])

  const changeSort = (key: GeographicImpactTableSortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }))
  }

  return (
    <section className="geographic-impact-table" aria-labelledby="impact-table-title">
      <div>
        <p className="eyebrow">Map alternative</p>
        <h4 id="impact-table-title">Exact geographic evidence cells</h4>
        <p>
          Select a row to synchronize the map and evidence details. The table remains usable when
          WebGL map rendering is unavailable.
        </p>
      </div>
      <div
        className="geographic-impact-table__scroll"
        role="region"
        aria-label="Scrollable geographic impact evidence table"
        tabIndex={0}
      >
        <table>
          <caption>
            {cells.length.toLocaleString('en-AU')} exact preaggregated cells in the selected scope
          </caption>
          <thead>
            <tr>
              <th scope="col">Select</th>
              <SortableHeader label="Spatial cell" column="spatialCellId" sort={sort} onSort={changeSort} />
              <SortableHeader label="Country" column="country" sort={sort} onSort={changeSort} />
              <SortableHeader label="Baseline eligible" column="baseline" sort={sort} onSort={changeSort} />
              <SortableHeader label="Flickr candidates" column="flickrCandidates" sort={sort} onSort={changeSort} />
              <SortableHeader label="Pending" column="pending" sort={sort} onSort={changeSort} />
              <SortableHeader label="Reviewed positive" column="reviewedPositive" sort={sort} onSort={changeSort} />
              <th scope="col">Reviewed non-target</th>
              <th scope="col">Uncertain</th>
              <SortableHeader label="Release-ready" column="releaseReady" sort={sort} onSort={changeSort} />
              <SortableHeader label="Nearest baseline" column="nearestBaselineDistance" sort={sort} onSort={changeSort} />
              <SortableHeader label="Baseline state" column="dataDeficiency" sort={sort} onSort={changeSort} />
            </tr>
          </thead>
          <tbody>
            {visibleCells.map((cell) => {
              const selected = cell.spatialCellId === selectedCellId
              return (
                <tr key={cell.spatialCellId} data-selected={selected ? 'true' : 'false'}>
                  <td>
                    <button
                      type="button"
                      aria-label={`${selected ? 'Selected' : 'Select'} ${cell.spatialCellId}`}
                      aria-pressed={selected}
                      onClick={() => onCellSelect(cell.spatialCellId)}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </button>
                  </td>
                  <th scope="row">{cell.spatialCellId}</th>
                  <td>{formatCountry(cell)}</td>
                  <NumericCell value={cell.baselineRangeInferenceEligibleCount} />
                  <NumericCell value={cell.flickrCandidateCount} />
                  <NumericCell value={cell.pendingCount} />
                  <NumericCell value={cell.reviewedPositiveCount} />
                  <NumericCell value={cell.reviewedNegativeCount} />
                  <NumericCell value={cell.uncertainCount} />
                  <NumericCell value={cell.releaseReadyCount} />
                  <td className="numeric">
                    {cell.nearestBaselineDistanceKm === null
                      ? 'Unavailable'
                      : `${cell.nearestBaselineDistanceKm.toLocaleString('en-AU', {
                          maximumFractionDigits: 2,
                        })} km`}
                  </td>
                  <td>{formatDeficiency(cell.dataDeficientState)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <nav className="geographic-impact-table__pagination" aria-label="Evidence table pages">
        <button
          type="button"
          disabled={safePage === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          Previous
        </button>
        <span role="status" aria-live="polite">
          Page {safePage + 1} of {pageCount}
        </span>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
        >
          Next
        </button>
      </nav>
    </section>
  )
}

export function sortGeographicImpactCells(
  cells: readonly PublicGeographicImpactMapCell[],
  sort: GeographicImpactTableSort,
): readonly PublicGeographicImpactMapCell[] {
  return Object.freeze(
    [...cells].sort((left, right) => {
      const comparison = compareCellValues(left, right, sort.key)
      if (comparison !== 0) {
        return sort.direction === 'ascending' ? comparison : -comparison
      }
      return left.spatialCellId.localeCompare(right.spatialCellId)
    }),
  )
}

function SortableHeader({
  column,
  label,
  sort,
  onSort,
}: {
  readonly column: GeographicImpactTableSortKey
  readonly label: string
  readonly sort: GeographicImpactTableSort
  readonly onSort: (column: GeographicImpactTableSortKey) => void
}) {
  const active = sort.key === column
  return (
    <th scope="col" aria-sort={active ? sort.direction : 'none'}>
      <button type="button" onClick={() => onSort(column)}>
        {label}
        <span aria-hidden="true">
          {active ? (sort.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
        </span>
      </button>
    </th>
  )
}

function NumericCell({ value }: { readonly value: number }) {
  return <td className="numeric">{value.toLocaleString('en-AU')}</td>
}

function compareCellValues(
  left: PublicGeographicImpactMapCell,
  right: PublicGeographicImpactMapCell,
  key: GeographicImpactTableSortKey,
): number {
  switch (key) {
    case 'spatialCellId':
      return left.spatialCellId.localeCompare(right.spatialCellId)
    case 'country':
      return formatCountry(left).localeCompare(formatCountry(right))
    case 'baseline':
      return left.baselineRangeInferenceEligibleCount - right.baselineRangeInferenceEligibleCount
    case 'flickrCandidates':
      return left.flickrCandidateCount - right.flickrCandidateCount
    case 'pending':
      return left.pendingCount - right.pendingCount
    case 'reviewedPositive':
      return left.reviewedPositiveCount - right.reviewedPositiveCount
    case 'releaseReady':
      return left.releaseReadyCount - right.releaseReadyCount
    case 'nearestBaselineDistance':
      return nullableNumber(left.nearestBaselineDistanceKm) - nullableNumber(right.nearestBaselineDistanceKm)
    case 'dataDeficiency':
      return left.dataDeficientState.localeCompare(right.dataDeficientState)
  }
}

function nullableNumber(value: number | null): number {
  return value ?? Number.NEGATIVE_INFINITY
}

function formatCountry(cell: PublicGeographicImpactMapCell): string {
  return cell.country === null || cell.countryCode === null
    ? 'Unassigned'
    : `${cell.country} (${cell.countryCode})`
}

function formatDeficiency(
  state: PublicGeographicImpactMapCell['dataDeficientState'],
): string {
  switch (state) {
    case 'sufficient':
      return 'Sufficient baseline'
    case 'data_deficient':
      return 'Data-deficient baseline'
    case 'unavailable':
      return 'Baseline unavailable'
  }
}
