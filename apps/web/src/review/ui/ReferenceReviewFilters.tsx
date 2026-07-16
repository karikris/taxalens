import type {
  VerificationItem,
  VerificationOutcome,
} from '../domain'

export const REFERENCE_REVIEW_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'gbif', label: 'GBIF' },
  { id: 'inaturalist', label: 'iNaturalist' },
  { id: 'target', label: 'Target' },
  { id: 'competitor', label: 'Competitor' },
  { id: 'adult', label: 'Adult' },
  { id: 'larval', label: 'Larval' },
  { id: 'specimen', label: 'Specimen' },
  { id: 'pending', label: 'Pending' },
  { id: 'conflict', label: 'Conflict' },
] as const)

export type ReferenceReviewFilter =
  (typeof REFERENCE_REVIEW_FILTERS)[number]['id']

export interface ReferenceReviewFilterContext {
  readonly targetAcceptedTaxonKey: string | null
  readonly currentOutcomes: Readonly<
    Record<string, VerificationOutcome | undefined>
  >
  readonly conflictItemIds: ReadonlySet<string>
}

export function ReferenceReviewFilters({
  context,
  items,
  onChange,
  value,
}: {
  readonly context: ReferenceReviewFilterContext
  readonly items: readonly VerificationItem[]
  readonly onChange: (filter: ReferenceReviewFilter) => void
  readonly value: ReferenceReviewFilter
}) {
  return (
    <section
      className="reference-review-filters"
      aria-labelledby="reference-review-filters-title"
    >
      <div>
        <p className="eyebrow">Reference queue filters</p>
        <h3 id="reference-review-filters-title">Choose a review route</h3>
      </div>
      <div
        className="reference-review-filters__options"
        role="group"
        aria-label="Reference image filters"
      >
        {REFERENCE_REVIEW_FILTERS.map((filter) => {
          const count = filterReferenceReviewItems(
            items,
            filter.id,
            context,
          ).length
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={value === filter.id}
              data-filter={filter.id}
              onClick={() => onChange(filter.id)}
            >
              {filter.label} <span>{count}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function filterReferenceReviewItems<T extends VerificationItem>(
  items: readonly T[],
  filter: ReferenceReviewFilter,
  context: ReferenceReviewFilterContext,
): readonly T[] {
  if (filter === 'all') {
    return items
  }
  return items.filter((item) => {
    switch (filter) {
      case 'gbif':
      case 'inaturalist':
        return item.source === filter
      case 'target':
        return (
          context.targetAcceptedTaxonKey !== null &&
          item.targetTaxon.acceptedTaxonKey ===
            context.targetAcceptedTaxonKey
        )
      case 'competitor':
        return (
          context.targetAcceptedTaxonKey !== null &&
          item.targetTaxon.acceptedTaxonKey !==
            context.targetAcceptedTaxonKey
        )
      case 'adult':
        return item.expectedLifeStage === 'adult'
      case 'larval':
        return item.expectedLifeStage === 'larva'
      case 'specimen':
        return item.expectedVisualDomain === 'pinned_specimen'
      case 'pending': {
        const outcome = context.currentOutcomes[item.itemId]
        return outcome === undefined || outcome === 'skipped'
      }
      case 'conflict':
        return context.conflictItemIds.has(item.itemId)
    }
  })
}
