import { describe, expect, it, vi } from 'vitest'

import { judgeBundleFixture, jsonResponse, runSummaryFixture } from '../test/fixtures'
import {
  loadReplayBootstrap,
  replayBootstrapContract,
  ReplayBootstrapError,
} from './replayBootstrap'

function fetcherFor(manifest: unknown, runSummary: unknown): typeof fetch {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse(manifest))
    .mockResolvedValueOnce(jsonResponse(runSummary))
}

describe('loadReplayBootstrap', () => {
  it('loads the exact static manifest and human-review state', async () => {
    const fetcher = fetcherFor(judgeBundleFixture, runSummaryFixture)

    const result = await loadReplayBootstrap(new AbortController().signal, fetcher)

    expect(result.bundleId).toBe(replayBootstrapContract.bundleId)
    expect(result.target.scientificName).toBe('Papilio demoleus')
    expect(result.artifactCount).toBe(1)
    expect(result.unavailableSectionCount).toBe(6)
    expect(result.heroState).toBe('awaiting_human_review')
    expect(result.scientificClaimAllowed).toBe(false)
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pathname: '/data/run_summary.json' }),
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }),
    )
  })

  it('rejects a stale or different bundle identity', async () => {
    const stale = { ...judgeBundleFixture, bundle_id: 'future-bundle-v2' }

    await expect(
      loadReplayBootstrap(
        new AbortController().signal,
        fetcherFor(stale, runSummaryFixture),
      ),
    ).rejects.toThrow(ReplayBootstrapError)
  })

  it('rejects a hero that is promoted past review', async () => {
    const promoted = { ...runSummaryFixture, hero_state: 'target_confirmed' }

    await expect(
      loadReplayBootstrap(
        new AbortController().signal,
        fetcherFor(judgeBundleFixture, promoted),
      ),
    ).rejects.toThrow('metadata-only hero must await human review')
  })
})
