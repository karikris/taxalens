import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { HumanReviewWorkspace } from './HumanReviewWorkspace'
import { HUMAN_REVIEW_PACKET } from './reviewPacket'
import type { ReviewMediaCache } from './reviewStore'

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

describe('HumanReviewWorkspace', () => {
  it('keeps scientific outcomes disabled until the verified image is displayed', async () => {
    const cache = fakeCache()
    render(
      <HumanReviewWorkspace
        cache={cache}
        now={() => new Date('2026-07-16T12:00:00Z')}
        replay={replay}
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
    expect(
      window.localStorage.getItem(
        `taxalens-human-review:${HUMAN_REVIEW_PACKET.packetId}`,
      ),
    ).toContain('"outcome":"cant_tell"')
  })

  it('prepares the small cache and records comments, can’t-view, and skip locally', async () => {
    const cache = fakeCache()
    render(
      <HumanReviewWorkspace
        cache={cache}
        now={() => new Date('2026-07-16T12:00:00Z')}
        replay={replay}
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
    const stored = window.localStorage.getItem(
      `taxalens-human-review:${HUMAN_REVIEW_PACKET.packetId}`,
    )
    expect(stored).toContain('Thumbnail did not render clearly.')
    expect(stored).toContain('"outcome":"cant_view"')
    expect(stored).toContain('"outcome":"skipped"')
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
