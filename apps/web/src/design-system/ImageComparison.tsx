import { useId } from 'react'
import { Label, Slider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components'

interface ComparisonImage {
  readonly src: string
  readonly alt: string
}

interface ImageComparisonProps {
  readonly title: string
  readonly before: ComparisonImage
  readonly after: ComparisonImage
  readonly caption: string
  readonly initialPosition?: number
}

export function ImageComparison({
  title,
  before,
  after,
  caption,
  initialPosition = 50,
}: ImageComparisonProps) {
  const titleId = useId()

  return (
    <Slider
      className="tl-comparison"
      defaultValue={initialPosition}
      minValue={0}
      maxValue={100}
      step={1}
      aria-labelledby={titleId}
    >
      {({ state }) => {
        const position = state.getThumbValue(0)
        return (
          <>
            <div className="tl-comparison__heading">
              <h3 id={titleId} className="tl-editorial-title">
                {title}
              </h3>
              <SliderOutput>{position}% after image revealed</SliderOutput>
            </div>

            <figure className="tl-comparison__figure">
              <div className="tl-comparison__viewport">
                <div className="tl-comparison__image-layer">
                  <span className="tl-comparison__image-label tl-comparison__image-label--before">
                    Before
                  </span>
                  <img src={before.src} alt={before.alt} />
                </div>
                <div
                  className="tl-comparison__image-layer tl-comparison__image-layer--after"
                  style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                >
                  <span className="tl-comparison__image-label tl-comparison__image-label--after">
                    After
                  </span>
                  <img src={after.src} alt={after.alt} />
                </div>
              </div>
              <figcaption>{caption}</figcaption>
            </figure>

            <div className="tl-comparison__control-row">
              <Label>Reveal after image</Label>
              <span>Arrow keys adjust by 1%</span>
            </div>
            <SliderTrack className="tl-comparison__track">
              <SliderThumb className="tl-comparison__thumb" />
            </SliderTrack>
          </>
        )
      }}
    </Slider>
  )
}
