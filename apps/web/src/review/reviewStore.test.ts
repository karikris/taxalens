import { createHash } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewItem,
  type HumanReviewPacket,
} from './reviewPacket'
import {
  browserReviewMediaCache,
  canRecordHumanReviewOutcome,
  currentHumanReviewDecisions,
  emptyHumanReviewSession,
  humanReviewReceiptBytes,
  loadHumanReviewSession,
  loadHumanReviewSessionResult,
  restoreHumanReviewEvents,
  ReviewPersistenceError,
  saveHumanReviewSession,
  type HumanReviewSession,
  withDecision,
  withImageInspection,
  withReviewerId,
} from './reviewStore'

describe('human review local session', () => {
  it('round-trips only decisions belonging to the current packet', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    const session = withDecision(emptyHumanReviewSession(), {
      itemId: item!.itemId,
      outcome: 'cant_tell',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_250,
    })

    saveHumanReviewSession(session, storage)

    expect(loadHumanReviewSession(storage)).toEqual(session)
  })

  it('normalizes retained v1 events with explicit structured defaults', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    const session = withDecision(emptyHumanReviewSession(), {
      itemId: item!.itemId,
      outcome: 'cant_view',
      comment: 'Legacy media failure.',
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: null,
    })
    const current = session.events[0]!
    const {
      mediaQuality: _mediaQuality,
      duplicateConcern: _duplicateConcern,
      captiveOrCultivatedConcern: _captiveConcern,
      ...legacy
    } = current

    expect(
      restoreHumanReviewEvents({
        events: [
          {
            ...legacy,
            schemaVersion: 'taxalens-verification-event:v1.0.0',
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        schemaVersion: 'taxalens-verification-event:v1.3.0',
        mediaQuality: 'unknown',
        duplicateConcern: false,
        captiveOrCultivatedConcern: false,
        nonTargetCategory: null,
      }),
    ])
  })

  it('requires a verified opened image for scientific outcomes', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    const empty = emptyHumanReviewSession()

    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'yes')).toBe(false)
    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'cant_view')).toBe(true)
    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'skipped')).toBe(true)

    const inspected = withImageInspection(empty, {
      itemId: item!.itemId,
      imageOpened: true,
      imageVerified: true,
      imageOpenedAt: '2026-07-16T12:00:00.000Z',
      imageFailureReason: null,
    })

    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'yes')).toBe(true)
    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'no')).toBe(true)
    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'cant_tell')).toBe(
      true,
    )
  })

  it('classifies blocked storage and serialization failures', () => {
    const blocked = loadHumanReviewSessionResult({
      getItem: () => {
        throw new DOMException('storage denied', 'SecurityError')
      },
    })
    expect(blocked.session).toEqual(emptyHumanReviewSession())
    expect(blocked.error).toMatchObject({ code: 'unavailable' })

    const circular = {
      ...emptyHumanReviewSession(),
    } as HumanReviewSession & {
      self?: unknown
    }
    circular.self = circular
    expect(() =>
      saveHumanReviewSession(circular, {
        setItem: vi.fn(),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewPersistenceError>>({
        code: 'serialization_failed',
      }),
    )
  })
})

describe('append-only human review history', () => {
  it('retains first and replacement decisions with explicit supersession', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    let session = withReviewerId(emptyHumanReviewSession(), ' reviewer-a ')
    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'yes',
      comment: 'Initial judgment.',
      reviewedAt: '2026-07-16T15:10:00.000Z',
      reviewDurationMs: 1_000,
    })
    const firstEvent = session.events[0]
    expect(firstEvent).toMatchObject({
      reviewerId: 'reviewer-a',
      reviewRound: 1,
      outcome: 'yes',
      supersedesEventId: null,
    })

    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'no',
      comment: 'Corrected after closer inspection.',
      reviewedAt: '2026-07-16T15:11:00.000Z',
      reviewDurationMs: 2_000,
    })

    expect(session.events).toHaveLength(2)
    expect(session.events[0]).toBe(firstEvent)
    expect(session.events[1]).toMatchObject({
      reviewerId: 'reviewer-a',
      reviewRound: 2,
      outcome: 'no',
      supersedesEventId: firstEvent!.eventId,
    })
    expect(currentHumanReviewDecisions(session)[item!.itemId]).toMatchObject({
      eventId: session.events[1]!.eventId,
      outcome: 'no',
      reviewerId: 'reviewer-a',
    })
  })

  it('does not rewrite earlier attribution when the active reviewer changes', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'cant_tell',
      comment: null,
      reviewedAt: '2026-07-16T15:12:00.000Z',
      reviewDurationMs: null,
    })
    const firstEvent = session.events[0]

    session = withReviewerId(session, 'reviewer-b')
    expect(session.events[0]).toBe(firstEvent)
    expect(session.events[0]!.reviewerId).toBe('reviewer-a')
    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T15:13:00.000Z',
      reviewDurationMs: 500,
    })

    expect(session.events.map(({ reviewerId }) => reviewerId)).toEqual([
      'reviewer-a',
      'reviewer-b',
    ])
    expect(session.events[1]).toMatchObject({
      reviewRound: 1,
      supersedesEventId: null,
    })
  })

  it('exports the full ledger and deterministic current projection', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'yes',
      comment: 'First.',
      reviewedAt: '2026-07-16T15:14:00.000Z',
      reviewDurationMs: 100,
    })
    session = withDecision(session, {
      itemId: item!.itemId,
      outcome: 'no',
      comment: 'Replacement.',
      reviewedAt: '2026-07-16T15:15:00.000Z',
      reviewDurationMs: 200,
    })

    const first = humanReviewReceiptBytes(session)
    const second = humanReviewReceiptBytes(session)
    expect(first).toEqual(second)
    const receipt = JSON.parse(new TextDecoder().decode(first)) as {
      readonly schemaVersion: string
      readonly events: readonly {
        readonly eventId: string
        readonly supersedesEventId: string | null
      }[]
      readonly decisions: readonly {
        readonly eventId: string
        readonly outcome: string
      }[]
    }
    expect(receipt.schemaVersion).toBe(
      'taxalens-human-review-receipt:v2.0.0',
    )
    expect(receipt.events).toHaveLength(2)
    expect(receipt.events[1]!.supersedesEventId).toBe(
      receipt.events[0]!.eventId,
    )
    expect(receipt.decisions).toEqual([
      expect.objectContaining({
        eventId: receipt.events[1]!.eventId,
        outcome: 'no',
      }),
    ])
  })
})

describe('verified review media cache', () => {
  const originalCaches = Object.getOwnPropertyDescriptor(window, 'caches')
  const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL',
  )

  afterEach(async () => {
    await browserReviewMediaCache.clear()
    if (originalCaches === undefined) {
      Reflect.deleteProperty(window, 'caches')
    } else {
      Object.defineProperty(window, 'caches', originalCaches)
    }
    if (originalCreateObjectUrl === undefined) {
      Reflect.deleteProperty(URL, 'createObjectURL')
    } else {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl)
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    {
      name: 'bad byte count',
      cachedBytes: new Uint8Array([1, 2]),
      cachedType: 'image/jpeg',
    },
    {
      name: 'bad SHA-256',
      cachedBytes: new Uint8Array([9, 9, 9]),
      cachedType: 'image/jpeg',
    },
    {
      name: 'wrong media type',
      cachedBytes: new Uint8Array([1, 2, 3]),
      cachedType: 'text/plain',
    },
  ])('deletes a corrupt persistent entry with $name', async ({
    cachedBytes,
    cachedType,
  }) => {
    const expectedBytes = new Uint8Array([1, 2, 3])
    const packet = mediaPacket(expectedBytes)
    const fake = installCacheStorage(
      responseFor(cachedBytes, cachedType),
    )

    const status = await browserReviewMediaCache.inspect(packet)

    expect(status.ready).toBe(false)
    expect(status.cachedCount).toBe(0)
    expect(status.itemFailures[packet.items[0]!.itemId]).toMatch(
      /failed integrity verification/u,
    )
    expect(fake.cache.delete).toHaveBeenCalledWith(
      packet.items[0]!.imageUrl,
    )
  })

  it('returns an object URL only for a valid persistent entry', async () => {
    const expectedBytes = new Uint8Array([1, 2, 3])
    const packet = mediaPacket(expectedBytes)
    const fake = installCacheStorage(
      responseFor(expectedBytes, 'image/jpeg; charset=binary'),
    )
    const createObjectUrl = vi.fn().mockReturnValue('blob:verified-review')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })

    const status = await browserReviewMediaCache.inspect(packet)
    const objectUrl = await browserReviewMediaCache.open(packet.items[0]!)

    expect(status).toMatchObject({
      ready: true,
      cachedCount: 1,
      itemFailures: {},
    })
    expect(fake.cache.delete).not.toHaveBeenCalled()
    expect(objectUrl).toBe('blob:verified-review')
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    expect((createObjectUrl.mock.calls[0]?.[0] as Blob).type).toBe('image/jpeg')
  })

  it('deletes and redownloads a corrupt persistent entry during prepare', async () => {
    const expectedBytes = new Uint8Array([1, 2, 3])
    const packet = mediaPacket(expectedBytes)
    const fake = installCacheStorage(
      responseFor(new Uint8Array([9, 9, 9]), 'image/jpeg'),
    )
    const fetchMock = vi.fn().mockResolvedValue(
      responseFor(expectedBytes, 'image/jpeg'),
    )
    vi.stubGlobal('fetch', fetchMock)
    const progress: number[] = []

    const status = await browserReviewMediaCache.prepare(
      packet,
      new AbortController().signal,
      (current) => progress.push(current.cachedCount),
    )

    expect(status.ready).toBe(true)
    expect(status.cachedCount).toBe(1)
    expect(status.itemFailures).toEqual({})
    expect(fake.cache.delete).toHaveBeenCalledWith(
      packet.items[0]!.imageUrl,
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fake.cache.put).toHaveBeenCalledOnce()
    expect(progress).toEqual([1])
  })

  it('fails closed and deletes a persistent entry corrupted before open', async () => {
    const expectedBytes = new Uint8Array([1, 2, 3])
    const packet = mediaPacket(expectedBytes)
    const fake = installCacheStorage(
      responseFor(new Uint8Array([9, 9, 9]), 'image/jpeg'),
    )

    await expect(
      browserReviewMediaCache.open(packet.items[0]!),
    ).rejects.toThrow(/failed integrity verification/u)
    expect(fake.cache.delete).toHaveBeenCalledWith(
      packet.items[0]!.imageUrl,
    )
  })
})

function mediaPacket(bytes: Uint8Array): HumanReviewPacket {
  const item: HumanReviewItem = Object.freeze({
    ...HUMAN_REVIEW_PACKET.items[0]!,
    itemId: 'verified-cache-test-item',
    imageUrl: 'https://taxalens.test/review-image.jpg',
    imageSha256: createHash('sha256').update(bytes).digest('hex'),
    imageByteCount: bytes.byteLength,
  })
  return Object.freeze({
    ...HUMAN_REVIEW_PACKET,
    items: Object.freeze([item]),
  })
}

function responseFor(bytes: Uint8Array, mediaType: string): Response {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Response(body, {
    headers: { 'Content-Type': mediaType },
  })
}

function installCacheStorage(initialResponse: Response) {
  let storedResponse: Response | undefined = initialResponse
  const cache = {
    delete: vi.fn().mockImplementation(async () => {
      const existed = storedResponse !== undefined
      storedResponse = undefined
      return existed
    }),
    match: vi
      .fn()
      .mockImplementation(async () => storedResponse?.clone()),
    put: vi.fn().mockImplementation(async (_key: string, response: Response) => {
      storedResponse = response.clone()
    }),
  }
  const cacheStorage = {
    delete: vi.fn().mockResolvedValue(true),
    open: vi.fn().mockResolvedValue(cache),
  }
  Object.defineProperty(window, 'caches', {
    configurable: true,
    value: cacheStorage,
  })
  return { cache, cacheStorage }
}
