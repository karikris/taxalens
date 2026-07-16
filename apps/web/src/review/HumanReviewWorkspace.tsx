import { useEffect, useMemo, useState } from 'react'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
} from './reviewPacket'
import {
  browserReviewMediaCache,
  clearHumanReviewSession,
  emptyHumanReviewSession,
  exportHumanReviewReceipt,
  loadHumanReviewSession,
  saveHumanReviewSession,
  withDecision,
  withReviewerId,
  type HumanReviewOutcome,
  type HumanReviewSession,
  type ReviewCacheStatus,
  type ReviewMediaCache,
} from './reviewStore'
import './review.css'

const EMPTY_CACHE_STATUS: ReviewCacheStatus = Object.freeze({
  ready: false,
  cachedCount: 0,
  totalCount: HUMAN_REVIEW_PACKET.items.length,
  persistentBrowserCache: false,
})

export function HumanReviewWorkspace({
  cache = browserReviewMediaCache,
  now = () => new Date(),
  replay,
}: {
  readonly cache?: ReviewMediaCache
  readonly now?: () => Date
  readonly replay: ReplayEvidence
}) {
  const [session, setSession] = useState<HumanReviewSession>(() =>
    loadHumanReviewSession(),
  )
  const [index, setIndex] = useState(() => firstPendingIndex(session))
  const [cacheStatus, setCacheStatus] =
    useState<ReviewCacheStatus>(EMPTY_CACHE_STATUS)
  const [cacheState, setCacheState] = useState<
    'checking' | 'idle' | 'preparing' | 'ready' | 'error'
  >('checking')
  const [cacheError, setCacheError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const item = itemAt(index)
  const decision = session.decisions[item.itemId]
  const [comment, setComment] = useState(decision?.comment ?? '')

  useEffect(() => {
    let active = true
    void cache
      .inspect(HUMAN_REVIEW_PACKET)
      .then((status) => {
        if (!active) return
        setCacheStatus(status)
        setCacheState(status.ready ? 'ready' : 'idle')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setCacheState('error')
        setCacheError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [cache])

  useEffect(() => {
    setComment(decision?.comment ?? '')
  }, [decision, item.itemId])

  useEffect(() => {
    if (!cacheStatus.ready) {
      setImageUrl(null)
      return
    }
    let active = true
    let openedUrl: string | null = null
    void cache
      .open(item)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        openedUrl = url
        setImageUrl(url)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setImageUrl(null)
        setCacheState('error')
        setCacheError(errorMessage(reason))
      })
    return () => {
      active = false
      if (openedUrl !== null) {
        URL.revokeObjectURL(openedUrl)
      }
    }
  }, [cache, cacheStatus.ready, item])

  const counts = useMemo(() => outcomeCounts(session), [session])

  function prepareCache() {
    const controller = new AbortController()
    setCacheState('preparing')
    setCacheError(null)
    void cache
      .prepare(HUMAN_REVIEW_PACKET, controller.signal, setCacheStatus)
      .then((status) => {
        setCacheStatus(status)
        setCacheState('ready')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setCacheState('error')
        setCacheError(errorMessage(reason))
      })
  }

  function updateReviewerId(reviewerId: string) {
    const next = withReviewerId(session, reviewerId)
    setSession(next)
    saveHumanReviewSession(next)
  }

  function record(outcome: HumanReviewOutcome) {
    const next = withDecision(session, {
      itemId: item.itemId,
      outcome,
      comment: comment.trim() || null,
      reviewedAt: now().toISOString(),
    })
    setSession(next)
    saveHumanReviewSession(next)
    if (index < HUMAN_REVIEW_PACKET.items.length - 1) {
      setIndex(index + 1)
    }
  }

  function clearReview() {
    void cache.clear()
    clearHumanReviewSession()
    setSession(emptyHumanReviewSession())
    setIndex(0)
    setComment('')
    setImageUrl(null)
    setCacheStatus(EMPTY_CACHE_STATUS)
    setCacheState('idle')
    setCacheError(null)
  }

  return (
    <section className="detail-panel human-review" aria-labelledby="human-review-title">
      <div className="human-review__heading">
        <div>
          <p className="eyebrow">Local human verification</p>
          <h2 id="human-review-title">Review the label, one image at a time</h2>
          <p className="lede">
            Prepare a checksum-verified three-image browser cache, inspect the displayed label,
            then choose Yes, No, Can’t tell, Can’t view, or Skip. Comments are optional.
          </p>
        </div>
        <div className="human-review__progress" aria-live="polite">
          <strong>
            {counts.recorded} / {HUMAN_REVIEW_PACKET.items.length}
          </strong>
          <span>recorded locally</span>
        </div>
      </div>

      <EvidenceState state="available" title="BioMiner suitability confirmation acknowledged">
        The pinned BioMiner update records 81 / 81 provider-supported items as human-confirmed
        suitable for their assigned prototype roles. It still records 0 independently
        taxonomically verified labels.
      </EvidenceState>

      <aside className="human-review__boundary">
        <strong>Separate review packet</strong>
        <span>
          These CC-licensed Commons images are not the frozen BioMiner reference bank. Decisions
          remain in this browser until you export a receipt; no result is sent to a server.
        </span>
      </aside>

      <section className="review-cache" aria-labelledby="review-cache-title">
        <div>
          <p className="eyebrow">Step 1 · prepare media</p>
          <h3 id="review-cache-title">Small local image cache</h3>
          <p>
            {cacheStatus.cachedCount} of {cacheStatus.totalCount} images verified ·{' '}
            {cacheStatus.persistentBrowserCache
              ? 'browser Cache Storage'
              : 'temporary in-memory fallback'}
          </p>
        </div>
        <button
          type="button"
          disabled={cacheState === 'preparing' || cacheStatus.ready}
          onClick={prepareCache}
        >
          {cacheState === 'preparing'
            ? `Downloading ${cacheStatus.cachedCount} / ${cacheStatus.totalCount}…`
            : cacheStatus.ready
              ? 'Cache ready'
              : 'Prepare review cache'}
        </button>
      </section>

      {cacheState === 'error' && (
        <EvidenceState state="failure" title="The review cache could not be prepared">
          {cacheError}
        </EvidenceState>
      )}

      <div className="human-review__workspace">
        <section className="review-image-panel" aria-labelledby="review-item-title">
          <div className="review-item__topline">
            <span>
              Image {index + 1} of {HUMAN_REVIEW_PACKET.items.length}
            </span>
            <span>{decision === undefined ? 'Pending' : outcomeLabel(decision.outcome)}</span>
          </div>
          <div className="review-image-frame">
            {imageUrl === null ? (
              <div className="review-image-placeholder">
                <strong>Image not opened</strong>
                <span>Prepare the local cache to view this review item.</span>
              </div>
            ) : (
              <img src={imageUrl} alt={item.verificationLabel} />
            )}
          </div>
          <h3 id="review-item-title">{item.verificationLabel}</h3>
          <p className="review-item__metadata">
            Adult · live field · {item.view} view · expected label{' '}
            <i>{replay.target.scientificName}</i>
          </p>
          <p className="review-item__attribution">
            <a href={item.source.sourceUrl} target="_blank" rel="noreferrer">
              {item.source.title}
            </a>{' '}
            by {item.source.creator} ·{' '}
            <a href={item.source.licenseUrl} target="_blank" rel="noreferrer">
              {item.source.licenseName}
            </a>
          </p>
        </section>

        <form
          className="review-decision-panel"
          onSubmit={(event) => event.preventDefault()}
        >
          <p className="eyebrow">Step 2 · record judgment</p>
          <label>
            Reviewer ID <span>(optional)</span>
            <input
              type="text"
              value={session.reviewerId}
              placeholder="e.g. initials or local alias"
              onChange={(event) => updateReviewerId(event.target.value)}
            />
          </label>
          <label>
            Comment <span>(optional)</span>
            <textarea
              rows={4}
              value={comment}
              placeholder="Note a visible feature, mismatch, or technical issue."
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Does the image support the verification label?</legend>
            <div className="review-decision-grid">
              <DecisionButton
                outcome="yes"
                current={decision?.outcome}
                onSelect={record}
              />
              <DecisionButton
                outcome="no"
                current={decision?.outcome}
                onSelect={record}
              />
              <DecisionButton
                outcome="cant_tell"
                current={decision?.outcome}
                onSelect={record}
              />
              <DecisionButton
                outcome="cant_view"
                current={decision?.outcome}
                onSelect={record}
              />
              <DecisionButton
                outcome="skipped"
                current={decision?.outcome}
                onSelect={record}
              />
            </div>
          </fieldset>
          <p className="review-decision__hint">
            Can’t view records a media problem. Skip defers the item without making a scientific
            judgment. Any choice can be replaced by revisiting the image.
          </p>
        </form>
      </div>

      <nav className="review-navigation" aria-label="Review item navigation">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex(Math.max(0, index - 1))}
        >
          Previous image
        </button>
        <ol>
          {HUMAN_REVIEW_PACKET.items.map((candidate, candidateIndex) => (
            <li key={candidate.itemId}>
              <button
                type="button"
                aria-label={`Open review image ${candidateIndex + 1}`}
                aria-current={candidateIndex === index ? 'step' : undefined}
                data-reviewed={session.decisions[candidate.itemId] !== undefined}
                onClick={() => setIndex(candidateIndex)}
              >
                {candidateIndex + 1}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={index === HUMAN_REVIEW_PACKET.items.length - 1}
          onClick={() =>
            setIndex(Math.min(HUMAN_REVIEW_PACKET.items.length - 1, index + 1))
          }
        >
          Next image
        </button>
      </nav>

      <section className="review-summary" aria-labelledby="review-summary-title">
        <div>
          <p className="eyebrow">Local receipt</p>
          <h3 id="review-summary-title">Review summary</h3>
          <p>
            Yes {counts.yes} · No {counts.no} · Can’t tell {counts.cantTell} · Can’t view{' '}
            {counts.cantView} · Skipped {counts.skipped}
          </p>
        </div>
        <div className="review-summary__actions">
          <button
            type="button"
            disabled={counts.recorded === 0}
            onClick={() => exportHumanReviewReceipt(session)}
          >
            Export review receipt
          </button>
          <button type="button" className="review-button--quiet" onClick={clearReview}>
            Clear cache and review
          </button>
        </div>
      </section>
    </section>
  )
}

function DecisionButton({
  current,
  onSelect,
  outcome,
}: {
  readonly current: HumanReviewOutcome | undefined
  readonly onSelect: (outcome: HumanReviewOutcome) => void
  readonly outcome: HumanReviewOutcome
}) {
  return (
    <button
      type="button"
      aria-pressed={current === outcome}
      data-outcome={outcome}
      onClick={() => onSelect(outcome)}
    >
      {outcomeLabel(outcome)}
    </button>
  )
}

function outcomeLabel(outcome: HumanReviewOutcome): string {
  switch (outcome) {
    case 'yes':
      return 'Yes'
    case 'no':
      return 'No'
    case 'cant_tell':
      return 'Can’t tell'
    case 'cant_view':
      return 'Can’t view'
    case 'skipped':
      return 'Skip'
  }
}

function itemAt(index: number): HumanReviewItem {
  const item = HUMAN_REVIEW_PACKET.items[index]
  if (item === undefined) {
    throw new Error('Review item index is outside the packet')
  }
  return item
}

function firstPendingIndex(session: HumanReviewSession): number {
  const index = HUMAN_REVIEW_PACKET.items.findIndex(
    (item) => session.decisions[item.itemId] === undefined,
  )
  return index === -1 ? 0 : index
}

function outcomeCounts(session: HumanReviewSession) {
  const decisions = Object.values(session.decisions)
  return {
    recorded: decisions.length,
    yes: decisions.filter(({ outcome }) => outcome === 'yes').length,
    no: decisions.filter(({ outcome }) => outcome === 'no').length,
    cantTell: decisions.filter(({ outcome }) => outcome === 'cant_tell').length,
    cantView: decisions.filter(({ outcome }) => outcome === 'cant_view').length,
    skipped: decisions.filter(({ outcome }) => outcome === 'skipped').length,
  }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'The local review cache operation failed.'
}
