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

interface PrecisionRow {
  readonly item: VerificationItem
  readonly consensus: VerificationConsensus
  readonly targetCorrect: 0 | 1
}

interface WeightedPrecisionRow extends PrecisionRow {
  readonly samplingWeight: number
  readonly analysisWeight: number
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
    decisiveSampleCount: 0,
    correctCount: 0,
    errorCount: 0,
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
