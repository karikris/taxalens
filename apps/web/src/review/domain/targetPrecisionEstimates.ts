import type {
  VerificationCampaign,
  VerificationItem,
} from './verificationContracts'
import type { VerificationConsensus } from './verificationConsensus'

export const TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION =
  'taxalens-target-precision-estimate:v1.0.0' as const

export type TargetPrecisionAvailability = 'available' | 'unavailable'

export interface SimpleRandomTargetPrecisionEstimate {
  readonly schemaVersion: typeof TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION
  readonly method: 'simple_random_wilson'
  readonly availability: TargetPrecisionAvailability
  readonly blockers: readonly string[]
  readonly samplingPlanId: string
  readonly confidenceLevel: number
  readonly sampledItemCount: number
  readonly decisiveSampleCount: number
  readonly correctCount: number
  readonly errorCount: number
  readonly estimate: number | null
  readonly interval:
    | {
        readonly lower: number
        readonly upper: number
      }
    | null
}

export interface WeightedPrecisionStratumEstimate {
  readonly stratumId: string
  readonly label: string
  readonly decisiveSampleCount: number
  readonly correctCount: number
  readonly errorCount: number
  readonly samplingWeightSum: number
  readonly populationWeight: number | null
  readonly analysisWeight: number | null
  readonly estimate: number | null
}

export interface WeightedTargetPrecisionEstimate {
  readonly schemaVersion: typeof TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION
  readonly method: 'stratified_hajek'
  readonly availability: TargetPrecisionAvailability
  readonly blockers: readonly string[]
  readonly samplingPlanId: string
  readonly samplingDesign: VerificationCampaign['samplingPlan']['design']
  readonly sampledItemCount: number
  readonly decisiveSampleCount: number
  readonly correctCount: number
  readonly errorCount: number
  readonly estimate: number | null
  readonly effectiveSampleSize: number | null
  readonly representedStrata: readonly string[]
  readonly missingStrata: readonly string[]
  readonly strata: readonly WeightedPrecisionStratumEstimate[]
}

export interface GroupedBootstrapTargetPrecisionInterval {
  readonly schemaVersion: typeof TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION
  readonly method: 'grouped_percentile_bootstrap'
  readonly availability: TargetPrecisionAvailability
  readonly blockers: readonly string[]
  readonly samplingPlanId: string
  readonly samplingDesign: VerificationCampaign['samplingPlan']['design']
  readonly confidenceLevel: number
  readonly bootstrapReplicates: number
  readonly bootstrapSeed: string
  readonly decisiveSampleCount: number
  readonly resamplingGroupCount: number
  readonly groupingKeys: readonly string[]
  readonly pointEstimate: number | null
  readonly interval:
    | {
        readonly lower: number
        readonly upper: number
      }
    | null
}

export interface GroupedBootstrapConfig {
  readonly confidenceLevel?: number
  readonly replicates?: number
  readonly seed?: string
}

interface PrecisionRow {
  readonly item: VerificationItem
  readonly consensus: VerificationConsensus
  readonly targetCorrect: 0 | 1
}

interface WeightedPrecisionRow extends PrecisionRow {
  readonly samplingWeight: number
  readonly analysisWeight: number
}

interface BootstrapGroup {
  readonly groupId: string
  readonly stratumId: string
  readonly rows: readonly WeightedPrecisionRow[]
}

export function estimateSimpleRandomTargetPrecision(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  consensus: readonly VerificationConsensus[],
  confidenceLevel = 0.95,
): SimpleRandomTargetPrecisionEstimate {
  const prepared = preparePrecisionRows(campaign, items, consensus)
  const blockers = [...prepared.blockers]
  if (campaign.samplingPlan.design !== 'simple_random') {
    blockers.push('sampling_design_not_simple_random')
  }
  if (campaign.samplingPlan.independentUnit !== 'media') {
    blockers.push('independent_unit_not_media')
  }
  if (!validConfidenceLevel(confidenceLevel)) {
    blockers.push('confidence_level_invalid')
  }
  const probabilities = items
    .map(({ inclusionProbability }) => inclusionProbability)
    .filter((value): value is number => value !== null)
  if (
    campaign.samplingPlan.inclusionProbabilityRequired &&
    probabilities.length !== items.length
  ) {
    blockers.push('inclusion_probability_missing')
  }
  if (
    probabilities.length > 1 &&
    probabilities.some(
      (probability) =>
        Math.abs(probability - probabilities[0]!) >
        Number.EPSILON * 16,
    )
  ) {
    blockers.push('inclusion_probability_unequal')
  }
  if (prepared.rows.length === 0) {
    blockers.push('decisive_sample_empty')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  if (canonicalBlockers.length > 0) {
    return unavailableSimpleRandomEstimate(
      campaign,
      items.length,
      confidenceLevel,
      prepared.rows.length,
      prepared.rows.reduce(
        (total, { targetCorrect }) => total + targetCorrect,
        0,
      ),
      canonicalBlockers,
    )
  }
  const correctCount = prepared.rows.reduce(
    (total, { targetCorrect }) => total + targetCorrect,
    0,
  )
  const decisiveSampleCount = prepared.rows.length
  const estimate = correctCount / decisiveSampleCount
  const interval = wilsonInterval(
    correctCount,
    decisiveSampleCount,
    confidenceLevel,
  )
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'simple_random_wilson',
    availability: 'available',
    blockers: Object.freeze([]),
    samplingPlanId: campaign.samplingPlan.planId,
    confidenceLevel,
    sampledItemCount: items.length,
    decisiveSampleCount,
    correctCount,
    errorCount: decisiveSampleCount - correctCount,
    estimate,
    interval: Object.freeze(interval),
  })
}

export function wilsonInterval(
  successCount: number,
  sampleCount: number,
  confidenceLevel = 0.95,
): {
  readonly lower: number
  readonly upper: number
} {
  if (
    !Number.isInteger(successCount) ||
    !Number.isInteger(sampleCount) ||
    successCount < 0 ||
    sampleCount < 1 ||
    successCount > sampleCount ||
    !validConfidenceLevel(confidenceLevel)
  ) {
    throw new Error('Wilson interval inputs are invalid.')
  }
  const proportion = successCount / sampleCount
  const z = inverseStandardNormal(0.5 + confidenceLevel / 2)
  const zSquared = z * z
  const denominator = 1 + zSquared / sampleCount
  const center =
    (proportion + zSquared / (2 * sampleCount)) / denominator
  const halfWidth =
    (z / denominator) *
    Math.sqrt(
      (proportion * (1 - proportion)) / sampleCount +
        zSquared / (4 * sampleCount * sampleCount),
    )
  return Object.freeze({
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
  })
}

export function estimateWeightedTargetPrecision(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  consensus: readonly VerificationConsensus[],
): WeightedTargetPrecisionEstimate {
  const prepared = preparePrecisionRows(campaign, items, consensus)
  const blockers = [...prepared.blockers]
  if (
    campaign.samplingPlan.design !== 'stratified_random' &&
    campaign.samplingPlan.design !== 'clustered_random'
  ) {
    blockers.push('sampling_design_not_weighted_probability')
  }
  if (campaign.samplingPlan.strata.length === 0) {
    blockers.push('sampling_strata_missing')
  }
  const stratumById = new Map(
    campaign.samplingPlan.strata.map((stratum) => [
      stratum.stratumId,
      stratum,
    ]),
  )
  if (
    stratumById.size !== campaign.samplingPlan.strata.length ||
    campaign.samplingPlan.strata.some(
      ({ populationCount, populationWeight }) =>
        (populationCount !== null &&
          (!Number.isInteger(populationCount) || populationCount < 1)) ||
        (populationWeight !== null &&
          (!Number.isFinite(populationWeight) || populationWeight <= 0)),
    )
  ) {
    blockers.push('sampling_strata_invalid')
  }
  if (
    items.some(({ samplingStratumId }) => !stratumById.has(samplingStratumId))
  ) {
    blockers.push('sampling_stratum_undeclared')
  }
  const baseRows = prepared.rows.map((row) => {
    const probability = row.item.inclusionProbability
    if (probability === null) {
      if (campaign.samplingPlan.inclusionProbabilityRequired) {
        blockers.push('inclusion_probability_missing')
      }
      return Object.freeze({ ...row, samplingWeight: 1 })
    }
    return Object.freeze({ ...row, samplingWeight: 1 / probability })
  })
  const representedStrata = [
    ...new Set(baseRows.map(({ item }) => item.samplingStratumId)),
  ].sort()
  const missingStrata = campaign.samplingPlan.strata
    .map(({ stratumId }) => stratumId)
    .filter((stratumId) => !representedStrata.includes(stratumId))
    .sort()
  if (missingStrata.length > 0) {
    blockers.push('sampling_strata_missing')
  }
  if (baseRows.length === 0) {
    blockers.push('decisive_sample_empty')
  }
  const declaredWeights = populationWeights(campaign)
  const weightedRows: WeightedPrecisionRow[] = []
  for (const stratum of campaign.samplingPlan.strata) {
    const rows = baseRows.filter(
      ({ item }) => item.samplingStratumId === stratum.stratumId,
    )
    const stratumSamplingWeight = rows.reduce(
      (total, { samplingWeight }) => total + samplingWeight,
      0,
    )
    const declaredWeight = declaredWeights.get(stratum.stratumId)
    for (const row of rows) {
      const analysisWeight =
        declaredWeight === undefined
          ? row.samplingWeight
          : (declaredWeight * row.samplingWeight) /
            stratumSamplingWeight
      weightedRows.push(
        Object.freeze({
          ...row,
          analysisWeight,
        }),
      )
    }
  }
  const analysisWeightSum = weightedRows.reduce(
    (total, { analysisWeight }) => total + analysisWeight,
    0,
  )
  if (
    weightedRows.length > 0 &&
    (!Number.isFinite(analysisWeightSum) || analysisWeightSum <= 0)
  ) {
    blockers.push('sampling_weights_invalid')
  }
  const strata = campaign.samplingPlan.strata.map((stratum) => {
    const rows = weightedRows.filter(
      ({ item }) => item.samplingStratumId === stratum.stratumId,
    )
    const correctCount = rows.reduce(
      (total, { targetCorrect }) => total + targetCorrect,
      0,
    )
    const samplingWeightSum = rows.reduce(
      (total, { samplingWeight }) => total + samplingWeight,
      0,
    )
    const analysisWeight = rows.reduce(
      (total, row) => total + row.analysisWeight,
      0,
    )
    return Object.freeze({
      stratumId: stratum.stratumId,
      label: stratum.label,
      decisiveSampleCount: rows.length,
      correctCount,
      errorCount: rows.length - correctCount,
      samplingWeightSum,
      populationWeight: declaredWeights.get(stratum.stratumId) ?? null,
      analysisWeight: rows.length === 0 ? null : analysisWeight,
      estimate:
        rows.length === 0 || samplingWeightSum <= 0
          ? null
          : rows.reduce(
                (total, row) =>
                  total + row.samplingWeight * row.targetCorrect,
                0,
              ) / samplingWeightSum,
    } satisfies WeightedPrecisionStratumEstimate)
  })
  const canonicalBlockers = [...new Set(blockers)].sort()
  const correctCount = weightedRows.reduce(
    (total, { targetCorrect }) => total + targetCorrect,
    0,
  )
  if (canonicalBlockers.length > 0) {
    return unavailableWeightedEstimate(
      campaign,
      items.length,
      weightedRows.length,
      correctCount,
      representedStrata,
      missingStrata,
      strata,
      canonicalBlockers,
    )
  }
  const estimate =
    weightedRows.reduce(
      (total, row) =>
        total + row.analysisWeight * row.targetCorrect,
      0,
    ) / analysisWeightSum
  const squaredWeightSum = weightedRows.reduce(
    (total, { analysisWeight }) =>
      total + analysisWeight * analysisWeight,
    0,
  )
  const effectiveSampleSize =
    (analysisWeightSum * analysisWeightSum) / squaredWeightSum
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'stratified_hajek',
    availability: 'available',
    blockers: Object.freeze([]),
    samplingPlanId: campaign.samplingPlan.planId,
    samplingDesign: campaign.samplingPlan.design,
    sampledItemCount: items.length,
    decisiveSampleCount: weightedRows.length,
    correctCount,
    errorCount: weightedRows.length - correctCount,
    estimate,
    effectiveSampleSize,
    representedStrata: Object.freeze(representedStrata),
    missingStrata: Object.freeze([]),
    strata: Object.freeze(strata),
  })
}

export function bootstrapGroupedTargetPrecision(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  consensus: readonly VerificationConsensus[],
  config: GroupedBootstrapConfig = {},
): GroupedBootstrapTargetPrecisionInterval {
  const confidenceLevel = config.confidenceLevel ?? 0.95
  const replicates = config.replicates ?? 2_000
  const seed = (config.seed ?? campaign.samplingPlan.selectionSeed ?? '').trim()
  const prepared = preparePrecisionRows(campaign, items, consensus)
  const blockers = [...prepared.blockers]
  if (
    campaign.samplingPlan.design !== 'simple_random' &&
    campaign.samplingPlan.design !== 'stratified_random' &&
    campaign.samplingPlan.design !== 'clustered_random'
  ) {
    blockers.push('sampling_design_not_bootstrap_eligible')
  }
  if (!validConfidenceLevel(confidenceLevel)) {
    blockers.push('confidence_level_invalid')
  }
  if (!Number.isInteger(replicates) || replicates < 100) {
    blockers.push('bootstrap_replicates_invalid')
  }
  if (seed === '') {
    blockers.push('bootstrap_seed_missing')
  }
  const weighted = bootstrapAnalysisRows(campaign, prepared.rows)
  blockers.push(...weighted.blockers)
  if (weighted.rows.length === 0) {
    blockers.push('decisive_sample_empty')
  }
  const grouped = bootstrapGroups(campaign, weighted.rows)
  blockers.push(...grouped.blockers)
  if (grouped.groups.length < 2) {
    blockers.push('bootstrap_groups_insufficient')
  }
  const groupingKeys = effectiveGroupingKeys(campaign)
  const canonicalBlockers = [...new Set(blockers)].sort()
  if (canonicalBlockers.length > 0) {
    return unavailableBootstrapInterval(
      campaign,
      confidenceLevel,
      replicates,
      seed,
      weighted.rows.length,
      grouped.groups.length,
      groupingKeys,
      canonicalBlockers,
    )
  }
  const pointEstimate = weightedMean(weighted.rows)
  const random = mulberry32(seedToUint32(seed))
  const estimates: number[] = []
  const groupsByStratum =
    campaign.samplingPlan.design === 'simple_random'
      ? new Map([['__all__', grouped.groups]])
      : groupByStratum(grouped.groups)
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const sampledRows: WeightedPrecisionRow[] = []
    for (const groups of groupsByStratum.values()) {
      for (let draw = 0; draw < groups.length; draw += 1) {
        const selected = groups[Math.floor(random() * groups.length)]!
        sampledRows.push(...selected.rows)
      }
    }
    estimates.push(weightedMean(sampledRows))
  }
  estimates.sort((left, right) => left - right)
  const alpha = 1 - confidenceLevel
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'grouped_percentile_bootstrap',
    availability: 'available',
    blockers: Object.freeze([]),
    samplingPlanId: campaign.samplingPlan.planId,
    samplingDesign: campaign.samplingPlan.design,
    confidenceLevel,
    bootstrapReplicates: replicates,
    bootstrapSeed: seed,
    decisiveSampleCount: weighted.rows.length,
    resamplingGroupCount: grouped.groups.length,
    groupingKeys: Object.freeze(groupingKeys),
    pointEstimate,
    interval: Object.freeze({
      lower: quantile(estimates, alpha / 2),
      upper: quantile(estimates, 1 - alpha / 2),
    }),
  })
}

function preparePrecisionRows(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  consensus: readonly VerificationConsensus[],
): {
  readonly rows: readonly PrecisionRow[]
  readonly blockers: readonly string[]
} {
  const blockers: string[] = []
  if (campaign.samplingPlan.purpose !== 'quality_estimation') {
    blockers.push('sampling_purpose_not_quality_estimation')
  }
  if (!campaign.samplingPlan.qualityEstimationAllowed) {
    blockers.push('quality_estimation_not_allowed')
  }
  if (!campaign.samplingPlan.representative) {
    blockers.push('sampling_plan_not_representative')
  }
  if (
    !campaign.samplingPlan.blindReview ||
    campaign.disclosurePolicy.mode !== 'blind'
  ) {
    blockers.push('review_not_blind')
  }
  const itemById = new Map<string, VerificationItem>()
  for (const item of items) {
    if (
      item.campaignId !== campaign.campaignId ||
      itemById.has(item.itemId)
    ) {
      blockers.push('item_manifest_invalid')
    }
    itemById.set(item.itemId, item)
  }
  const consensusById = new Map<string, VerificationConsensus>()
  for (const projection of consensus) {
    if (
      projection.campaignId !== campaign.campaignId ||
      !itemById.has(projection.itemId) ||
      consensusById.has(projection.itemId)
    ) {
      blockers.push('consensus_manifest_invalid')
    }
    consensusById.set(projection.itemId, projection)
  }
  if (
    consensusById.size !== itemById.size ||
    [...itemById.keys()].some((itemId) => !consensusById.has(itemId))
  ) {
    blockers.push('consensus_incomplete')
  }
  const rows: PrecisionRow[] = []
  for (const item of items) {
    const projection = consensusById.get(item.itemId)
    if (
      projection === undefined ||
      (projection.status !== 'complete_agreement' &&
        projection.status !== 'adjudicated')
    ) {
      continue
    }
    if (
      projection.consensusOutcome === null ||
      projection.finalTestEligibility !== 'eligible'
    ) {
      blockers.push('decisive_item_ineligible')
      continue
    }
    rows.push(
      Object.freeze({
        item,
        consensus: projection,
        targetCorrect: projection.consensusOutcome === 'yes' ? 1 : 0,
      }),
    )
  }
  return Object.freeze({
    rows: Object.freeze(rows),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  })
}

function unavailableSimpleRandomEstimate(
  campaign: VerificationCampaign,
  sampledItemCount: number,
  confidenceLevel: number,
  decisiveSampleCount: number,
  correctCount: number,
  blockers: readonly string[],
): SimpleRandomTargetPrecisionEstimate {
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'simple_random_wilson',
    availability: 'unavailable',
    blockers: Object.freeze([...blockers]),
    samplingPlanId: campaign.samplingPlan.planId,
    confidenceLevel,
    sampledItemCount,
    decisiveSampleCount,
    correctCount,
    errorCount: decisiveSampleCount - correctCount,
    estimate: null,
    interval: null,
  })
}

function unavailableWeightedEstimate(
  campaign: VerificationCampaign,
  sampledItemCount: number,
  decisiveSampleCount: number,
  correctCount: number,
  representedStrata: readonly string[],
  missingStrata: readonly string[],
  strata: readonly WeightedPrecisionStratumEstimate[],
  blockers: readonly string[],
): WeightedTargetPrecisionEstimate {
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'stratified_hajek',
    availability: 'unavailable',
    blockers: Object.freeze([...blockers]),
    samplingPlanId: campaign.samplingPlan.planId,
    samplingDesign: campaign.samplingPlan.design,
    sampledItemCount,
    decisiveSampleCount,
    correctCount,
    errorCount: decisiveSampleCount - correctCount,
    estimate: null,
    effectiveSampleSize: null,
    representedStrata: Object.freeze([...representedStrata]),
    missingStrata: Object.freeze([...missingStrata]),
    strata: Object.freeze([...strata]),
  })
}

function unavailableBootstrapInterval(
  campaign: VerificationCampaign,
  confidenceLevel: number,
  replicates: number,
  seed: string,
  decisiveSampleCount: number,
  resamplingGroupCount: number,
  groupingKeys: readonly string[],
  blockers: readonly string[],
): GroupedBootstrapTargetPrecisionInterval {
  return Object.freeze({
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'grouped_percentile_bootstrap',
    availability: 'unavailable',
    blockers: Object.freeze([...blockers]),
    samplingPlanId: campaign.samplingPlan.planId,
    samplingDesign: campaign.samplingPlan.design,
    confidenceLevel,
    bootstrapReplicates: replicates,
    bootstrapSeed: seed,
    decisiveSampleCount,
    resamplingGroupCount,
    groupingKeys: Object.freeze([...groupingKeys]),
    pointEstimate: null,
    interval: null,
  })
}

function bootstrapAnalysisRows(
  campaign: VerificationCampaign,
  rows: readonly PrecisionRow[],
): {
  readonly rows: readonly WeightedPrecisionRow[]
  readonly blockers: readonly string[]
} {
  if (campaign.samplingPlan.design === 'simple_random') {
    const probabilities = rows
      .map(({ item }) => item.inclusionProbability)
      .filter((value): value is number => value !== null)
    const blockers: string[] = []
    if (
      campaign.samplingPlan.inclusionProbabilityRequired &&
      probabilities.length !== rows.length
    ) {
      blockers.push('inclusion_probability_missing')
    }
    if (
      probabilities.length > 1 &&
      probabilities.some(
        (probability) =>
          Math.abs(probability - probabilities[0]!) >
          Number.EPSILON * 16,
      )
    ) {
      blockers.push('inclusion_probability_unequal')
    }
    return Object.freeze({
      rows: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            ...row,
            samplingWeight: 1,
            analysisWeight: 1,
          }),
        ),
      ),
      blockers: Object.freeze(blockers.sort()),
    })
  }
  const blockers: string[] = []
  const stratumIds = campaign.samplingPlan.strata.map(
    ({ stratumId }) => stratumId,
  )
  if (
    stratumIds.length === 0 ||
    new Set(stratumIds).size !== stratumIds.length
  ) {
    blockers.push('sampling_strata_invalid')
  }
  const represented = new Set(
    rows.map(({ item }) => item.samplingStratumId),
  )
  if (stratumIds.some((stratumId) => !represented.has(stratumId))) {
    blockers.push('sampling_strata_missing')
  }
  const declaredWeights = populationWeights(campaign)
  const output: WeightedPrecisionRow[] = []
  for (const stratumId of stratumIds) {
    const stratumRows = rows.filter(
      ({ item }) => item.samplingStratumId === stratumId,
    )
    const base = stratumRows.map((row) => {
      const probability = row.item.inclusionProbability
      if (probability === null) {
        if (campaign.samplingPlan.inclusionProbabilityRequired) {
          blockers.push('inclusion_probability_missing')
        }
        return Object.freeze({ ...row, samplingWeight: 1 })
      }
      return Object.freeze({ ...row, samplingWeight: 1 / probability })
    })
    const baseWeightSum = base.reduce(
      (total, { samplingWeight }) => total + samplingWeight,
      0,
    )
    const declaredWeight = declaredWeights.get(stratumId)
    output.push(
      ...base.map((row) =>
        Object.freeze({
          ...row,
          analysisWeight:
            declaredWeight === undefined
              ? row.samplingWeight
              : (declaredWeight * row.samplingWeight) / baseWeightSum,
        }),
      ),
    )
  }
  return Object.freeze({
    rows: Object.freeze(output),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  })
}

function bootstrapGroups(
  campaign: VerificationCampaign,
  rows: readonly WeightedPrecisionRow[],
): {
  readonly groups: readonly BootstrapGroup[]
  readonly blockers: readonly string[]
} {
  const parent = rows.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) {
      root = parent[root]!
    }
    while (parent[index] !== index) {
      const next = parent[index]!
      parent[index] = root
      index = next
    }
    return root
  }
  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot
    }
  }
  const indicesByKey = new Map<string, number[]>()
  rows.forEach((row, index) => {
    for (const key of groupingValues(campaign, row.item)) {
      const indices = indicesByKey.get(key) ?? []
      indices.push(index)
      indicesByKey.set(key, indices)
    }
  })
  for (const indices of indicesByKey.values()) {
    const [first, ...rest] = indices
    if (first !== undefined) {
      for (const index of rest) {
        union(first, index)
      }
    }
  }
  const rowsByRoot = new Map<number, WeightedPrecisionRow[]>()
  rows.forEach((row, index) => {
    const root = find(index)
    const groupedRows = rowsByRoot.get(root) ?? []
    groupedRows.push(row)
    rowsByRoot.set(root, groupedRows)
  })
  const blockers: string[] = []
  const groups = [...rowsByRoot.values()]
    .map((groupRows) => {
      const strata = [
        ...new Set(groupRows.map(({ item }) => item.samplingStratumId)),
      ]
      if (strata.length !== 1) {
        blockers.push('bootstrap_group_crosses_strata')
      }
      const itemIds = groupRows.map(({ item }) => item.itemId).sort()
      return Object.freeze({
        groupId: itemIds.join('|'),
        stratumId: strata[0] ?? '',
        rows: Object.freeze(
          [...groupRows].sort((left, right) =>
            left.item.itemId.localeCompare(right.item.itemId),
          ),
        ),
      })
    })
    .sort((left, right) => left.groupId.localeCompare(right.groupId))
  return Object.freeze({
    groups: Object.freeze(groups),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  })
}

function groupingValues(
  campaign: VerificationCampaign,
  item: VerificationItem,
): readonly string[] {
  const values = new Set<string>()
  const add = (key: string, value: string | null | undefined) => {
    if (value !== null && value !== undefined && value.trim() !== '') {
      values.add(`${key}:${value}`)
    }
  }
  switch (campaign.samplingPlan.independentUnit) {
    case 'media':
      add('media', item.itemId)
      break
    case 'observation_group':
      add('observation_group', item.observationGroupId)
      break
    case 'duplicate_group':
      add('duplicate_group', item.duplicateGroupId)
      break
    case 'owner_group':
      add('owner_group', item.ownerPhotographerGroupId)
      break
    case 'configured_cluster':
      break
  }
  for (const key of campaign.samplingPlan.groupingKeys) {
    switch (key) {
      case 'duplicate_group':
        add(key, item.duplicateGroupId)
        break
      case 'observation_group':
        add(key, item.observationGroupId)
        break
      case 'owner_group':
        add(key, item.ownerPhotographerGroupId)
        break
      case 'geographic_cluster':
        add(
          key,
          item.flickrSource?.geographicClusterId ??
            item.sourceProvenance?.geography.geographicClusterId,
        )
        break
    }
  }
  if (values.size === 0) {
    add('media', item.itemId)
  }
  return Object.freeze([...values].sort())
}

function effectiveGroupingKeys(
  campaign: VerificationCampaign,
): readonly string[] {
  return Object.freeze(
    [
      `independent_unit:${campaign.samplingPlan.independentUnit}`,
      ...campaign.samplingPlan.groupingKeys.map((key) => `grouping_key:${key}`),
    ].sort(),
  )
}

function groupByStratum(
  groups: readonly BootstrapGroup[],
): ReadonlyMap<string, readonly BootstrapGroup[]> {
  const output = new Map<string, BootstrapGroup[]>()
  for (const group of groups) {
    const current = output.get(group.stratumId) ?? []
    current.push(group)
    output.set(group.stratumId, current)
  }
  return output
}

function weightedMean(rows: readonly WeightedPrecisionRow[]): number {
  const denominator = rows.reduce(
    (total, { analysisWeight }) => total + analysisWeight,
    0,
  )
  if (!(denominator > 0)) {
    throw new Error('Weighted mean requires a positive weight sum.')
  }
  return (
    rows.reduce(
      (total, { analysisWeight, targetCorrect }) =>
        total + analysisWeight * targetCorrect,
      0,
    ) / denominator
  )
}

function quantile(sorted: readonly number[], probability: number): number {
  if (
    sorted.length === 0 ||
    probability < 0 ||
    probability > 1
  ) {
    throw new Error('Bootstrap quantile inputs are invalid.')
  }
  const index = (sorted.length - 1) * probability
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!
  return lower + (upper - lower) * (index - lowerIndex)
}

function seedToUint32(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function populationWeights(
  campaign: VerificationCampaign,
): ReadonlyMap<string, number> {
  const strata = campaign.samplingPlan.strata
  if (
    strata.length > 0 &&
    strata.every(
      ({ populationWeight }) =>
        populationWeight !== null &&
        Number.isFinite(populationWeight) &&
        populationWeight > 0,
    )
  ) {
    const total = strata.reduce(
      (sum, { populationWeight }) => sum + populationWeight!,
      0,
    )
    return new Map(
      strata.map(({ stratumId, populationWeight }) => [
        stratumId,
        populationWeight! / total,
      ]),
    )
  }
  if (
    strata.length > 0 &&
    strata.every(
      ({ populationCount }) =>
        populationCount !== null &&
        Number.isInteger(populationCount) &&
        populationCount > 0,
    )
  ) {
    const total = strata.reduce(
      (sum, { populationCount }) => sum + populationCount!,
      0,
    )
    return new Map(
      strata.map(({ stratumId, populationCount }) => [
        stratumId,
        populationCount! / total,
      ]),
    )
  }
  return new Map()
}

function validConfidenceLevel(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 1
}

function inverseStandardNormal(probability: number): number {
  if (!(probability > 0 && probability < 1)) {
    throw new Error('Normal quantile probability must be between zero and one.')
  }
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ] as const
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ] as const
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ] as const
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ] as const
  const lowerTail = 0.02425
  const upperTail = 1 - lowerTail
  if (probability < lowerTail) {
    const q = Math.sqrt(-2 * Math.log(probability))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (probability > upperTail) {
    const q = Math.sqrt(-2 * Math.log(1 - probability))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  const q = probability - 0.5
  const r = q * q
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r +
      a[5]) *
    q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}
