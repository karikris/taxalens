import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import { resolveVerificationRoute } from './verificationRoute'

describe('verification route resolution', () => {
  it('accepts committed campaign and item IDs with return context', () => {
    expect(
      resolveVerificationRoute({
        campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
        itemId: HUMAN_REVIEW_ITEMS[1]!.itemId,
        returnView: 'evidence-lens',
        errors: [],
      }),
    ).toEqual({
      campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
      itemId: HUMAN_REVIEW_ITEMS[1]!.itemId,
      returnView: 'evidence-lens',
      errors: [],
    })
  })

  it('rejects unknown manifest identities without losing valid return context', () => {
    expect(
      resolveVerificationRoute({
        campaignId: 'unknown-campaign',
        itemId: 'unknown-item',
        returnView: 'dashboard',
        errors: ['unknown verification route parameter: extra'],
      }),
    ).toEqual({
      campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
      itemId: null,
      returnView: 'dashboard',
      errors: [
        'unknown verification route parameter: extra',
        'unknown verification campaign: unknown-campaign',
        'unknown verification item: unknown-item',
      ],
    })
  })
})
