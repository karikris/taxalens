import { describe, expect, it, vi } from 'vitest'

import type { ReviewRepository } from './repositories/reviewRepository'

describe('review repository contract', () => {
  it('exposes campaign, item, event, projection, consensus, export, and clear operations', async () => {
    const repository = {
      loadCampaign: vi.fn().mockResolvedValue(null),
      loadItems: vi.fn().mockResolvedValue([]),
      loadEvents: vi.fn().mockResolvedValue([]),
      appendEvent: vi.fn().mockResolvedValue(undefined),
      loadCurrentDecisions: vi.fn().mockResolvedValue({}),
      loadConsensus: vi.fn().mockResolvedValue([]),
      exportReceipt: vi.fn().mockResolvedValue(new Uint8Array()),
      clearLocalCampaign: vi.fn().mockResolvedValue(undefined),
    } satisfies ReviewRepository

    await expect(repository.loadCampaign('campaign-1')).resolves.toBeNull()
    await expect(repository.loadItems('campaign-1')).resolves.toEqual([])
    await expect(repository.loadEvents('campaign-1')).resolves.toEqual([])
    await expect(repository.loadCurrentDecisions('campaign-1')).resolves.toEqual(
      {},
    )
    await expect(repository.loadConsensus('campaign-1')).resolves.toEqual([])
    await expect(repository.exportReceipt('campaign-1')).resolves.toEqual(
      new Uint8Array(),
    )
    await expect(repository.appendEvent({} as never)).resolves.toBeUndefined()
    await expect(
      repository.clearLocalCampaign('campaign-1'),
    ).resolves.toBeUndefined()
  })
})
