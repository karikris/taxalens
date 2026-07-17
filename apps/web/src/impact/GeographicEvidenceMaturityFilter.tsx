import type { GeographicEvidenceMode } from './geographicImpactQuery'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

const FILTER_OPTIONS = Object.freeze([
  {
    value: 'comparison',
    label: 'All evidence',
    description: 'Baseline and Flickr evidence together.',
  },
  {
    value: 'baseline',
    label: 'Baseline',
    description: 'Cells containing range-inference-eligible baseline evidence.',
  },
  {
    value: 'flickr_candidates',
    label: 'Flickr candidates',
    description: 'Cells containing Flickr candidate evidence at any review maturity.',
  },
  {
    value: 'human_reviewed',
    label: 'Human reviewed',
    description: 'Cells with a retained human outcome, including uncertainty or media failure.',
  },
  {
    value: 'release_ready',
    label: 'Release-ready',
    description: 'Cells containing a candidate that passed every occurrence-release gate.',
  },
] as const satisfies readonly {
  readonly value: GeographicEvidenceMode
  readonly label: string
  readonly description: string
}[])

export function filterGeographicImpactCells(
  cells: readonly PublicGeographicImpactMapCell[],
  mode: GeographicEvidenceMode,
): readonly PublicGeographicImpactMapCell[] {
  return Object.freeze(cells.filter((cell) => cellMatchesMode(cell, mode)))
}

export function GeographicEvidenceMaturityFilter({
  mode,
  onChange,
  sourceCellCount,
  visibleCellCount,
}: {
  readonly mode: GeographicEvidenceMode
  readonly onChange: (mode: GeographicEvidenceMode) => void
  readonly sourceCellCount: number
  readonly visibleCellCount: number
}) {
  const selected = FILTER_OPTIONS.find(({ value }) => value === mode)!
  return (
    <section
      className="geographic-evidence-filter"
      aria-labelledby="geographic-evidence-filter-title"
    >
      <fieldset>
        <legend id="geographic-evidence-filter-title">Evidence maturity</legend>
        <p>Filter the map, exact table, detail panels and ranking together.</p>
        <div>
          {FILTER_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="geographic-evidence-maturity"
                value={option.value}
                checked={option.value === mode}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" aria-live="polite">
        {visibleCellCount.toLocaleString('en-US')} of{' '}
        {sourceCellCount.toLocaleString('en-US')} cells match {selected.label}.{' '}
        {selected.description}
      </p>
      {visibleCellCount === 0 ? (
        <p>
          No cells match this maturity in the selected scope. Zero is retained as an exact
          evidence state; another maturity filter may still contain candidates.
        </p>
      ) : null}
    </section>
  )
}

function cellMatchesMode(
  cell: PublicGeographicImpactMapCell,
  mode: GeographicEvidenceMode,
): boolean {
  switch (mode) {
    case 'comparison':
      return true
    case 'baseline':
      return cell.baselineRangeInferenceEligibleCount > 0
    case 'flickr_candidates':
      return cell.flickrCandidateCount > 0
    case 'human_reviewed':
      return (
        cell.reviewedPositiveCount +
          cell.reviewedNegativeCount +
          cell.uncertainCount +
          cell.mediaFailureCount +
          cell.skippedCount >
        0
      )
    case 'release_ready':
      return cell.releaseReadyCount > 0
  }
}
