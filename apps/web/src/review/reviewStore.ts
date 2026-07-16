import {
  canonicalExportJsonBytes,
  downloadEvidenceFile,
} from '../evidence/evidenceExport'
import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
  type HumanReviewPacket,
} from './reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  type VerificationEvent,
  type VerificationOutcome,
} from './verificationEvents'

const REVIEW_CACHE_NAME = `taxalens-${HUMAN_REVIEW_PACKET.packetId}`
const REVIEW_SESSION_KEY = `taxalens-human-review:${HUMAN_REVIEW_PACKET.packetId}`

export type HumanReviewOutcome = VerificationOutcome

export interface HumanReviewDecisionInput {
  readonly itemId: string
  readonly outcome: HumanReviewOutcome
  readonly comment: string | null
  readonly reviewedAt: string
  readonly reviewDurationMs: number | null
}

export interface HumanReviewDecision extends HumanReviewDecisionInput {
  readonly eventId: string
  readonly reviewerId: string
  readonly reviewRound: number
  readonly supersedesEventId: string | null
}

export interface HumanReviewInspection {
  readonly itemId: string
  readonly imageOpened: boolean
  readonly imageVerified: boolean
  readonly imageOpenedAt: string | null
  readonly imageFailureReason: string | null
}

export interface HumanReviewSession {
  readonly packetId: HumanReviewPacket['packetId']
  readonly reviewerId: string
  readonly events: readonly VerificationEvent[]
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
}

export type ReviewPersistenceErrorCode =
  | 'unavailable'
  | 'quota_exceeded'
  | 'serialization_failed'
  | 'corrupt_session'
  | 'unknown'

export class ReviewPersistenceError extends Error {
  readonly code: ReviewPersistenceErrorCode

  constructor(code: ReviewPersistenceErrorCode, message: string) {
    super(message)
    this.name = 'ReviewPersistenceError'
    this.code = code
  }
}

export interface HumanReviewSessionLoadResult {
  readonly session: HumanReviewSession
  readonly error: ReviewPersistenceError | null
}

export interface ReviewCacheStatus {
  readonly ready: boolean
  readonly cachedCount: number
  readonly totalCount: number
  readonly persistentBrowserCache: boolean
  readonly itemFailures: Readonly<Record<string, string>>
}

export interface ReviewMediaCache {
  inspect(packet?: HumanReviewPacket): Promise<ReviewCacheStatus>
  prepare(
    packet: HumanReviewPacket,
    signal: AbortSignal,
    onProgress: (status: ReviewCacheStatus) => void,
  ): Promise<ReviewCacheStatus>
  open(item: HumanReviewItem): Promise<string>
  clear(): Promise<void>
}

const memoryCache = new Map<string, Blob>()

export function emptyHumanReviewSession(): HumanReviewSession {
  return Object.freeze({
    packetId: HUMAN_REVIEW_PACKET.packetId,
    reviewerId: '',
    events: Object.freeze([]),
    inspections: Object.freeze({}),
  })
}

export function loadHumanReviewSession(
  storage?: Pick<Storage, 'getItem'>,
): HumanReviewSession {
  return loadHumanReviewSessionResult(storage).session
}

export function loadHumanReviewSessionResult(
  storage?: Pick<Storage, 'getItem'>,
): HumanReviewSessionLoadResult {
  try {
    const raw = (storage ?? window.localStorage).getItem(REVIEW_SESSION_KEY)
    if (raw === null) {
      return Object.freeze({
        session: emptyHumanReviewSession(),
        error: null,
      })
    }
    const value = JSON.parse(raw) as Partial<HumanReviewSession> & {
      readonly decisions?: Readonly<Record<string, HumanReviewDecisionInput>>
    }
    if (
      value.packetId !== HUMAN_REVIEW_PACKET.packetId ||
      typeof value.reviewerId !== 'string'
    ) {
      return Object.freeze({
        session: emptyHumanReviewSession(),
        error: new ReviewPersistenceError(
          'corrupt_session',
          'The stored local review session is incompatible and was ignored.',
        ),
      })
    }
    const events = restoreVerificationEvents(value)
    const inspections: Record<string, HumanReviewInspection> = {}
    for (const item of HUMAN_REVIEW_PACKET.items) {
      const inspection =
        typeof value.inspections === 'object' &&
        value.inspections !== null &&
        !Array.isArray(value.inspections)
          ? value.inspections[item.itemId]
          : undefined
      if (
        typeof inspection === 'object' &&
        inspection !== null &&
        inspection.itemId === item.itemId &&
        typeof inspection.imageOpened === 'boolean' &&
        typeof inspection.imageVerified === 'boolean' &&
        (inspection.imageOpenedAt === null ||
          typeof inspection.imageOpenedAt === 'string') &&
        (inspection.imageFailureReason === null ||
          typeof inspection.imageFailureReason === 'string')
      ) {
        inspections[item.itemId] = Object.freeze({ ...inspection })
      }
    }
    return Object.freeze({
      session: Object.freeze({
        packetId: HUMAN_REVIEW_PACKET.packetId,
        reviewerId: value.reviewerId,
        events,
        inspections: Object.freeze(inspections),
      }),
      error: null,
    })
  } catch (reason) {
    return Object.freeze({
      session: emptyHumanReviewSession(),
      error: classifyPersistenceError(reason),
    })
  }
}

export function saveHumanReviewSession(
  session: HumanReviewSession,
  storage?: Pick<Storage, 'setItem'>,
): void {
  let serialized: string
  try {
    serialized = JSON.stringify(session)
  } catch (reason) {
    throw new ReviewPersistenceError(
      'serialization_failed',
      `The local review session could not be serialized: ${causeMessage(reason)}`,
    )
  }
  try {
    ;(storage ?? window.localStorage).setItem(REVIEW_SESSION_KEY, serialized)
  } catch (reason) {
    throw classifyPersistenceError(reason)
  }
}

export function clearHumanReviewSession(
  storage?: Pick<Storage, 'removeItem'>,
): void {
  try {
    ;(storage ?? window.localStorage).removeItem(REVIEW_SESSION_KEY)
  } catch (reason) {
    throw classifyPersistenceError(reason)
  }
}

export function reviewPersistenceErrorMessage(
  error: ReviewPersistenceError,
): string {
  switch (error.code) {
    case 'quota_exceeded':
      return `${error.message} Browser storage quota is full; the current review remains in memory only.`
    case 'serialization_failed':
      return `${error.message} The current review remains in memory and was not persisted.`
    case 'corrupt_session':
      return error.message
    case 'unavailable':
      return `${error.message} This can occur in private browsing or when site storage is blocked; the current review remains in memory only.`
    case 'unknown':
      return `${error.message} The current review remains in memory only.`
  }
}

function restoreVerificationEvents(value: {
  readonly reviewerId?: string
  readonly events?: readonly unknown[]
  readonly decisions?: Readonly<Record<string, HumanReviewDecisionInput>>
}): readonly VerificationEvent[] {
  if (value.events !== undefined) {
    if (!Array.isArray(value.events)) {
      throw corruptReviewSession('The stored review event ledger is invalid.')
    }
    const events = value.events.map((candidate) =>
      restoreVerificationEvent(candidate),
    )
    assertVerificationEventLedger(events)
    return Object.freeze(events)
  }
  if (
    typeof value.decisions !== 'object' ||
    value.decisions === null ||
    Array.isArray(value.decisions)
  ) {
    throw corruptReviewSession(
      'The stored local review session has no compatible event ledger.',
    )
  }

  let events: readonly VerificationEvent[] = Object.freeze([])
  for (const item of HUMAN_REVIEW_PACKET.items) {
    const candidate = value.decisions[item.itemId]
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      candidate.itemId === item.itemId &&
      isOutcome(candidate.outcome) &&
      (candidate.comment === null || typeof candidate.comment === 'string') &&
      typeof candidate.reviewedAt === 'string'
    ) {
      const event = createVerificationEvent(
        events,
        value.reviewerId ?? '',
        Object.freeze({
          itemId: candidate.itemId,
          outcome: candidate.outcome,
          comment: candidate.comment,
          reviewedAt: candidate.reviewedAt,
          reviewDurationMs: validDuration(candidate.reviewDurationMs)
            ? candidate.reviewDurationMs
            : null,
        }),
      )
      events = Object.freeze([...events, event])
    }
  }
  return events
}

function restoreVerificationEvent(value: unknown): VerificationEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw corruptReviewSession('The stored review event is invalid.')
  }
  const candidate = value as Partial<VerificationEvent>
  if (
    candidate.schemaVersion !== VERIFICATION_EVENT_SCHEMA_VERSION ||
    typeof candidate.eventId !== 'string' ||
    typeof candidate.campaignId !== 'string' ||
    typeof candidate.itemId !== 'string' ||
    typeof candidate.reviewerId !== 'string' ||
    typeof candidate.reviewRound !== 'number' ||
    !isOutcome(candidate.outcome) ||
    (candidate.comment !== null && typeof candidate.comment !== 'string') ||
    (candidate.alternativeTaxon !== null &&
      typeof candidate.alternativeTaxon !== 'object') ||
    (candidate.correctedLifeStage !== null &&
      typeof candidate.correctedLifeStage !== 'string') ||
    (candidate.correctedVisualDomain !== null &&
      typeof candidate.correctedVisualDomain !== 'string') ||
    (candidate.correctedView !== null &&
      typeof candidate.correctedView !== 'string') ||
    (candidate.exclusionReason !== null &&
      typeof candidate.exclusionReason !== 'string') ||
    !isConfidence(candidate.confidence) ||
    typeof candidate.reviewedAt !== 'string' ||
    (candidate.durationMs !== null &&
      typeof candidate.durationMs !== 'number') ||
    typeof candidate.imageSha256 !== 'string' ||
    typeof candidate.questionSha256 !== 'string' ||
    typeof candidate.campaignManifestSha256 !== 'string' ||
    typeof candidate.taxalensSha !== 'string' ||
    (candidate.biominerSha !== null &&
      typeof candidate.biominerSha !== 'string') ||
    (candidate.supersedesEventId !== null &&
      typeof candidate.supersedesEventId !== 'string')
  ) {
    throw corruptReviewSession('The stored review event fields are invalid.')
  }
  const event = candidate as VerificationEvent
  const item = HUMAN_REVIEW_PACKET.items.find(
    ({ itemId }) => itemId === event.itemId,
  )
  if (
    item === undefined ||
    validateVerificationEvent(
      event,
      HUMAN_REVIEW_PACKET.campaign,
      item,
    ).length > 0
  ) {
    throw corruptReviewSession(
      'The stored review event does not match the current campaign.',
    )
  }
  return Object.freeze({ ...event })
}

function assertVerificationEventLedger(
  events: readonly VerificationEvent[],
): void {
  const byId = new Map<string, VerificationEvent>()
  const superseded = new Set<string>()
  const reviewerRounds = new Map<string, number>()
  for (const event of events) {
    if (byId.has(event.eventId)) {
      throw corruptReviewSession('The review event ledger repeats an event ID.')
    }
    const reviewerKey = `${event.itemId}\u0000${event.reviewerId}`
    const expectedRound = (reviewerRounds.get(reviewerKey) ?? 0) + 1
    if (event.reviewRound !== expectedRound) {
      throw corruptReviewSession(
        'The review event ledger has a non-contiguous reviewer round.',
      )
    }
    if (event.supersedesEventId !== null) {
      const prior = byId.get(event.supersedesEventId)
      if (
        prior === undefined ||
        prior.itemId !== event.itemId ||
        prior.campaignId !== event.campaignId ||
        superseded.has(prior.eventId)
      ) {
        throw corruptReviewSession(
          'The review event ledger has an invalid supersession link.',
        )
      }
      superseded.add(prior.eventId)
    }
    byId.set(event.eventId, event)
    reviewerRounds.set(reviewerKey, event.reviewRound)
  }
}

export function withReviewerId(
  session: HumanReviewSession,
  reviewerId: string,
): HumanReviewSession {
  return Object.freeze({
    ...session,
    reviewerId,
  })
}

export function withDecision(
  session: HumanReviewSession,
  decision: HumanReviewDecisionInput,
): HumanReviewSession {
  const reviewerIdAtEventCreation = session.reviewerId.trim()
  const event = createVerificationEvent(
    session.events,
    reviewerIdAtEventCreation,
    decision,
  )
  return Object.freeze({
    ...session,
    events: Object.freeze([...session.events, event]),
  })
}

export function currentHumanReviewDecisions(
  session: HumanReviewSession,
): Readonly<Record<string, HumanReviewDecision>> {
  const decisions: Record<string, HumanReviewDecision> = {}
  for (const event of Object.values(
    projectCurrentVerificationEvents(session.events),
  )) {
    decisions[event.itemId] = Object.freeze({
      eventId: event.eventId,
      itemId: event.itemId,
      reviewerId: event.reviewerId,
      outcome: event.outcome,
      comment: event.comment,
      reviewedAt: event.reviewedAt,
      reviewDurationMs: event.durationMs,
      reviewRound: event.reviewRound,
      supersedesEventId: event.supersedesEventId,
    })
  }
  return Object.freeze(decisions)
}

function createVerificationEvent(
  events: readonly VerificationEvent[],
  reviewerId: string,
  decision: HumanReviewDecisionInput,
): VerificationEvent {
  const item = HUMAN_REVIEW_PACKET.items.find(
    ({ itemId }) => itemId === decision.itemId,
  )
  if (item === undefined) {
    throw new Error(
      `Review item is outside the current campaign: ${decision.itemId}`,
    )
  }
  const currentEvent = projectCurrentVerificationEvents(events)[decision.itemId]
  const reviewRound =
    events
      .filter(
        (event) =>
          event.itemId === decision.itemId &&
          event.reviewerId === reviewerId,
      )
      .reduce((maximum, event) => Math.max(maximum, event.reviewRound), 0) + 1
  const event: VerificationEvent = Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: localVerificationEventId(
      decision.itemId,
      reviewerId,
      reviewRound,
      decision.reviewedAt,
    ),
    campaignId: HUMAN_REVIEW_PACKET.campaign.campaignId,
    itemId: decision.itemId,
    reviewerId,
    reviewRound,
    outcome: decision.outcome,
    comment: decision.comment,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    exclusionReason: null,
    confidence: 'unknown',
    reviewedAt: decision.reviewedAt,
    durationMs: decision.reviewDurationMs,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_PACKET.campaign.manifestSha256,
    taxalensSha: HUMAN_REVIEW_PACKET.campaign.taxalensSha,
    biominerSha: HUMAN_REVIEW_PACKET.campaign.biominerSha,
    supersedesEventId: currentEvent?.eventId ?? null,
  })
  const failures = validateVerificationEvent(
    event,
    HUMAN_REVIEW_PACKET.campaign,
    item,
  )
  if (failures.length > 0) {
    throw new Error(`Invalid review event: ${failures.join('; ')}`)
  }
  assertVerificationEventLedger([...events, event])
  return event
}

function localVerificationEventId(
  itemId: string,
  reviewerId: string,
  reviewRound: number,
  reviewedAt: string,
): string {
  return [
    'local-review-event',
    encodeURIComponent(itemId),
    encodeURIComponent(reviewerId.trim() || 'anonymous'),
    String(reviewRound),
    encodeURIComponent(reviewedAt),
  ].join(':')
}

export function withImageInspection(
  session: HumanReviewSession,
  inspection: HumanReviewInspection,
): HumanReviewSession {
  return Object.freeze({
    ...session,
    inspections: Object.freeze({
      ...session.inspections,
      [inspection.itemId]: Object.freeze(inspection),
    }),
  })
}

export function canRecordHumanReviewOutcome(
  session: HumanReviewSession,
  itemId: string,
  outcome: HumanReviewOutcome,
): boolean {
  if (!isScientificOutcome(outcome)) {
    return true
  }
  const inspection = session.inspections[itemId]
  return inspection?.imageOpened === true && inspection.imageVerified === true
}

export function exportHumanReviewReceipt(
  session: HumanReviewSession,
  packet: HumanReviewPacket = HUMAN_REVIEW_PACKET,
): void {
  const currentDecisions = currentHumanReviewDecisions(session)
  const decisions = packet.items
    .map((item) => currentDecisions[item.itemId])
    .filter((decision): decision is HumanReviewDecision => decision !== undefined)
    .map((decision) => ({
      ...decision,
      inspection: session.inspections[decision.itemId] ?? null,
      scientificDisposition:
        decision.outcome === 'yes'
          ? 'label_supported'
          : decision.outcome === 'no'
            ? 'label_not_supported'
            : decision.outcome === 'cant_tell'
              ? 'uncertain'
              : null,
      technicalDisposition:
        decision.outcome === 'cant_view'
          ? 'media_unavailable'
          : decision.outcome === 'skipped'
            ? 'deferred'
            : null,
    }))
  const bytes = canonicalExportJsonBytes({
    schemaVersion: 'taxalens-human-review-receipt:v1.0.0',
    packet: {
      schemaVersion: packet.schemaVersion,
      packetId: packet.packetId,
      target: packet.target,
      itemCount: packet.items.length,
    },
    reviewerId: session.reviewerId.trim() || null,
    decisions,
    counts: {
      recorded: decisions.length,
      yes: decisions.filter(({ outcome }) => outcome === 'yes').length,
      no: decisions.filter(({ outcome }) => outcome === 'no').length,
      cantTell: decisions.filter(({ outcome }) => outcome === 'cant_tell').length,
      cantView: decisions.filter(({ outcome }) => outcome === 'cant_view').length,
      skipped: decisions.filter(({ outcome }) => outcome === 'skipped').length,
    },
    semantics: {
      localBrowserReview: true,
      separateFromFrozenBioMinerReferenceBank: true,
      independentExpertTaxonomicVerificationClaimed: false,
      scientificClaimAllowed: false,
    },
  })
  downloadEvidenceFile({
    filename: `${packet.packetId}.review-receipt.json`,
    mediaType: 'application/json',
    bytes,
  })
}

export const browserReviewMediaCache: ReviewMediaCache = Object.freeze({
  async inspect(packet = HUMAN_REVIEW_PACKET) {
    const persistent = hasCacheStorage()
    let cachedCount = 0
    const itemFailures: Record<string, string> = {}
    if (persistent) {
      const cache = await window.caches.open(REVIEW_CACHE_NAME)
      for (const item of packet.items) {
        const response = await cache.match(item.imageUrl)
        const blob =
          response === undefined
            ? undefined
            : await readVerifiedMedia(item, response, () =>
                cache.delete(item.imageUrl),
              )
        if (blob !== undefined) {
          cachedCount += 1
        } else if (response !== undefined) {
          itemFailures[item.itemId] =
            'Cached media failed integrity verification and was removed.'
        }
      }
    } else {
      for (const item of packet.items) {
        const blob = memoryCache.get(item.imageUrl)
        const verified =
          blob === undefined
            ? undefined
            : await readVerifiedMedia(item, blob, () => {
                memoryCache.delete(item.imageUrl)
              })
        if (verified !== undefined) {
          cachedCount += 1
        } else if (blob !== undefined) {
          itemFailures[item.itemId] =
            'Cached media failed integrity verification and was removed.'
        }
      }
    }
    return cacheStatus(packet, cachedCount, persistent, itemFailures)
  },

  async prepare(
    packet: HumanReviewPacket,
    signal: AbortSignal,
    onProgress: (status: ReviewCacheStatus) => void,
  ) {
    const persistent = hasCacheStorage()
    const cache = persistent ? await window.caches.open(REVIEW_CACHE_NAME) : null
    let cachedCount = 0
    const itemFailures: Record<string, string> = {}
    for (const item of packet.items) {
      try {
        if (signal.aborted) {
          throw new DOMException(
            'Review cache preparation was cancelled',
            'AbortError',
          )
        }
        const existing =
          cache === null
            ? memoryCache.get(item.imageUrl)
            : await cache.match(item.imageUrl)
        const verifiedExisting =
          existing === undefined
            ? undefined
            : await readVerifiedMedia(item, existing, () =>
                cache === null
                  ? memoryCache.delete(item.imageUrl)
                  : cache.delete(item.imageUrl),
              )
        if (verifiedExisting !== undefined) {
          cachedCount += 1
          onProgress(
            cacheStatus(packet, cachedCount, persistent, itemFailures),
          )
          continue
        }
        const response = await fetch(item.imageUrl, {
          signal,
          cache: 'reload',
          credentials: 'same-origin',
        })
        if (!response.ok) {
          throw new Error(`Review image returned HTTP ${response.status}`)
        }
        const blob = await readVerifiedMedia(item, response, () => undefined)
        if (blob === undefined) {
          throw new Error(
            `Review image ${item.itemId} failed media integrity verification`,
          )
        }
        if (cache === null) {
          memoryCache.set(item.imageUrl, blob)
        } else {
          await cache.put(
            item.imageUrl,
            new Response(blob, {
              headers: {
                'Content-Type': item.mediaType,
                'X-TaxaLens-SHA256': item.imageSha256,
              },
            }),
          )
        }
        cachedCount += 1
        onProgress(cacheStatus(packet, cachedCount, persistent, itemFailures))
      } catch (reason) {
        itemFailures[item.itemId] = reviewErrorMessage(reason)
        onProgress(cacheStatus(packet, cachedCount, persistent, itemFailures))
        throw reason
      }
    }
    return cacheStatus(packet, cachedCount, persistent, itemFailures)
  },

  async open(item: HumanReviewItem) {
    let blob: Blob | undefined
    if (hasCacheStorage()) {
      const cache = await window.caches.open(REVIEW_CACHE_NAME)
      const response = await cache.match(item.imageUrl)
      if (response !== undefined) {
        blob = await readVerifiedMedia(item, response, () =>
          cache.delete(item.imageUrl),
        )
      }
    } else {
      const memoryBlob = memoryCache.get(item.imageUrl)
      if (memoryBlob !== undefined) {
        blob = await readVerifiedMedia(item, memoryBlob, () => {
          memoryCache.delete(item.imageUrl)
        })
      }
    }
    if (blob === undefined) {
      throw new Error(
        'The review image is missing or failed integrity verification. Prepare the review cache again.',
      )
    }
    return URL.createObjectURL(blob)
  },

  async clear() {
    if (hasCacheStorage()) {
      await window.caches.delete(REVIEW_CACHE_NAME)
    }
    memoryCache.clear()
  },
})

function cacheStatus(
  packet: HumanReviewPacket,
  cachedCount: number,
  persistentBrowserCache: boolean,
  itemFailures: Readonly<Record<string, string>> = {},
): ReviewCacheStatus {
  return Object.freeze({
    ready: cachedCount === packet.items.length,
    cachedCount,
    totalCount: packet.items.length,
    persistentBrowserCache,
    itemFailures: Object.freeze({ ...itemFailures }),
  })
}

function hasCacheStorage(): boolean {
  return typeof window.caches !== 'undefined'
}

function isOutcome(value: unknown): value is HumanReviewOutcome {
  return (
    value === 'yes' ||
    value === 'no' ||
    value === 'cant_tell' ||
    value === 'cant_view' ||
    value === 'skipped'
  )
}

function isConfidence(
  value: unknown,
): value is VerificationEvent['confidence'] {
  return (
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'unknown'
  )
}

function isScientificOutcome(outcome: HumanReviewOutcome): boolean {
  return outcome === 'yes' || outcome === 'no' || outcome === 'cant_tell'
}

function validDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function readVerifiedMedia(
  item: HumanReviewItem,
  source: Response | Blob,
  deleteInvalid: () => void | boolean | Promise<void | boolean>,
): Promise<Blob | undefined> {
  const response = source instanceof Response ? source : null
  const contentType = normalizeMediaType(
    response?.headers.get('Content-Type') ?? source.type,
  )
  const bytes = new Uint8Array(
    await (response === null ? source.arrayBuffer() : response.arrayBuffer()),
  )
  const valid =
    (response === null || response.ok) &&
    contentType === item.mediaType &&
    bytes.byteLength === item.imageByteCount &&
    (await sha256Hex(bytes)) === item.imageSha256
  if (!valid) {
    await deleteInvalid()
    return undefined
  }
  return new Blob([bytes], { type: item.mediaType })
}

function normalizeMediaType(value: string | null): string {
  return (value ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function reviewErrorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Review media preparation failed.'
}

function classifyPersistenceError(reason: unknown): ReviewPersistenceError {
  if (reason instanceof ReviewPersistenceError) {
    return reason
  }
  const name =
    typeof DOMException !== 'undefined' && reason instanceof DOMException
      ? reason.name
      : reason instanceof Error
        ? reason.name
        : ''
  const message = causeMessage(reason)
  if (
    name === 'QuotaExceededError' ||
    /quota|storage.?full|space available/u.test(message.toLowerCase())
  ) {
    return new ReviewPersistenceError(
      'quota_exceeded',
      'The browser refused to save the local review session because its storage quota was exceeded.',
    )
  }
  if (
    name === 'SecurityError' ||
    /security|denied|disabled|unavailable|not supported|private/u.test(
      message.toLowerCase(),
    )
  ) {
    return new ReviewPersistenceError(
      'unavailable',
      'Browser persistence is unavailable or blocked for this session.',
    )
  }
  if (/json|parse|unexpected token|corrupt/u.test(message.toLowerCase())) {
    return new ReviewPersistenceError(
      'corrupt_session',
      'The stored local review session could not be parsed and was ignored.',
    )
  }
  return new ReviewPersistenceError(
    'unknown',
    `Browser persistence failed: ${message}`,
  )
}

function causeMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function corruptReviewSession(message: string): ReviewPersistenceError {
  return new ReviewPersistenceError('corrupt_session', message)
}
