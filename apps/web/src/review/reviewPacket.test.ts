import { describe, expect, it } from 'vitest'

import {
  COMMONS_VERIFICATION_FIXTURE,
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_PACKET,
  VERIFICATION_CAMPAIGN_MANIFEST,
} from './reviewPacket'
import { validateVerificationItem } from './verificationContracts'

describe('Commons verification campaign fixture', () => {
  it('loads the three existing images through generic campaign contracts', () => {
    expect(COMMONS_VERIFICATION_FIXTURE.schemaVersion).toBe(
      'taxalens-verification-campaign-manifest:v1.0.0',
    )
    expect(HUMAN_REVIEW_CAMPAIGN).toMatchObject({
      campaignId: 'papilio-demoleus-commons-review-v1',
      kind: 'reference_identity_verification',
      publicReplay: true,
      scientificClaimAllowed: false,
    })
    expect(COMMONS_VERIFICATION_FIXTURE.items).toHaveLength(3)
    expect(
      COMMONS_VERIFICATION_FIXTURE.items.map(
        ({ imageByteCount, imageSha256 }) => ({
          imageByteCount,
          imageSha256,
        }),
      ),
    ).toEqual(
      VERIFICATION_CAMPAIGN_MANIFEST.items.map(
        ({ imageByteCount, imageSha256 }) => ({
          imageByteCount,
          imageSha256,
        }),
      ),
    )
    for (const item of COMMONS_VERIFICATION_FIXTURE.items) {
      expect(validateVerificationItem(item, HUMAN_REVIEW_CAMPAIGN)).toEqual([])
      expect(item.imageUrl).toBe(item.previewUri)
      expect(item.rights.policyStatus).toBe('allowed')
      expect(Object.isFrozen(item)).toBe(true)
    }
  })

  it('preserves local-review compatibility without granting a scientific claim', () => {
    expect(HUMAN_REVIEW_PACKET.packetId).toBe(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )
    expect(HUMAN_REVIEW_PACKET.items).toBe(
      COMMONS_VERIFICATION_FIXTURE.items,
    )
    expect(HUMAN_REVIEW_PACKET.semantics).toEqual({
      separateFromFrozenBioMinerReferenceBank: true,
      reviewerDecisionsAreLocalUntilExported: true,
      scientificClaimAllowed: false,
    })
    expect(HUMAN_REVIEW_PACKET.manifestSha256).toMatch(/^[a-f0-9]{64}$/u)
  })
})
