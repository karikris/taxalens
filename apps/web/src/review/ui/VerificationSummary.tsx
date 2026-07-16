import type { VerificationCoverage } from '../domain'

export function VerificationSummary({
  clearState,
  coverage,
  onClear,
  onExport,
}: {
  readonly clearState: 'idle' | 'clearing' | 'success' | 'error'
  readonly coverage: VerificationCoverage
  readonly onClear: () => void
  readonly onExport: () => void
}) {
  return (
    <section className="review-summary" aria-labelledby="review-summary-title">
      <div>
        <p className="eyebrow">Local receipt</p>
        <h3 id="review-summary-title">Review summary</h3>
        <p>
          Decisively reviewed {coverage.decisivelyReviewedItems} · Uncertain{' '}
          {coverage.uncertainItems} · Media failures{' '}
          {coverage.mediaFailureItems} · Deferred {coverage.deferredItems} ·
          Pending {coverage.pendingItems}
        </p>
        <p>
          Effective reviews · Yes {coverage.yesReviewCount} · No{' '}
          {coverage.noReviewCount} · Can’t tell{' '}
          {coverage.cantTellReviewCount} · Can’t view{' '}
          {coverage.cantViewReviewCount} · Skipped{' '}
          {coverage.skippedReviewCount}
        </p>
      </div>
      <div className="review-summary__actions">
        <button
          type="button"
          disabled={coverage.attemptedItems === 0}
          onClick={onExport}
        >
          Export review receipt
        </button>
        <button
          type="button"
          className="review-button--quiet"
          disabled={clearState === 'clearing'}
          aria-busy={clearState === 'clearing'}
          onClick={onClear}
        >
          {clearState === 'clearing'
            ? 'Clearing cache and review…'
            : 'Clear cache and review'}
        </button>
      </div>
    </section>
  )
}
