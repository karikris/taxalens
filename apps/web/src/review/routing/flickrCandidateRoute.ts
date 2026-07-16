export interface FlickrCandidateRouteTarget {
  readonly campaignId: string
  readonly itemId: string
  readonly sourceId: string
  readonly recordId: string
  readonly title: string
}

const COMMITTED_FLICKR_CANDIDATE_ROUTES = Object.freeze([
  Object.freeze({
    campaignId: 'papilio-demoleus-flickr-candidate-intake-v1',
    itemId: 'flickr:55081300254',
    sourceId: 'flickr:55081300254',
    recordId: 'papilio-demoleus-pilot-awaiting-review',
    title: 'Papilio demoleus Flickr candidate intake',
  }),
] satisfies readonly FlickrCandidateRouteTarget[])

export function flickrCandidateRouteForSource(
  sourceId: string,
): FlickrCandidateRouteTarget | null {
  return (
    COMMITTED_FLICKR_CANDIDATE_ROUTES.find(
      (target) => target.sourceId === sourceId,
    ) ?? null
  )
}

export function flickrCandidateRouteForRecord(
  recordId: string,
): FlickrCandidateRouteTarget | null {
  return (
    COMMITTED_FLICKR_CANDIDATE_ROUTES.find(
      (target) => target.recordId === recordId,
    ) ?? null
  )
}

export function resolveFlickrCandidateRouteTarget(
  campaignId: string | null,
  itemId: string | null,
): FlickrCandidateRouteTarget | null {
  if (campaignId === null || itemId === null) {
    return null
  }
  return (
    COMMITTED_FLICKR_CANDIDATE_ROUTES.find(
      (target) =>
        target.campaignId === campaignId && target.itemId === itemId,
    ) ?? null
  )
}
