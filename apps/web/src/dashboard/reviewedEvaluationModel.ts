import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'

export interface EvaluationMetricState {
  readonly id:
    | 'phase-13-results'
    | 'precision'
    | 'recall'
    | 'pr-auc'
    | 'accuracy'
    | 'calibration'
    | 'coverage'
  readonly phase: 'Phase 13' | 'Phase 14'
  readonly label: string
  readonly status: 'unavailable'
  readonly value: 'Unavailable'
  readonly denominator: string
  readonly missingEvidence: string
}

export interface ReviewedEvaluationModel {
  readonly committedReviewedMetricCount: 0
  readonly phase13: {
    readonly status: 'unavailable'
    readonly resultArtifactCount: 0
    readonly reviewedMetricCount: 0
    readonly reason: string
    readonly sourceSection: 'evaluation_summaries'
  }
  readonly phase14: {
    readonly status: 'blocked'
    readonly humanVerifiedSourceMediaCount: 0
    readonly humanVerifiedShortfall: number
    readonly groupsAwaitingHumanReview: number
    readonly unresolvedGroupCount: number
    readonly candidateVisualScoreCount: 0
    readonly calibratedDecisionCount: 0
    readonly reviewState: 'awaiting_human_review'
  }
  readonly metrics: readonly EvaluationMetricState[]
  readonly provenance: readonly ReplayArtifactEvidence[]
  readonly scientificClaimAllowed: false
}

export function buildReviewedEvaluationModel(replay: ReplayEvidence): ReviewedEvaluationModel {
  const evaluation = replay.sections.evaluation_summaries
  const reference = replay.geographyReference.reference
  const counts = replay.observatory

  if (
    evaluation.status !== 'unavailable' ||
    evaluation.artifactIds.length !== 0 ||
    evaluation.reason === null ||
    evaluation.scientificClaimAllowed ||
    reference.humanVerifiedSourceMediaCount !== 0 ||
    reference.humanVerifiedShortfall < 1 ||
    reference.groupsAwaitingHumanReview < 1 ||
    reference.unresolvedGroupCount < 1 ||
    counts.candidateVisualScoreCount !== 0 ||
    counts.calibratedDecisionCount !== 0 ||
    replay.heroState !== 'awaiting_human_review' ||
    replay.selectiveDecision.decisionStatus !== 'unavailable' ||
    replay.scientificClaimAllowed
  ) {
    throw new Error('Reviewed evaluation requires the verified blocked scientific boundary')
  }

  const metrics = Object.freeze([
    unavailableMetric(
      'phase-13-results',
      'Phase 13',
      'Committed reviewed result set',
      'A committed Phase 13 evaluation artifact with reviewed labels and exact metric denominators',
      evaluation.reason,
    ),
    unavailableMetric(
      'precision',
      'Phase 14',
      'Precision',
      'TP / (TP + FP), from reviewed predictions and labels',
      'No reviewed true-positive or false-positive outcomes are committed.',
    ),
    unavailableMetric(
      'recall',
      'Phase 14',
      'Recall',
      'TP / (TP + FN), from a frozen reviewed evaluation partition',
      'No reviewed positive-reference denominator or false-negative outcomes are committed.',
    ),
    unavailableMetric(
      'pr-auc',
      'Phase 14',
      'PR-AUC',
      'Reviewed labels and scores across a frozen evaluation partition',
      'No reviewed score-label pairs or completed threshold sweep are committed.',
    ),
    unavailableMetric(
      'accuracy',
      'Phase 14',
      'Accuracy',
      '(TP + TN) / N, from all reviewed evaluation outcomes',
      'No reviewed confusion outcomes or final-test population are committed.',
    ),
    unavailableMetric(
      'calibration',
      'Phase 14',
      'Calibration',
      'Predicted probabilities and observed outcomes per reviewed calibration bin',
      'No selected calibrator, reliability bins, or reviewed calibration partition is committed.',
    ),
    unavailableMetric(
      'coverage',
      'Phase 14',
      'Selective coverage',
      'Non-abstained reviewed decisions / all eligible reviewed decisions',
      'No calibrated decision or reviewed eligible-decision denominator is committed.',
    ),
  ])

  return Object.freeze({
    committedReviewedMetricCount: 0 as const,
    phase13: Object.freeze({
      status: 'unavailable' as const,
      resultArtifactCount: 0 as const,
      reviewedMetricCount: 0 as const,
      reason: evaluation.reason,
      sourceSection: 'evaluation_summaries' as const,
    }),
    phase14: Object.freeze({
      status: 'blocked' as const,
      humanVerifiedSourceMediaCount: 0 as const,
      humanVerifiedShortfall: reference.humanVerifiedShortfall,
      groupsAwaitingHumanReview: reference.groupsAwaitingHumanReview,
      unresolvedGroupCount: reference.unresolvedGroupCount,
      candidateVisualScoreCount: 0 as const,
      calibratedDecisionCount: 0 as const,
      reviewState: 'awaiting_human_review' as const,
    }),
    metrics,
    provenance: Object.freeze([
      requiredArtifact(replay, 'reference_readiness'),
      requiredArtifact(replay, 'reference_shortfalls'),
      requiredArtifact(replay, 'selective_decision_metadata'),
    ]),
    scientificClaimAllowed: false as const,
  })
}

function unavailableMetric(
  id: EvaluationMetricState['id'],
  phase: EvaluationMetricState['phase'],
  label: string,
  denominator: string,
  missingEvidence: string,
): EvaluationMetricState {
  return Object.freeze({
    id,
    phase,
    label,
    status: 'unavailable' as const,
    value: 'Unavailable' as const,
    denominator,
    missingEvidence,
  })
}

function requiredArtifact(
  replay: ReplayEvidence,
  role: ReplayArtifactEvidence['role'],
): ReplayArtifactEvidence {
  const artifact = replay.artifactInventory.find((candidate) => candidate.role === role)
  if (artifact === undefined || !artifact.verified) {
    throw new Error(`Reviewed evaluation is missing verified ${role} provenance`)
  }
  return artifact
}
