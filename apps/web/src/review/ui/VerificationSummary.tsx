export interface VerificationOutcomeCounts {
  readonly recorded: number
  readonly yes: number
  readonly no: number
  readonly cantTell: number
  readonly cantView: number
  readonly skipped: number
}

export function VerificationSummary({
  clearState,
  counts,
  onClear,
  onExport,
}: {
  readonly clearState: 'idle' | 'clearing' | 'success' | 'error'
  readonly counts: VerificationOutcomeCounts
  readonly onClear: () => void
  readonly onExport: () => void
}) {
  return (
    <section className="review-summary" aria-labelledby="review-summary-title">
      <div>
        <p className="eyebrow">Local receipt</p>
        <h3 id="review-summary-title">Review summary</h3>
        <p>
          Yes {counts.yes} · No {counts.no} · Can’t tell {counts.cantTell} ·
          Can’t view {counts.cantView} · Skipped {counts.skipped}
        </p>
      </div>
      <div className="review-summary__actions">
        <button
          type="button"
          disabled={counts.recorded === 0}
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
