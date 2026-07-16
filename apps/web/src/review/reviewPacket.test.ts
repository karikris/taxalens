import { describe, expect, it } from 'vitest'

import {
  COMMONS_VERIFICATION_FIXTURE,
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_PACKET,
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
    ).toEqual([
      {
        imageByteCount: 180_698,
        imageSha256:
          '47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
      },
      {
        imageByteCount: 159_332,
        imageSha256:
          '3bd3248347c3b82a977b0890f192f2f0c93253eff13d38b4b54dedb08b39627b',
      },
      {
        imageByteCount: 130_460,
        imageSha256:
          '9ceb5c0e354627441ba7be5a8e75a8eed7c278948e606e4892ae47387ee1bbea',
      },
    ])
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
