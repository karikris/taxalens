import { verifyPublicReviewMediaBuild } from './public-review-media.mjs'

const result = await verifyPublicReviewMediaBuild()
console.log(
  `Public review media verified: campaign=${result.campaignId}, items=${result.approvedItemCount}, files=${result.mediaFileCount}`,
)
