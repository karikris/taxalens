import { describe, expect, it } from 'vitest'

import judgeBundle from '../../../../../demo/fixture/papilio_pilot/judge_bundle.json'
import bundledItems from '../../../../../demo/fixture/papilio_pilot/verification/items.json'
import campaignManifest from '../../../../../demo/source/verification/papilio-demoleus-commons.campaign.json'
import { validateVerificationSchema } from './verificationSchema'

const VERIFICATION_SECTION_NAMES = Object.freeze([
  'verification_campaigns',
  'verification_items',
  'verification_media',
  'verification_decisions',
  'verification_quality',
] as const)

describe('committed verification exports', () => {
  it('validates the normalized campaign and item exports', () => {
    const campaign = {
      ...campaignManifest.campaign,
      manifestSha256: campaignManifest.manifestSha256,
    }
    expect(validateVerificationSchema('campaign', campaign)).toEqual({
      contract: 'campaign',
      valid: true,
      failures: [],
    })

    const sourceItems = campaignManifest.items
      .map(normalizeSourceItem)
      .sort(compareItems)
    const projectedItems = bundledItems
      .map(normalizeBundledItem)
      .sort(compareItems)

    expect(projectedItems).toEqual(sourceItems)
    for (const item of [...sourceItems, ...projectedItems]) {
      expect(validateVerificationSchema('item', item)).toEqual({
        contract: 'item',
        valid: true,
        failures: [],
      })
    }
  })

  it('validates bundle sections and keeps absent decisions and quality explicit', () => {
    const sections = Object.fromEntries(
      VERIFICATION_SECTION_NAMES.map((name) => [
        name,
        judgeBundle.sections[name],
      ]),
    )

    expect(
      validateVerificationSchema(
        'judge_bundle_verification_sections',
        sections,
      ),
    ).toEqual({
      contract: 'judge_bundle_verification_sections',
      valid: true,
      failures: [],
    })
    expect(judgeBundle.sections.verification_decisions).toMatchObject({
      status: 'partial',
      artifact_ids: ['geographic-verification-consensus'],
      verification_status: 'human_review_pending',
      scientific_claim_allowed: false,
    })
    expect(judgeBundle.sections.verification_quality).toMatchObject({
      status: 'partial',
      artifact_ids: ['geographic-release-decisions'],
      verification_status: 'human_review_pending',
      scientific_claim_allowed: false,
    })
    expect(
      judgeBundle.artifact_inventory.some(
        ({ role }) =>
          role === 'verification_decisions' ||
          role === 'verification_quality',
      ),
    ).toBe(true)
  })
})

function normalizeSourceItem(
  source: (typeof campaignManifest.items)[number],
): Readonly<Record<string, unknown>> {
  const { previewAsset, verificationLabel, ...item } = source
  expect(verificationLabel.length).toBeGreaterThan(0)
  return {
    ...item,
    previewUri: `verification/media/${previewAsset}`,
  }
}

function normalizeBundledItem(
  source: (typeof bundledItems)[number],
): Readonly<Record<string, unknown>> {
  const {
    mediaArtifactId,
    previewAsset,
    verificationLabel,
    scientificClaimAllowed,
    ...item
  } = source
  expect(mediaArtifactId).toBe(`verification-media-${source.itemId}`)
  expect(previewAsset.length).toBeGreaterThan(0)
  expect(verificationLabel.length).toBeGreaterThan(0)
  expect(scientificClaimAllowed).toBe(false)
  return item
}

function compareItems(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): number {
  return String(left.itemId).localeCompare(String(right.itemId))
}
