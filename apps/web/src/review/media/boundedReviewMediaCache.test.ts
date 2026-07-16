import { createHash } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  BoundedReviewMediaCache,
  BrowserPrivateReviewMediaStore,
  MemoryPrivateReviewMediaStore,
  PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION,
  privateReviewMediaWindow,
} from './boundedReviewMediaCache'
import {
  SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
  signedReviewMediaCacheKey,
  type SignedReviewMediaPreviewProvider,
} from './signedReviewMediaPreview'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bounded private review media cache', () => {
  it('fetches only the current item, next two, and previous one', async () => {
    const fixture = privateMediaFixture(6, 4)
    const provider = previewProvider()
    const fetch = mediaFetch(fixture.bytesByItemId)
    const cache = new BoundedReviewMediaCache({
      fetch,
      maxBytes: 64,
      previewProvider: provider,
      store: new MemoryPrivateReviewMediaStore(),
    })

    const status = await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-2',
      new AbortController().signal,
    )

    expect(provider.getPreview).toHaveBeenCalledTimes(4)
    expect(
      provider.getPreview.mock.calls.map(([, item]) => item.itemId),
    ).toEqual([
      'private-item-2',
      'private-item-3',
      'private-item-4',
      'private-item-1',
    ])
    expect(status).toMatchObject({
      ready: true,
      currentItemId: 'private-item-2',
      cachedItemIds: [
        'private-item-1',
        'private-item-2',
        'private-item-3',
        'private-item-4',
      ],
      prefetchedItemIds: [
        'private-item-2',
        'private-item-3',
        'private-item-4',
        'private-item-1',
      ],
      cachedBytes: 16,
      maxBytes: 64,
      persistentBrowserCache: false,
    })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(
      fetch.mock.calls.map(([url]) => String(url)),
    ).toEqual([
      signedUrl('private-item-2'),
      signedUrl('private-item-3'),
      signedUrl('private-item-4'),
      signedUrl('private-item-1'),
    ])
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })
  })

  it('evicts the least-recent window entry to stay within the byte budget', async () => {
    const fixture = privateMediaFixture(6, 4)
    const store = new MemoryPrivateReviewMediaStore()
    const provider = previewProvider()
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 12,
      previewProvider: provider,
      store,
    })

    const first = await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-2',
      new AbortController().signal,
    )
    expect(first.cachedItemIds).toEqual([
      'private-item-2',
      'private-item-3',
      'private-item-4',
    ])
    expect(first.evictedItemIds).toEqual(['private-item-1'])
    expect(first.cachedBytes).toBe(12)

    const second = await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-3',
      new AbortController().signal,
    )
    expect(second.cachedItemIds).toEqual([
      'private-item-3',
      'private-item-4',
      'private-item-5',
    ])
    expect(second.evictedItemIds).toEqual(['private-item-2'])
    expect(second.cachedBytes).toBe(12)
    expect(provider.getPreview).toHaveBeenCalledTimes(5)
  })

  it('never requests or persists a signed URL as the cache identity', async () => {
    const fixture = privateMediaFixture(1, 4)
    const store = new MemoryPrivateReviewMediaStore()
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 4,
      previewProvider: previewProvider(),
      store,
    })

    await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-0',
      new AbortController().signal,
    )

    const records = await store.list()
    expect(records).toHaveLength(1)
    expect(records[0]?.cacheKey).toBe(
      signedReviewMediaCacheKey(fixture.items[0]!),
    )
    expect(JSON.stringify(records)).not.toContain('X-Amz-Signature')
  })

  it('round-trips verified blobs through browser Cache Storage metadata', async () => {
    const fixture = privateMediaFixture(1, 4)
    const fake = fakeCacheStorage()
    const store = new BrowserPrivateReviewMediaStore({
      cacheStorage: fake.cacheStorage,
      origin: 'https://taxalens.test',
    })
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 4,
      previewProvider: previewProvider(),
      store,
    })

    const status = await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-0',
      new AbortController().signal,
    )
    const records = await store.list()

    expect(status.persistentBrowserCache).toBe(true)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      cacheKey: signedReviewMediaCacheKey(fixture.items[0]!),
      imageByteCount: 4,
      mediaType: 'image/jpeg',
    })
    expect([...fake.responses.keys()]).toEqual([
      expect.stringContaining('/__taxalens_private_review_media__/'),
    ])
    expect([...fake.responses.keys()][0]).not.toContain('X-Amz-Signature')
  })

  it('rejects a current image larger than the configured cache budget', async () => {
    const fixture = privateMediaFixture(1, 5)
    const provider = previewProvider()
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 4,
      previewProvider: provider,
      store: new MemoryPrivateReviewMediaStore(),
    })

    await expect(
      cache.prepareWindow(
        fixture.campaign,
        fixture.items,
        'private-item-0',
        new AbortController().signal,
      ),
    ).rejects.toThrow(/exceeds the configured cache budget/u)
    expect(provider.getPreview).not.toHaveBeenCalled()
  })

  it('fails closed on corrupt current bytes and does not cache them', async () => {
    const fixture = privateMediaFixture(1, 4)
    const store = new MemoryPrivateReviewMediaStore()
    const cache = new BoundedReviewMediaCache({
      fetch: vi.fn().mockResolvedValue(
        new Response(new Uint8Array([9, 9, 9, 9]), {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
      maxBytes: 4,
      previewProvider: previewProvider(),
      store,
    })

    await expect(
      cache.prepareWindow(
        fixture.campaign,
        fixture.items,
        'private-item-0',
        new AbortController().signal,
      ),
    ).rejects.toThrow(/failed integrity verification/u)
    await expect(store.list()).resolves.toEqual([])
  })

  it('removes a cached blob that is corrupt when opened', async () => {
    const fixture = privateMediaFixture(1, 4)
    const item = fixture.items[0]!
    const store = new MemoryPrivateReviewMediaStore()
    await store.put({
      schemaVersion: PRIVATE_REVIEW_MEDIA_CACHE_SCHEMA_VERSION,
      cacheKey: signedReviewMediaCacheKey(item),
      campaignId: item.campaignId,
      itemId: item.itemId,
      imageSha256: item.imageSha256,
      imageByteCount: item.imageByteCount,
      mediaType: item.mediaType,
      lastAccessSequence: 1,
      blob: new Blob([new Uint8Array([8, 8, 8, 8])], {
        type: item.mediaType,
      }),
    })
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 4,
      previewProvider: previewProvider(),
      store,
    })

    await expect(cache.open(item)).rejects.toThrow(
      /failed integrity verification/u,
    )
    await expect(store.list()).resolves.toEqual([])
  })

  it('reports a failed neighbor prefetch without hiding a ready current image', async () => {
    const fixture = privateMediaFixture(3, 4)
    const provider = previewProvider()
    provider.getPreview.mockImplementation(async (_campaign, item) => {
      if (item.itemId === 'private-item-1') {
        throw new Error('Neighbor preview denied.')
      }
      return previewFor(item)
    })
    const cache = new BoundedReviewMediaCache({
      fetch: mediaFetch(fixture.bytesByItemId),
      maxBytes: 12,
      previewProvider: provider,
      store: new MemoryPrivateReviewMediaStore(),
    })

    const status = await cache.prepareWindow(
      fixture.campaign,
      fixture.items,
      'private-item-0',
      new AbortController().signal,
    )

    expect(status.ready).toBe(true)
    expect(status.cachedItemIds).toEqual([
      'private-item-0',
      'private-item-2',
    ])
    expect(status.itemFailures).toEqual({
      'private-item-1': 'Neighbor preview denied.',
    })
  })

  it('returns the exact navigation window at list boundaries', () => {
    const fixture = privateMediaFixture(5, 4)
    expect(
      privateReviewMediaWindow(fixture.items, 'private-item-0').fetchOrder.map(
        ({ itemId }) => itemId,
      ),
    ).toEqual(['private-item-0', 'private-item-1', 'private-item-2'])
    expect(
      privateReviewMediaWindow(fixture.items, 'private-item-4').fetchOrder.map(
        ({ itemId }) => itemId,
      ),
    ).toEqual(['private-item-4', 'private-item-3'])
  })
})

function privateMediaFixture(count: number, bytesPerItem: number): {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly bytesByItemId: ReadonlyMap<string, Uint8Array<ArrayBuffer>>
} {
  const campaign: VerificationCampaign = Object.freeze({
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: 'private-cache-campaign',
    publicReplay: false,
  })
  const source = HUMAN_REVIEW_ITEMS[0]
  if (source === undefined) {
    throw new Error('The Commons fixture requires a first item.')
  }
  const bytesByItemId = new Map<string, Uint8Array<ArrayBuffer>>()
  const items = Array.from({ length: count }, (_, index) => {
    const itemId = `private-item-${index}`
    const bytes = Uint8Array.from(
      { length: bytesPerItem },
      (_unused, byteIndex) => index * 10 + byteIndex + 1,
    )
    bytesByItemId.set(itemId, bytes)
    return Object.freeze({
      ...source,
      campaignId: campaign.campaignId,
      itemId,
      sourceObservationId: `private-observation-${index}`,
      sourceMediaId: `private-media-${index}`,
      imageSha256: createHash('sha256').update(bytes).digest('hex'),
      imageByteCount: bytes.byteLength,
      previewUri: `taxalens-private-media:campaigns/${campaign.campaignId}/${itemId}.jpg`,
      privateMedia: Object.freeze({
        schemaVersion: 'taxalens-verification-private-media:v1.0.0' as const,
        provider: 'backblaze_b2' as const,
        bucketAlias: 'review-media',
        objectKey: `campaigns/${campaign.campaignId}/${itemId}.jpg`,
        accessScope: 'assigned_reviewer' as const,
      }),
      duplicateGroupId: `private-duplicate-${index}`,
      observationGroupId: `private-observation-${index}`,
      ownerPhotographerGroupId: `private-owner-${index}`,
      rights: Object.freeze({
        ...source.rights,
        policyStatus: 'restricted' as const,
      }),
    })
  })
  return Object.freeze({
    campaign,
    items: Object.freeze(items),
    bytesByItemId,
  })
}

function previewProvider(): SignedReviewMediaPreviewProvider & {
  readonly getPreview: ReturnType<typeof vi.fn>
} {
  return {
    getPreview: vi.fn().mockImplementation(async (_campaign, item) =>
      previewFor(item),
    ),
  }
}

function previewFor(item: VerificationItem) {
  const privateMedia = item.privateMedia
  if (privateMedia === undefined) {
    throw new Error('Private media fixture is incomplete.')
  }
  return Object.freeze({
    schemaVersion: SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
    campaignId: item.campaignId,
    itemId: item.itemId,
    provider: 'backblaze_b2' as const,
    bucketAlias: privateMedia.bucketAlias,
    objectKey: privateMedia.objectKey,
    accessScope: 'assigned_reviewer' as const,
    rightsPolicyStatus: 'restricted' as const,
    url: signedUrl(item.itemId),
    issuedAt: '2026-07-16T20:20:00.000Z',
    expiresAt: '2026-07-16T20:22:00.000Z',
    imageSha256: item.imageSha256,
    imageByteCount: item.imageByteCount,
    mediaType: item.mediaType,
    cacheKey: signedReviewMediaCacheKey(item),
  })
}

function signedUrl(itemId: string): string {
  return `https://s3.us-west-004.backblazeb2.com/review-media/${itemId}.jpg?X-Amz-Signature=${itemId}`
}

function mediaFetch(
  bytesByItemId: ReadonlyMap<string, Uint8Array<ArrayBuffer>>,
) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    )
    const itemId = url.pathname.split('/').at(-1)?.replace(/\.jpg$/u, '')
    const bytes = itemId === undefined ? undefined : bytesByItemId.get(itemId)
    if (bytes === undefined) {
      return new Response(null, { status: 404 })
    }
    return new Response(bytes.slice().buffer, {
      headers: { 'Content-Type': 'image/jpeg' },
    })
  })
}

function fakeCacheStorage() {
  const responses = new Map<string, Response>()
  const cache = {
    delete: vi.fn(async (request: RequestInfo | URL) =>
      responses.delete(requestUrl(request)),
    ),
    keys: vi.fn(async () =>
      [...responses.keys()].map((url) => new Request(url)),
    ),
    match: vi.fn(async (request: RequestInfo | URL) =>
      responses.get(requestUrl(request))?.clone(),
    ),
    put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
      responses.set(requestUrl(request), response.clone())
    }),
  }
  const cacheStorage = {
    delete: vi.fn(async () => {
      const existed = responses.size > 0
      responses.clear()
      return existed
    }),
    open: vi.fn(async () => cache as unknown as Cache),
  } as unknown as CacheStorage
  return { cache, cacheStorage, responses }
}

function requestUrl(request: RequestInfo | URL): string {
  return typeof request === 'string'
    ? request
    : request instanceof URL
      ? request.href
      : request.url
}
