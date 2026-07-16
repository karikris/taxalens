import { canonicalExportJsonBytes } from '../../evidence/evidenceExport'
import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import type { VerificationConsensus } from '../domain/verificationConsensus'
import {
  projectCurrentVerificationEvents,
  type VerificationEvent,
} from '../domain/verificationEvents'

export type ReviewCurrentDecisions = Readonly<
  Record<string, VerificationEvent>
>

export const REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION =
  'taxalens-review-repository-receipt:v1.0.0' as const

export interface ReviewRepository {
  loadCampaign(campaignId: string): Promise<VerificationCampaign | null>
  loadItems(campaignId: string): Promise<readonly VerificationItem[]>
  loadEvents(campaignId: string): Promise<readonly VerificationEvent[]>
  appendEvent(event: VerificationEvent): Promise<void>
  loadCurrentDecisions(campaignId: string): Promise<ReviewCurrentDecisions>
  loadConsensus(campaignId: string): Promise<readonly VerificationConsensus[]>
  exportReceipt(campaignId: string): Promise<Uint8Array<ArrayBuffer>>
  clearLocalCampaign(campaignId: string): Promise<void>
}

export function reviewRepositoryReceiptBytes({
  campaign,
  consensus = [],
  events,
  items,
}: {
  readonly campaign: VerificationCampaign
  readonly consensus?: readonly VerificationConsensus[]
  readonly events: readonly VerificationEvent[]
  readonly items: readonly VerificationItem[]
}): Uint8Array<ArrayBuffer> {
  const sortedItems = [...items].sort((left, right) =>
    left.itemId.localeCompare(right.itemId),
  )
  const currentDecisions = Object.values(
    projectCurrentVerificationEvents(events),
  ).sort((left, right) => left.itemId.localeCompare(right.itemId))
  return canonicalExportJsonBytes({
    schemaVersion: REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION,
    campaign,
    items: sortedItems,
    events,
    currentDecisions,
    consensus,
    semantics: {
      appendOnlyEvents: true,
      supersededEventsRetained: true,
      currentStateIsProjection: true,
    },
  })
}
