import type { ReplayEvidence } from '../data/evidenceFacade'

export type FullFrameModeId =
  | 'raw-full-image'
  | 'focused-full-frame'
  | 'masked-full-frame'
  | 'multi-object-full-frame'

export type FullFrameIdentityId =
  | 'full-canvas-retained'
  | 'transformation-version'
  | 'transformation-fingerprint'
  | 'embedding-identity'

export interface UnavailableFullFrameItem<Id extends string> {
  readonly id: Id
  readonly label: string
  readonly status: 'unavailable'
  readonly reason: string
}

export interface FullFrameMode extends UnavailableFullFrameItem<FullFrameModeId> {
  readonly comparisonLabel: string
  readonly description: string
}

export interface FullFrameComparisonModel {
  readonly status: 'unavailable'
  readonly transformationCount: 0
  readonly modes: readonly FullFrameMode[]
  readonly identities: readonly UnavailableFullFrameItem<FullFrameIdentityId>[]
  readonly scientificClaimAllowed: false
}

export function buildFullFrameComparison(replay: ReplayEvidence): FullFrameComparisonModel {
  const section = replay.sections.full_frame_visual_input_metadata
  if (
    section.status !== 'unavailable' ||
    section.reason === null ||
    section.artifactIds.length !== 0 ||
    replay.observatory.fullFrameTransformationCount !== 0 ||
    replay.discovery.media.status !== 'unavailable'
  ) {
    throw new Error('Full-frame comparison requires the verified zero-transformation boundary')
  }
  const transformationReason = section.reason
  const mediaReason = replay.discovery.media.reason

  const mode = (
    id: FullFrameModeId,
    label: string,
    comparisonLabel: string,
    description: string,
    reason = transformationReason,
  ): FullFrameMode =>
    Object.freeze({ id, label, comparisonLabel, description, status: 'unavailable', reason })

  return Object.freeze({
    status: 'unavailable',
    transformationCount: 0,
    modes: Object.freeze([
      mode(
        'raw-full-image',
        'Raw full image',
        'Raw identity view',
        'The unmodified full canvas that anchors every derived visual-input identity.',
        mediaReason,
      ),
      mode(
        'focused-full-frame',
        'Focused full frame',
        'Focused attention view',
        'The full canvas with pixels outside the selected detection region attenuated.',
      ),
      mode(
        'masked-full-frame',
        'Masked full frame',
        'Masked attention view',
        'The full canvas with attention defined by an instance mask when one is available.',
      ),
      mode(
        'multi-object-full-frame',
        'Multi-object full frame',
        'Multi-object attention view',
        'The full canvas with the union of multiple retained detection regions.',
      ),
    ]),
    identities: Object.freeze([
      Object.freeze({
        id: 'full-canvas-retained',
        label: 'Full canvas retained',
        status: 'unavailable',
        reason: 'No real before-and-after image pair exists to verify equal canvas dimensions.',
      }),
      Object.freeze({
        id: 'transformation-version',
        label: 'Transformation version',
        status: 'unavailable',
        reason: transformationReason,
      }),
      Object.freeze({
        id: 'transformation-fingerprint',
        label: 'Transformation fingerprint',
        status: 'unavailable',
        reason: 'No applied transformation exists from which to verify a fingerprint.',
      }),
      Object.freeze({
        id: 'embedding-identity',
        label: 'Embedding identity',
        status: 'unavailable',
        reason: 'No transformed visual input was embedded in this pilot.',
      }),
    ]),
    scientificClaimAllowed: false,
  })
}
