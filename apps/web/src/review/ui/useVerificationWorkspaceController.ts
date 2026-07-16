import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  INITIAL_VERIFICATION_WORKFLOW_STATE,
  canRecordHumanReviewOutcome,
  currentHumanReviewDecisions,
  emptyHumanReviewSession,
  isScientificHumanReviewOutcome,
  ReviewPersistenceError,
  reviewPersistenceErrorMessage,
  verificationWorkflowReducer,
  withDecision,
  withImageInspection,
  withReviewerId,
  type HumanReviewOutcome,
  type HumanReviewSession,
} from '../domain'
import type { VerificationEvent } from '../domain/verificationEvents'
import {
  browserReviewMediaCache,
  type ReviewCacheStatus,
  type ReviewMediaCache,
} from '../media'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
} from '../reviewPacket'
import {
  InMemoryReviewRepository,
  IndexedDbReviewRepository,
  migrateLegacyHumanReviewSession,
  type ReviewRepository,
} from '../repositories'
import {
  clearHumanReviewSession,
  loadHumanReviewSessionResult,
} from '../repositories/legacyReviewSession'
import type { VerificationCacheState } from './VerificationControls'

const EMPTY_CACHE_STATUS: ReviewCacheStatus = Object.freeze({
  ready: false,
  cachedCount: 0,
  totalCount: HUMAN_REVIEW_PACKET.items.length,
  persistentBrowserCache: false,
  itemFailures: Object.freeze({}),
})

export function useVerificationWorkspaceController({
  cache = browserReviewMediaCache,
  initialItemId,
  legacyStorage = window.localStorage,
  now = () => new Date(),
  repository,
}: {
  readonly cache?: ReviewMediaCache
  readonly initialItemId?: string
  readonly legacyStorage?: Pick<Storage, 'getItem' | 'removeItem'>
  readonly now?: () => Date
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
  const eventWriteGenerationRef = useRef(0)
  const [workflow, dispatchWorkflow] = useReducer(
    verificationWorkflowReducer,
    INITIAL_VERIFICATION_WORKFLOW_STATE,
  )
  const [repositoryState, setRepositoryState] = useState<
    'loading' | 'ready' | 'error'
  >(usingTemporaryRepository ? 'ready' : 'loading')
  const [persistenceError, setPersistenceError] = useState<string | null>(() =>
    legacySnapshot.error === null
      ? null
      : reviewPersistenceErrorMessage(legacySnapshot.error),
  )
  const [index, setIndex] = useState(() =>
    preferredReviewIndex(session, initialItemId),
  )
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
  const counts = useMemo(() => outcomeCounts(session), [session])

  useEffect(() => {
    let active = true
    dispatchWorkflow({ type: 'load_campaign' })
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
        setIndex(preferredReviewIndex(next, initialItemId))
        setRepositoryState('ready')
        dispatchWorkflow({
          type: 'campaign_ready',
          complete: humanReviewSessionIsComplete(next),
        })
      } catch (reason) {
        if (!active) return
        const message = repositoryPersistenceErrorMessage(reason)
        setPersistenceError(message)
        dispatchWorkflow({ type: 'fail', error: message })
        if (
          repository === undefined &&
          activeRepository instanceof IndexedDbReviewRepository
        ) {
          const fallback = createTemporaryReviewRepository(
            legacySnapshot.session.events,
          )
          sessionRef.current = legacySnapshot.session
          setSession(legacySnapshot.session)
          setIndex(
            preferredReviewIndex(legacySnapshot.session, initialItemId),
          )
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
    initialItemId,
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
        if (status.ready) {
          dispatchWorkflow({ type: 'media_ready' })
        }
      })
      .catch((reason: unknown) => {
        if (!active) return
        const message = errorMessage(reason)
        setCacheState('error')
        setCacheError(message)
        dispatchWorkflow({ type: 'fail', error: message })
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
    if (initialItemId === undefined) {
      return
    }
    const requestedIndex = HUMAN_REVIEW_PACKET.items.findIndex(
      ({ itemId }) => itemId === initialItemId,
    )
    if (requestedIndex !== -1) {
      openIndex(requestedIndex)
    }
  }, [initialItemId])

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
        const message = errorMessage(reason)
        setImageUrl(null)
        setDisplayedItemId(null)
        setCacheState('error')
        setCacheError(message)
        dispatchWorkflow({ type: 'fail', error: message })
        recordImageFailure(item, message)
        setCacheStatus((current) =>
          Object.freeze({
            ...current,
            ready: false,
            cachedCount: Math.max(0, current.cachedCount - 1),
            itemFailures: Object.freeze({
              ...current.itemFailures,
              [item.itemId]: message,
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
    dispatchWorkflow({ type: 'prepare_media' })
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
        dispatchWorkflow(
          status.ready
            ? { type: 'media_ready' }
            : {
                type: 'campaign_ready',
                complete: humanReviewSessionIsComplete(sessionRef.current),
              },
        )
      })
      .catch((reason: unknown) => {
        if (!preparationIsCurrent(requestId, controller)) return
        if (controller.signal.aborted) {
          setCacheState('idle')
          dispatchWorkflow({
            type: 'campaign_ready',
            complete: humanReviewSessionIsComplete(sessionRef.current),
          })
          return
        }
        const message = errorMessage(reason)
        setCacheState('error')
        setCacheError(message)
        dispatchWorkflow({ type: 'fail', error: message })
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
    dispatchWorkflow({
      type: 'campaign_ready',
      complete: humanReviewSessionIsComplete(sessionRef.current),
    })
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
    dispatchWorkflow({ type: 'record' })
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
    queueEventWrite(event, humanReviewSessionIsComplete(next))
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
    setImageUrl(null)
  }

  async function clearReview() {
    cancelPreparation()
    eventWriteGenerationRef.current += 1
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
      dispatchWorkflow({ type: 'clear' })
    } catch (reason) {
      const message = errorMessage(reason)
      setClearState('error')
      setClearError(message)
      dispatchWorkflow({ type: 'fail', error: message })
    }
  }

  function openIndex(nextIndex: number) {
    setDisplayedItemId(null)
    setImageUrl(null)
    setIndex(nextIndex)
  }

  return {
    cacheError,
    cacheState,
    cacheStatus,
    cancelPreparation,
    clearError,
    clearReview,
    clearState,
    comment,
    counts,
    currentDecisions,
    decision,
    imageUrl,
    index,
    inspection,
    item,
    openIndex,
    persistenceError,
    prepareCache,
    record,
    recordImageFailure,
    recordImageOpened,
    repositoryState,
    scientificDecisionReady,
    session,
    setComment,
    updateReviewerId,
    workflow,
  }

  function applySession(next: HumanReviewSession) {
    sessionRef.current = next
    setSession(next)
  }

  function queueEventWrite(event: VerificationEvent, complete: boolean) {
    const targetRepository = activeRepository
    const generation = eventWriteGenerationRef.current + 1
    eventWriteGenerationRef.current = generation
    const write = eventWriteRef.current
      .catch(() => undefined)
      .then(() => targetRepository.appendEvent(event))
    eventWriteRef.current = write
    void write
      .then(() => {
        if (eventWriteGenerationRef.current === generation) {
          setPersistenceError(null)
          dispatchWorkflow({ type: 'saved', complete })
        }
      })
      .catch((reason: unknown) => {
        const message = repositoryPersistenceErrorMessage(reason)
        setPersistenceError(message)
        if (eventWriteGenerationRef.current === generation) {
          dispatchWorkflow({ type: 'fail', error: message })
        }
      })
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

function preferredReviewIndex(
  session: HumanReviewSession,
  itemId: string | undefined,
): number {
  if (itemId !== undefined) {
    const requestedIndex = HUMAN_REVIEW_PACKET.items.findIndex(
      (item) => item.itemId === itemId,
    )
    if (requestedIndex !== -1) {
      return requestedIndex
    }
  }
  return firstPendingIndex(session)
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

function humanReviewSessionIsComplete(session: HumanReviewSession): boolean {
  return (
    Object.keys(currentHumanReviewDecisions(session)).length ===
    HUMAN_REVIEW_PACKET.items.length
  )
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
