import {
  isScientificHumanReviewOutcome,
  type HumanReviewOutcome,
} from '../domain/reviewSession'
import { humanReviewOutcomeLabel } from './VerificationItemViewer'

export type VerificationCacheState =
  | 'checking'
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'error'

export function VerificationControls({
  cacheState,
  comment,
  currentOutcome,
  imageFailureReason,
  onCommentChange,
  onReviewerIdChange,
  onSelectOutcome,
  repositoryReady,
  reviewerId,
  scientificDecisionReady,
}: {
  readonly cacheState: VerificationCacheState
  readonly comment: string
  readonly currentOutcome: HumanReviewOutcome | undefined
  readonly imageFailureReason: string | null
  readonly onCommentChange: (comment: string) => void
  readonly onReviewerIdChange: (reviewerId: string) => void
  readonly onSelectOutcome: (outcome: HumanReviewOutcome) => void
  readonly repositoryReady: boolean
  readonly reviewerId: string
  readonly scientificDecisionReady: boolean
}) {
  return (
    <form
      className="review-decision-panel"
      onSubmit={(event) => event.preventDefault()}
    >
      <p className="eyebrow">Step 2 · record judgment</p>
      <label>
        Reviewer ID <span>(optional)</span>
        <input
          type="text"
          value={reviewerId}
          placeholder="e.g. initials or local alias"
          onChange={(event) => onReviewerIdChange(event.target.value)}
        />
      </label>
      <label>
        Comment <span>(optional)</span>
        <textarea
          rows={4}
          value={comment}
          placeholder="Note a visible feature, mismatch, or technical issue."
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </label>
      <fieldset>
        <legend>Does the image support the verification label?</legend>
        <p
          id="review-scientific-readiness"
          className="review-decision__readiness"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-ready={scientificDecisionReady}
        >
          {scientificReadinessMessage({
            cacheState,
            imageFailureReason,
            ready: scientificDecisionReady,
          })}
        </p>
        <div className="review-decision-grid">
          {(
            [
              'yes',
              'no',
              'cant_tell',
              'cant_view',
              'skipped',
            ] as const
          ).map((outcome) => {
            const scientific = isScientificHumanReviewOutcome(outcome)
            return (
              <button
                key={outcome}
                type="button"
                aria-pressed={currentOutcome === outcome}
                aria-describedby={
                  scientific && !scientificDecisionReady
                    ? 'review-scientific-readiness'
                    : undefined
                }
                data-outcome={outcome}
                disabled={
                  !repositoryReady ||
                  (scientific && !scientificDecisionReady)
                }
                onClick={() => onSelectOutcome(outcome)}
              >
                {humanReviewOutcomeLabel(outcome)}
              </button>
            )
          })}
        </div>
      </fieldset>
      <p className="review-decision__hint">
        Yes, No, and Can’t tell require the verified image to be displayed. Can’t
        view records a media problem. Skip defers the item without making a
        scientific judgment. Any choice can be replaced by revisiting the image.
      </p>
    </form>
  )
}

export function scientificReadinessMessage({
  cacheState,
  imageFailureReason,
  ready,
}: {
  readonly cacheState: VerificationCacheState
  readonly imageFailureReason: string | null
  readonly ready: boolean
}): string {
  if (ready) {
    return 'Verified image displayed. Yes, No, and Can’t tell are available.'
  }
  if (imageFailureReason !== null) {
    return `${imageFailureReason} Yes, No, and Can’t tell remain unavailable; Can’t view and Skip are available.`
  }
  if (cacheState === 'checking' || cacheState === 'preparing') {
    return 'Preparing verified media. Yes, No, and Can’t tell are unavailable until the image is displayed.'
  }
  if (cacheState === 'ready') {
    return 'Opening the verified image. Yes, No, and Can’t tell are unavailable until it is displayed.'
  }
  return 'Prepare and display the verified image before choosing Yes, No, or Can’t tell. Can’t view and Skip are available now.'
}
