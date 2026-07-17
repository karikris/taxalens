export const TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID =
  'taxalens-uncertain-evidence-ring' as const
export const TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID =
  'taxalens-excluded-evidence-mark' as const

export interface GeographicEvidenceImage {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array<ArrayBuffer>
}

export interface GeographicEvidenceImageTarget {
  readonly hasImage: (id: string) => boolean
  readonly addImage: (
    id: string,
    image: GeographicEvidenceImage,
    options: { readonly pixelRatio: number },
  ) => void
}

const IMAGE_SIZE = 64
const IMAGE_CENTER = (IMAGE_SIZE - 1) / 2
const AMBER = Object.freeze([180, 83, 9, 255] as const)

export function registerGeographicEvidenceImages(
  target: GeographicEvidenceImageTarget,
): void {
  if (!target.hasImage(TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID)) {
    target.addImage(
      TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
      createGeographicEvidenceImage('uncertain'),
      { pixelRatio: 2 },
    )
  }
  if (!target.hasImage(TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID)) {
    target.addImage(
      TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
      createGeographicEvidenceImage('excluded'),
      { pixelRatio: 2 },
    )
  }
}

export function createGeographicEvidenceImage(
  kind: 'uncertain' | 'excluded',
): GeographicEvidenceImage {
  const data = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4)
  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const dx = x - IMAGE_CENTER
      const dy = y - IMAGE_CENTER
      const distance = Math.hypot(dx, dy)
      const ring = distance >= 25 && distance <= 29
      const dashIndex = Math.floor(
        ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 16,
      )
      const dashedRing = ring && dashIndex % 2 === 0
      const excludedCross =
        distance <= 24 && Math.abs(Math.abs(dx) - Math.abs(dy)) <= 2.25
      const painted =
        kind === 'uncertain' ? dashedRing : ring || excludedCross
      if (painted) setPixel(data, x, y, AMBER)
    }
  }
  return Object.freeze({
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    data,
  })
}

function setPixel(
  data: Uint8Array,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
): void {
  const offset = (y * IMAGE_SIZE + x) * 4
  data[offset] = color[0]
  data[offset + 1] = color[1]
  data[offset + 2] = color[2]
  data[offset + 3] = color[3]
}
