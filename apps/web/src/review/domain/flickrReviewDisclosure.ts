import {
  validateVerificationItem,
  type VerificationCampaign,
  type VerificationItem,
  type VerificationLifeStage,
  type VerificationView,
  type VerificationVisualDomain,
} from './verificationContracts'

export const FLICKR_BLIND_HIDDEN_FIELDS = Object.freeze([
  'target_score_band',
  'competitor_margin_band',
  'decision_state',
  'top_competitors',
  'flickr_comments',
  'query_term',
  'provider_supplied_identity',
  'query_trust_tier',
  'priority_signals',
] as const)

export type FlickrBlindHiddenField =
  (typeof FLICKR_BLIND_HIDDEN_FIELDS)[number]

export interface BlindFlickrReviewContext {
  readonly mode: 'blind'
  readonly decisionRecorded: false
  readonly targetQuestion: string
  readonly campaignPurpose: VerificationCampaign['samplingPlan']['purpose']
  readonly reviewMedia: {
    readonly previewUri: string
    readonly imageSha256: string
    readonly imageByteCount: number
    readonly mediaType: `image/${string}`
  }
  readonly routeExpectation: {
    readonly lifeStage: VerificationLifeStage | null
    readonly visualDomain: VerificationVisualDomain | null
    readonly view: VerificationView | null
  }
  readonly attribution: {
    readonly creator: string | null
    readonly text: string
    readonly licenseName: string
    readonly licenseUri: string
  }
  readonly sourcePageAvailable: false
  readonly hiddenBeforeDecision: readonly FlickrBlindHiddenField[]
}

export function projectBlindFlickrReviewContext(
  campaign: VerificationCampaign,
  item: VerificationItem,
): BlindFlickrReviewContext {
  const targetTaxon = campaign.targetTaxon
  const failures = [
    ...validateVerificationItem(item, campaign),
    ...validateFlickrBlindDisclosurePolicy(campaign),
  ]
  if (
    item.source !== 'flickr' ||
    item.flickrSource === undefined ||
    targetTaxon === null
  ) {
    failures.push(
      'blind Flickr review requires a Flickr item and campaign target',
    )
  }
  if (failures.length > 0) {
    throw new Error(`Invalid blind Flickr review context: ${failures.join('; ')}`)
  }
  if (targetTaxon === null) {
    throw new Error('Blind Flickr review target is unavailable.')
  }

  return Object.freeze({
    mode: 'blind',
    decisionRecorded: false,
    targetQuestion: `Does this image show ${targetTaxon.scientificName}?`,
    campaignPurpose: campaign.samplingPlan.purpose,
    reviewMedia: Object.freeze({
      previewUri: item.previewUri,
      imageSha256: item.imageSha256,
      imageByteCount: item.imageByteCount,
      mediaType: item.mediaType,
    }),
    routeExpectation: Object.freeze({
      lifeStage: item.expectedLifeStage,
      visualDomain: item.expectedVisualDomain,
      view: item.expectedView,
    }),
    attribution: Object.freeze({
      creator: item.rights.creator,
      text: item.rights.attribution,
      licenseName: item.rights.licenseName,
      licenseUri: item.rights.licenseUri,
    }),
    sourcePageAvailable: false,
    hiddenBeforeDecision: FLICKR_BLIND_HIDDEN_FIELDS,
  })
}

export function validateFlickrBlindDisclosurePolicy(
  campaign: VerificationCampaign,
): readonly string[] {
  const failures: string[] = []
  if (
    campaign.disclosurePolicy.mode !== 'blind' ||
    !campaign.samplingPlan.blindReview
  ) {
    failures.push('Flickr review campaign is not blind')
  }
  if (!campaign.disclosurePolicy.revealAfterDecision) {
    failures.push('blind Flickr review must defer disclosure until a decision')
  }
  const declared = new Set(campaign.disclosurePolicy.hiddenBeforeDecision)
  const missing = FLICKR_BLIND_HIDDEN_FIELDS.filter(
    (field) => !declared.has(field),
  )
  if (missing.length > 0) {
    failures.push(
      `blind Flickr disclosure policy is missing: ${missing.join(', ')}`,
    )
  }
  return Object.freeze(failures)
}

export function flickrBlindHiddenFieldLabel(
  field: FlickrBlindHiddenField,
): string {
  switch (field) {
    case 'target_score_band':
      return 'BioCLIP result'
    case 'competitor_margin_band':
      return 'Target–competitor margin'
    case 'decision_state':
      return 'Model decision'
    case 'top_competitors':
      return 'Top competitor identities'
    case 'flickr_comments':
      return 'Flickr comments and descriptions'
    case 'query_term':
      return 'Source search term'
    case 'provider_supplied_identity':
      return 'Provider-supplied target identity'
    case 'query_trust_tier':
      return 'Query trust tier'
    case 'priority_signals':
      return 'Failure-discovery priority signals'
  }
}
