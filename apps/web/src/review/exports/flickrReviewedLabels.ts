import {
  validateFlickrVerificationSource,
  validateVerificationItem,
  type FlickrNonTargetCategory,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
  type VerificationLifeStage,
  type VerificationView,
  type VerificationVisualDomain,
} from '../domain'
import {
  validateVerificationEvent,
  validateVerificationEventLedger,
} from '../domain/verificationEvents'

export const BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION =
  'reviewed-labels-v2' as const

export const BIOMINER_REVIEWED_LABEL_V2_FIELDS = Object.freeze([
  'schema_version',
  'source',
  'flickr_photo_id',
  'detection_id',
  'crop_hash',
  'label_level',
  'is_butterfly',
  'accepted_taxon_key',
  'scientific_name',
  'family_key',
  'family',
  'genus_key',
  'genus',
  'label_source',
  'reviewer_id',
  'reviewed_at',
  'review_confidence',
  'review_notes',
  'target_present',
  'label_certainty',
  'life_stage',
  'visual_domain',
  'view',
  'route',
  'geo_cluster_id',
  'source_query_tier',
  'source_query_term',
  'duplicate_group_id',
  'observer_owner_group_id',
  'dataset_split',
  'second_review_status',
  'ambiguity_reason',
  'unsuitable_for_species_identification',
] as const)

export type BioMinerReviewedLabelV2Field =
  (typeof BIOMINER_REVIEWED_LABEL_V2_FIELDS)[number]

export interface FlickrReviewedLabelTaxonomy {
  readonly acceptedTaxonKey: string
  readonly scientificName: string
  readonly familyKey: string
  readonly family: string
  readonly genusKey: string
  readonly genus: string
}

export interface FlickrReviewedLabelExportConfig {
  readonly taxonomyByAcceptedTaxonKey: Readonly<
    Record<string, FlickrReviewedLabelTaxonomy>
  >
}

export interface BioMinerReviewedLabelV2Row {
  readonly schema_version: typeof BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION
  readonly source: 'flickr'
  readonly flickr_photo_id: string
  readonly detection_id: string
  readonly crop_hash: string
  readonly label_level:
    | 'photo'
    | 'object'
    | 'family'
    | 'species'
    | 'negative'
  readonly is_butterfly: boolean | null
  readonly accepted_taxon_key: string | null
  readonly scientific_name: string | null
  readonly family_key: string | null
  readonly family: string | null
  readonly genus_key: string | null
  readonly genus: string | null
  readonly label_source: 'taxalens_human_verification'
  readonly reviewer_id: string
  readonly reviewed_at: string
  readonly review_confidence: VerificationEvent['confidence']
  readonly review_notes: string
  readonly target_present: boolean | null
  readonly label_certainty: VerificationEvent['confidence']
  readonly life_stage: VerificationLifeStage
  readonly visual_domain: VerificationVisualDomain
  readonly view: VerificationView
  readonly route:
    | 'adult_field'
    | 'larval'
    | 'pupal'
    | 'egg'
    | 'pinned_specimen'
    | null
  readonly geo_cluster_id: string | null
  readonly source_query_tier: string
  readonly source_query_term: string
  readonly duplicate_group_id: string
  readonly observer_owner_group_id: string
  readonly dataset_split: string
  readonly second_review_status:
    | 'not_required'
    | 'pending'
    | 'second_review_required'
    | 'completed'
    | 'conflict'
    | 'unknown'
  readonly ambiguity_reason: string
  readonly unsuitable_for_species_identification: boolean
}

interface EffectiveDecision {
  readonly event: VerificationEvent
  readonly targetPresent: boolean | null
  readonly taxonomy: FlickrReviewedLabelTaxonomy | null
  readonly labelLevel: BioMinerReviewedLabelV2Row['label_level']
  readonly isButterfly: boolean | null
  readonly secondReviewStatus: BioMinerReviewedLabelV2Row['second_review_status']
  readonly ambiguityReason: string
  readonly unsuitable: boolean
  readonly visualDomainOverride: VerificationVisualDomain | null
  readonly lifeStageOverride: VerificationLifeStage | null
}

export function mapFlickrVerificationEventsToReviewedLabels(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
  config: FlickrReviewedLabelExportConfig,
): readonly BioMinerReviewedLabelV2Row[] {
  assertCampaign(campaign, items, config)
  const canonicalEvents = [...events].sort(compareEvents)
  const ledgerFailures = validateVerificationEventLedger(canonicalEvents)
  if (ledgerFailures.length > 0) {
    throw new Error(
      `Flickr review event ledger is invalid: ${ledgerFailures.join('; ')}`,
    )
  }
  const itemById = new Map(items.map((item) => [item.itemId, item]))
  for (const event of canonicalEvents) {
    const item = itemById.get(event.itemId)
    if (item === undefined) {
      throw new Error(`Flickr review event names an unknown item: ${event.itemId}`)
    }
    const failures = validateVerificationEvent(event, campaign, item)
    if (failures.length > 0) {
      throw new Error(`Flickr review event is invalid: ${failures.join('; ')}`)
    }
  }

  const rows: BioMinerReviewedLabelV2Row[] = []
  for (const item of [...items].sort(compareItems)) {
    const source = item.flickrSource
    if (source === undefined) {
      throw new Error(`Flickr reviewed-label item lost its source: ${item.itemId}`)
    }
    const decision = effectiveDecision(
      campaign,
      canonicalEvents.filter((event) => event.itemId === item.itemId),
      config.taxonomyByAcceptedTaxonKey,
    )
    if (decision === null) {
      continue
    }
    const lifeStage =
      decision.lifeStageOverride ??
      decision.event.correctedLifeStage ??
      item.expectedLifeStage ??
      'unknown'
    const visualDomain =
      decision.visualDomainOverride ??
      decision.event.correctedVisualDomain ??
      item.expectedVisualDomain ??
      'ambiguous'
    const view =
      decision.event.correctedView ?? item.expectedView ?? 'unknown'
    const taxonomy = decision.taxonomy
    const row: BioMinerReviewedLabelV2Row = Object.freeze({
      schema_version: BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION,
      source: 'flickr',
      flickr_photo_id: source.flickrPhotoId,
      detection_id: source.fullFrameMedia.mediaId,
      crop_hash: `sha256:${source.fullFrameMedia.sha256}`,
      label_level: decision.labelLevel,
      is_butterfly: decision.isButterfly,
      accepted_taxon_key: taxonomy?.acceptedTaxonKey ?? null,
      scientific_name:
        taxonomy?.scientificName ??
        (decision.isButterfly === true ? 'Unresolved butterfly' : null),
      family_key: taxonomy?.familyKey ?? null,
      family:
        taxonomy?.family ??
        (decision.isButterfly === true
          ? 'Unresolved butterfly family'
          : null),
      genus_key: taxonomy?.genusKey ?? null,
      genus: taxonomy?.genus ?? null,
      label_source: 'taxalens_human_verification',
      reviewer_id: decision.event.reviewerId.trim() || 'anonymous',
      reviewed_at: decision.event.reviewedAt,
      review_confidence: decision.event.confidence,
      review_notes: decision.event.comment ?? '',
      target_present: decision.targetPresent,
      label_certainty: decision.event.confidence,
      life_stage: lifeStage,
      visual_domain: visualDomain,
      view,
      route: reviewedRoute(lifeStage, visualDomain),
      geo_cluster_id: source.geographicClusterId,
      source_query_tier: source.query.trustTier,
      source_query_term: source.query.term,
      duplicate_group_id: source.duplicateGroupId,
      observer_owner_group_id: source.ownerGroupId,
      dataset_split: source.datasetPartition,
      second_review_status: decision.secondReviewStatus,
      ambiguity_reason: decision.ambiguityReason,
      unsuitable_for_species_identification: decision.unsuitable,
    })
    assertExactCoreFields(row)
    rows.push(row)
  }
  return Object.freeze(rows)
}

function assertCampaign(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  config: FlickrReviewedLabelExportConfig,
): void {
  if (
    campaign.kind !== 'flickr_target_verification' ||
    campaign.targetTaxon === null ||
    campaign.biominerSha === null
  ) {
    throw new Error(
      'Reviewed-label export requires a BioMiner-bound Flickr target campaign.',
    )
  }
  if (items.length === 0) {
    throw new Error('Reviewed-label export requires at least one Flickr item.')
  }
  const targetTaxonomy =
    config.taxonomyByAcceptedTaxonKey[
      campaign.targetTaxon.acceptedTaxonKey
    ]
  assertTaxonomyMatches(campaign.targetTaxon, targetTaxonomy, 'target')
  const seenItems = new Set<string>()
  const seenPhotos = new Set<string>()
  const seenMedia = new Set<string>()
  for (const item of items) {
    const failures = validateVerificationItem(item, campaign)
    if (
      item.source !== 'flickr' ||
      item.flickrSource === undefined ||
      failures.length > 0
    ) {
      throw new Error(
        `Invalid Flickr reviewed-label item: ${failures.join('; ')}`,
      )
    }
    const sourceFailures = validateFlickrVerificationSource(item.flickrSource)
    if (sourceFailures.length > 0) {
      throw new Error(
        `Invalid Flickr reviewed-label source: ${sourceFailures.join('; ')}`,
      )
    }
    if (
      seenItems.has(item.itemId) ||
      seenPhotos.has(item.flickrSource.flickrPhotoId) ||
      seenMedia.has(item.sourceMediaId)
    ) {
      throw new Error('Flickr reviewed-label item identity is repeated.')
    }
    seenItems.add(item.itemId)
    seenPhotos.add(item.flickrSource.flickrPhotoId)
    seenMedia.add(item.sourceMediaId)
  }
}

function effectiveDecision(
  campaign: VerificationCampaign,
  events: readonly VerificationEvent[],
  taxonomyByAcceptedTaxonKey: FlickrReviewedLabelExportConfig['taxonomyByAcceptedTaxonKey'],
): EffectiveDecision | null {
  const effective = latestEventByReviewer(events).filter(
    ({ outcome }) =>
      outcome === 'yes' || outcome === 'no' || outcome === 'cant_tell',
  )
  if (effective.length === 0) {
    return null
  }
  const decisive = effective.filter(
    ({ outcome }) => outcome === 'yes' || outcome === 'no',
  )
  const signatures = new Set(decisive.map(decisionSignature))
  const latest = effective.at(-1)!
  if (signatures.size > 1) {
    return ambiguousDecision(
      latest,
      'conflict',
      'reviewer_decisions_conflict',
    )
  }
  if (decisive.length === 0) {
    return ambiguousDecision(
      latest,
      'second_review_required',
      'human_reviewer_cant_tell',
    )
  }
  const event = decisive.at(-1)!
  const secondReviewStatus = secondReviewStatusFor(
    campaign,
    decisive,
    effective,
  )
  if (event.outcome === 'yes') {
    const target = campaign.targetTaxon
    if (target === null) {
      throw new Error('Flickr campaign target is unavailable.')
    }
    const taxonomy = taxonomyByAcceptedTaxonKey[target.acceptedTaxonKey]
    assertTaxonomyMatches(target, taxonomy, 'target')
    return Object.freeze({
      event,
      targetPresent: true,
      taxonomy,
      labelLevel: 'species',
      isButterfly: true,
      secondReviewStatus,
      ambiguityReason: '',
      unsuitable: false,
      visualDomainOverride: null,
      lifeStageOverride: null,
    })
  }
  return nonTargetDecision(
    event,
    secondReviewStatus,
    taxonomyByAcceptedTaxonKey,
  )
}

function nonTargetDecision(
  event: VerificationEvent,
  secondReviewStatus: BioMinerReviewedLabelV2Row['second_review_status'],
  taxonomyByAcceptedTaxonKey: FlickrReviewedLabelExportConfig['taxonomyByAcceptedTaxonKey'],
): EffectiveDecision {
  const category = event.nonTargetCategory
  if (category === null) {
    throw new Error('Flickr No event lost its non-target category.')
  }
  if (category === 'alternative_species') {
    const alternative = event.alternativeTaxon
    if (alternative === null) {
      throw new Error('Alternative-species event lost its named taxon.')
    }
    const taxonomy =
      taxonomyByAcceptedTaxonKey[alternative.acceptedTaxonKey]
    assertTaxonomyMatches(alternative, taxonomy, 'alternative')
    return Object.freeze({
      event,
      targetPresent: false,
      taxonomy,
      labelLevel: 'species',
      isButterfly: true,
      secondReviewStatus,
      ambiguityReason: '',
      unsuitable: false,
      visualDomainOverride: null,
      lifeStageOverride: null,
    })
  }
  const properties = NON_TARGET_PROPERTIES[category]
  return Object.freeze({
    event,
    targetPresent: properties.targetPresent,
    taxonomy: null,
    labelLevel: properties.labelLevel,
    isButterfly: properties.isButterfly,
    secondReviewStatus,
    ambiguityReason: properties.ambiguityReason,
    unsuitable: true,
    visualDomainOverride: properties.visualDomainOverride,
    lifeStageOverride: properties.lifeStageOverride,
  })
}

const NON_TARGET_PROPERTIES: Readonly<
  Record<
    Exclude<FlickrNonTargetCategory, 'alternative_species'>,
    {
      readonly targetPresent: boolean | null
      readonly labelLevel: BioMinerReviewedLabelV2Row['label_level']
      readonly isButterfly: boolean | null
      readonly ambiguityReason: string
      readonly visualDomainOverride: VerificationVisualDomain | null
      readonly lifeStageOverride: VerificationLifeStage | null
    }
  >
> = Object.freeze({
  other_butterfly: {
    targetPresent: false,
    labelLevel: 'negative',
    isButterfly: true,
    ambiguityReason: 'other_butterfly_without_species_identity',
    visualDomainOverride: null,
    lifeStageOverride: null,
  },
  other_insect: {
    targetPresent: false,
    labelLevel: 'negative',
    isButterfly: false,
    ambiguityReason: 'other_insect_outside_butterfly_target',
    visualDomainOverride: null,
    lifeStageOverride: null,
  },
  artifact: {
    targetPresent: false,
    labelLevel: 'negative',
    isButterfly: false,
    ambiguityReason: 'artifact_not_biological_observation',
    visualDomainOverride: 'unsuitable',
    lifeStageOverride: 'unknown',
  },
  specimen: {
    targetPresent: null,
    labelLevel: 'photo',
    isButterfly: null,
    ambiguityReason: 'specimen_route_requires_separate_review',
    visualDomainOverride: 'pinned_specimen',
    lifeStageOverride: 'unknown',
  },
  no_organism: {
    targetPresent: false,
    labelLevel: 'negative',
    isButterfly: false,
    ambiguityReason: 'no_organism_visible',
    visualDomainOverride: 'unsuitable',
    lifeStageOverride: 'unknown',
  },
  insufficient_visual_detail: {
    targetPresent: null,
    labelLevel: 'photo',
    isButterfly: null,
    ambiguityReason: 'insufficient_visual_detail',
    visualDomainOverride: 'ambiguous',
    lifeStageOverride: 'unknown',
  },
})

function ambiguousDecision(
  event: VerificationEvent,
  status: BioMinerReviewedLabelV2Row['second_review_status'],
  reason: string,
): EffectiveDecision {
  return Object.freeze({
    event,
    targetPresent: null,
    taxonomy: null,
    labelLevel: 'photo',
    isButterfly: null,
    secondReviewStatus: status,
    ambiguityReason: reason,
    unsuitable: true,
    visualDomainOverride: 'ambiguous',
    lifeStageOverride: null,
  })
}

function latestEventByReviewer(
  events: readonly VerificationEvent[],
): readonly VerificationEvent[] {
  const latest = new Map<string, VerificationEvent>()
  for (const event of [...events].sort(compareEvents)) {
    latest.set(event.reviewerId.trim() || 'anonymous', event)
  }
  return Object.freeze([...latest.values()].sort(compareEvents))
}

function secondReviewStatusFor(
  campaign: VerificationCampaign,
  decisive: readonly VerificationEvent[],
  effective: readonly VerificationEvent[],
): BioMinerReviewedLabelV2Row['second_review_status'] {
  const required = campaign.reviewRequirement.requiredIndependentReviewers
  if (required <= 1) {
    return 'not_required'
  }
  if (decisive.length >= required) {
    return 'completed'
  }
  return effective.some(({ outcome }) => outcome === 'cant_tell')
    ? 'second_review_required'
    : 'pending'
}

function decisionSignature(event: VerificationEvent): string {
  if (event.outcome === 'yes') {
    return 'yes'
  }
  return [
    'no',
    event.nonTargetCategory ?? '',
    event.alternativeTaxon?.acceptedTaxonKey ?? '',
  ].join(':')
}

function assertTaxonomyMatches(
  identity: TaxonIdentity,
  taxonomy: FlickrReviewedLabelTaxonomy | undefined,
  label: string,
): asserts taxonomy is FlickrReviewedLabelTaxonomy {
  if (
    taxonomy === undefined ||
    taxonomy.acceptedTaxonKey !== identity.acceptedTaxonKey ||
    taxonomy.scientificName !== identity.scientificName ||
    [
      taxonomy.familyKey,
      taxonomy.family,
      taxonomy.genusKey,
      taxonomy.genus,
    ].some((value) => value.trim() === '')
  ) {
    throw new Error(
      `Reviewed-label ${label} taxonomy lineage is unavailable or stale.`,
    )
  }
}

function reviewedRoute(
  lifeStage: VerificationLifeStage,
  visualDomain: VerificationVisualDomain,
): BioMinerReviewedLabelV2Row['route'] {
  if (visualDomain === 'pinned_specimen') {
    return 'pinned_specimen'
  }
  if (visualDomain !== 'live_field') {
    return null
  }
  switch (lifeStage) {
    case 'adult':
      return 'adult_field'
    case 'larva':
      return 'larval'
    case 'pupa':
      return 'pupal'
    case 'egg':
      return 'egg'
    case 'unknown':
      return null
  }
}

function assertExactCoreFields(row: BioMinerReviewedLabelV2Row): void {
  const actual = Object.keys(row).sort()
  const expected = [...BIOMINER_REVIEWED_LABEL_V2_FIELDS].sort()
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw new Error('Reviewed-label row fields differ from BioMiner v2.')
  }
}

function compareItems(
  left: VerificationItem,
  right: VerificationItem,
): number {
  return (
    (left.flickrSource?.flickrPhotoId ?? '').localeCompare(
      right.flickrSource?.flickrPhotoId ?? '',
    ) || left.itemId.localeCompare(right.itemId)
  )
}

function compareEvents(
  left: VerificationEvent,
  right: VerificationEvent,
): number {
  return (
    left.reviewedAt.localeCompare(right.reviewedAt) ||
    left.reviewRound - right.reviewRound ||
    left.reviewerId.localeCompare(right.reviewerId) ||
    left.eventId.localeCompare(right.eventId)
  )
}
