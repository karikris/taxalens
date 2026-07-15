import type { ReplayEvidence } from '../data/evidenceFacade'

export type YoloeVisualLayerId = 'original-full-image' | 'detection-box' | 'segmentation-mask'
export type YoloeRouteFieldId =
  | 'route'
  | 'visual-domain'
  | 'life-stage'
  | 'subject-area'
  | 'multiple-organisms'
  | 'route-reason'

export interface UnavailableYoloeItem<Id extends string> {
  readonly id: Id
  readonly label: string
  readonly status: 'unavailable'
  readonly reason: string
}

export interface YoloeRoutingEvidenceModel {
  readonly status: 'unavailable'
  readonly processedImageCount: 0
  readonly visualLayers: readonly UnavailableYoloeItem<YoloeVisualLayerId>[]
  readonly routeFields: readonly UnavailableYoloeItem<YoloeRouteFieldId>[]
  readonly sectionReason: string
  readonly scientificClaimAllowed: false
}

export function buildYoloeRoutingEvidence(replay: ReplayEvidence): YoloeRoutingEvidenceModel {
  const section = replay.sections.yoloe_evidence
  if (
    section.status !== 'unavailable' ||
    section.reason === null ||
    section.artifactIds.length !== 0 ||
    replay.observatory.yoloeImageCount !== 0 ||
    replay.discovery.media.status !== 'unavailable'
  ) {
    throw new Error('YOLOE routing display requires the verified zero-row unavailable boundary')
  }
  const detectionReason = section.reason
  const mediaReason = replay.discovery.media.reason

  return Object.freeze({
    status: 'unavailable',
    processedImageCount: 0,
    visualLayers: Object.freeze([
      Object.freeze({
        id: 'original-full-image',
        label: 'Original full image',
        status: 'unavailable',
        reason: mediaReason,
      }),
      Object.freeze({
        id: 'detection-box',
        label: 'Detection box',
        status: 'unavailable',
        reason: detectionReason,
      }),
      Object.freeze({
        id: 'segmentation-mask',
        label: 'Segmentation mask',
        status: 'unavailable',
        reason: detectionReason,
      }),
    ]),
    routeFields: Object.freeze([
      Object.freeze({
        id: 'route',
        label: 'Route',
        status: 'unavailable',
        reason: detectionReason,
      }),
      Object.freeze({
        id: 'visual-domain',
        label: 'Visual domain',
        status: 'unavailable',
        reason: 'No YOLOE route exists from which to resolve a visual domain.',
      }),
      Object.freeze({
        id: 'life-stage',
        label: 'Life stage',
        status: 'unavailable',
        reason: 'No YOLOE detection or reviewed life-stage evidence is committed.',
      }),
      Object.freeze({
        id: 'subject-area',
        label: 'Subject area',
        status: 'unavailable',
        reason: 'No detection box or mask exists from which to measure subject area.',
      }),
      Object.freeze({
        id: 'multiple-organisms',
        label: 'Multiple organisms',
        status: 'unavailable',
        reason: 'No detection instances exist from which to assess organism count.',
      }),
      Object.freeze({
        id: 'route-reason',
        label: 'Route reason',
        status: 'unavailable',
        reason: detectionReason,
      }),
    ]),
    sectionReason: detectionReason,
    scientificClaimAllowed: false,
  })
}
