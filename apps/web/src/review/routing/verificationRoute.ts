import type {
  VerificationReturnView,
  VerificationRouteParams,
} from '../../shell'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'

export interface ResolvedVerificationRoute {
  readonly campaignId: string
  readonly itemId: string | null
  readonly returnView: VerificationReturnView | null
  readonly errors: readonly string[]
}

export function resolveVerificationRoute(
  route: VerificationRouteParams | undefined,
): ResolvedVerificationRoute {
  const errors = [...(route?.errors ?? [])]
  const requestedCampaignId = route?.campaignId ?? null
  const campaignAccepted =
    requestedCampaignId === null ||
    requestedCampaignId === HUMAN_REVIEW_CAMPAIGN.campaignId
  if (!campaignAccepted) {
    errors.push(`unknown verification campaign: ${requestedCampaignId}`)
  }

  const requestedItemId = route?.itemId ?? null
  const item =
    campaignAccepted && requestedItemId !== null
      ? HUMAN_REVIEW_ITEMS.find(({ itemId }) => itemId === requestedItemId)
      : undefined
  if (requestedItemId !== null && item === undefined) {
    errors.push(`unknown verification item: ${requestedItemId}`)
  }

  return Object.freeze({
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    itemId: item?.itemId ?? null,
    returnView: route?.returnView ?? null,
    errors: Object.freeze(errors),
  })
}
