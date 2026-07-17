import { describe, expect, it } from 'vitest'

import {
  TAXALENS_BASELINE_EVIDENCE_LAYER,
  TAXALENS_FLICKR_PENDING_LAYER,
  TAXALENS_FLICKR_RELEASE_READY_LAYER,
  TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER,
  TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER,
  TAXALENS_FLICKR_UNCERTAIN_LAYER,
  TAXALENS_SELECTED_IMPACT_CELL_LAYER_ID,
  taxalensSelectedImpactCellLayer,
} from './geographicImpactLayers'
import {
  TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
  TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
} from './geographicEvidenceIcons'

describe('Geographic Impact evidence layers', () => {
  it('uses blue fill for range-inference-eligible baseline evidence', () => {
    expect(TAXALENS_BASELINE_EVIDENCE_LAYER).toMatchObject({
      type: 'circle',
      filter: ['>', ['get', 'baselineCount'], 0],
      paint: {
        'circle-radius': ['get', 'baselineRadius'],
        'circle-color': '#2563eb',
      },
    })
  })

  it('creates a declarative selected-cell highlight with identity and stroke', () => {
    expect(taxalensSelectedImpactCellLayer('cell:selected')).toMatchObject({
      id: TAXALENS_SELECTED_IMPACT_CELL_LAYER_ID,
      type: 'circle',
      filter: ['==', ['get', 'spatialCellId'], 'cell:selected'],
      paint: {
        'circle-color': 'rgba(255, 255, 255, 0)',
        'circle-stroke-width': 3,
      },
    })
  })

  it('distinguishes all Flickr states with fill, stroke, dash and excluded shapes', () => {
    expect(TAXALENS_FLICKR_PENDING_LAYER).toMatchObject({
      type: 'circle',
      filter: ['>', ['get', 'pendingCount'], 0],
      paint: {
        'circle-color': 'rgba(245, 158, 11, 0)',
        'circle-stroke-color': '#b45309',
        'circle-stroke-width': 2,
      },
    })
    expect(TAXALENS_FLICKR_REVIEWED_POSITIVE_LAYER).toMatchObject({
      type: 'circle',
      filter: ['>', ['get', 'reviewedPositiveCount'], 0],
      paint: { 'circle-color': '#f59e0b' },
    })
    expect(TAXALENS_FLICKR_REVIEWED_NEGATIVE_LAYER).toMatchObject({
      type: 'symbol',
      filter: ['>', ['get', 'reviewedNegativeCount'], 0],
      layout: { 'icon-image': TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID },
    })
    expect(TAXALENS_FLICKR_UNCERTAIN_LAYER).toMatchObject({
      type: 'symbol',
      filter: ['>', ['get', 'uncertainCount'], 0],
      layout: { 'icon-image': TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID },
    })
    expect(TAXALENS_FLICKR_RELEASE_READY_LAYER).toMatchObject({
      type: 'circle',
      filter: ['>', ['get', 'releaseReadyCount'], 0],
      paint: {
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#111827',
        'circle-stroke-width': 3,
      },
    })
  })
})
