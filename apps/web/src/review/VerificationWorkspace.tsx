import { useEffect, useMemo, useRef, useState } from 'react'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import {
  canRecordHumanReviewOutcome,
  currentHumanReviewDecisions,
  emptyHumanReviewSession,
  isScientificHumanReviewOutcome,
  ReviewPersistenceError,
  reviewPersistenceErrorMessage,
  withDecision,
  withImageInspection,
  withReviewerId,
  type HumanReviewOutcome,
  type HumanReviewSession,
} from './domain'
import type { VerificationEvent } from './domain/verificationEvents'
import { exportHumanReviewReceipt } from './exports'
import {
  browserReviewMediaCache,
  type ReviewCacheStatus,
  type ReviewMediaCache,
} from './media'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
} from './reviewPacket'
import {
  InMemoryReviewRepository,
  IndexedDbReviewRepository,
  migrateLegacyHumanReviewSession,
  type ReviewRepository,
} from './repositories'
import {
  clearHumanReviewSession,
  loadHumanReviewSessionResult,
} from './repositories/legacyReviewSession'
import {
  CampaignSelector,
  VerificationControls,
  VerificationItemViewer,
  VerificationProgress,
  VerificationSummary,
  type VerificationCacheState,
} from './ui'
import './review.css'

const EMPTY_CACHE_STATUS: ReviewCacheStatus = Object.freeze({
  ready: false,
  cachedCount: 0,
  totalCount: HUMAN_REVIEW_PACKET.items.length,
  persistentBrowserCache: false,
  itemFailures: Object.freeze({}),
})

export function VerificationWorkspace({
  cache = browserReviewMediaCache,
  legacyStorage = window.localStorage,
  now = () => new Date(),
  replay,
  repository,
}: {
  readonly cache?: ReviewMediaCache
  readonly legacyStorage?: Pick<Storage, 'getItem' | 'removeItem'>
  readonly now?: () => Date
  readonly replay: ReplayEvidence
  readonly repository?: ReviewRepository
}) {
  const [legacySnapshot] = useState(() =>
    loadHumanReviewSessionResult(legacyStorage),
  )
  const [activeRepository, setActiveRepository] = useState<ReviewRepository>(
    () =>
      repository ??
      createDefaultReviewRepository(legacySnapshot.session.events),
  )
  const usingTemporaryRepository =
    repository === undefined &&
    activeRepository instanceof InMemoryReviewRepository
  const [session, setSession] = useState<HumanReviewSession>(
    usingTemporaryRepository
      ? legacySnapshot.session
      : emptyHumanReviewSession(),
  )
  const sessionRef = useRef(session)
  sessionRef.current = session
  const eventWriteRef = useRef<Promise<void>>(Promise.resolve())
  const [repositoryState, setRepositoryState] = useState<
    'loading' | 'ready' | 'error'
  >(usingTemporaryRepository ? 'ready' : 'loading')
  const [persistenceError, setPersistenceError] = useState<string | null>(() =>
    legacySnapshot.error === null
      ? null
      : reviewPersistenceErrorMessage(legacySnapshot.error),
  )
  const [index, setIndex] = useState(() => firstPendingIndex(session))
  const [cacheStatus, setCacheStatus] =
    useState<ReviewCacheStatus>(EMPTY_CACHE_STATUS)
  const [cacheState, setCacheState] =
    useState<VerificationCacheState>('checking')
  const [cacheError, setCacheError] = useState<string | null>(null)
  const [clearState, setClearState] = useState<
    'idle' | 'clearing' | 'success' | 'error'
  >('idle')
  const [clearError, setClearError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [displayedItemId, setDisplayedItemId] = useState<string | null>(null)
  const preparationRef = useRef<{
    readonly controller: AbortController
    readonly requestId: number
  } | null>(null)
  const preparationRequestIdRef = useRef(0)
  const item = itemAt(index)
  const currentDecisions = useMemo(
    () => currentHumanReviewDecisions(session),
    [session],
  )
  const decision = currentDecisions[item.itemId]
  const inspection = session.inspections[item.itemId]
  const scientificDecisionReady =
    displayedItemId === item.itemId &&
    inspection?.imageOpened === true &&
    inspection.imageVerified === true
  const [comment, setComment] = useState(decision?.comment ?? '')

  useEffect(() => {
    let active = true
    setRepositoryState(
      activeRepository instanceof InMemoryReviewRepository
        ? 'ready'
        : 'loading',
    )
    void (async () => {
      try {
        const migration =
          activeRepository instanceof IndexedDbReviewRepository
            ? await migrateLegacyHumanReviewSession(
                activeRepository,
                legacyStorage,
              )
            : {
                status: 'absent' as const,
                reviewerId: '',
                inspections: Object.freeze({}),
                eventCount: 0,
              }
        const events = await activeRepository.loadEvents(
          HUMAN_REVIEW_CAMPAIGN.campaignId,
        )
        if (!active) return
        const current = sessionRef.current
        const hydratedEvents =
          current.events.length > events.length ? current.events : events
        const next = Object.freeze({
          packetId: HUMAN_REVIEW_PACKET.packetId,
          reviewerId:
            current.reviewerId ||
            migration.reviewerId ||
            hydratedEvents.at(-1)?.reviewerId ||
            '',
          events: Object.freeze([...hydratedEvents]),
          inspections: Object.freeze({
            ...migration.inspections,
            ...current.inspections,
          }),
        })
        sessionRef.current = next
        setSession(next)
        setIndex(firstPendingIndex(next))
        setRepositoryState('ready')
      } catch (reason) {
        if (!active) return
        setPersistenceError(repositoryPersistenceErrorMessage(reason))
        if (
          repository === undefined &&
          activeRepository instanceof IndexedDbReviewRepository
        ) {
          const fallback = createTemporaryReviewRepository(
            legacySnapshot.session.events,
          )
          sessionRef.current = legacySnapshot.session
          setSession(legacySnapshot.session)
          setIndex(firstPendingIndex(legacySnapshot.session))
          setRepositoryState('ready')
          setActiveRepository(fallback)
          return
        }
        setRepositoryState('error')
      }
    })()
    return () => {
      active = false
    }
  }, [
    activeRepository,
    legacySnapshot.session,
    legacyStorage,
    repository,
  ])

  useEffect(
    () => () => {
      if (
        repository === undefined &&
        activeRepository instanceof IndexedDbReviewRepository
      ) {
        void activeRepository.close()
      }
    },
    [activeRepository, repository],
  )

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

  useEffect(
    () => () => {
      preparationRequestIdRef.current += 1
      preparationRef.current?.controller.abort()
      preparationRef.current = null
    },
    [cache],
  )

  useEffect(() => {
    setComment(decision?.comment ?? '')
  }, [decision, item.itemId])

  useEffect(() => {
    setDisplayedItemId(null)
    setImageUrl(null)
    if (!cacheStatus.ready) {
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
        setDisplayedItemId(null)
        setCacheState('error')
        setCacheError(errorMessage(reason))
        recordImageFailure(item, errorMessage(reason))
        setCacheStatus((current) =>
          Object.freeze({
            ...current,
            ready: false,
            cachedCount: Math.max(0, current.cachedCount - 1),
            itemFailures: Object.freeze({
              ...current.itemFailures,
              [item.itemId]: errorMessage(reason),
            }),
          }),
        )
        void cache
          .inspect(HUMAN_REVIEW_PACKET)
          .then(setCacheStatus)
          .catch(() => undefined)
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
    setClearState('idle')
    setClearError(null)
    preparationRef.current?.controller.abort()
    const controller = new AbortController()
    const requestId = preparationRequestIdRef.current + 1
    preparationRequestIdRef.current = requestId
    preparationRef.current = { controller, requestId }
    setCacheState('preparing')
    setCacheError(null)
    void cache
      .prepare(HUMAN_REVIEW_PACKET, controller.signal, (status) => {
        if (preparationIsCurrent(requestId, controller)) {
          setCacheStatus(status)
        }
      })
      .then((status) => {
        if (!preparationIsCurrent(requestId, controller)) return
        setCacheStatus(status)
        setCacheState(status.ready ? 'ready' : 'idle')
      })
      .catch((reason: unknown) => {
        if (!preparationIsCurrent(requestId, controller)) return
        if (controller.signal.aborted) {
          setCacheState('idle')
          return
        }
        setCacheState('error')
        setCacheError(errorMessage(reason))
      })
      .finally(() => {
        if (preparationIsCurrent(requestId, controller)) {
          preparationRef.current = null
        }
      })
  }

  function cancelPreparation() {
    const active = preparationRef.current
    if (active === null) return
    preparationRequestIdRef.current += 1
    preparationRef.current = null
    active.controller.abort()
    setCacheState('idle')
    setCacheError(null)
  }

  function preparationIsCurrent(
    requestId: number,
    controller: AbortController,
  ): boolean {
    return (
      !controller.signal.aborted &&
      preparationRequestIdRef.current === requestId &&
      preparationRef.current?.controller === controller
    )
  }

  function updateReviewerId(reviewerId: string) {
    applySession(withReviewerId(sessionRef.current, reviewerId))
  }

  function record(outcome: HumanReviewOutcome) {
    if (
      repositoryState !== 'ready' ||
      !canRecordHumanReviewOutcome(session, item.itemId, outcome) ||
      (isScientificHumanReviewOutcome(outcome) && !scientificDecisionReady)
    ) {
      return
    }
    const reviewedAt = now()
    const openedAt = session.inspections[item.itemId]?.imageOpenedAt
    const reviewDurationMs =
      openedAt === null || openedAt === undefined
        ? null
        : Math.max(0, reviewedAt.getTime() - new Date(openedAt).getTime())
    const next = withDecision(sessionRef.current, {
      itemId: item.itemId,
      outcome,
      comment: comment.trim() || null,
      reviewedAt: reviewedAt.toISOString(),
      reviewDurationMs:
        reviewDurationMs !== null && Number.isFinite(reviewDurationMs)
          ? reviewDurationMs
          : null,
    })
    const event = next.events.at(-1)
    if (event === undefined) {
      throw new Error('Review event creation did not append an event.')
    }
    applySession(next)
    queueEventWrite(event)
    if (index < HUMAN_REVIEW_PACKET.items.length - 1) {
      setDisplayedItemId(null)
      setImageUrl(null)
      setIndex(index + 1)
    }
  }

  function recordImageOpened(openedItem: HumanReviewItem) {
    const existing = sessionRef.current.inspections[openedItem.itemId]
    applySession(
      withImageInspection(sessionRef.current, {
        itemId: openedItem.itemId,
        imageOpened: true,
        imageVerified: true,
        imageOpenedAt: existing?.imageOpenedAt ?? now().toISOString(),
        imageFailureReason: null,
      }),
    )
    setDisplayedItemId(openedItem.itemId)
  }

  function recordImageFailure(failedItem: HumanReviewItem, reason: string) {
    const existing = sessionRef.current.inspections[failedItem.itemId]
    applySession(
      withImageInspection(sessionRef.current, {
        itemId: failedItem.itemId,
        imageOpened: false,
        imageVerified: false,
        imageOpenedAt: existing?.imageOpenedAt ?? null,
        imageFailureReason: reason,
      }),
    )
    setDisplayedItemId(null)
  }

  function applySession(next: HumanReviewSession) {
    sessionRef.current = next
    setSession(next)
  }

  function queueEventWrite(event: VerificationEvent) {
    const targetRepository = activeRepository
    const write = eventWriteRef.current
      .catch(() => undefined)
      .then(() => targetRepository.appendEvent(event))
    eventWriteRef.current = write
    void write.catch((reason: unknown) => {
      setPersistenceError(repositoryPersistenceErrorMessage(reason))
    })
  }

  async function clearReview() {
    cancelPreparation()
    setClearState('clearing')
    setClearError(null)
    try {
      await eventWriteRef.current.catch(() => undefined)
      await cache.clear()
      await activeRepository.clearLocalCampaign(
        HUMAN_REVIEW_CAMPAIGN.campaignId,
      )
      clearHumanReviewSession(legacyStorage)
      if (repository === undefined) {
        if (activeRepository instanceof IndexedDbReviewRepository) {
          await activeRepository.close()
        }
        const replacement = createDefaultReviewRepository([])
        setActiveRepository(replacement)
        setRepositoryState(
          replacement instanceof InMemoryReviewRepository
            ? 'ready'
            : 'loading',
        )
      }
      setPersistenceError(null)
      const emptySession = emptyHumanReviewSession()
      sessionRef.current = emptySession
      setSession(emptySession)
      setIndex(0)
      setComment('')
      setImageUrl(null)
      setDisplayedItemId(null)
      setCacheStatus(EMPTY_CACHE_STATUS)
      setCacheState('idle')
      setCacheError(null)
      setClearState('success')
    } catch (reason) {
      setClearState('error')
      setClearError(errorMessage(reason))
    }
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

      <CampaignSelector
        campaigns={[HUMAN_REVIEW_CAMPAIGN]}
        selectedCampaignId={HUMAN_REVIEW_CAMPAIGN.campaignId}
        onSelect={() => undefined}
      />

      <EvidenceState state="available" title="BioMiner suitability confirmation acknowledged">
        The pinned BioMiner update records 81 / 81 provider-supported items as human-confirmed
        suitable for their assigned prototype roles. It still records 0 independently
        taxonomically verified labels.
      </EvidenceState>

      <aside className="human-review__boundary">
        <strong>Separate review campaign</strong>
        <span>
          These CC-licensed Commons images are not the frozen BioMiner reference bank. Decisions
          remain in this browser’s append-only IndexedDB ledger until you export a receipt; no
          result is sent to a server.
        </span>
      </aside>

      {persistenceError !== null && (
        <EvidenceState state="failure" title="Review repository persistence failed">
          {persistenceError}
        </EvidenceState>
      )}

      {typeof window.indexedDB === 'undefined' && (
        <EvidenceState state="review" title="IndexedDB is unavailable">
          The append-only ledger is using temporary memory. Existing legacy review data
          remains untouched so a durable migration can be retried in a browser with
          IndexedDB.
        </EvidenceState>
      )}

      {repositoryState === 'loading' && (
        <EvidenceState state="review" title="Opening offline review ledger">
          Loading the campaign and migrating any legacy local review evidence before
          decisions are enabled.
        </EvidenceState>
      )}

      {cacheState !== 'checking' && !cacheStatus.persistentBrowserCache && (
        <EvidenceState state="review" title="Persistent media cache is unavailable">
          Cache Storage is unavailable or restricted. Verified images use a temporary
          in-memory fallback and will need to be prepared again after reload.
        </EvidenceState>
      )}

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
        <div className="review-cache__actions">
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
          {cacheState === 'preparing' && (
            <button
              type="button"
              className="review-button--quiet"
              onClick={cancelPreparation}
            >
              Cancel media preparation
            </button>
          )}
        </div>
      </section>

      {Object.keys(cacheStatus.itemFailures).length > 0 && (
        <aside className="review-cache__failures" aria-live="polite">
          <strong>Media cache issues</strong>
          <ul>
            {Object.entries(cacheStatus.itemFailures).map(([itemId, reason]) => (
              <li key={itemId}>
                <code>{itemId}</code>: {reason}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {cacheState === 'error' && (
        <EvidenceState state="failure" title="The review cache could not be prepared">
          {cacheError}
        </EvidenceState>
      )}

      {clearState === 'success' && (
        <EvidenceState state="available" title="Local review state cleared">
          The media cache and IndexedDB campaign state were cleared after the browser
          operations completed.
        </EvidenceState>
      )}

      {clearState === 'error' && (
        <EvidenceState state="failure" title="Local review state could not be cleared">
          {clearError} The current in-memory review state was preserved.
        </EvidenceState>
      )}

      <div className="human-review__workspace">
        <VerificationItemViewer
          currentOutcome={decision?.outcome}
          imageUrl={imageUrl}
          index={index}
          item={item}
          scientificName={replay.target.scientificName}
          totalItems={HUMAN_REVIEW_PACKET.items.length}
          onImageLoad={() => recordImageOpened(item)}
          onImageError={() => {
            if (imageUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(imageUrl)
            }
            setImageUrl(null)
            recordImageFailure(
              item,
              'The verified review image could not be displayed.',
            )
          }}
        />
        <VerificationControls
          cacheState={cacheState}
          comment={comment}
          currentOutcome={decision?.outcome}
          imageFailureReason={inspection?.imageFailureReason ?? null}
          repositoryReady={repositoryState === 'ready'}
          reviewerId={session.reviewerId}
          scientificDecisionReady={scientificDecisionReady}
          onCommentChange={setComment}
          onReviewerIdChange={updateReviewerId}
          onSelectOutcome={record}
        />
      </div>

      <VerificationProgress
        currentDecisions={currentDecisions}
        index={index}
        items={HUMAN_REVIEW_PACKET.items}
        onOpenIndex={openIndex}
      />
      <VerificationSummary
        clearState={clearState}
        counts={counts}
        onClear={() => void clearReview()}
        onExport={() => exportHumanReviewReceipt(session)}
      />
    </section>
  )

  function openIndex(nextIndex: number) {
    setDisplayedItemId(null)
    setImageUrl(null)
    setIndex(nextIndex)
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
  const decisions = currentHumanReviewDecisions(session)
  const index = HUMAN_REVIEW_PACKET.items.findIndex(
    (item) => decisions[item.itemId] === undefined,
  )
  return index === -1 ? 0 : index
}

function outcomeCounts(session: HumanReviewSession) {
  const decisions = Object.values(currentHumanReviewDecisions(session))
  return {
    recorded: decisions.length,
    yes: decisions.filter(({ outcome }) => outcome === 'yes').length,
    no: decisions.filter(({ outcome }) => outcome === 'no').length,
    cantTell: decisions.filter(({ outcome }) => outcome === 'cant_tell').length,
    cantView: decisions.filter(({ outcome }) => outcome === 'cant_view').length,
    skipped: decisions.filter(({ outcome }) => outcome === 'skipped').length,
  }
}

function createDefaultReviewRepository(
  events: readonly VerificationEvent[],
): ReviewRepository {
  return typeof window.indexedDB === 'undefined'
    ? createTemporaryReviewRepository(events)
    : new IndexedDbReviewRepository({
        seeds: [
          {
            campaign: HUMAN_REVIEW_CAMPAIGN,
            items: HUMAN_REVIEW_ITEMS,
          },
        ],
      })
}

function createTemporaryReviewRepository(
  events: readonly VerificationEvent[],
): InMemoryReviewRepository {
  return new InMemoryReviewRepository([
    {
      campaign: HUMAN_REVIEW_CAMPAIGN,
      items: HUMAN_REVIEW_ITEMS,
      events,
    },
  ])
}

function repositoryPersistenceErrorMessage(reason: unknown): string {
  if (reason instanceof ReviewPersistenceError) {
    return reviewPersistenceErrorMessage(reason)
  }
  const message = errorMessage(reason)
  const name =
    typeof DOMException !== 'undefined' && reason instanceof DOMException
      ? reason.name
      : reason instanceof Error
        ? reason.name
        : ''
  const code =
    name === 'QuotaExceededError' || /quota|storage.?full/u.test(message)
      ? 'quota_exceeded'
      : /unavailable|blocked|denied|not supported|private/u.test(
            message.toLowerCase(),
          )
        ? 'unavailable'
        : 'unknown'
  return reviewPersistenceErrorMessage(
    new ReviewPersistenceError(
      code,
      `The append-only review repository could not persist the event: ${message}`,
    ),
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'The local review cache operation failed.'
}
