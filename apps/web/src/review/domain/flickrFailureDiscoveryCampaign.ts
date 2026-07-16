import { validateFlickrVerificationSource } from './flickrCampaignSource'
import {
  FLICKR_BLIND_HIDDEN_FIELDS,
  validateFlickrBlindDisclosurePolicy,
} from './flickrReviewDisclosure'
import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type FlickrVerificationPrioritySignals,
  type FlickrVerificationSource,
  type SamplingStratum,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationItem,
} from './verificationContracts'

export const FLICKR_FAILURE_DISCOVERY_SELECTION_SCHEMA_VERSION =
  'taxalens-flickr-failure-discovery-selection:v1.0.0' as const

export type FlickrFailureSignal = keyof FlickrVerificationPrioritySignals

export const FLICKR_FAILURE_SIGNAL_PRIORITY = Object.freeze([
  'lowMargin',
  'visualInputDisagreement',
  'geographicAnomaly',
  'commentConflict',
  'smallSubject',
  'referenceShortfall',
  'unusualCompetitor',
] as const satisfies readonly FlickrFailureSignal[])

const SIGNAL_WEIGHTS: Readonly<Record<FlickrFailureSignal, number>> =
  Object.freeze({
    lowMargin: 64,
    visualInputDisagreement: 32,
    geographicAnomaly: 16,
    commentConflict: 8,
    smallSubject: 4,
    referenceShortfall: 2,
    unusualCompetitor: 1,
  })

const QUALITY_ESTIMATION_BLOCKED_REASON =
  'Targeted failure-discovery selection has unknown inclusion probabilities and is unsuitable for unweighted quality estimation.'

export interface FlickrFailureDiscoveryCampaignConfig {
  readonly title: string
  readonly description: string
  readonly targetTaxon: TaxonIdentity
  readonly targetItemCount: number
  readonly rankingSeed: string
  readonly requiredIndependentReviewers: number
  readonly taxalensSha: string
  readonly biominerSha: string
}

export interface FlickrFailureDiscoveryPriority {
  readonly itemId: string
  readonly flickrRecordId: string
  readonly priorityScore: number
  readonly activeSignals: readonly FlickrFailureSignal[]
  readonly deterministicTieRank: string
}

export interface FlickrFailureDiscoveryCampaignPacket {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly selection: {
    readonly schemaVersion: typeof FLICKR_FAILURE_DISCOVERY_SELECTION_SCHEMA_VERSION
    readonly rankingSeed: string
    readonly sourceRecordCount: number
    readonly canonicalRecordCount: number
    readonly eligibleRecordCount: number
    readonly omittedDuplicateRecordIds: readonly string[]
    readonly omittedNoSignalRecordIds: readonly string[]
    readonly selectedRecordCount: number
    readonly priorityOrder: typeof FLICKR_FAILURE_SIGNAL_PRIORITY
    readonly priorities: readonly FlickrFailureDiscoveryPriority[]
    readonly representative: false
    readonly inclusionProbabilitiesAvailable: false
    readonly samplingWeightsAvailable: false
    readonly unweightedQualityEstimationAllowed: false
    readonly qualityEstimationBlockedReason: string
    readonly scientificClaimAllowed: false
  }
}

interface RankedFailureSource {
  readonly source: FlickrVerificationSource
  readonly priorityScore: number
  readonly activeSignals: readonly FlickrFailureSignal[]
  readonly deterministicTieRank: string
}

export async function buildFlickrFailureDiscoveryCampaign(
  sources: readonly FlickrVerificationSource[],
  config: FlickrFailureDiscoveryCampaignConfig,
): Promise<FlickrFailureDiscoveryCampaignPacket> {
  validateConfig(config)
  const canonical = canonicalSources(sources, config)
  const omittedNoSignalRecordIds = canonical.sources
    .filter((source) => activeSignals(source.prioritySignals).length === 0)
    .map(({ flickrRecordId }) => flickrRecordId)
    .sort()
  const eligible = canonical.sources.filter(
    (source) => activeSignals(source.prioritySignals).length > 0,
  )
  if (eligible.length === 0) {
    throw new Error(
      'Failure-discovery campaign has no records with active priority signals.',
    )
  }
  const ranked: RankedFailureSource[] = await Promise.all(
    eligible.map(async (source) => {
      const signals = activeSignals(source.prioritySignals)
      return Object.freeze({
        source,
        priorityScore: signals.reduce(
          (total, signal) => total + SIGNAL_WEIGHTS[signal],
          0,
        ),
        activeSignals: signals,
        deterministicTieRank: await sha256Hex(
          `${config.rankingSeed}\u0000${source.sourceArtifactFingerprint}\u0000${source.flickrRecordId}`,
        ),
      })
    }),
  )
  ranked.sort(compareRankedSources)
  const selected = ranked.slice(0, Math.min(config.targetItemCount, ranked.length))
  const questionFingerprint = await sha256Hex(
    canonicalJson({
      domain: 'taxalens.flickr-target-question.v1',
      target: config.targetTaxon,
      blind: true,
    }),
  )
  const manifestSha256 = await sha256Hex(
    canonicalJson({
      schemaVersion: FLICKR_FAILURE_DISCOVERY_SELECTION_SCHEMA_VERSION,
      rankingSeed: config.rankingSeed,
      biominerSha: config.biominerSha,
      targetTaxon: config.targetTaxon,
      sourceArtifacts: canonical.sources.map((source) => ({
        flickrRecordId: source.flickrRecordId,
        sourceArtifactFingerprint: source.sourceArtifactFingerprint,
      })),
      rankedEligible: ranked.map(
        ({
          source,
          priorityScore,
          activeSignals: signals,
          deterministicTieRank,
        }) => ({
          flickrRecordId: source.flickrRecordId,
          duplicateGroupId: source.duplicateGroupId,
          ownerGroupId: source.ownerGroupId,
          samplingStratumId: source.samplingStratumId,
          priorityScore,
          activeSignals: signals,
          deterministicTieRank,
        }),
      ),
      selectedRecordIds: selected.map(
        ({ source }) => source.flickrRecordId,
      ),
    }),
  )
  const campaignId = `flickr-failure-discovery-${manifestSha256.slice(0, 24)}`
  const campaign = Object.freeze({
    schemaVersion: VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
    campaignId,
    title: config.title,
    description: config.description,
    kind: 'flickr_target_verification',
    status: 'ready',
    targetTaxon: Object.freeze({ ...config.targetTaxon }),
    sourceProviders: ['flickr'],
    reviewRequirement: {
      requiredIndependentReviewers: config.requiredIndependentReviewers,
      secondReviewPolicy: 'on_conflict_or_uncertain',
      adjudicationRequiredOnConflict:
        config.requiredIndependentReviewers > 1,
      decisiveOutcomes: ['yes', 'no'],
      mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
      nonScientificOutcomes: ['cant_view', 'skipped'],
    },
    samplingPlan: {
      planId: `${campaignId}-targeted-priority`,
      purpose: 'failure_discovery',
      design: 'targeted_priority',
      representative: false,
      blindReview: true,
      selectionSeed: config.rankingSeed,
      targetSampleSize: selected.length,
      inclusionProbabilityRequired: false,
      independentUnit: 'duplicate_group',
      groupingKeys: [
        'duplicate_group',
        'observation_group',
        'owner_group',
        'geographic_cluster',
      ],
      leakagePolicy: 'model_selection_only',
      strata: samplingStrata(eligible, selected),
      qualityEstimationAllowed: false,
      qualityEstimationBlockedReason: QUALITY_ESTIMATION_BLOCKED_REASON,
    },
    disclosurePolicy: {
      mode: 'blind',
      revealAfterDecision: true,
      hiddenBeforeDecision: FLICKR_BLIND_HIDDEN_FIELDS,
    },
    questionFingerprint,
    manifestSha256,
    taxalensSha: config.taxalensSha,
    biominerSha: config.biominerSha,
    publicReplay: false,
    scientificClaimAllowed: false,
  } satisfies VerificationCampaign)
  const items = await Promise.all(
    selected.map(({ source }) => sourceItem(source, campaign)),
  )
  const priorities = selected.map(
    (
      { source, priorityScore, activeSignals: signals, deterministicTieRank },
      index,
    ) =>
      Object.freeze({
        itemId: items[index]?.itemId ?? '',
        flickrRecordId: source.flickrRecordId,
        priorityScore,
        activeSignals: signals,
        deterministicTieRank,
      }),
  )
  const campaignFailures = [
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
    ...validateFlickrBlindDisclosurePolicy(campaign),
  ]
  const itemFailures = items.flatMap((item) =>
    validateVerificationItem(item, campaign),
  )
  if (
    campaignFailures.length > 0 ||
    itemFailures.length > 0 ||
    priorities.some(({ itemId }) => itemId === '')
  ) {
    throw new Error(
      `Failure-discovery campaign projection is invalid: ${[
        ...campaignFailures,
        ...itemFailures,
      ].join('; ')}`,
    )
  }
  return Object.freeze({
    campaign,
    items: Object.freeze(items),
    selection: Object.freeze({
      schemaVersion: FLICKR_FAILURE_DISCOVERY_SELECTION_SCHEMA_VERSION,
      rankingSeed: config.rankingSeed,
      sourceRecordCount: sources.length,
      canonicalRecordCount: canonical.sources.length,
      eligibleRecordCount: eligible.length,
      omittedDuplicateRecordIds: canonical.omittedRecordIds,
      omittedNoSignalRecordIds: Object.freeze(omittedNoSignalRecordIds),
      selectedRecordCount: items.length,
      priorityOrder: FLICKR_FAILURE_SIGNAL_PRIORITY,
      priorities: Object.freeze(priorities),
      representative: false,
      inclusionProbabilitiesAvailable: false,
      samplingWeightsAvailable: false,
      unweightedQualityEstimationAllowed: false,
      qualityEstimationBlockedReason: QUALITY_ESTIMATION_BLOCKED_REASON,
      scientificClaimAllowed: false,
    }),
  })
}

function validateConfig(config: FlickrFailureDiscoveryCampaignConfig): void {
  if (
    config.title.trim() === '' ||
    config.description.trim() === '' ||
    config.rankingSeed.trim() === ''
  ) {
    throw new Error(
      'Failure-discovery campaign text and ranking seed must not be empty.',
    )
  }
  if (!Number.isInteger(config.targetItemCount) || config.targetItemCount < 1) {
    throw new Error(
      'Failure-discovery campaign target item count must be positive.',
    )
  }
  if (
    !Number.isInteger(config.requiredIndependentReviewers) ||
    config.requiredIndependentReviewers < 1
  ) {
    throw new Error(
      'Failure-discovery campaign requires at least one reviewer.',
    )
  }
  if (!/^[a-f0-9]{40}$/.test(config.taxalensSha)) {
    throw new Error(
      'Failure-discovery campaign TaxaLens SHA must be a full commit.',
    )
  }
  if (!/^[a-f0-9]{40}$/.test(config.biominerSha)) {
    throw new Error(
      'Failure-discovery campaign BioMiner SHA must be a full commit.',
    )
  }
}

function canonicalSources(
  sources: readonly FlickrVerificationSource[],
  config: FlickrFailureDiscoveryCampaignConfig,
): {
  readonly sources: readonly FlickrVerificationSource[]
  readonly omittedRecordIds: readonly string[]
} {
  if (sources.length === 0) {
    throw new Error('Failure-discovery campaign source population is empty.')
  }
  const seenRecords = new Set<string>()
  const seenPhotos = new Set<string>()
  const seenMedia = new Set<string>()
  const duplicateOwners = new Map<string, string>()
  for (const source of sources) {
    const failures = validateFlickrVerificationSource(source)
    if (failures.length > 0) {
      throw new Error(
        `Invalid Flickr failure-discovery source: ${failures.join('; ')}`,
      )
    }
    if (source.biominerSha !== config.biominerSha) {
      throw new Error('Flickr failure-discovery source BioMiner SHA is stale.')
    }
    if (source.datasetPartition !== 'model_selection') {
      throw new Error(
        'Flickr failure-discovery sources must use the model_selection partition.',
      )
    }
    if (source.inclusionProbability !== null) {
      throw new Error(
        'Flickr failure-discovery source must not carry an inclusion probability.',
      )
    }
    if (
      seenRecords.has(source.flickrRecordId) ||
      seenPhotos.has(source.flickrPhotoId) ||
      seenMedia.has(source.fullFrameMedia.mediaId)
    ) {
      throw new Error('Flickr failure-discovery source identity is repeated.')
    }
    seenRecords.add(source.flickrRecordId)
    seenPhotos.add(source.flickrPhotoId)
    seenMedia.add(source.fullFrameMedia.mediaId)
    const duplicateOwner = duplicateOwners.get(source.duplicateGroupId)
    if (
      duplicateOwner !== undefined &&
      duplicateOwner !== source.ownerGroupId
    ) {
      throw new Error('A duplicate group spans multiple owner groups.')
    }
    duplicateOwners.set(source.duplicateGroupId, source.ownerGroupId)
  }
  const byDuplicate = groupBy([...sources].sort(compareSources), (source) =>
    source.duplicateGroupId,
  )
  const canonical: FlickrVerificationSource[] = []
  const omitted: string[] = []
  for (const duplicateGroupId of Object.keys(byDuplicate).sort()) {
    const group = byDuplicate[duplicateGroupId] ?? []
    group.sort(compareCanonicalCandidates)
    const [first, ...rest] = group
    if (first === undefined) {
      continue
    }
    canonical.push(first)
    omitted.push(...rest.map(({ flickrRecordId }) => flickrRecordId))
  }
  return {
    sources: Object.freeze(canonical.sort(compareSources)),
    omittedRecordIds: Object.freeze(omitted.sort()),
  }
}

async function sourceItem(
  source: FlickrVerificationSource,
  campaign: VerificationCampaign,
): Promise<VerificationItem> {
  const itemId = `flickr-review-item:${await sha256Hex(
    `${campaign.campaignId}\u0000${source.flickrRecordId}\u0000${source.fullFrameMedia.sha256}`,
  )}`
  return Object.freeze({
    itemId,
    campaignId: campaign.campaignId,
    source: 'flickr',
    sourceObservationId: source.flickrPhotoId,
    sourceMediaId: source.fullFrameMedia.mediaId,
    imageSha256: source.fullFrameMedia.sha256,
    imageByteCount: source.fullFrameMedia.byteCount,
    mediaType: source.fullFrameMedia.mediaType,
    previewUri: source.fullFrameMedia.previewUri,
    targetTaxon: campaign.targetTaxon!,
    providerSuppliedIdentity: {
      providerTaxonKey: null,
      scientificName: null,
      commonName: null,
      rawLabel: null,
      verificationStatus: null,
    },
    expectedLifeStage: source.route.lifeStage,
    expectedVisualDomain: source.route.visualDomain,
    expectedView: source.route.view,
    duplicateGroupId: source.duplicateGroupId,
    observationGroupId: source.observationGroupId,
    ownerPhotographerGroupId: source.ownerGroupId,
    samplingStratumId: source.samplingStratumId,
    inclusionProbability: null,
    rights: source.fullFrameMedia.rights,
    flickrSource: Object.freeze({
      ...source,
      inclusionProbability: null,
    }),
    questionFingerprint: campaign.questionFingerprint,
  })
}

function samplingStrata(
  eligible: readonly FlickrVerificationSource[],
  selected: readonly RankedFailureSource[],
): readonly SamplingStratum[] {
  const eligibleByStratum = groupBy(eligible, ({ samplingStratumId }) =>
    samplingStratumId,
  )
  const selectedByStratum = groupBy(selected, ({ source }) =>
    source.samplingStratumId,
  )
  return Object.freeze(
    Object.keys(eligibleByStratum)
      .sort()
      .map((stratumId) => {
        const populationCount = eligibleByStratum[stratumId]?.length ?? 0
        return Object.freeze({
          stratumId,
          label: `Flickr failure-discovery stratum · ${stratumId}`,
          populationCount,
          targetSampleCount: selectedByStratum[stratumId]?.length ?? 0,
          populationWeight: populationCount / eligible.length,
          selectionNotes:
            'Targeted deterministic priority order; inclusion probability is unknown and no sampling weight is assigned.',
        })
      }),
  )
}

function activeSignals(
  signals: FlickrVerificationPrioritySignals,
): readonly FlickrFailureSignal[] {
  return Object.freeze(
    FLICKR_FAILURE_SIGNAL_PRIORITY.filter((signal) => signals[signal] === true),
  )
}

function priorityScore(source: FlickrVerificationSource): number {
  return activeSignals(source.prioritySignals).reduce(
    (total, signal) => total + SIGNAL_WEIGHTS[signal],
    0,
  )
}

function compareCanonicalCandidates(
  left: FlickrVerificationSource,
  right: FlickrVerificationSource,
): number {
  return (
    priorityScore(right) - priorityScore(left) ||
    compareSources(left, right)
  )
}

function compareRankedSources(
  left: RankedFailureSource,
  right: RankedFailureSource,
): number {
  return (
    right.priorityScore - left.priorityScore ||
    left.deterministicTieRank.localeCompare(right.deterministicTieRank) ||
    compareSources(left.source, right.source)
  )
}

function groupBy<T>(
  values: readonly T[],
  key: (value: T) => string,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const value of values) {
    const groupKey = key(value)
    ;(groups[groupKey] ??= []).push(value)
  }
  return groups
}

function compareSources(
  left: FlickrVerificationSource,
  right: FlickrVerificationSource,
): number {
  return (
    left.samplingStratumId.localeCompare(right.samplingStratumId) ||
    left.ownerGroupId.localeCompare(right.ownerGroupId) ||
    left.duplicateGroupId.localeCompare(right.duplicateGroupId) ||
    left.flickrRecordId.localeCompare(right.flickrRecordId)
  )
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        'Failure-discovery campaign fingerprint contains a non-finite number.',
      )
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new Error(
    'Failure-discovery campaign fingerprint contains an unsupported value.',
  )
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
