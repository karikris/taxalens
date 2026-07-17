import { describe, expect, it } from 'vitest'

import campaignsSnapshot from '../../../../../demo/repository_storage/supabase/verification_campaigns.json'
import consensusSnapshot from '../../../../../demo/repository_storage/supabase/verification_consensus.json'
import eventsSnapshot from '../../../../../demo/repository_storage/supabase/verification_events.json'
import itemsSnapshot from '../../../../../demo/repository_storage/supabase/verification_items.json'
import qualitySnapshot from '../../../../../demo/repository_storage/supabase/verification_quality_snapshots.json'
import assignmentsSnapshot from '../../../../../demo/repository_storage/supabase/verification_assignments.json'
import {
  verificationCampaignFromSupabaseRow,
  verificationItemFromSupabaseRow,
} from './supabaseReviewRows'

describe('repository-backed Supabase snapshot', () => {
  it('decodes all four campaigns and 82 items through production row adapters', () => {
    const campaigns = campaignsSnapshot.rows.map((row) =>
      verificationCampaignFromSupabaseRow(row),
    )
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.campaignId, campaign]),
    )
    const items = itemsSnapshot.rows.map((row) => {
      const campaign = campaignById.get(row.campaign_id)
      if (campaign === undefined) {
        throw new Error(`Repository item has no campaign: ${row.item_id}`)
      }
      return verificationItemFromSupabaseRow(row, campaign)
    })

    expect(campaigns).toHaveLength(4)
    expect(items).toHaveLength(82)
    expect(
      Object.fromEntries(
        campaigns.map((campaign) => [
          campaign.campaignId,
          items.filter((item) => item.campaignId === campaign.campaignId)
            .length,
        ]),
      ),
    ).toEqual({
      'flickr-audit-fa3dbbb5e5a678f38eb7e7cd': 49,
      'papilio-demoleus-commons-review-v1': 3,
      'reference-audit-8adc6d35657a54fac32a536d': 24,
      'reviewer-controls-a9083d4e8f683545a2991bfa': 6,
    })
    expect(campaigns.filter(({ publicReplay }) => publicReplay)).toHaveLength(
      1,
    )
    expect(campaigns.every(({ scientificClaimAllowed }) => !scientificClaimAllowed)).toBe(
      true,
    )
  })

  it('does not invent mutable collaboration or scientific state', () => {
    expect(assignmentsSnapshot.rows).toEqual([])
    expect(eventsSnapshot.rows).toEqual([])
    expect(consensusSnapshot.rows).toEqual([])
    expect(qualitySnapshot.rows).toEqual([])
  })
})
