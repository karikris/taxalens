import type { LayerProps } from '@vis.gl/react-maplibre'

import {
  TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
  TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
} from './geographicEvidenceIcons'

export const TAXALENS_IMPACT_CELL_SOURCE_ID = 'taxalens-impact-cells' as const
export const TAXALENS_BASELINE_EVIDENCE_LAYER_ID =
  'taxalens-baseline-occurrence-evidence' as const

export const TAXALENS_BASELINE_EVIDENCE_LAYER = Object.freeze({
    id: TAXALENS_BASELINE_EVIDENCE_LAYER_ID,
    type: 'circle',
    source: TAXALENS_IMPACT_CELL_SOURCE_ID,
    filter: ['>', ['get', 'baselineCount'], 0],
    paint: {
      'circle-radius': ['get', 'baselineRadius'],
      'circle-color': '#2563eb',
      'circle-opacity': 0.72,
      'circle-stroke-color': '#163f8f',
      'circle-stroke-opacity': 0.92,
      'circle-stroke-width': 1,
    },
  } satisfies LayerProps)

export const TAXALENS_FLICKR_PENDING_LAYER_ID = 'taxalens-flickr-pending' as const
export const TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER_ID =
  'taxalens-flickr-reviewed-positive' as const
export const TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER_ID =
  'taxalens-flickr-reviewed-negative' as const
export const TAXALENS_FLICKR_UNCERTAIN_LAYER_ID = 'taxalens-flickr-uncertain' as const
export const TAXALENS_FLICKR_RELEASE_READY_LAYER_ID =
  'taxalens-flickr-release-ready' as const

export const TAXALENS_FLICKR_PENDING_LAYER = Object.freeze({
  id: TAXALENS_FLICKR_PENDING_LAYER_ID,
  type: 'circle',
  source: TAXALENS_IMPACT_CELL_SOURCE_ID,
  filter: ['>', ['get', 'pendingCount'], 0],
  paint: {
    'circle-radius': ['get', 'pendingRadius'],
    'circle-color': 'rgba(245, 158, 11, 0)',
    'circle-stroke-color': '#b45309',
    'circle-stroke-opacity': 1,
    'circle-stroke-width': 2,
  },
} satisfies LayerProps)

export const TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER = Object.freeze({
  id: TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER_ID,
  type: 'circle',
  source: TAXALENS_IMPACT_CELL_SOURCE_ID,
  filter: ['>', ['get', 'reviewedPositiveCount'], 0],
  paint: {
    'circle-radius': ['get', 'reviewedPositiveRadius'],
    'circle-color': '#f59e0b',
    'circle-opacity': 0.82,
    'circle-stroke-color': '#92400e',
    'circle-stroke-opacity': 1,
    'circle-stroke-width': 1,
  },
} satisfies LayerProps)

export const TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER = Object.freeze({
  id: TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER_ID,
  type: 'symbol',
  source: TAXALENS_IMPACT_CELL_SOURCE_ID,
  filter: ['>', ['get', 'reviewedNegativeCount'], 0],
  layout: {
    'icon-image': TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
    'icon-size': ['/', ['get', 'reviewedNegativeRadius'], 16],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
} satisfies LayerProps)

export const TAXALENS_FLICKR_UNCERTAIN_LAYER = Object.freeze({
  id: TAXALENS_FLICKR_UNCERTAIN_LAYER_ID,
  type: 'symbol',
  source: TAXALENS_IMPACT_CELL_SOURCE_ID,
  filter: ['>', ['get', 'uncertainCount'], 0],
  layout: {
    'icon-image': TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
    'icon-size': ['/', ['get', 'uncertainRadius'], 16],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
} satisfies LayerProps)

export const TAXALENS_FLICKR_RELEASE_READY_LAYER = Object.freeze({
  id: TAXALENS_FLICKR_RELEASE_READY_LAYER_ID,
  type: 'circle',
  source: TAXALENS_IMPACT_CELL_SOURCE_ID,
  filter: ['>', ['get', 'releaseReadyCount'], 0],
  paint: {
    'circle-radius': ['get', 'releaseReadyRadius'],
    'circle-color': '#f59e0b',
    'circle-opacity': 0.9,
    'circle-stroke-color': '#111827',
    'circle-stroke-opacity': 1,
    'circle-stroke-width': 3,
  },
} satisfies LayerProps)
