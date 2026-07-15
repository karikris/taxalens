import type { ReplayEvidence } from '../data/evidenceFacade'

export interface UnavailableEvidenceField {
  readonly id: string
  readonly label: string
  readonly sourceFields: readonly string[]
  readonly status: 'unavailable'
  readonly value: null
  readonly reason: string
}

export interface SelectiveDecisionModel {
  readonly rawEvidence: readonly UnavailableEvidenceField[]
  readonly decisionEvidence: readonly UnavailableEvidenceField[]
  readonly recordId: string
  readonly recordState: 'awaiting_human_review'
  readonly displayLabel: string
  readonly transitionRequired: string
  readonly calibrationStatus: 'not_run'
  readonly abstentionStatus: 'not_evaluated'
  readonly scientificClaimAllowed: false
  readonly gateCount: number
  readonly satisfiedGateCount: 0
}

export function buildSelectiveDecisionModel(replay: ReplayEvidence): SelectiveDecisionModel {
  const scoreSection = replay.sections.target_aware_score_metadata
  const decisionSection = replay.sections.selective_decision_metadata
  if (
    scoreSection.status !== 'unavailable' ||
    scoreSection.reason === null ||
    decisionSection.status !== 'partial' ||
    decisionSection.scientificClaimAllowed ||
    replay.observatory.candidateVisualScoreCount !== 0 ||
    replay.observatory.calibratedDecisionCount !== 0 ||
    replay.selectiveDecision.decisionStatus !== 'unavailable' ||
    replay.selectiveDecision.candidateVisualScoreCount !== 0 ||
    replay.selectiveDecision.gates.some(({ satisfied }) => satisfied)
  ) {
    throw new Error('Selective-decision explanation requires the verified no-score boundary')
  }

  const rawReason = scoreSection.reason
  const decisionReason = replay.selectiveDecision.unavailableReason
  const rawEvidence = Object.freeze([
    unavailableField('text-similarity', 'Text similarity', ['target_raw_text_similarity'], rawReason),
    unavailableField(
      'prototype-similarity',
      'Prototype similarity',
      ['target_local_prototype_similarity', 'target_global_prototype_similarity'],
      rawReason,
    ),
    unavailableField(
      'nearest-support',
      'Nearest support',
      ['target_nearest_reference_similarity'],
      rawReason,
    ),
    unavailableField(
      'top-k-support',
      'Top-k support',
      ['target_top_k_reference_similarity'],
      rawReason,
    ),
    unavailableField(
      'visual-input-fusion',
      'Visual-input fusion',
      ['visual_input_evidence', 'visual_input_disagreement', 'visual_input_fusion_fingerprint'],
      replay.sections.full_frame_visual_input_metadata.reason ?? rawReason,
    ),
    unavailableField('geography', 'Geography', ['geo_evidence'], rawReason),
    unavailableField(
      'quality',
      'Quality',
      ['detector_score', 'subject_area_ratio', 'mask_coverage', 'quality_flags'],
      rawReason,
    ),
  ])
  const decisionEvidence = Object.freeze([
    unavailableField(
      'target-probability',
      'Calibrated target probability',
      ['calibrated_target_probability'],
      decisionReason,
    ),
    unavailableField(
      'non-target-probability',
      'Calibrated non-target probability',
      ['calibrated_non_target_probability'],
      decisionReason,
    ),
    unavailableField(
      'decision-threshold',
      'Threshold',
      ['model_decision_threshold'],
      decisionReason,
    ),
    unavailableField(
      'competitor-margin',
      'Margin',
      ['target_competitor_margin'],
      decisionReason,
    ),
    unavailableField(
      'margin-threshold',
      'Margin threshold',
      ['competitor_margin_threshold'],
      decisionReason,
    ),
    unavailableField(
      'abstention',
      'Abstention',
      ['abstained', 'abstention_reason'],
      'Not evaluated. Awaiting human review is a workflow state, not a model abstention.',
    ),
    unavailableField(
      'policy-fingerprint',
      'Policy fingerprint',
      ['decision_policy_fingerprint', 'threshold_provenance'],
      decisionReason,
    ),
  ])

  return Object.freeze({
    rawEvidence,
    decisionEvidence,
    recordId: replay.selectiveDecision.recordId,
    recordState: replay.selectiveDecision.state,
    displayLabel: replay.selectiveDecision.displayLabel,
    transitionRequired: replay.selectiveDecision.allowedTransition,
    calibrationStatus: 'not_run',
    abstentionStatus: 'not_evaluated',
    scientificClaimAllowed: false,
    gateCount: replay.selectiveDecision.gates.length,
    satisfiedGateCount: 0,
  })
}

function unavailableField(
  id: string,
  label: string,
  sourceFields: readonly string[],
  reason: string,
): UnavailableEvidenceField {
  return Object.freeze({
    id,
    label,
    sourceFields: Object.freeze(sourceFields),
    status: 'unavailable',
    value: null,
    reason,
  })
}
