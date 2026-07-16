import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
  type HumanReviewPacket,
} from '../reviewPacket'

const REVIEW_CACHE_NAME = `taxalens-${HUMAN_REVIEW_PACKET.packetId}`

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
        itemFailures[item.itemId] = reviewMediaErrorMessage(reason)
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

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function normalizeMediaType(value: string | null): string {
  return (value ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function reviewMediaErrorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Review media preparation failed.'
}
