import {
  canonicalExportJsonBytes,
  downloadEvidenceFile,
} from '../../evidence/evidenceExport'
import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewPacket,
} from '../reviewPacket'
import {
  currentHumanReviewDecisions,
  type HumanReviewDecision,
  type HumanReviewSession,
} from '../domain/reviewSession'

export function exportHumanReviewReceipt(
  session: HumanReviewSession,
  packet: HumanReviewPacket = HUMAN_REVIEW_PACKET,
): void {
  const bytes = humanReviewReceiptBytes(session, packet)
  downloadEvidenceFile({
    filename: `${packet.packetId}.review-receipt.json`,
    mediaType: 'application/json',
    bytes,
  })
}

export function humanReviewReceiptBytes(
  session: HumanReviewSession,
  packet: HumanReviewPacket = HUMAN_REVIEW_PACKET,
): Uint8Array<ArrayBuffer> {
  const currentDecisions = currentHumanReviewDecisions(session)
  const decisions = packet.items
    .map((item) => currentDecisions[item.itemId])
    .filter((decision): decision is HumanReviewDecision => decision !== undefined)
    .map((decision) => ({
      ...decision,
      inspection: session.inspections[decision.itemId] ?? null,
      scientificDisposition:
        decision.outcome === 'yes'
          ? 'label_supported'
          : decision.outcome === 'no'
            ? 'label_not_supported'
            : decision.outcome === 'cant_tell'
              ? 'uncertain'
              : null,
      technicalDisposition:
        decision.outcome === 'cant_view'
          ? 'media_unavailable'
          : decision.outcome === 'skipped'
            ? 'deferred'
            : null,
    }))
  return canonicalExportJsonBytes({
    schemaVersion: 'taxalens-human-review-receipt:v2.0.0',
    packet: {
      schemaVersion: packet.schemaVersion,
      packetId: packet.packetId,
      campaignSchemaVersion: packet.campaign.schemaVersion,
      campaignKind: packet.campaign.kind,
      campaignManifestSha256: packet.manifestSha256,
      questionSha256: packet.campaign.questionFingerprint,
      target: packet.target,
      itemCount: packet.items.length,
    },
    currentReviewerId: session.reviewerId.trim() || null,
    events: session.events,
    decisions,
    counts: {
      recorded: decisions.length,
      yes: decisions.filter(({ outcome }) => outcome === 'yes').length,
      no: decisions.filter(({ outcome }) => outcome === 'no').length,
      cantTell: decisions.filter(({ outcome }) => outcome === 'cant_tell').length,
      cantView: decisions.filter(({ outcome }) => outcome === 'cant_view').length,
      skipped: decisions.filter(({ outcome }) => outcome === 'skipped').length,
    },
    semantics: {
      localBrowserReview: true,
      appendOnlyEventLedger: true,
      supersededEventsRetained: true,
      separateFromFrozenBioMinerReferenceBank: true,
      independentExpertTaxonomicVerificationClaimed: false,
      scientificClaimAllowed: false,
    },
  })
}
