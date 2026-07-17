import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecordGeographicMiniMap } from './RecordGeographicMiniMap'
import { RecordGeographicActions } from './RecordGeographicActions'
import { RecordPrecisionBoundary } from './RecordPrecisionBoundary'
import {
  RecordGeographicFacts,
  buildRecordGeographicFactsModel,
} from './RecordGeographicFacts'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'
import {
  buildNearbyBaselineCellsSql,
  buildRecordGeographicContextSql,
  type RecordGeographicContext,
} from './recordGeographicContext'

const discovery = {
  source: 'flickr',
  sourcePhotoId: '55081300254',
  sourceId: 'flickr:55081300254',
  sourceRecordHash: 'sha256:record',
  coordinateQuality: 'flickr_street',
  coordinate: {
    latitude: 59.366308,
    longitude: 18.031366,
    accuracyLevel: 16,
  },
} as DiscoveryProvenanceResult

const context: RecordGeographicContext = {
  sourceId: discovery.sourceId,
  sourcePhotoId: discovery.sourcePhotoId,
  sourceRecordHash: discovery.sourceRecordHash,
  candidateCoordinate: {
    latitude: discovery.coordinate.latitude,
    longitude: discovery.coordinate.longitude,
    quality: discovery.coordinateQuality,
    accuracyLevel: discovery.coordinate.accuracyLevel,
  },
  precisionCells: [
    {
      spatialResolution: 7,
      spatialCellId: '87088660cffffff',
      supported: true,
      supportStatus: 'supported',
    },
  ],
  selectedCell: {
    spatialResolution: 7,
    spatialCellId: '87088660cffffff',
    latitude: 59.369,
    longitude: 18.03,
    countryCode: 'SE',
    country: 'Sweden',
    admin1: 'Stockholm',
  },
  impact: {
    baselineUnionCount: 0,
    baselineRangeInferenceEligibleCount: 0,
    flickrCandidateCount: 1,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 1,
    releaseReadyCount: 0,
    candidateOnlyCell: true,
    reviewedAdditionalCell: false,
    releaseReadyAdditionalCell: false,
    nearestBaselineDistanceStatus: 'available',
    nearestBaselineDistanceKm: 1084.768364,
    nearestBaselineCellId: '871968a00ffffff',
    dataDeficientState: 'data_deficient',
  },
  review: {
    campaignId: null,
    itemId: null,
    queueState: 'not_in_committed_campaign',
    state: 'not_requested',
    reviewerAssignmentCount: 0,
    effectiveReviewCount: 0,
    decisiveReviewCount: 0,
    humanReviewed: false,
    humanSupported: false,
  },
  nearbyBaselineCells: [
    {
      spatialCellId: '871968a00ffffff',
      latitude: 52.804055,
      longitude: 5.01363,
      baselineRangeInferenceEligibleCount: 1,
    },
    {
      spatialCellId: '87196abcdffffff',
      latitude: 52.2,
      longitude: 5.8,
      baselineRangeInferenceEligibleCount: 3,
    },
  ],
  sources: {
    flickrGeographySha256: 'a'.repeat(64),
    geographicImpactCellsSha256: 'b'.repeat(64),
    baselineSnapshotId: 'baseline:snapshot',
    flickrSnapshotId: 'flickr:snapshot',
  },
  scientificClaimAllowed: false,
}

describe('record Geographic Impact context', () => {
  it('scopes the record-to-cell join by immutable identity and source record hash', () => {
    const sql = buildRecordGeographicContextSql(discovery)

    expect(sql).toContain("geography.source = 'flickr'")
    expect(sql).toContain("geography.flickr_photo_id = '55081300254'")
    expect(sql).toContain("geography.source_record_hash = 'sha256:record'")
    expect(sql).toContain('geography.spatial_resolution = impact.spatial_resolution')
    expect(sql).toContain('geography.spatial_cell_id = impact.spatial_cell_id')
  })

  it('bounds nearby baseline context at the selected resolution and prioritizes the artifact cell', () => {
    const sql = buildNearbyBaselineCellsSql(discovery, 7, '871968a00ffffff')

    expect(sql).toContain('spatial_resolution = 7')
    expect(sql).toContain('baseline_range_inference_eligible_count > 0')
    expect(sql).toContain("spatial_cell_id = '871968a00ffffff'")
    expect(sql).toContain('LIMIT 8')
    expect(sql).not.toContain('distance_to_medoid_km')
  })

  it('renders exact candidate coordinates and shape-labelled baseline context without count scaling', () => {
    render(<RecordGeographicMiniMap context={context} />)

    expect(screen.getByRole('img', { name: /Record geographic context mini-map/u })).toBeInTheDocument()
    expect(screen.getByLabelText(/Flickr candidate at 59.366308, 18.031366/u)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/1 range-inference-eligible baseline observations at cell 871968a00ffffff/u),
    ).toBeInTheDocument()
    expect(screen.getByText(/Fixed marker sizes show evidence role, not record count/u)).toBeInTheDocument()
  })

  it('explains exact cell evidence without promoting a candidate-only cell', () => {
    expect(buildRecordGeographicFactsModel(context)).toMatchObject({
      contributionState: 'potential_coverage_gap_cell',
      contributionLabel: 'Potential coverage-gap cell',
      reviewLabel: 'Not in committed public campaign',
    })

    render(<RecordGeographicFacts context={context} />)

    expect(screen.getByText('Coordinate quality').parentElement).toHaveTextContent(
      'flickr streetFlickr accuracy level 16',
    )
    expect(screen.getByText('Country and region').parentElement).toHaveTextContent(
      'SwedenSE · Stockholm',
    )
    expect(screen.getByText('Supported comparison cell').parentElement).toHaveTextContent(
      'H3 resolution 787088660cffffff',
    )
    expect(screen.getByText('Baseline records in cell').parentElement).toHaveTextContent(
      '0 baseline union0 range-inference eligible',
    )
    expect(screen.getByText('Flickr candidates in cell').parentElement).toHaveTextContent(
      '1 candidate evidence0 reviewed target positive · 0 release-ready',
    )
    expect(screen.getByText('Nearest baseline distance').parentElement).toHaveTextContent(
      '1084.768 kmto same-resolution cell 871968a00ffffff',
    )
    expect(screen.getByText('Potential contribution').parentElement).toHaveTextContent(
      'Potential coverage-gap cell',
    )
    expect(screen.getByText('Baseline data state').parentElement).toHaveTextContent(
      'data deficientData deficiency is not a species-absence claim.',
    )
  })

  it('links the exact country cell, verification item, and inline baseline provenance', () => {
    render(<RecordGeographicActions context={context} />)

    expect(screen.getByRole('link', { name: 'Open Geographic Impact' })).toHaveAttribute(
      'href',
      '#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=lens',
    )
    expect(screen.getByRole('link', { name: 'View records in this cell' })).toHaveAttribute(
      'href',
      '#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=table',
    )
    expect(screen.getByRole('link', { name: 'Verify this result' })).toHaveAttribute(
      'href',
      '#verification?campaign=papilio-demoleus-flickr-candidate-intake-v1&item=flickr%3A55081300254&return=evidence-lens',
    )
    const provenance = screen.getByText('Inspect baseline provenance').closest('details')
    expect(provenance).not.toBeNull()
    expect(provenance).toHaveTextContent('baseline:snapshot')
    expect(provenance).toHaveTextContent('871968a00ffffff')
    expect(provenance).toHaveTextContent(/does not prove biological absence/u)
  })

  it('discloses and enforces a coarse coordinate precision boundary', () => {
    const coarseContext: RecordGeographicContext = {
      ...context,
      candidateCoordinate: { ...context.candidateCoordinate, quality: 'flickr_region' },
      precisionCells: [
        {
          spatialResolution: 3,
          spatialCellId: '830886fffffffff',
          supported: true,
          supportStatus: 'supported',
        },
        {
          spatialResolution: 5,
          spatialCellId: null,
          supported: false,
          supportStatus: 'unsupported_precision',
        },
        {
          spatialResolution: 7,
          spatialCellId: null,
          supported: false,
          supportStatus: 'unsupported_precision',
        },
      ],
      selectedCell: {
        ...context.selectedCell,
        spatialResolution: 3,
        spatialCellId: '830886fffffffff',
      },
    }
    const { rerender } = render(<RecordPrecisionBoundary context={coarseContext} />)

    expect(screen.getByRole('heading', { name: 'Finer geographic comparison blocked' }))
      .toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Blocked finer resolutions: 5, 7')
    expect(screen.getByText('H3 resolution 5').closest('li')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('H3 resolution 7').closest('li')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Unsupported child cells are never inferred/u)).toBeInTheDocument()

    rerender(<RecordGeographicActions context={coarseContext} />)
    expect(screen.queryByRole('link', { name: 'Open Geographic Impact' })).not.toBeInTheDocument()
    expect(screen.getByText('Geographic Impact link unavailable')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
