export const LOCAL_REVIEW_LEDGER_CHANGED_EVENT =
  'taxalens:local-review-ledger-changed' as const

export interface LocalReviewLedgerChange {
  readonly campaignId: string
  readonly operation: 'append' | 'clear'
  readonly eventId: string | null
}

export function announceLocalReviewLedgerChange(
  change: LocalReviewLedgerChange,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<LocalReviewLedgerChange>(LOCAL_REVIEW_LEDGER_CHANGED_EVENT, {
      detail: Object.freeze({ ...change }),
    }),
  )
}

export function subscribeToLocalReviewLedgerChanges(
  listener: (change: LocalReviewLedgerChange) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handle = (event: Event) => {
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as Partial<LocalReviewLedgerChange> | null
    if (
      detail === null ||
      typeof detail.campaignId !== 'string' ||
      (detail.operation !== 'append' && detail.operation !== 'clear') ||
      (detail.eventId !== null && typeof detail.eventId !== 'string')
    ) {
      return
    }
    listener({
      campaignId: detail.campaignId,
      operation: detail.operation,
      eventId: detail.eventId,
    })
  }
  window.addEventListener(LOCAL_REVIEW_LEDGER_CHANGED_EVENT, handle)
  return () => window.removeEventListener(LOCAL_REVIEW_LEDGER_CHANGED_EVENT, handle)
}
