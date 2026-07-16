import campaignManifestJson from '../../../../demo/source/verification/papilio-demoleus-commons.campaign.json'
import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationItem,
} from './verificationContracts'

export const VERIFICATION_CAMPAIGN_MANIFEST_SCHEMA_VERSION =
  'taxalens-verification-campaign-manifest:v1.0.0' as const

type ManifestCampaign = Omit<VerificationCampaign, 'manifestSha256'>

interface ManifestItem extends Omit<VerificationItem, 'previewUri'> {
  readonly previewAsset: string
  readonly verificationLabel: string
}

export interface VerificationCampaignManifest {
  readonly schemaVersion: typeof VERIFICATION_CAMPAIGN_MANIFEST_SCHEMA_VERSION
  readonly manifestSha256: string
  readonly campaign: ManifestCampaign
  readonly items: readonly ManifestItem[]
  readonly semantics: {
    readonly localBrowserReview: true
    readonly separateFromFrozenBioMinerReferenceBank: true
    readonly reviewerDecisionsAreLocalUntilExported: true
    readonly scientificClaimAllowed: false
  }
}

export interface HumanReviewItem extends VerificationItem {
  readonly imageUrl: string
  readonly verificationLabel: string
}

export interface VerificationCampaignFixture {
  readonly schemaVersion: typeof VERIFICATION_CAMPAIGN_MANIFEST_SCHEMA_VERSION
  readonly manifestSha256: string
  readonly campaign: VerificationCampaign
  readonly items: readonly HumanReviewItem[]
  readonly semantics: VerificationCampaignManifest['semantics']
}

const fixtureAssetUrls = import.meta.glob<string>('./assets/*', {
  eager: true,
  import: 'default',
  query: '?url',
})

export const VERIFICATION_CAMPAIGN_MANIFEST = deepFreeze(
  campaignManifestJson as unknown as VerificationCampaignManifest,
)

export const COMMONS_VERIFICATION_FIXTURE = loadVerificationCampaignFixture(
  VERIFICATION_CAMPAIGN_MANIFEST,
)

export const HUMAN_REVIEW_CAMPAIGN = COMMONS_VERIFICATION_FIXTURE.campaign
export const HUMAN_REVIEW_ITEMS = COMMONS_VERIFICATION_FIXTURE.items

// Compatibility projection for the current local review store. The source of
// truth is the generic campaign manifest above, not this legacy packet shape.
export const HUMAN_REVIEW_PACKET_SCHEMA_VERSION =
  'taxalens-human-review-packet:v1.0.0' as const

export interface HumanReviewPacket {
  readonly schemaVersion: typeof HUMAN_REVIEW_PACKET_SCHEMA_VERSION
  readonly packetId: string
  readonly target: Pick<
    TaxonIdentity,
    'acceptedTaxonKey' | 'scientificName' | 'commonName'
  >
  readonly items: readonly HumanReviewItem[]
  readonly campaign: VerificationCampaign
  readonly manifestSha256: string
  readonly semantics: {
    readonly separateFromFrozenBioMinerReferenceBank: true
    readonly reviewerDecisionsAreLocalUntilExported: true
    readonly scientificClaimAllowed: false
  }
}

export const HUMAN_REVIEW_PACKET: HumanReviewPacket = deepFreeze({
  schemaVersion: HUMAN_REVIEW_PACKET_SCHEMA_VERSION,
  packetId: HUMAN_REVIEW_CAMPAIGN.campaignId,
  target: compatibilityTarget(requiredTargetTaxon(HUMAN_REVIEW_CAMPAIGN)),
  items: HUMAN_REVIEW_ITEMS,
  campaign: HUMAN_REVIEW_CAMPAIGN,
  manifestSha256: COMMONS_VERIFICATION_FIXTURE.manifestSha256,
  semantics: {
    separateFromFrozenBioMinerReferenceBank: true,
    reviewerDecisionsAreLocalUntilExported: true,
    scientificClaimAllowed: false,
  },
})

function loadVerificationCampaignFixture(
  manifest: VerificationCampaignManifest,
): VerificationCampaignFixture {
  if (manifest.schemaVersion !== VERIFICATION_CAMPAIGN_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported verification campaign manifest: ${manifest.schemaVersion}`,
    )
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.manifestSha256)) {
    throw new Error('Verification campaign manifest requires a SHA-256 digest')
  }
  if (
    manifest.campaign.schemaVersion !== VERIFICATION_CAMPAIGN_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported verification campaign: ${manifest.campaign.schemaVersion}`,
    )
  }

  const campaign = deepFreeze({
    ...manifest.campaign,
    manifestSha256: manifest.manifestSha256,
  })
  const items = manifest.items.map(
    ({ previewAsset, verificationLabel, ...item }): HumanReviewItem => {
      const imageUrl = fixtureAssetUrls[`./assets/${previewAsset}`]
      if (imageUrl === undefined) {
        throw new Error(
          `Verification campaign asset is unavailable: ${previewAsset}`,
        )
      }
      return deepFreeze({
        ...item,
        previewUri: imageUrl,
        imageUrl,
        verificationLabel,
      })
    },
  )

  const failures = [
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
    ...items.flatMap((item) => validateVerificationItem(item, campaign)),
  ]
  if (items.length === 0) {
    failures.push('verification campaign requires at least one item')
  }
  if (failures.length > 0) {
    throw new Error(
      `Invalid verification campaign fixture: ${failures.join('; ')}`,
    )
  }

  return deepFreeze({
    schemaVersion: manifest.schemaVersion,
    manifestSha256: manifest.manifestSha256,
    campaign,
    items,
    semantics: manifest.semantics,
  })
}

function requiredTargetTaxon(campaign: VerificationCampaign): TaxonIdentity {
  if (campaign.targetTaxon === null) {
    throw new Error(
      `Verification campaign ${campaign.campaignId} requires a target taxon`,
    )
  }
  return campaign.targetTaxon
}

function compatibilityTarget(
  target: TaxonIdentity,
): HumanReviewPacket['target'] {
  return {
    acceptedTaxonKey: target.acceptedTaxonKey,
    scientificName: target.scientificName,
    commonName: target.commonName,
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested)
  }
  return Object.freeze(value)
}
