import type {
  VerificationReturnView,
  VerificationRouteParams,
} from '../../shell'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  resolveFlickrCandidateRouteTarget,
  type FlickrCandidateRouteTarget,
} from './flickrCandidateRoute'

export interface ResolvedVerificationRoute {
  readonly campaignId: string
  readonly itemId: string | null
  readonly returnView: VerificationReturnView | null
  readonly errors: readonly string[]
  readonly section: 'flickr-results' | 'reference-images'
  readonly flickrCandidate: FlickrCandidateRouteTarget | null
}

export function resolveVerificationRoute(
  route: VerificationRouteParams | undefined,
): ResolvedVerificationRoute {
  const errors = [...(route?.errors ?? [])]
  const requestedCampaignId = route?.campaignId ?? null
  const requestedItemId = route?.itemId ?? null
  const flickrCandidate = resolveFlickrCandidateRouteTarget(
    requestedCampaignId,
    requestedItemId,
  )
  if (flickrCandidate !== null) {
    return Object.freeze({
      campaignId: flickrCandidate.campaignId,
      itemId: flickrCandidate.itemId,
      returnView: route?.returnView ?? null,
      errors: Object.freeze(errors),
      section: 'flickr-results',
      flickrCandidate,
    })
  }

  const campaignAccepted =
    requestedCampaignId === null ||
    requestedCampaignId === HUMAN_REVIEW_CAMPAIGN.campaignId
  if (!campaignAccepted) {
    errors.push(`unknown verification campaign: ${requestedCampaignId}`)
  }

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
    section: 'reference-images',
    flickrCandidate: null,
  })
}
