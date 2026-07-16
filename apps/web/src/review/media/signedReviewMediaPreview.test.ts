import { describe, expect, it, vi } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  SIGNED_REVIEW_MEDIA_PREVIEW_REQUEST_SCHEMA_VERSION,
  SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
  SignedReviewMediaPreviewError,
  SupabaseSignedReviewMediaPreviewClient,
} from './signedReviewMediaPreview'

describe('signed private review media previews', () => {
  it('requests only item identity and validates a short-lived B2 response', async () => {
    const campaign = privateCampaign()
    const item = privateItem()
    const invoke = vi.fn().mockResolvedValue({
      data: signedResponse(),
      error: null,
    })
    const client = new SupabaseSignedReviewMediaPreviewClient({
      functions: { invoke },
      maxLifetimeSeconds: 120,
      now: () => new Date('2026-07-16T20:15:00.000Z'),
    })
    const controller = new AbortController()

    await expect(
      client.getPreview(campaign, item, controller.signal),
    ).resolves.toEqual({
      ...signedResponse(),
      cacheKey: [
        'taxalens-private-review-media',
        encodeURIComponent(item.campaignId),
        encodeURIComponent(item.itemId),
        item.imageSha256,
      ].join('/'),
    })
    expect(invoke).toHaveBeenCalledWith('sign-review-media-preview', {
      body: {
        schemaVersion:
          SIGNED_REVIEW_MEDIA_PREVIEW_REQUEST_SCHEMA_VERSION,
        campaignId: campaign.campaignId,
        itemId: item.itemId,
        requestedLifetimeSeconds: 120,
      },
      signal: controller.signal,
      timeout: 10_000,
    })
    expect(JSON.stringify(invoke.mock.calls[0])).not.toContain(
      item.privateMedia?.objectKey,
    )
  })

  it.each(['pending', 'unknown'] as const)(
    'blocks %s rights before calling the signer',
    async (policyStatus) => {
      const item = privateItem(policyStatus)
      const invoke = vi.fn()
      const client = new SupabaseSignedReviewMediaPreviewClient({
        functions: { invoke },
      })

      await expect(
        client.getPreview(
          privateCampaign(),
          item,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        code: 'rights_blocked',
      } satisfies Partial<SignedReviewMediaPreviewError>)
      expect(invoke).not.toHaveBeenCalled()
    },
  )

  it('keeps private media out of public replay campaigns', async () => {
    const invoke = vi.fn()
    const client = new SupabaseSignedReviewMediaPreviewClient({
      functions: { invoke },
    })

    await expect(
      client.getPreview(
        HUMAN_REVIEW_CAMPAIGN,
        privateItem(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: 'public_replay_forbidden',
    } satisfies Partial<SignedReviewMediaPreviewError>)
    expect(invoke).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'expired URL',
      response: {
        expiresAt: '2026-07-16T20:14:59.000Z',
      },
    },
    {
      name: 'wrong digest',
      response: {
        imageSha256: 'f'.repeat(64),
      },
    },
    {
      name: 'non-B2 host',
      response: {
        url: 'https://example.invalid/private.jpg?X-Amz-Signature=redacted',
      },
    },
    {
      name: 'wrong object key',
      response: {
        objectKey: 'campaigns/other/private.jpg',
      },
    },
  ])('rejects a signed response with $name', async ({ response }) => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ...signedResponse(), ...response },
      error: null,
    })
    const client = new SupabaseSignedReviewMediaPreviewClient({
      functions: { invoke },
      maxLifetimeSeconds: 120,
      now: () => new Date('2026-07-16T20:15:00.000Z'),
    })

    await expect(
      client.getPreview(
        privateCampaign(),
        privateItem(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: 'invalid_response',
    } satisfies Partial<SignedReviewMediaPreviewError>)
  })

  it('reports signer failures without manufacturing a preview', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned HTTP 403'),
    })
    const client = new SupabaseSignedReviewMediaPreviewClient({
      functions: { invoke },
    })

    await expect(
      client.getPreview(
        privateCampaign(),
        privateItem(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: 'signing_failed',
    } satisfies Partial<SignedReviewMediaPreviewError>)
  })
})

function privateCampaign() {
  return Object.freeze({
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: 'private-review-campaign',
    publicReplay: false,
  })
}

function privateItem(
  policyStatus: 'allowed' | 'restricted' | 'pending' | 'unknown' = 'restricted',
) {
  const source = HUMAN_REVIEW_ITEMS[0]
  if (source === undefined) {
    throw new Error('The Commons fixture requires a first item.')
  }
  return Object.freeze({
    ...source,
    campaignId: 'private-review-campaign',
    itemId: 'private-review-item',
    previewUri:
      'taxalens-private-media:campaigns/private-review-campaign/private-review-item.jpg',
    privateMedia: Object.freeze({
      schemaVersion: 'taxalens-verification-private-media:v1.0.0' as const,
      provider: 'backblaze_b2' as const,
      bucketAlias: 'review-media',
      objectKey:
        'campaigns/private-review-campaign/private-review-item.jpg',
      accessScope: 'assigned_reviewer' as const,
    }),
    rights: Object.freeze({
      ...source.rights,
      policyStatus,
    }),
  })
}

function signedResponse() {
  const item = privateItem()
  return {
    schemaVersion: SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
    campaignId: item.campaignId,
    itemId: item.itemId,
    provider: 'backblaze_b2' as const,
    bucketAlias: item.privateMedia.bucketAlias,
    objectKey: item.privateMedia.objectKey,
    accessScope: 'assigned_reviewer' as const,
    rightsPolicyStatus: 'restricted' as const,
    url: 'https://s3.us-west-004.backblazeb2.com/taxalens-review/private.jpg?X-Amz-Expires=120&X-Amz-Signature=redacted',
    issuedAt: '2026-07-16T20:15:00.000Z',
    expiresAt: '2026-07-16T20:17:00.000Z',
    imageSha256: item.imageSha256,
    imageByteCount: item.imageByteCount,
    mediaType: item.mediaType,
  }
}
