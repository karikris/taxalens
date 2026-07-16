import type { HumanReviewItem } from '../reviewPacket'
import type { HumanReviewOutcome } from '../domain/reviewSession'

export function VerificationItemViewer({
  currentOutcome,
  imageUrl,
  index,
  item,
  onImageError,
  onImageLoad,
  scientificName,
  totalItems,
}: {
  readonly currentOutcome: HumanReviewOutcome | undefined
  readonly imageUrl: string | null
  readonly index: number
  readonly item: HumanReviewItem
  readonly onImageError: () => void
  readonly onImageLoad: () => void
  readonly scientificName: string
  readonly totalItems: number
}) {
  return (
    <section className="review-image-panel" aria-labelledby="review-item-title">
      <div className="review-item__topline">
        <span>
          Image {index + 1} of {totalItems}
        </span>
        <span>
          {currentOutcome === undefined
            ? 'Pending'
            : humanReviewOutcomeLabel(currentOutcome)}
        </span>
      </div>
      <div className="review-image-frame">
        {imageUrl === null ? (
          <div className="review-image-placeholder">
            <strong>Image not opened</strong>
            <span>Prepare the local cache to view this review item.</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={item.verificationLabel}
            onLoad={onImageLoad}
            onError={onImageError}
          />
        )}
      </div>
      <h3 id="review-item-title">{item.verificationLabel}</h3>
      <p className="review-item__metadata">
        {formatReviewDimension(item.expectedLifeStage)} ·{' '}
        {formatReviewDimension(item.expectedVisualDomain)} ·{' '}
        {formatReviewDimension(item.expectedView)} view · expected label{' '}
        <i>{scientificName}</i>
      </p>
      <p className="review-item__attribution">
        <a href={item.rights.sourceUri} target="_blank" rel="noreferrer">
          {item.providerSuppliedIdentity.rawLabel ?? item.rights.attribution}
        </a>{' '}
        by {item.rights.creator ?? 'unknown creator'} ·{' '}
        <a href={item.rights.licenseUri} target="_blank" rel="noreferrer">
          {item.rights.licenseName}
        </a>
      </p>
    </section>
  )
}

export function humanReviewOutcomeLabel(
  outcome: HumanReviewOutcome,
): string {
  switch (outcome) {
    case 'yes':
      return 'Yes'
    case 'no':
      return 'No'
    case 'cant_tell':
      return 'Can’t tell'
    case 'cant_view':
      return 'Can’t view'
    case 'skipped':
      return 'Skip'
  }
}

function formatReviewDimension(value: string | null): string {
  return value === null ? 'unspecified' : value.replaceAll('_', ' ')
}
