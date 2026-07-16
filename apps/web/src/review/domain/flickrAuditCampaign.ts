import { validateFlickrVerificationSource } from './flickrCampaignSource'
import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type FlickrVerificationSource,
  type SamplingStratum,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationItem,
} from './verificationContracts'

export const FLICKR_AUDIT_SELECTION_SCHEMA_VERSION =
  'taxalens-flickr-audit-selection:v1.0.0' as const

export interface FlickrAuditCampaignConfig {
  readonly title: string
  readonly description: string
  readonly targetTaxon: TaxonIdentity
  readonly selectionSeed: string
  readonly ownerGroupTargetByStratum: Readonly<Record<string, number>>
  readonly requiredIndependentReviewers: number
  readonly taxalensSha: string
  readonly biominerSha: string
}

export interface FlickrAuditSelectionStratum {
  readonly stratumId: string
  readonly populationOwnerGroupCount: number
  readonly selectedOwnerGroupCount: number
  readonly populationCanonicalRecordCount: number
  readonly selectedCanonicalRecordCount: number
  readonly inclusionProbability: number
  readonly samplingWeight: number
  readonly selectedOwnerGroupIds: readonly string[]
}

export interface FlickrAuditCampaignPacket {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly selection: {
    readonly schemaVersion: typeof FLICKR_AUDIT_SELECTION_SCHEMA_VERSION
    readonly selectionSeed: string
    readonly sourceRecordCount: number
    readonly canonicalRecordCount: number
    readonly omittedDuplicateRecordIds: readonly string[]
    readonly selectedRecordCount: number
    readonly strata: readonly FlickrAuditSelectionStratum[]
    readonly samplingWeights: Readonly<Record<string, number>>
    readonly representative: true
    readonly qualityEstimationAllowed: true
    readonly scientificClaimAllowed: false
  }
}

export async function buildFlickrAuditCampaign(
  sources: readonly FlickrVerificationSource[],
  config: FlickrAuditCampaignConfig,
): Promise<FlickrAuditCampaignPacket> {
  validateConfig(config)
  const canonical = canonicalSources(sources, config)
  const byStratum = groupBy(canonical.sources, ({ samplingStratumId }) =>
    samplingStratumId,
  )
  const selected: {
    readonly source: FlickrVerificationSource
    readonly inclusionProbability: number
    readonly samplingWeight: number
  }[] = []
  const selectionStrata: FlickrAuditSelectionStratum[] = []

  for (const stratumId of Object.keys(byStratum).sort()) {
    const rows = byStratum[stratumId] ?? []
    const byOwner = groupBy(rows, ({ ownerGroupId }) => ownerGroupId)
    const ownerIds = Object.keys(byOwner).sort()
    const requested = config.ownerGroupTargetByStratum[stratumId]
    if (
      requested === undefined ||
      !Number.isInteger(requested) ||
      requested < 1
    ) {
      throw new Error(
        `Audit sampling target is missing for stratum: ${stratumId}`,
      )
    }
    const selectedOwnerCount = Math.min(requested, ownerIds.length)
    const rankedOwners = await Promise.all(
      ownerIds.map(async (ownerGroupId) => ({
        ownerGroupId,
        rank: await sha256Hex(
          `${config.selectionSeed}\u0000${stratumId}\u0000${ownerGroupId}`,
        ),
      })),
    )
    rankedOwners.sort(
      (left, right) =>
        left.rank.localeCompare(right.rank) ||
        left.ownerGroupId.localeCompare(right.ownerGroupId),
    )
    const selectedOwnerIds = rankedOwners
      .slice(0, selectedOwnerCount)
      .map(({ ownerGroupId }) => ownerGroupId)
      .sort()
    const inclusionProbability = selectedOwnerCount / ownerIds.length
    const samplingWeight = 1 / inclusionProbability
    const selectedOwnerSet = new Set(selectedOwnerIds)
    const selectedRows = rows
      .filter(({ ownerGroupId }) => selectedOwnerSet.has(ownerGroupId))
      .sort(compareSources)
    selected.push(
      ...selectedRows.map((source) => ({
        source,
        inclusionProbability,
        samplingWeight,
      })),
    )
    selectionStrata.push(
      Object.freeze({
        stratumId,
        populationOwnerGroupCount: ownerIds.length,
        selectedOwnerGroupCount: selectedOwnerCount,
        populationCanonicalRecordCount: rows.length,
        selectedCanonicalRecordCount: selectedRows.length,
        inclusionProbability,
        samplingWeight,
        selectedOwnerGroupIds: Object.freeze(selectedOwnerIds),
      }),
    )
  }

  const unknownTargets = Object.keys(config.ownerGroupTargetByStratum).filter(
    (stratumId) => byStratum[stratumId] === undefined,
  )
  if (unknownTargets.length > 0) {
    throw new Error(
      `Audit sampling targets name unknown strata: ${unknownTargets.sort().join(', ')}`,
    )
  }
  selected.sort((left, right) => compareSources(left.source, right.source))
  const questionFingerprint = await sha256Hex(
    canonicalJson({
      domain: 'taxalens.flickr-target-question.v1',
      target: config.targetTaxon,
      blind: true,
    }),
  )
  const manifestSha256 = await sha256Hex(
    canonicalJson({
      schemaVersion: FLICKR_AUDIT_SELECTION_SCHEMA_VERSION,
      selectionSeed: config.selectionSeed,
      biominerSha: config.biominerSha,
      targetTaxon: config.targetTaxon,
      sourceArtifacts: canonical.sources.map((source) => ({
        flickrRecordId: source.flickrRecordId,
        sourceArtifactFingerprint: source.sourceArtifactFingerprint,
      })),
      selected: selected.map(({ source, inclusionProbability }) => ({
        flickrRecordId: source.flickrRecordId,
        duplicateGroupId: source.duplicateGroupId,
        ownerGroupId: source.ownerGroupId,
        samplingStratumId: source.samplingStratumId,
        inclusionProbability,
      })),
    }),
  )
  const campaignId = `flickr-audit-${manifestSha256.slice(0, 24)}`
  const strata = samplingStrata(selectionStrata, canonical.sources.length)
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
      planId: `${campaignId}-owner-cluster-sample`,
      purpose: 'quality_estimation',
      design: 'clustered_random',
      representative: true,
      blindReview: true,
      selectionSeed: config.selectionSeed,
      targetSampleSize: selected.length,
      inclusionProbabilityRequired: true,
      independentUnit: 'owner_group',
      groupingKeys: [
        'duplicate_group',
        'observation_group',
        'owner_group',
        'geographic_cluster',
      ],
      leakagePolicy: 'final_test_only',
      strata,
      qualityEstimationAllowed: true,
      qualityEstimationBlockedReason: null,
    },
    disclosurePolicy: {
      mode: 'blind',
      revealAfterDecision: true,
      hiddenBeforeDecision: [
        'target_score_band',
        'decision_state',
        'competitor_margin_band',
        'query_term',
        'query_tier',
        'priority_signals',
      ],
    },
    questionFingerprint,
    manifestSha256,
    taxalensSha: config.taxalensSha,
    biominerSha: config.biominerSha,
    publicReplay: false,
    scientificClaimAllowed: false,
  } satisfies VerificationCampaign)
  const items = await Promise.all(
    selected.map(({ source, inclusionProbability }) =>
      sourceItem(source, campaign, inclusionProbability),
    ),
  )
  const campaignFailures = [
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
  ]
  const itemFailures = items.flatMap((item) =>
    validateVerificationItem(item, campaign),
  )
  if (campaignFailures.length > 0 || itemFailures.length > 0) {
    throw new Error(
      `Audit campaign projection is invalid: ${[
        ...campaignFailures,
        ...itemFailures,
      ].join('; ')}`,
    )
  }
  const samplingWeights = Object.fromEntries(
    items.map((item) => {
      const probability = item.inclusionProbability
      if (probability === null) {
        throw new Error('Audit item lost its inclusion probability.')
      }
      return [item.itemId, 1 / probability]
    }),
  )
  return Object.freeze({
    campaign,
    items: Object.freeze(items),
    selection: Object.freeze({
      schemaVersion: FLICKR_AUDIT_SELECTION_SCHEMA_VERSION,
      selectionSeed: config.selectionSeed,
      sourceRecordCount: sources.length,
      canonicalRecordCount: canonical.sources.length,
      omittedDuplicateRecordIds: canonical.omittedRecordIds,
      selectedRecordCount: items.length,
      strata: Object.freeze(selectionStrata),
      samplingWeights: Object.freeze(samplingWeights),
      representative: true,
      qualityEstimationAllowed: true,
      scientificClaimAllowed: false,
    }),
  })
}

function validateConfig(config: FlickrAuditCampaignConfig): void {
  if (
    config.title.trim() === '' ||
    config.description.trim() === '' ||
    config.selectionSeed.trim() === ''
  ) {
    throw new Error('Audit campaign text and selection seed must not be empty.')
  }
  if (
    !Number.isInteger(config.requiredIndependentReviewers) ||
    config.requiredIndependentReviewers < 1
  ) {
    throw new Error('Audit campaign requires at least one reviewer.')
  }
  if (!/^[a-f0-9]{40}$/.test(config.taxalensSha)) {
    throw new Error('Audit campaign TaxaLens SHA must be a full commit.')
  }
  if (!/^[a-f0-9]{40}$/.test(config.biominerSha)) {
    throw new Error('Audit campaign BioMiner SHA must be a full commit.')
  }
}

function canonicalSources(
  sources: readonly FlickrVerificationSource[],
  config: FlickrAuditCampaignConfig,
): {
  readonly sources: readonly FlickrVerificationSource[]
  readonly omittedRecordIds: readonly string[]
} {
  if (sources.length === 0) {
    throw new Error('Audit campaign source population is empty.')
  }
  const seenRecords = new Set<string>()
  const seenMedia = new Set<string>()
  const duplicateOwners = new Map<string, string>()
  const ownerStrata = new Map<string, string>()
  const byDuplicate = groupBy([...sources].sort(compareSources), (source) =>
    source.duplicateGroupId,
  )
  for (const source of sources) {
    const failures = validateFlickrVerificationSource(source)
    if (failures.length > 0) {
      throw new Error(`Invalid Flickr audit source: ${failures.join('; ')}`)
    }
    if (source.biominerSha !== config.biominerSha) {
      throw new Error('Flickr audit source BioMiner SHA is stale.')
    }
    if (source.datasetPartition !== 'final_test') {
      throw new Error('Flickr audit sources must use the final_test partition.')
    }
    if (source.inclusionProbability !== null) {
      throw new Error(
        'Flickr audit source already has an inclusion probability.',
      )
    }
    if (
      seenRecords.has(source.flickrRecordId) ||
      seenMedia.has(source.fullFrameMedia.mediaId)
    ) {
      throw new Error('Flickr audit source identity is repeated.')
    }
    seenRecords.add(source.flickrRecordId)
    seenMedia.add(source.fullFrameMedia.mediaId)
    const duplicateOwner = duplicateOwners.get(source.duplicateGroupId)
    if (
      duplicateOwner !== undefined &&
      duplicateOwner !== source.ownerGroupId
    ) {
      throw new Error('A duplicate group spans multiple owner groups.')
    }
    duplicateOwners.set(source.duplicateGroupId, source.ownerGroupId)
    const ownerStratum = ownerStrata.get(source.ownerGroupId)
    if (
      ownerStratum !== undefined &&
      ownerStratum !== source.samplingStratumId
    ) {
      throw new Error('An owner group spans multiple audit strata.')
    }
    ownerStrata.set(source.ownerGroupId, source.samplingStratumId)
  }
  const canonical: FlickrVerificationSource[] = []
  const omitted: string[] = []
  for (const duplicateGroupId of Object.keys(byDuplicate).sort()) {
    const group = byDuplicate[duplicateGroupId] ?? []
    const [first, ...rest] = group.sort(compareSources)
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
  inclusionProbability: number,
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
    inclusionProbability,
    rights: source.fullFrameMedia.rights,
    flickrSource: Object.freeze({
      ...source,
      inclusionProbability,
    }),
    questionFingerprint: campaign.questionFingerprint,
  })
}

function samplingStrata(
  selection: readonly FlickrAuditSelectionStratum[],
  totalCanonicalRecords: number,
): readonly SamplingStratum[] {
  return Object.freeze(
    selection.map((stratum) =>
      Object.freeze({
        stratumId: stratum.stratumId,
        label: `Flickr audit stratum · ${stratum.stratumId}`,
        populationCount: stratum.populationCanonicalRecordCount,
        targetSampleCount: stratum.selectedCanonicalRecordCount,
        populationWeight:
          stratum.populationCanonicalRecordCount / totalCanonicalRecords,
        selectionNotes:
          'Seeded equal-probability owner-group cluster sample; one canonical media row per duplicate group.',
      }),
    ),
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
      throw new Error('Audit campaign fingerprint contains a non-finite number.')
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
  throw new Error('Audit campaign fingerprint contains an unsupported value.')
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
