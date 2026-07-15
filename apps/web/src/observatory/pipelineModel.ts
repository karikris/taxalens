import type { EvidenceSectionState, ReplayEvidence } from '../data/evidenceFacade'

export type PipelineStageStatus = 'verified' | 'partial' | 'unavailable' | 'review'

export interface PipelineStageModel {
  readonly sequence: number
  readonly stageId: string
  readonly label: string
  readonly count: number
  readonly unit: string
  readonly status: PipelineStageStatus
  readonly detail: string
  readonly sourceSections: readonly EvidenceSectionState['name'][]
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

export function buildPipelineStages(replay: ReplayEvidence): readonly PipelineStageModel[] {
  const counts = replay.observatory
  const sections = replay.sections

  return deepFreeze([
    {
      sequence: 1,
      stageId: 'trusted-registry',
      label: 'Trusted Registry',
      count: counts.registryTaxonCount,
      unit: 'registry-linked taxa',
      status: 'verified',
      detail: `Identities are pinned to ${replay.mission.sourceRegistry.version}.`,
      sourceSections: ['query_definitions'],
    },
    {
      sequence: 2,
      stageId: 'query-compilation',
      label: 'Query Compilation',
      count: counts.physicalQueryCount,
      unit: 'registry-linked species plans',
      status: 'verified',
      detail: 'Every registry-linked query definition is committed and checksum verified.',
      sourceSections: ['query_definitions'],
    },
    {
      sequence: 3,
      stageId: 'flickr-metadata',
      label: 'Flickr Metadata',
      count: counts.flickrQueryHitCount,
      unit: 'query hits',
      status: 'verified',
      detail: 'Discovery metadata only; query matches are hypotheses, not image labels.',
      sourceSections: ['flickr_candidate_summaries'],
    },
    {
      sequence: 4,
      stageId: 'deduplication',
      label: 'Deduplication',
      count: counts.canonicalPhotoCount,
      unit: 'canonical photos',
      status: 'partial',
      detail:
        sections.duplicate_summaries.reason ??
        'The committed summary is available without duplicate relationship rows.',
      sourceSections: ['flickr_candidate_summaries', 'duplicate_summaries'],
    },
    {
      sequence: 5,
      stageId: 'geography',
      label: 'Geography',
      count: counts.locatedClusterCount,
      unit: 'located clusters',
      status: 'partial',
      detail: 'Clusters are soft geographic evidence, not confirmed occurrence records.',
      sourceSections: ['geographic_clusters', 'logical_associations'],
    },
    {
      sequence: 6,
      stageId: 'regional-candidates',
      label: 'Regional Candidates',
      count: counts.regionalCandidateCount,
      unit: 'candidate hypotheses',
      status: 'partial',
      detail: 'All eligible regional candidates remain scoreable; none is a verified label.',
      sourceSections: ['candidate_sets'],
    },
    {
      sequence: 7,
      stageId: 'reference-readiness',
      label: 'Reference Readiness',
      count: counts.eligibleReferenceCandidateCount,
      unit: 'eligible source candidates',
      status: 'partial',
      detail: 'Human-verified source support remains at zero and the shortfall gates stay open.',
      sourceSections: ['reference_readiness', 'reference_shortfalls'],
    },
    {
      sequence: 8,
      stageId: 'yoloe-routing',
      label: 'YOLOE Routing',
      count: counts.yoloeImageCount,
      unit: 'images processed',
      status: 'unavailable',
      detail: sections.yoloe_evidence.reason ?? 'No YOLOE evidence is committed.',
      sourceSections: ['yoloe_evidence'],
    },
    {
      sequence: 9,
      stageId: 'full-frame-bioclip',
      label: 'Full-Frame BioCLIP',
      count: counts.fullFrameTransformationCount,
      unit: 'transformations',
      status: 'unavailable',
      detail:
        sections.full_frame_visual_input_metadata.reason ??
        'No full-frame visual input metadata is committed.',
      sourceSections: ['full_frame_visual_input_metadata'],
    },
    {
      sequence: 10,
      stageId: 'target-competitor-scoring',
      label: 'Target and Competitor Scoring',
      count: counts.candidateVisualScoreCount,
      unit: 'candidate visual scores',
      status: 'unavailable',
      detail:
        sections.target_aware_score_metadata.reason ??
        'No target-aware score metadata is committed.',
      sourceSections: ['target_aware_score_metadata'],
    },
    {
      sequence: 11,
      stageId: 'calibration-abstention',
      label: 'Calibration and Abstention',
      count: counts.calibratedDecisionCount,
      unit: 'decision outputs',
      status: 'unavailable',
      detail:
        sections.evaluation_summaries.reason ??
        'No calibrated decision evidence is committed.',
      sourceSections: ['evaluation_summaries', 'selective_decision_metadata'],
    },
    {
      sequence: 12,
      stageId: 'comments',
      label: 'Comments',
      count: counts.humanCommentCount,
      unit: 'human comments',
      status: 'unavailable',
      detail: sections.comments.reason ?? 'No human review comment artifact is committed.',
      sourceSections: ['comments'],
    },
    {
      sequence: 13,
      stageId: 'final-evidence',
      label: 'Final Evidence',
      count: counts.finalEvidenceCount,
      unit: 'scientific evidence records',
      status: 'review',
      detail: 'The hero awaits human review and no scientific claim is allowed.',
      sourceSections: ['selective_decision_metadata'],
    },
  ] satisfies PipelineStageModel[])
}
