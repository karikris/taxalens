import type { ReplayEvidence } from '../data/evidenceFacade'

export type LedgerEventStatus = 'available' | 'metadata' | 'unavailable' | 'pending'

export interface EvidenceLedgerEvent {
  readonly id:
    | 'discovery'
    | 'deduplication'
    | 'geography'
    | 'reference-status'
    | 'route'
    | 'visual-inputs'
    | 'candidates'
    | 'decision'
    | 'review-state'
    | 'export'
  readonly sequence: number
  readonly label: string
  readonly status: LedgerEventStatus
  readonly recordedAt: string | null
  readonly detail: string
  readonly verification: string
  readonly artifactIds: readonly string[]
  readonly scientificClaimAllowed: false
}

export interface EvidenceLedgerModel {
  readonly recordId: string
  readonly bundleCreatedAt: string
  readonly chronology: 'ordered_evidence_lifecycle_not_event_time'
  readonly events: readonly EvidenceLedgerEvent[]
  readonly commentEnrichment: 'comment enrichment unavailable for this record'
  readonly commentCount: 0
  readonly commentPromotionAllowed: false
}

export function buildEvidenceLedger(replay: ReplayEvidence): EvidenceLedgerModel {
  if (
    replay.observatory.humanCommentCount !== 0 ||
    replay.observatory.calibratedDecisionCount !== 0 ||
    replay.heroState !== 'awaiting_human_review' ||
    replay.scientificClaimAllowed
  ) {
    throw new Error('Evidence ledger requires the verified awaiting-review pilot boundary')
  }

  const events: readonly EvidenceLedgerEvent[] = [
    event(
      'discovery',
      1,
      'Discovery',
      'metadata',
      `${replay.observatory.flickrQueryHitCount.toLocaleString('en-US')} query hits resolve to ${replay.observatory.canonicalPhotoCount.toLocaleString('en-US')} canonical source candidates.`,
      'committed_metadata_verified',
      ['flickr-candidate-summaries', 'biominer-flickr-query-hits-parquet'],
    ),
    event(
      'deduplication',
      2,
      'Deduplication',
      'metadata',
      `Summary counts are verified; ${replay.discovery.duplicateRelationships.reason}`,
      'committed_metadata_counts_verified',
      ['duplicate-summaries'],
    ),
    event(
      'geography',
      3,
      'Geography',
      'metadata',
      `${replay.geographyReference.geography.locatedClusterCount} located candidate clusters are committed; coordinates remain candidate distribution metadata.`,
      replay.geographyReference.geography.verificationStatus,
      ['geographic-clusters', 'biominer-flickr-geography-parquet'],
    ),
    event(
      'reference-status',
      4,
      'Reference status',
      'pending',
      `${replay.geographyReference.reference.eligibleSourceMediaCount.toLocaleString('en-US')} eligible source candidates, 0 human-verified images, and a ${replay.geographyReference.reference.humanVerifiedShortfall} human-verified shortfall.`,
      replay.geographyReference.reference.readinessVerificationStatus,
      ['reference-readiness', 'reference-shortfalls'],
    ),
    event(
      'route',
      5,
      'Route',
      'unavailable',
      replay.sections.yoloe_evidence.reason ?? 'No YOLOE route evidence is committed.',
      replay.sections.yoloe_evidence.verificationStatus,
      ['run-summary'],
    ),
    event(
      'visual-inputs',
      6,
      'Visual inputs',
      'unavailable',
      replay.sections.full_frame_visual_input_metadata.reason ??
        'No transformed full-frame input is committed.',
      replay.sections.full_frame_visual_input_metadata.verificationStatus,
      ['run-summary'],
    ),
    event(
      'candidates',
      7,
      'Candidates',
      'metadata',
      `${replay.mission.candidatePolicy.candidateCount} regional competitor planning hypotheses are committed without visual scores.`,
      replay.sections.candidate_sets.verificationStatus,
      ['candidate-sets'],
    ),
    event(
      'decision',
      8,
      'Decision',
      'unavailable',
      `${replay.selectiveDecision.unavailableReason} Decision payload is null.`,
      replay.selectiveDecision.verificationStatus,
      ['selective-decision-metadata'],
    ),
    event(
      'review-state',
      9,
      'Review state',
      'pending',
      `Record remains ${replay.heroState.replaceAll('_', ' ')}; no comment-driven promotion exists.`,
      replay.selectiveDecision.verificationStatus,
      ['run-summary', 'selective-decision-metadata'],
    ),
    event(
      'export',
      10,
      'Export',
      'available',
      `Static judge bundle contains ${replay.verifiedArtifactCount} / ${replay.artifactCount} checksum-verified artifacts. A user-generated evidence export is not yet recorded.`,
      'inventory_and_payload_verified',
      ['rights-manifest', 'attribution-manifest'],
      replay.bundleCreatedAt,
    ),
  ]
  const inventoryIds = new Set(replay.artifactInventory.map(({ artifactId }) => artifactId))
  for (const item of events) {
    if (item.artifactIds.some((artifactId) => !inventoryIds.has(artifactId))) {
      throw new Error(`Ledger event ${item.id} references an unverified artifact`)
    }
  }

  return Object.freeze({
    recordId: replay.heroRecordId,
    bundleCreatedAt: replay.bundleCreatedAt,
    chronology: 'ordered_evidence_lifecycle_not_event_time',
    events: Object.freeze(events),
    commentEnrichment: 'comment enrichment unavailable for this record',
    commentCount: 0,
    commentPromotionAllowed: false,
  })
}

function event(
  id: EvidenceLedgerEvent['id'],
  sequence: number,
  label: string,
  status: LedgerEventStatus,
  detail: string,
  verification: string,
  artifactIds: readonly string[],
  recordedAt: string | null = null,
): EvidenceLedgerEvent {
  return Object.freeze({
    id,
    sequence,
    label,
    status,
    recordedAt,
    detail,
    verification,
    artifactIds: Object.freeze(artifactIds),
    scientificClaimAllowed: false,
  })
}
