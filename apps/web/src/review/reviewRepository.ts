import type {
  VerificationCampaign,
  VerificationItem,
} from './verificationContracts'
import type { VerificationEvent } from './verificationEvents'

export type ReviewCurrentDecisions = Readonly<
  Record<string, VerificationEvent>
>

export interface ReviewRepository<TConsensus = unknown> {
  loadCampaign(campaignId: string): Promise<VerificationCampaign | null>
  loadItems(campaignId: string): Promise<readonly VerificationItem[]>
  loadEvents(campaignId: string): Promise<readonly VerificationEvent[]>
  appendEvent(event: VerificationEvent): Promise<void>
  loadCurrentDecisions(campaignId: string): Promise<ReviewCurrentDecisions>
  loadConsensus(campaignId: string): Promise<readonly TConsensus[]>
  exportReceipt(campaignId: string): Promise<Uint8Array<ArrayBuffer>>
  clearLocalCampaign(campaignId: string): Promise<void>
}
