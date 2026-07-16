import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { HumanReviewWorkspace } from './HumanReviewWorkspace'
import { InMemoryReviewRepository } from './inMemoryReviewRepository'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './reviewPacket'
import {
  HUMAN_REVIEW_SESSION_STORAGE_KEY,
  ReviewPersistenceError,
  type ReviewCacheStatus,
  type ReviewMediaCache,
} from './reviewStore'

let replay: ReplayEvidence

beforeEach(async () => {
  window.localStorage.clear()
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HumanReviewWorkspace', () => {
  it('keeps scientific outcomes disabled until the verified image is displayed', async () => {
    const cache = fakeCache()
    const repository = reviewRepository()
    const { container } = render(
      <HumanReviewWorkspace
        cache={cache}
        now={() => new Date('2026-07-16T12:00:00Z')}
        replay={replay}
        repository={repository}
      />,
    )

    const yes = screen.getByRole('button', { name: 'Yes' })
    const no = screen.getByRole('button', { name: 'No' })
    const cantTell = screen.getByRole('button', { name: 'Can’t tell' })
    expect(yes).toBeDisabled()
    expect(no).toBeDisabled()
    expect(cantTell).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Can’t view' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled()
    expect(
      screen.getByText(/Yes, No, and Can’t tell are unavailable/u),
    ).toBeInTheDocument()

    fireEvent.click(yes)
    fireEvent.click(no)
    fireEvent.click(cantTell)
    expect(screen.getByText('0 / 3')).toBeInTheDocument()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Prepare review cache' }),
    )
    const image = await screen.findByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    })
    expect(yes).toBeDisabled()
    expect(no).toBeDisabled()
    expect(cantTell).toBeDisabled()

    fireEvent.load(image)
    await waitFor(() => {
      expect(yes).toBeEnabled()
      expect(no).toBeEnabled()
      expect(cantTell).toBeEnabled()
    })
    expect(screen.getByText(/Verified image displayed/u)).toBeInTheDocument()

    fireEvent.click(cantTell)
    expect(screen.getByText(/Can’t tell 1/u)).toBeInTheDocument()
    await waitFor(async () => {
      await expect(
        repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
      ).resolves.toEqual([
        expect.objectContaining({ outcome: 'cant_tell' }),
      ])
      expect(container.firstElementChild).toHaveAttribute(
        'data-workflow-phase',
        'saved',
      )
    })
    expect(
      window.localStorage.getItem(HUMAN_REVIEW_SESSION_STORAGE_KEY),
    ).toBeNull()
  })

  it('prepares the small cache and records comments, can’t-view, and skip locally', async () => {
    const cache = fakeCache()
    const repository = reviewRepository()
    render(
      <HumanReviewWorkspace
        cache={cache}
        now={() => new Date('2026-07-16T12:00:00Z')}
        replay={replay}
        repository={repository}
      />,
    )

    expect(
      screen.getByText(/81 \/ 81 provider-supported items as human-confirmed/u),
    ).toBeInTheDocument()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Prepare review cache' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cache ready' })).toBeDisabled(),
    )
    expect(cache.prepare).toHaveBeenCalledOnce()

    fireEvent.change(screen.getByLabelText(/Comment/u), {
      target: { value: 'Thumbnail did not render clearly.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Can’t view' }))

    expect(screen.getByText('Image 2 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.getByText(/Can’t view 1 · Skipped 1/u)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export review receipt' })).toBeEnabled()
    await waitFor(async () => {
      await expect(
        repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
      ).resolves.toEqual([
        expect.objectContaining({
          outcome: 'cant_view',
          comment: 'Thumbnail did not render clearly.',
        }),
        expect.objectContaining({
          outcome: 'skipped',
          comment: null,
        }),
      ])
    })
    expect(
      window.localStorage.getItem(HUMAN_REVIEW_SESSION_STORAGE_KEY),
    ).toBeNull()
  })

  it('records yes and no as replaceable item-level judgments', async () => {
    render(<HumanReviewWorkspace cache={fakeCache(true)} replay={replay} />)

    await screen.findByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    })
    fireEvent.load(
      screen.getByRole('img', {
        name: /Does this image show an adult Papilio demoleus/u,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
    const reopenedImage = await screen.findByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    })
    fireEvent.load(
      reopenedImage,
    )
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))

    expect(screen.getByText(/Yes 0 · No 1/u)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('cancels preparation, aborts on unmount, and ignores stale completion', async () => {
    const pending = deferred<ReviewCacheStatus>()
    let activeSignal: AbortSignal | undefined
    const cache: ReviewMediaCache = {
      ...fakeCache(),
      prepare: vi.fn().mockImplementation(
        async (
          _packet,
          signal: AbortSignal,
          onProgress: (value: ReviewCacheStatus) => void,
        ) => {
          activeSignal = signal
          onProgress({
            ready: false,
            cachedCount: 1,
            totalCount: 3,
            persistentBrowserCache: true,
            itemFailures: {},
          })
          return pending.promise
        },
      ),
    }
    const rendered = render(
      <HumanReviewWorkspace cache={cache} replay={replay} />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Prepare review cache' }),
    )
    expect(
      screen.getByRole('button', { name: 'Cancel media preparation' }),
    ).toBeEnabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel media preparation' }),
    )
    expect(activeSignal?.aborted).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Prepare review cache' }),
    ).toBeEnabled()

    await act(async () => {
      pending.resolve({
        ready: true,
        cachedCount: 3,
        totalCount: 3,
        persistentBrowserCache: true,
        itemFailures: {},
      })
      await pending.promise
    })
    expect(
      screen.getByRole('button', { name: 'Prepare review cache' }),
    ).toBeEnabled()

    const secondPending = deferred<ReviewCacheStatus>()
    const secondCache: ReviewMediaCache = {
      ...fakeCache(),
      prepare: vi.fn().mockImplementation(
        async (_packet, signal: AbortSignal) => {
          activeSignal = signal
          return secondPending.promise
        },
      ),
    }
    rendered.rerender(
      <HumanReviewWorkspace cache={secondCache} replay={replay} />,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Prepare review cache' }),
    )
    rendered.unmount()
    expect(activeSignal?.aborted).toBe(true)
  })

  it('preserves the review and reports a cache-clear failure', async () => {
    const cache = {
      ...fakeCache(),
      clear: vi.fn().mockRejectedValue(new Error('Cache deletion denied')),
    }
    render(<HumanReviewWorkspace cache={cache} replay={replay} />)

    const cantView = screen.getByRole('button', { name: 'Can’t view' })
    await waitFor(() => expect(cantView).toBeEnabled())
    fireEvent.click(cantView)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear cache and review' }))

    expect(
      await screen.findByText('Local review state could not be cleared'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cache deletion denied/u)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('keeps work in memory and reports repository quota failure', async () => {
    const repository = reviewRepository()
    vi.spyOn(repository, 'appendEvent').mockRejectedValue(
      new ReviewPersistenceError(
        'quota_exceeded',
        'IndexedDB quota exceeded.',
      ),
    )
    render(
      <HumanReviewWorkspace
        cache={fakeCache()}
        replay={replay}
        repository={repository}
      />,
    )

    const cantView = screen.getByRole('button', { name: 'Can’t view' })
    await waitFor(() => expect(cantView).toBeEnabled())
    fireEvent.click(cantView)

    expect(
      await screen.findByText('Review repository persistence failed'),
    ).toBeInTheDocument()
    expect(screen.getByText(/storage quota is full/u)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('reports temporary media and ledger fallbacks when browser storage is unavailable', async () => {
    const cache = fakeCache()
    cache.inspect = vi.fn().mockResolvedValue({
      ready: false,
      cachedCount: 0,
      totalCount: 3,
      persistentBrowserCache: false,
      itemFailures: {},
    })
    render(<HumanReviewWorkspace cache={cache} replay={replay} />)

    expect(
      await screen.findByText('Persistent media cache is unavailable'),
    ).toBeInTheDocument()
    if (typeof window.indexedDB === 'undefined') {
      expect(screen.getByText('IndexedDB is unavailable')).toBeInTheDocument()
    }
  })
})

function fakeCache(initiallyReady = false): ReviewMediaCache & {
  readonly prepare: ReturnType<typeof vi.fn>
} {
  const ready = {
    ready: true,
    cachedCount: 3,
    totalCount: 3,
    persistentBrowserCache: true,
    itemFailures: {},
  }
  return {
    inspect: vi.fn().mockResolvedValue(
      initiallyReady
        ? ready
        : {
            ready: false,
            cachedCount: 0,
            totalCount: 3,
            persistentBrowserCache: true,
            itemFailures: {},
          },
    ),
    prepare: vi.fn().mockImplementation(
      async (_packet, _signal, onProgress: (value: typeof ready) => void) => {
        onProgress(ready)
        return ready
      },
    ),
    open: vi.fn().mockResolvedValue('data:image/jpeg;base64,AA=='),
    clear: vi.fn().mockResolvedValue(undefined),
  }
}

function reviewRepository(): InMemoryReviewRepository {
  return new InMemoryReviewRepository([
    {
      campaign: HUMAN_REVIEW_CAMPAIGN,
      items: HUMAN_REVIEW_ITEMS,
    },
  ])
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}
