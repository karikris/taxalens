import type { LayerProps } from '@vis.gl/react-maplibre'

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
