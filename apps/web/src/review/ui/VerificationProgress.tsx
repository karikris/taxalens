import type { HumanReviewDecision } from '../domain/reviewSession'
import type { HumanReviewItem } from '../reviewPacket'

export function VerificationProgress({
  currentDecisions,
  index,
  items,
  onOpenIndex,
}: {
  readonly currentDecisions: Readonly<Record<string, HumanReviewDecision>>
  readonly index: number
  readonly items: readonly HumanReviewItem[]
  readonly onOpenIndex: (index: number) => void
}) {
  return (
    <nav className="review-navigation" aria-label="Review item navigation">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onOpenIndex(Math.max(0, index - 1))}
      >
        Previous image
      </button>
      <ol>
        {items.map((item, itemIndex) => (
          <li key={item.itemId}>
            <button
              type="button"
              aria-label={`Open review image ${itemIndex + 1}`}
              aria-current={itemIndex === index ? 'step' : undefined}
              data-reviewed={currentDecisions[item.itemId] !== undefined}
              onClick={() => onOpenIndex(itemIndex)}
            >
              {itemIndex + 1}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={index === items.length - 1}
        onClick={() => onOpenIndex(Math.min(items.length - 1, index + 1))}
      >
        Next image
      </button>
    </nav>
  )
}
