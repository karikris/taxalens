import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createVerificationDashboardView,
  VERIFICATION_ASSIGNMENT_COUNT,
  VERIFICATION_CAMPAIGN_CATALOG,
} from './verificationDashboardModel'

interface CampaignArtifact {
  readonly manifestSha256?: string
  readonly campaign: {
    readonly campaignId: string
    readonly manifestSha256?: string
  }
  readonly items: readonly unknown[]
}

const ARTIFACT_PATHS = [
  'demo/source/verification/papilio-demoleus-commons.campaign.json',
  'demo/source/verification/papilio-demoleus-flickr-audit.campaign.json',
  'demo/source/verification/papilio-demoleus-reference-audit.campaign.json',
  'demo/source/verification/papilio-demoleus-reviewer-controls.campaign.json',
] as const

describe('verification dashboard model', () => {
  it('pins every campaign card to its committed artifact', () => {
    const artifacts = ARTIFACT_PATHS.map(readArtifact)

    expect(VERIFICATION_CAMPAIGN_CATALOG).toHaveLength(artifacts.length)
    expect(VERIFICATION_ASSIGNMENT_COUNT).toBe(82)
    expect(
      VERIFICATION_CAMPAIGN_CATALOG.map(
        ({ campaignId, itemCount, manifestSha256 }) => ({
          campaignId,
          itemCount,
          manifestSha256,
        }),
      ),
    ).toEqual(
      artifacts.map((artifact) => ({
        campaignId: artifact.campaign.campaignId,
        itemCount: artifact.items.length,
        manifestSha256:
          artifact.manifestSha256 ?? artifact.campaign.manifestSha256,
      })),
    )
  })

  it('keeps packet readiness separate from verified outcomes', () => {
    const view = createVerificationDashboardView({
      availability: 'available',
      decisiveItemCount: 2,
      attemptedItemCount: 3,
      conflictItemCount: 1,
      eventCount: 4,
      reason: null,
    })

    expect(view.coverage).toMatchObject({
      decisiveItemCount: 2,
      assignmentCount: 82,
      attemptedItemCount: 3,
      eventCount: 4,
    })
    expect(view.referenceReadiness).toEqual({
      status: 'blocked',
      independentlyVerifiedRecordCount: 0,
      providerRoleSuitableRecordCount: 81,
      blocker: 'independent_taxonomic_verification_missing',
    })
    expect(view.conflicts).toEqual({
      localCount: 1,
      localAvailability: 'available',
      crossCampaignAvailability: 'unavailable',
    })
    expect(view.qualityInterval).toMatchObject({
      availability: 'unavailable',
      decisiveFlickrAuditCount: 0,
      nextMilestone: 20,
    })
    expect(view.nextReviewMilestone).toMatchObject({
      kind: 'local_workflow',
      current: 2,
      target: 3,
      remaining: 1,
    })
  })

  it('advances from the local workflow gate to the first private audit gate', () => {
    const view = createVerificationDashboardView({
      availability: 'available',
      decisiveItemCount: 3,
      attemptedItemCount: 3,
      conflictItemCount: 0,
      eventCount: 3,
      reason: null,
    })

    expect(view.nextReviewMilestone).toEqual({
      kind: 'flickr_quality',
      current: 0,
      target: 20,
      remaining: 20,
      label: 'Reach the first private Flickr quality checkpoint',
    })
  })

  it('rejects inconsistent local ledger projections', () => {
    expect(() =>
      createVerificationDashboardView({
        availability: 'available',
        decisiveItemCount: 2,
        attemptedItemCount: 1,
        conflictItemCount: 0,
        eventCount: 2,
        reason: null,
      }),
    ).toThrow('local verification counts are inconsistent')

    expect(() =>
      createVerificationDashboardView({
        availability: 'unavailable',
        decisiveItemCount: 0,
        attemptedItemCount: 0,
        conflictItemCount: 0,
        eventCount: 0,
        reason: null,
      }),
    ).toThrow('unavailable local verification requires a reason')
  })
})

function readArtifact(relativePath: string): CampaignArtifact {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '..', '..', relativePath), 'utf8'),
  ) as CampaignArtifact
}
