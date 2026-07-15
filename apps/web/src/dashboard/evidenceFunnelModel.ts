import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'

export type EvidenceFunnelStatus = 'verified' | 'partial' | 'unavailable' | 'review'

export interface EvidenceFunnelStage {
  readonly id:
    | 'query-hits'
    | 'canonical-photos'
    | 'unique-content'
    | 'routes'
    | 'candidate-states'
    | 'decision-states'
    | 'review-queue'
  readonly sequence: number
  readonly label: string
  readonly value: number | null
  readonly unit: string
  readonly status: EvidenceFunnelStatus
  readonly detail: string
  readonly measurementBasis: string
  readonly artifacts: readonly ReplayArtifactEvidence[]
  readonly scientificClaimAllowed: false
  readonly transitionToNext: string | null
}

export interface EvidenceFunnelModel {
  readonly stages: readonly EvidenceFunnelStage[]
  readonly comparisonPolicy: 'unlike_units_no_stage_conversion_rates'
  readonly reviewQueueMaterialized: false
  readonly scientificClaimAllowed: false
}

interface StageInput extends Omit<EvidenceFunnelStage, 'artifacts' | 'scientificClaimAllowed'> {
  readonly artifactIds: readonly string[]
}

export function buildEvidenceFunnel(replay: ReplayEvidence): EvidenceFunnelModel {
  if (
    replay.scientificClaimAllowed ||
    replay.heroState !== 'awaiting_human_review' ||
    replay.observatory.yoloeImageCount !== 0 ||
    replay.observatory.calibratedDecisionCount !== 0 ||
    replay.observatory.finalEvidenceCount !== 0
  ) {
    throw new Error('Evidence funnel requires the verified awaiting-review pilot boundary')
  }

  const counts = replay.observatory
  const candidateStateCount = 1 + counts.regionalCandidateCount
  const inputs: readonly StageInput[] = [
    {
      id: 'query-hits',
      sequence: 1,
      label: 'Query hits',
      value: counts.flickrQueryHitCount,
      unit: 'query associations',
      status: 'verified',
      detail: 'Many-to-many Flickr search matches; duplicates may be present and no hit is a label.',
      measurementBasis: 'stage_metrics.flickr-query-hits.value',
      artifactIds: ['stage-metrics', 'flickr-candidate-summaries'],
      transitionToNext:
        'Unit changes from query associations to canonical source records; no retention rate is computed.',
    },
    {
      id: 'canonical-photos',
      sequence: 2,
      label: 'Canonical photos',
      value: counts.canonicalPhotoCount,
      unit: 'canonical source records',
      status: 'verified',
      detail: 'Canonical source identities after query-association fan-in; not scientific observations.',
      measurementBasis: 'stage_metrics.canonical-flickr-photos.value',
      artifactIds: ['stage-metrics', 'flickr-candidate-summaries'],
      transitionToNext:
        'Content-group membership is unavailable, so no canonical-to-unique reduction is asserted.',
    },
    {
      id: 'unique-content',
      sequence: 3,
      label: 'Unique content',
      value: null,
      unit: 'content groups',
      status: 'unavailable',
      detail:
        'Unavailable — canonical source hashes identify payloads, but duplicate relationship rows are not committed.',
      measurementBasis: 'duplicate_summaries.data.duplicate_relationship_rows_available=false',
      artifactIds: ['duplicate-summaries'],
      transitionToNext:
        'Unique-content groups are unavailable and routes use processed images; no conversion is computed.',
    },
    {
      id: 'routes',
      sequence: 4,
      label: 'Route counts',
      value: counts.yoloeImageCount,
      unit: 'YOLOE-processed images',
      status: 'unavailable',
      detail: 'Verified zero at this metadata stage; no route output artifact exists.',
      measurementBasis: 'run_summary.detection_data.record_count',
      artifactIds: ['run-summary'],
      transitionToNext:
        'Route outputs and scoreable taxon identities have different denominators; no conversion is computed.',
    },
    {
      id: 'candidate-states',
      sequence: 5,
      label: 'Candidate states',
      value: candidateStateCount,
      unit: 'scoreable taxon identities',
      status: 'partial',
      detail: `One target plus ${counts.regionalCandidateCount} regional competitor hypotheses; none has a visual score.`,
      measurementBasis:
        'query_definitions target identity + candidate_sets regional candidate records',
      artifactIds: ['query-definitions', 'candidate-sets'],
      transitionToNext:
        'Candidate identities and produced decisions are different units; no conversion is computed.',
    },
    {
      id: 'decision-states',
      sequence: 6,
      label: 'Decision states',
      value: counts.calibratedDecisionCount,
      unit: 'calibrated decision outputs',
      status: 'unavailable',
      detail: 'Verified zero; candidate scores and the selective-decision payload are unavailable.',
      measurementBasis: 'selective_decision_metadata.decision=null',
      artifactIds: ['selective-decision-metadata', 'run-summary'],
      transitionToNext:
        'A pending replay record is not a calibrated decision or a queue conversion.',
    },
    {
      id: 'review-queue',
      sequence: 7,
      label: 'Review queue state',
      value: 1,
      unit: 'awaiting-review replay records',
      status: 'review',
      detail:
        'The hero record awaits review, but no materialized or ranked review-queue artifact is committed.',
      measurementBasis: 'run_summary.hero_state=awaiting_human_review',
      artifactIds: ['run-summary', 'selective-decision-metadata'],
      transitionToNext: null,
    },
  ]

  const inventory = new Map(replay.artifactInventory.map((artifact) => [artifact.artifactId, artifact]))
  const stages = inputs.map(({ artifactIds, ...stage }) => {
    const artifacts = artifactIds.map((artifactId) => {
      const artifact = inventory.get(artifactId)
      if (artifact === undefined) {
        throw new Error(`Evidence funnel references missing artifact ${artifactId}`)
      }
      return artifact
    })
    return {
      ...stage,
      artifacts,
      scientificClaimAllowed: false as const,
    }
  })

  return deepFreeze({
    stages,
    comparisonPolicy: 'unlike_units_no_stage_conversion_rates' as const,
    reviewQueueMaterialized: false as const,
    scientificClaimAllowed: false as const,
  })
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}
