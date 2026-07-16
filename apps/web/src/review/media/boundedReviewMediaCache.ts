import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import {
  signedReviewMediaCacheKey,
  type SignedReviewMediaPreviewProvider,
} from './signedReviewMediaPreview'

export const PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION =
  'taxalens-private-review-media-cache:v1.0.0' as const

const DEFAULT_CACHE_NAME = 'taxalens-private-review-media-v1'
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024

export interface PrivateReviewMediaCacheRecord {
  readonly schemaVersion: typeof PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION
  readonly cacheKey: string
  readonly campaignId: string
  readonly itemId: string
  readonly imageSha256: string
  readonly imageByteCount: number
  readonly mediaType: `image/${string}`
  readonly lastAccessSequence: number
  readonly blob: Blob
}

export interface PrivateReviewMediaStore {
  readonly persistent: boolean
  list(): Promise<readonly PrivateReviewMediaCacheRecord[]>
  get(cacheKey: string): Promise<PrivateReviewMediaCacheRecord | null>
  put(record: PrivateReviewMediaCacheRecord): Promise<void>
  delete(cacheKey: string): Promise<boolean>
  clear(): Promise<void>
}

export interface BoundedReviewMediaCacheStatus {
  readonly ready: boolean
  readonly currentItemId: string
  readonly cachedItemIds: readonly string[]
  readonly prefetchedItemIds: readonly string[]
  readonly evictedItemIds: readonly string[]
  readonly cachedBytes: number
  readonly maxBytes: number
  readonly persistentBrowserCache: boolean
  readonly itemFailures: Readonly<Record<string, string>>
}

export interface BoundedReviewMediaCacheOptions {
  readonly fetch?: typeof globalThis.fetch
  readonly maxBytes?: number
  readonly previewProvider: SignedReviewMediaPreviewProvider
  readonly store?: PrivateReviewMediaStore
}

export class BoundedReviewMediaCache {
  readonly #fetch: typeof globalThis.fetch
  readonly #maxBytes: number
  readonly #previewProvider: SignedReviewMediaPreviewProvider
  readonly #store: PrivateReviewMediaStore

  constructor({
    fetch = globalThis.fetch,
    maxBytes = DEFAULT_MAX_BYTES,
    previewProvider,
    store = createPrivateReviewMediaStore(),
  }: BoundedReviewMediaCacheOptions) {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > 512 * 1024 * 1024
    ) {
      throw new Error(
        'Private review media cache budget must be an integer from 1 byte to 512 MiB.',
      )
    }
    this.#fetch = fetch
    this.#maxBytes = maxBytes
    this.#previewProvider = previewProvider
    this.#store = store
  }

  async inspect(
    campaign: VerificationCampaign,
    items: readonly VerificationItem[],
    currentItemId: string,
  ): Promise<BoundedReviewMediaCacheStatus> {
    const context = validateCacheContext(campaign, items, currentItemId)
    const failures: Record<string, string> = {}
    const records = await this.#loadVerifiedRecords(context.itemByCacheKey)
    return cacheStatus({
      context,
      evictedItemIds: [],
      failures,
      maxBytes: this.#maxBytes,
      persistent: this.#store.persistent,
      records,
    })
  }

  async prepareWindow(
    campaign: VerificationCampaign,
    items: readonly VerificationItem[],
    currentItemId: string,
    signal: AbortSignal,
    onProgress: (status: BoundedReviewMediaCacheStatus) => void = () =>
      undefined,
  ): Promise<BoundedReviewMediaCacheStatus> {
    const context = validateCacheContext(campaign, items, currentItemId)
    if (context.current.imageByteCount > this.#maxBytes) {
      throw new Error(
        `Current review image exceeds the configured cache budget: ${context.current.itemId}.`,
      )
    }
    const failures: Record<string, string> = {}
    const evictedItemIds: string[] = []
    const records = await this.#loadVerifiedRecords(context.itemByCacheKey)
    let nextAccessSequence = Math.max(
      0,
      ...[...records.values()].map(({ lastAccessSequence }) =>
        Number.isSafeInteger(lastAccessSequence) ? lastAccessSequence : 0,
      ),
    )

    for (const item of context.fetchOrder) {
      throwIfAborted(signal)
      const cacheKey = signedReviewMediaCacheKey(item)
      const existing = records.get(cacheKey)
      if (existing !== undefined) {
        continue
      }
      try {
        const preview = await this.#previewProvider.getPreview(
          campaign,
          item,
          signal,
        )
        const response = await this.#fetch(preview.url, {
          cache: 'no-store',
          credentials: 'omit',
          headers: { Accept: item.mediaType },
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          signal,
        })
        if (!response.ok) {
          throw new Error(
            `Private review image returned HTTP ${response.status}.`,
          )
        }
        const blob = await verifiedMediaBlob(item, response)
        nextAccessSequence += 1
        const record = cacheRecord(item, blob, nextAccessSequence)
        await this.#store.put(record)
        records.set(cacheKey, record)
      } catch (reason) {
        const message = privateMediaErrorMessage(reason)
        failures[item.itemId] = message
        if (item.itemId === currentItemId) {
          throw reason
        }
      }
      onProgress(
        cacheStatus({
          context,
          evictedItemIds,
          failures,
          maxBytes: this.#maxBytes,
          persistent: this.#store.persistent,
          records,
        }),
      )
    }

    for (const item of context.recencyOrder) {
      const cacheKey = signedReviewMediaCacheKey(item)
      const record = records.get(cacheKey)
      if (record === undefined) {
        continue
      }
      nextAccessSequence += 1
      const touched = Object.freeze({
        ...record,
        lastAccessSequence: nextAccessSequence,
      })
      await this.#store.put(touched)
      records.set(cacheKey, touched)
    }

    const protectedCacheKey = signedReviewMediaCacheKey(context.current)
    for (const record of [...records.values()].sort(compareLeastRecentlyUsed)) {
      if (cachedBytes(records) <= this.#maxBytes) {
        break
      }
      if (record.cacheKey === protectedCacheKey) {
        continue
      }
      await this.#store.delete(record.cacheKey)
      records.delete(record.cacheKey)
      evictedItemIds.push(record.itemId)
    }
    if (cachedBytes(records) > this.#maxBytes) {
      throw new Error(
        'The private review media cache could not satisfy its byte budget.',
      )
    }
    const status = cacheStatus({
      context,
      evictedItemIds,
      failures,
      maxBytes: this.#maxBytes,
      persistent: this.#store.persistent,
      records,
    })
    onProgress(status)
    return status
  }

  async open(item: VerificationItem): Promise<string> {
    const cacheKey = signedReviewMediaCacheKey(item)
    const record = await this.#store.get(cacheKey)
    if (record === null) {
      throw new Error(
        'The private review image is not cached. Prepare its review window again.',
      )
    }
    try {
      const blob = await verifiedMediaBlob(item, record.blob)
      const records = await this.#store.list()
      const nextAccessSequence =
        Math.max(0, ...records.map(({ lastAccessSequence }) => lastAccessSequence)) +
        1
      await this.#store.put(
        Object.freeze({
          ...record,
          blob,
          lastAccessSequence: nextAccessSequence,
        }),
      )
      return URL.createObjectURL(blob)
    } catch (reason) {
      await this.#store.delete(cacheKey)
      throw new Error(
        'The cached private review image failed integrity verification and was removed.',
        { cause: reason },
      )
    }
  }

  async clear(): Promise<void> {
    await this.#store.clear()
  }

  async #loadVerifiedRecords(
    itemByCacheKey: ReadonlyMap<string, VerificationItem>,
  ): Promise<Map<string, PrivateReviewMediaCacheRecord>> {
    const records = new Map<string, PrivateReviewMediaCacheRecord>()
    for (const record of await this.#store.list()) {
      const item = itemByCacheKey.get(record.cacheKey)
      if (
        item === undefined ||
        record.schemaVersion !== PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION ||
        record.campaignId !== item.campaignId ||
        record.itemId !== item.itemId ||
        record.imageSha256 !== item.imageSha256 ||
        record.imageByteCount !== item.imageByteCount ||
        record.mediaType !== item.mediaType ||
        !Number.isSafeInteger(record.lastAccessSequence) ||
        record.lastAccessSequence < 0
      ) {
        await this.#store.delete(record.cacheKey)
        continue
      }
      try {
        const blob = await verifiedMediaBlob(item, record.blob)
        records.set(
          record.cacheKey,
          Object.freeze({
            ...record,
            blob,
          }),
        )
      } catch {
        await this.#store.delete(record.cacheKey)
      }
    }
    return records
  }
}

export class MemoryPrivateReviewMediaStore implements PrivateReviewMediaStore {
  readonly persistent = false
  readonly #records = new Map<string, PrivateReviewMediaCacheRecord>()

  async list(): Promise<readonly PrivateReviewMediaCacheRecord[]> {
    return Object.freeze(
      [...this.#records.values()].map(cloneCacheRecord),
    )
  }

  async get(cacheKey: string): Promise<PrivateReviewMediaCacheRecord | null> {
    const record = this.#records.get(cacheKey)
    return record === undefined ? null : cloneCacheRecord(record)
  }

  async put(record: PrivateReviewMediaCacheRecord): Promise<void> {
    this.#records.set(record.cacheKey, cloneCacheRecord(record))
  }

  async delete(cacheKey: string): Promise<boolean> {
    return this.#records.delete(cacheKey)
  }

  async clear(): Promise<void> {
    this.#records.clear()
  }
}

export class BrowserPrivateReviewMediaStore implements PrivateReviewMediaStore {
  readonly persistent = true
  readonly #cacheName: string
  readonly #cacheStorage: CacheStorage
  readonly #origin: string

  constructor({
    cacheName = DEFAULT_CACHE_NAME,
    cacheStorage = window.caches,
    origin = window.location.origin,
  }: {
    readonly cacheName?: string
    readonly cacheStorage?: CacheStorage
    readonly origin?: string
  } = {}) {
    if (cacheName.trim() === '') {
      throw new Error('Private review media cache name must not be empty.')
    }
    this.#cacheName = cacheName
    this.#cacheStorage = cacheStorage
    this.#origin = origin
  }

  async list(): Promise<readonly PrivateReviewMediaCacheRecord[]> {
    const cache = await this.#cacheStorage.open(this.#cacheName)
    const records: PrivateReviewMediaCacheRecord[] = []
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      if (response === undefined) {
        continue
      }
      try {
        records.push(await recordFromResponse(response))
      } catch {
        await cache.delete(request)
      }
    }
    return Object.freeze(records)
  }

  async get(cacheKey: string): Promise<PrivateReviewMediaCacheRecord | null> {
    const cache = await this.#cacheStorage.open(this.#cacheName)
    const response = await cache.match(cacheRequest(this.#origin, cacheKey))
    if (response === undefined) {
      return null
    }
    try {
      return await recordFromResponse(response)
    } catch (reason) {
      await cache.delete(cacheRequest(this.#origin, cacheKey))
      throw reason
    }
  }

  async put(record: PrivateReviewMediaCacheRecord): Promise<void> {
    const cache = await this.#cacheStorage.open(this.#cacheName)
    await cache.put(
      cacheRequest(this.#origin, record.cacheKey),
      responseFromRecord(record),
    )
  }

  async delete(cacheKey: string): Promise<boolean> {
    const cache = await this.#cacheStorage.open(this.#cacheName)
    return cache.delete(cacheRequest(this.#origin, cacheKey))
  }

  async clear(): Promise<void> {
    await this.#cacheStorage.delete(this.#cacheName)
  }
}

export function privateReviewMediaWindow(
  items: readonly VerificationItem[],
  currentItemId: string,
): {
  readonly current: VerificationItem
  readonly fetchOrder: readonly VerificationItem[]
  readonly recencyOrder: readonly VerificationItem[]
} {
  const currentIndex = items.findIndex(({ itemId }) => itemId === currentItemId)
  const current = items[currentIndex]
  if (currentIndex === -1 || current === undefined) {
    throw new Error(`Private review item is unavailable: ${currentItemId}.`)
  }
  const nextOne = items[currentIndex + 1]
  const nextTwo = items[currentIndex + 2]
  const previous = items[currentIndex - 1]
  return Object.freeze({
    current,
    fetchOrder: Object.freeze(
      [current, nextOne, nextTwo, previous].filter(
        (item): item is VerificationItem => item !== undefined,
      ),
    ),
    recencyOrder: Object.freeze(
      [previous, nextTwo, nextOne, current].filter(
        (item): item is VerificationItem => item !== undefined,
      ),
    ),
  })
}

function validateCacheContext(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  currentItemId: string,
) {
  if (campaign.publicReplay) {
    throw new Error('Public replay campaigns cannot use the private media cache.')
  }
  if (items.length === 0) {
    throw new Error('Private review media cache requires at least one item.')
  }
  const itemIds = new Set<string>()
  const itemByCacheKey = new Map<string, VerificationItem>()
  for (const item of items) {
    if (item.campaignId !== campaign.campaignId) {
      throw new Error(
        `Private review item belongs to another campaign: ${item.itemId}.`,
      )
    }
    if (itemIds.has(item.itemId)) {
      throw new Error(`Private review item ID is repeated: ${item.itemId}.`)
    }
    itemIds.add(item.itemId)
    itemByCacheKey.set(signedReviewMediaCacheKey(item), item)
  }
  return Object.freeze({
    ...privateReviewMediaWindow(items, currentItemId),
    itemByCacheKey,
    items,
  })
}

function cacheStatus({
  context,
  evictedItemIds,
  failures,
  maxBytes,
  persistent,
  records,
}: {
  readonly context: ReturnType<typeof validateCacheContext>
  readonly evictedItemIds: readonly string[]
  readonly failures: Readonly<Record<string, string>>
  readonly maxBytes: number
  readonly persistent: boolean
  readonly records: ReadonlyMap<string, PrivateReviewMediaCacheRecord>
}): BoundedReviewMediaCacheStatus {
  const cachedItemIds = context.items
    .filter((item) => records.has(signedReviewMediaCacheKey(item)))
    .map(({ itemId }) => itemId)
  const prefetchedItemIds = context.fetchOrder
    .filter((item) => records.has(signedReviewMediaCacheKey(item)))
    .map(({ itemId }) => itemId)
  return Object.freeze({
    ready: records.has(signedReviewMediaCacheKey(context.current)),
    currentItemId: context.current.itemId,
    cachedItemIds: Object.freeze(cachedItemIds),
    prefetchedItemIds: Object.freeze(prefetchedItemIds),
    evictedItemIds: Object.freeze([...evictedItemIds]),
    cachedBytes: cachedBytes(records),
    maxBytes,
    persistentBrowserCache: persistent,
    itemFailures: Object.freeze({ ...failures }),
  })
}

function cacheRecord(
  item: VerificationItem,
  blob: Blob,
  lastAccessSequence: number,
): PrivateReviewMediaCacheRecord {
  return Object.freeze({
    schemaVersion: PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION,
    cacheKey: signedReviewMediaCacheKey(item),
    campaignId: item.campaignId,
    itemId: item.itemId,
    imageSha256: item.imageSha256,
    imageByteCount: item.imageByteCount,
    mediaType: item.mediaType,
    lastAccessSequence,
    blob,
  })
}

function cachedBytes(
  records: ReadonlyMap<string, PrivateReviewMediaCacheRecord>,
): number {
  return [...records.values()].reduce(
    (total, { imageByteCount }) => total + imageByteCount,
    0,
  )
}

function compareLeastRecentlyUsed(
  left: PrivateReviewMediaCacheRecord,
  right: PrivateReviewMediaCacheRecord,
): number {
  return (
    left.lastAccessSequence - right.lastAccessSequence ||
    left.cacheKey.localeCompare(right.cacheKey)
  )
}

async function verifiedMediaBlob(
  item: VerificationItem,
  source: Response | Blob,
): Promise<Blob> {
  const response = source instanceof Response ? source : null
  const mediaType = normalizeMediaType(
    response?.headers.get('Content-Type') ?? source.type,
  )
  const bytes = new Uint8Array(
    await (response === null ? source.arrayBuffer() : response.arrayBuffer()),
  )
  if (
    (response !== null && !response.ok) ||
    mediaType !== item.mediaType ||
    bytes.byteLength !== item.imageByteCount ||
    (await sha256Hex(bytes)) !== item.imageSha256
  ) {
    throw new Error(
      `Private review image failed integrity verification: ${item.itemId}.`,
    )
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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException(
      'Private review media preparation was cancelled.',
      'AbortError',
    )
  }
}

function privateMediaErrorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Private review media preparation failed.'
}

function createPrivateReviewMediaStore(): PrivateReviewMediaStore {
  return typeof window !== 'undefined' && typeof window.caches !== 'undefined'
    ? new BrowserPrivateReviewMediaStore()
    : new MemoryPrivateReviewMediaStore()
}

function cloneCacheRecord(
  record: PrivateReviewMediaCacheRecord,
): PrivateReviewMediaCacheRecord {
  return Object.freeze({
    ...record,
    blob: record.blob.slice(0, record.blob.size, record.blob.type),
  })
}

function cacheRequest(origin: string, cacheKey: string): Request {
  const url = new URL(
    `/__taxalens_private_review_media__/${encodeURIComponent(cacheKey)}`,
    origin,
  )
  return new Request(url, {
    credentials: 'omit',
    method: 'GET',
  })
}

function responseFromRecord(record: PrivateReviewMediaCacheRecord): Response {
  return new Response(record.blob, {
    headers: {
      'Content-Type': record.mediaType,
      'X-TaxaLens-Cache-Schema': record.schemaVersion,
      'X-TaxaLens-Cache-Key': record.cacheKey,
      'X-TaxaLens-Campaign-Id': record.campaignId,
      'X-TaxaLens-Item-Id': record.itemId,
      'X-TaxaLens-Image-SHA256': record.imageSha256,
      'X-TaxaLens-Image-Bytes': String(record.imageByteCount),
      'X-TaxaLens-Last-Access': String(record.lastAccessSequence),
    },
  })
}

async function recordFromResponse(
  response: Response,
): Promise<PrivateReviewMediaCacheRecord> {
  const schemaVersion = requiredHeader(response, 'X-TaxaLens-Cache-Schema')
  if (schemaVersion !== PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION) {
    throw new Error('Private review cache schema version is unsupported.')
  }
  const mediaType = normalizeMediaType(
    requiredHeader(response, 'Content-Type'),
  )
  if (!mediaType.startsWith('image/')) {
    throw new Error('Private review cache media type is invalid.')
  }
  const imageByteCount = positiveIntegerHeader(
    response,
    'X-TaxaLens-Image-Bytes',
  )
  const lastAccessSequence = nonNegativeIntegerHeader(
    response,
    'X-TaxaLens-Last-Access',
  )
  return Object.freeze({
    schemaVersion: PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION,
    cacheKey: requiredHeader(response, 'X-TaxaLens-Cache-Key'),
    campaignId: requiredHeader(response, 'X-TaxaLens-Campaign-Id'),
    itemId: requiredHeader(response, 'X-TaxaLens-Item-Id'),
    imageSha256: requiredHeader(response, 'X-TaxaLens-Image-SHA256'),
    imageByteCount,
    mediaType: mediaType as `image/${string}`,
    lastAccessSequence,
    blob: await response.blob(),
  })
}

function requiredHeader(response: Response, name: string): string {
  const value = response.headers.get(name)
  if (value === null || value.trim() === '') {
    throw new Error(`Private review cache header is missing: ${name}.`)
  }
  return value
}

function positiveIntegerHeader(response: Response, name: string): number {
  const value = Number(requiredHeader(response, name))
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Private review cache header is invalid: ${name}.`)
  }
  return value
}

function nonNegativeIntegerHeader(response: Response, name: string): number {
  const value = Number(requiredHeader(response, name))
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Private review cache header is invalid: ${name}.`)
  }
  return value
}
