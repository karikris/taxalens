import {
  canonicalExportJsonBytes,
  downloadEvidenceFile,
} from '../evidence/evidenceExport'
import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
  type HumanReviewPacket,
} from './reviewPacket'

const REVIEW_CACHE_NAME = `taxalens-${HUMAN_REVIEW_PACKET.packetId}`
const REVIEW_SESSION_KEY = `taxalens-human-review:${HUMAN_REVIEW_PACKET.packetId}`

export type HumanReviewOutcome = 'yes' | 'no' | 'cant_tell' | 'cant_view' | 'skipped'

export interface HumanReviewDecision {
  readonly itemId: string
  readonly outcome: HumanReviewOutcome
  readonly comment: string | null
  readonly reviewedAt: string
  readonly reviewDurationMs: number | null
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
  readonly decisions: Readonly<Record<string, HumanReviewDecision>>
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
}

export interface ReviewCacheStatus {
  readonly ready: boolean
  readonly cachedCount: number
  readonly totalCount: number
  readonly persistentBrowserCache: boolean
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
    decisions: Object.freeze({}),
    inspections: Object.freeze({}),
  })
}

export function loadHumanReviewSession(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): HumanReviewSession {
  try {
    const raw = storage.getItem(REVIEW_SESSION_KEY)
    if (raw === null) {
      return emptyHumanReviewSession()
    }
    const value = JSON.parse(raw) as Partial<HumanReviewSession>
    if (
      value.packetId !== HUMAN_REVIEW_PACKET.packetId ||
      typeof value.reviewerId !== 'string' ||
      typeof value.decisions !== 'object' ||
      value.decisions === null ||
      Array.isArray(value.decisions)
    ) {
      return emptyHumanReviewSession()
    }
    const decisions: Record<string, HumanReviewDecision> = {}
    const inspections: Record<string, HumanReviewInspection> = {}
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
        decisions[item.itemId] = Object.freeze({
          ...candidate,
          reviewDurationMs: validDuration(candidate.reviewDurationMs)
            ? candidate.reviewDurationMs
            : null,
        })
      }
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
      packetId: HUMAN_REVIEW_PACKET.packetId,
      reviewerId: value.reviewerId,
      decisions: Object.freeze(decisions),
      inspections: Object.freeze(inspections),
    })
  } catch {
    return emptyHumanReviewSession()
  }
}

export function saveHumanReviewSession(
  session: HumanReviewSession,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(REVIEW_SESSION_KEY, JSON.stringify(session))
}

export function clearHumanReviewSession(
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
): void {
  storage.removeItem(REVIEW_SESSION_KEY)
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
  decision: HumanReviewDecision,
): HumanReviewSession {
  return Object.freeze({
    ...session,
    decisions: Object.freeze({
      ...session.decisions,
      [decision.itemId]: Object.freeze(decision),
    }),
  })
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
  const decisions = packet.items
    .map((item) => session.decisions[item.itemId])
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
    if (persistent) {
      const cache = await window.caches.open(REVIEW_CACHE_NAME)
      for (const item of packet.items) {
        const response = await cache.match(item.imageUrl)
        if (
          response !== undefined &&
          (await cachedResponseIsValid(response, item))
        ) {
          cachedCount += 1
        } else if (response !== undefined) {
          await cache.delete(item.imageUrl)
        }
      }
    } else {
      cachedCount = packet.items.filter((item) => memoryCache.has(item.imageUrl)).length
    }
    return cacheStatus(packet, cachedCount, persistent)
  },

  async prepare(
    packet: HumanReviewPacket,
    signal: AbortSignal,
    onProgress: (status: ReviewCacheStatus) => void,
  ) {
    const persistent = hasCacheStorage()
    const cache = persistent ? await window.caches.open(REVIEW_CACHE_NAME) : null
    let cachedCount = 0
    for (const item of packet.items) {
      if (signal.aborted) {
        throw new DOMException('Review cache preparation was cancelled', 'AbortError')
      }
      const existing =
        cache === null
          ? memoryCache.get(item.imageUrl)
          : await cache.match(item.imageUrl)
      if (existing !== undefined) {
        cachedCount += 1
        onProgress(cacheStatus(packet, cachedCount, persistent))
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
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (
        bytes.byteLength !== item.imageByteCount ||
        (await sha256Hex(bytes)) !== item.imageSha256
      ) {
        throw new Error(`Review image ${item.itemId} failed checksum verification`)
      }
      const blob = new Blob([bytes], { type: item.mediaType })
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
      onProgress(cacheStatus(packet, cachedCount, persistent))
    }
    return cacheStatus(packet, cachedCount, persistent)
  },

  async open(item: HumanReviewItem) {
    let blob: Blob | undefined
    if (hasCacheStorage()) {
      const response = await (await window.caches.open(REVIEW_CACHE_NAME)).match(
        item.imageUrl,
      )
      if (response !== undefined) {
        blob = await response.blob()
      }
    } else {
      blob = memoryCache.get(item.imageUrl)
    }
    if (blob === undefined) {
      throw new Error('Prepare the review cache before opening this image')
    }
    return URL.createObjectURL(blob)
  },

  async clear() {
    memoryCache.clear()
    if (hasCacheStorage()) {
      await window.caches.delete(REVIEW_CACHE_NAME)
    }
  },
})

function cacheStatus(
  packet: HumanReviewPacket,
  cachedCount: number,
  persistentBrowserCache: boolean,
): ReviewCacheStatus {
  return Object.freeze({
    ready: cachedCount === packet.items.length,
    cachedCount,
    totalCount: packet.items.length,
    persistentBrowserCache,
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

async function cachedResponseIsValid(
  response: Response,
  item: HumanReviewItem,
): Promise<boolean> {
  const bytes = new Uint8Array(await response.arrayBuffer())
  return (
    bytes.byteLength === item.imageByteCount &&
    (await sha256Hex(bytes)) === item.imageSha256
  )
}
