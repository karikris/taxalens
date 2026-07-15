import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'

export type ReviewPriorityFactorStatus =
  | 'attention'
  | 'aggregate-only'
  | 'verified-zero'
  | 'unavailable'

export interface ReviewPriorityFactor {
  readonly id:
    | 'competitor-margin'
    | 'missing-calibration'
    | 'reference-shortfall'
    | 'visual-disagreement'
    | 'small-subject'
    | 'comment-conflict'
    | 'geographic-anomaly'
  readonly label: string
  readonly status: ReviewPriorityFactorStatus
  readonly statusLabel: string
  readonly value: string
  readonly detail: string
  readonly sourceFields: readonly string[]
  readonly priorityEffect: 'not-scored'
}

export interface ReviewPriorityModel {
  readonly item: {
    readonly position: 1
    readonly positionLabel: '1 of 1'
    readonly positionBasis: 'Single committed awaiting-review record; not score-derived.'
    readonly recordId: string
    readonly displayLabel: string
    readonly state: 'awaiting_human_review'
    readonly priorityScore: null
    readonly priorityLabel: 'Unavailable — no materialized review queue'
    readonly blockedGateCount: number
    readonly gateCount: number
    readonly allowedTransition: string
    readonly reason: string
  }
  readonly factors: readonly ReviewPriorityFactor[]
  readonly queueMaterialized: false
  readonly comparativeRankingAvailable: false
  readonly scientificClaimAllowed: false
  readonly provenance: readonly ReplayArtifactEvidence[]
}

export function buildReviewPriorityModel(replay: ReplayEvidence): ReviewPriorityModel {
  const decision = replay.selectiveDecision
  const counts = replay.observatory
  if (
    replay.heroRecordId !== decision.recordId ||
    replay.heroState !== 'awaiting_human_review' ||
    decision.state !== 'awaiting_human_review' ||
    decision.decisionStatus !== 'unavailable' ||
    decision.candidateVisualScoreCount !== 0 ||
    counts.candidateVisualScoreCount !== 0 ||
    counts.calibratedDecisionCount !== 0 ||
    counts.yoloeImageCount !== 0 ||
    counts.fullFrameTransformationCount !== 0 ||
    counts.humanCommentCount !== 0 ||
    decision.gates.length === 0 ||
    decision.gates.some(({ satisfied }) => satisfied) ||
    replay.scientificClaimAllowed
  ) {
    throw new Error('Review prioritization requires the verified unscored review boundary')
  }

  const factors = Object.freeze([
    factor({
      id: 'competitor-margin',
      label: 'Competitor margin',
      status: 'unavailable',
      statusLabel: 'Unavailable',
      value: 'No target–competitor margin',
      detail:
        'The five competitor records are planning hypotheses. No target or competitor visual score exists to form a comparable margin.',
      sourceFields: ['candidate_visual_scores', 'target_competitor_margin'],
    }),
    factor({
      id: 'missing-calibration',
      label: 'Missing calibration',
      status: 'attention',
      statusLabel: 'Evidence blocker',
      value: `${counts.calibratedDecisionCount} calibrated decisions · ${decision.gates.length} of ${decision.gates.length} gates blocked`,
      detail:
        'Calibration and decision-policy evidence are absent. This explains review attention but supplies no numeric priority contribution.',
      sourceFields: ['decision', 'gates', 'calibration_version', 'decision_policy_fingerprint'],
    }),
    factor({
      id: 'reference-shortfall',
      label: 'Reference shortfall',
      status: 'aggregate-only',
      statusLabel: 'Aggregate only',
      value: `${replay.geographyReference.reference.sourceCandidateShortfall} source · ${replay.geographyReference.reference.humanVerifiedShortfall} human-review`,
      detail:
        'Verified shortfalls span the reference plan and are not joined to this review record, so they do not change its item priority.',
      sourceFields: ['source_candidate_shortfall', 'human_verified_shortfall'],
    }),
    factor({
      id: 'visual-disagreement',
      label: 'Visual disagreement',
      status: 'unavailable',
      statusLabel: 'Unavailable',
      value: 'No full-frame visual comparison',
      detail:
        'No image, transformation, or scored visual-input evidence is committed for this record.',
      sourceFields: ['visual_input_disagreement', 'visual_input_evidence'],
    }),
    factor({
      id: 'small-subject',
      label: 'Small subject',
      status: 'unavailable',
      statusLabel: 'Unavailable',
      value: 'No subject-size measurement',
      detail:
        'No admitted image or detector output exists, so subject area and small-subject quality flags cannot be evaluated.',
      sourceFields: ['subject_area_ratio', 'quality_flags.small_subject'],
    }),
    factor({
      id: 'comment-conflict',
      label: 'Comment conflict',
      status: 'verified-zero',
      statusLabel: 'No signal',
      value: `${counts.humanCommentCount} committed comments`,
      detail:
        'With zero comments there is no evidenced comment conflict, promotion, or reviewer disagreement.',
      sourceFields: ['expected_ui_counts.section_records.comments'],
    }),
    factor({
      id: 'geographic-anomaly',
      label: 'Geographic anomaly',
      status: 'unavailable',
      statusLabel: 'Unlinked',
      value: 'No review-record geography join',
      detail:
        'The workload artifacts contain aggregate outliers, but this decision-mechanics record has no media identity that can be joined to an assignment row.',
      sourceFields: ['media_id', 'geo_cluster_id', 'outlier'],
    }),
  ])

  return Object.freeze({
    item: Object.freeze({
      position: 1 as const,
      positionLabel: '1 of 1' as const,
      positionBasis: 'Single committed awaiting-review record; not score-derived.' as const,
      recordId: decision.recordId,
      displayLabel: decision.displayLabel,
      state: decision.state,
      priorityScore: null,
      priorityLabel: 'Unavailable — no materialized review queue' as const,
      blockedGateCount: decision.gates.length,
      gateCount: decision.gates.length,
      allowedTransition: decision.allowedTransition,
      reason: decision.unavailableReason,
    }),
    factors,
    queueMaterialized: false as const,
    comparativeRankingAvailable: false as const,
    scientificClaimAllowed: false as const,
    provenance: Object.freeze([
      requiredArtifact(replay, 'selective_decision_metadata'),
      requiredArtifact(replay, 'run_summary'),
      requiredArtifact(replay, 'reference_shortfalls'),
    ]),
  })
}

function factor(
  input: Omit<ReviewPriorityFactor, 'priorityEffect' | 'sourceFields'> & {
    readonly sourceFields: readonly string[]
  },
): ReviewPriorityFactor {
  return Object.freeze({
    ...input,
    sourceFields: Object.freeze(input.sourceFields),
    priorityEffect: 'not-scored' as const,
  })
}

function requiredArtifact(
  replay: ReplayEvidence,
  role: ReplayArtifactEvidence['role'],
): ReplayArtifactEvidence {
  const artifact = replay.artifactInventory.find((candidate) => candidate.role === role)
  if (artifact === undefined || !artifact.verified) {
    throw new Error(`Review prioritization is missing verified ${role} provenance`)
  }
  return artifact
}
