import { useId, type ReactNode } from 'react'

import { EvidenceTier, type EvidenceTierKind } from './EvidencePrimitives'

interface ScientificFigureProps {
  readonly title: string
  readonly description: string
  readonly caption: string
  readonly tier: EvidenceTierKind
  readonly children: ReactNode
}

export function ScientificFigure({
  title,
  description,
  caption,
  tier,
  children,
}: ScientificFigureProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <figure
      className="tl-scientific-figure"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <header className="tl-scientific-figure__header">
        <EvidenceTier tier={tier} />
        <h3 id={titleId} className="tl-editorial-title">
          {title}
        </h3>
        <p id={descriptionId} className="tl-scientific-figure__description">
          {description}
        </p>
      </header>
      <div className="tl-scientific-figure__plot">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
