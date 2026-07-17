import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type EvidenceFacade } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { FlickrWorkloadMap } from './FlickrWorkloadMap'
import type { GeographicWorkloadResult } from './geographicWorkload'

let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
})

const result: GeographicWorkloadResult = {
  backend: 'duckdb-wasm-parquet',
  packageVersion: '1.32.0',
  engineVersion: 'v1.4.3',
  clusters: [
    {
      id: 'geo:first',
      latitude: 10,
      longitude: 20,
      memberImageCount: 100,
      memberCellCount: 5,
      outlierRecordCount: 4,
      radiusP95Km: 12.5,
      candidateDistributionOnly: true,
    },
    {
      id: 'geo:second',
      latitude: -30,
      longitude: 140,
      memberImageCount: 25,
      memberCellCount: 2,
      outlierRecordCount: 1,
      radiusP95Km: 8.25,
      candidateDistributionOnly: true,
    },
  ],
  locatedClusterCount: 2,
  noGeoRecordCount: 0,
  unassignedGeotaggedRecordCount: 792,
  outlierRecordCount: 707,
  assignmentRecordCount: 13_501,
  reviewDensity: null,
  reviewDensityReason:
    'No materialized review queue or geographic review assignments are committed.',
  referenceShortfalls: { sourceCandidate: 247, humanVerified: 490 },
  artifacts: [
    {
      artifactId: 'biominer-flickr-geo-assignments-parquet',
      mediaType: 'application/vnd.apache.parquet',
      path: 'analytics/flickr_geo_assignments.parquet',
      sizeBytes: 633_625,
      sha256: 'e12f6ef9582bf707c952c3974c91e9a8f226ca7ce8034cab8ea8c293b70b6f74',
      recordCount: 13_501,
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    },
    {
      artifactId: 'biominer-flickr-geo-clusters-parquet',
      mediaType: 'application/vnd.apache.parquet',
      path: 'analytics/flickr_geo_clusters.parquet',
      sizeBytes: 22_573,
      sha256: 'cba4651b967fae15f586e760859fb11ff608a603f792e338c7661d5563130b35',
      recordCount: 77,
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    },
  ],
  candidateDistributionOnly: true,
  scientificClaimAllowed: false,
}

describe('FlickrWorkloadMap', () => {
  it('keeps the worker stopped until requested and exposes truthful summary states', async () => {
    const execute = vi.fn().mockResolvedValue(result)
    render(
      <FlickrWorkloadMap facade={facade} replay={facade.replay} execute={execute} />,
    )

    expect(execute).not.toHaveBeenCalled()
    const mapSection = document.querySelector('.geographic-workload')
    expect(mapSection).toHaveAttribute('data-map-purpose', 'flickr-operational-workload')
    expect(mapSection).toHaveAttribute('data-evidence-semantics', 'candidate-distribution-only')
    expect(mapSection).toHaveAttribute('data-scientific-claim-allowed', 'false')
    expect(screen.getByText('Cluster payload not yet queried')).toBeInTheDocument()
    expect(screen.getByText('Candidate distribution only')).toBeInTheDocument()
    expect(screen.getByText('Candidate clusters').parentElement).toHaveTextContent('76')
    expect(screen.getByText('No-geo').parentElement).toHaveTextContent('Verify locally')
    expect(screen.getByText('Unassigned geotags').parentElement).toHaveTextContent('792')
    expect(screen.getByText('Outliers').parentElement).toHaveTextContent('707')
    expect(screen.getByText('Reference shortfalls').parentElement).toHaveTextContent(
      '247 source · 490 review',
    )
    expect(screen.getByText('Review density').parentElement).toHaveTextContent('Unavailable')

    fireEvent.click(screen.getByRole('button', { name: 'Load verified workload map' }))
    expect(await screen.findByText('Candidate workload plotted locally')).toBeInTheDocument()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(
      execute.mock.calls[0]?.[0].artifacts.map(
        (artifact: { readonly artifactId: string }) => artifact.artifactId,
      ),
    ).toEqual([
      'biominer-flickr-geo-assignments-parquet',
      'biominer-flickr-geo-clusters-parquet',
    ])
    expect(screen.getByText('No-geo').parentElement).toHaveTextContent('0')
  })

  it('plots cluster workload, supports selection, and provides a complete table', async () => {
    render(
      <FlickrWorkloadMap
        facade={facade}
        replay={facade.replay}
        execute={vi.fn().mockResolvedValue(result)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load verified workload map' }))

    const map = await screen.findByRole('img', {
      name: '2 candidate workload cluster centroids on an equirectangular coordinate plane',
    })
    expect(map.querySelectorAll('circle[data-cluster="candidate-workload"]')).toHaveLength(2)
    expect(map.querySelectorAll('circle[data-selected="true"]')).toHaveLength(1)
    expect(screen.getByText(/Marker area encodes candidate-record workload/)).toHaveTextContent(
      'selected outline is not an uncertainty ring',
    )
    const selector = screen.getByLabelText('Inspect candidate cluster')
    expect(within(selector).getAllByRole('option')).toHaveLength(2)
    fireEvent.change(selector, { target: { value: 'geo:second' } })
    const inspection = screen.getByRole('heading', { name: 'Selected workload cluster' }).parentElement
    expect(inspection).toHaveTextContent('geo:second')
    expect(inspection).toHaveTextContent('-30.000000, 140.000000')
    expect(inspection).toHaveTextContent('25 records')
    expect(inspection).toHaveTextContent('8.250 km · not uncertainty')
    expect(inspection).toHaveTextContent('Unavailable — no H3 output committed')
    expect(inspection).toHaveTextContent(
      'Unavailable — No materialized review queue or geographic review assignments are committed.',
    )

    fireEvent.click(screen.getByText('Read all 2 candidate clusters as a table'))
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(2)
  })
})
