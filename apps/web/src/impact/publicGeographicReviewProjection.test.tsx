import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import campaignPacket from '../../../../demo/source/verification/papilio-demoleus-flickr-audit.campaign.json'
import { announceLocalReviewLedgerChange } from '../review/repositories/localReviewLedgerEvents'
import {
  parseCommittedFlickrAuditPacket,
  useLocalGeographicReviewProjection,
  type LocalGeographicReviewProjectionState,
} from './publicGeographicReviewProjection'

describe('public geographic review projection', () => {
  it('validates the committed representative Flickr audit packet without fixed product counts', () => {
    const packet = parseCommittedFlickrAuditPacket(campaignPacket)

    expect(packet.items.length).toBe(packet.campaign.samplingPlan.targetSampleSize)
    expect(packet.campaign.samplingPlan).toMatchObject({
      purpose: 'quality_estimation',
      representative: true,
      qualityEstimationAllowed: true,
    })
  })

  it('reloads after a committed local-ledger notification and stops after unmount', async () => {
    const available = {
      status: 'available',
      projection: {
        items: [],
        cells: [],
        scientificClaimAllowed: false,
      },
      campaignId: 'campaign:test',
      localEventCount: 0,
      failureDiscoveryCampaignStatus: 'unavailable',
      scientificClaimAllowed: false,
    } as const satisfies LocalGeographicReviewProjectionState
    const load = vi.fn(async () => available)
    const { result, unmount } = renderHook(() =>
      useLocalGeographicReviewProjection({ enabled: true, load }),
    )
    await waitFor(() => expect(result.current.status).toBe('available'))
    expect(load).toHaveBeenCalledTimes(1)

    act(() =>
      announceLocalReviewLedgerChange({
        campaignId: 'campaign:test',
        operation: 'append',
        eventId: 'event:test',
      }),
    )
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    unmount()
    act(() =>
      announceLocalReviewLedgerChange({
        campaignId: 'campaign:test',
        operation: 'clear',
        eventId: null,
      }),
    )
    expect(load).toHaveBeenCalledTimes(2)
  })
})
