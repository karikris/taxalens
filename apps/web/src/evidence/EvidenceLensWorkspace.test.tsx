import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type ReplayEvidence,
} from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { EvidenceLensWorkspace } from './EvidenceLensWorkspace'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'

let facade: EvidenceFacade
let replay: ReplayEvidence

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
  replay = facade.replay
})

const result: DiscoveryProvenanceResult = {
  backend: 'duckdb-wasm-parquet',
  packageVersion: '1.32.0',
  engineVersion: 'v1.4.3',
  source: 'flickr',
  sourcePhotoId: '55081300254',
  sourceId: 'flickr:55081300254',
  sourceRecordHash: 'sha256:ddce85e192e3fe8548a75681f0dff6b6f0d00bb818eca891521faa0197274e40',
  coordinateQuality: 'flickr_street',
  coordinate: {
    latitude: 59.366308,
    longitude: 18.031366,
    accuracyLevel: 16,
    source: 'flickr_search_geo',
    warning: null,
    uncertaintyMeters: null,
  },
  cluster: {
    id: 'geo:be72642ae1a67685c5a68725',
    targetAcceptedTaxonKey: 'gbif:1938069',
    distanceToMedoidKm: 43.36547427503527,
    assignmentMethod: 'coarse_cell',
    fallbackScope: null,
    outlier: false,
    memberImageCount: 437,
    memberCellCount: 7,
    centroidLatitude: 59.36977516221015,
    centroidLongitude: 17.15959829013883,
    radiusP95Km: 52.120425429532695,
    candidateDistributionOnly: true,
  },
  associationCount: 2,
  associations: [
    {
      queryHash: 'a'.repeat(64),
      queryTier: 'common_name:high:tags',
      rank: 'common_name',
      keyword: 'lime swallowtail',
      trustTier: 'high',
      searchField: 'tags',
    },
    {
      queryHash: 'b'.repeat(64),
      queryTier: 'scientific_name:high:text',
      rank: 'scientific_name',
      keyword: 'Papilio demoleus',
      trustTier: 'high',
      searchField: 'text',
    },
  ],
  artifacts: [
    {
      artifactId: 'biominer-flickr-query-hits-parquet',
      mediaType: 'application/vnd.apache.parquet',
      path: 'analytics/flickr_query_hits.parquet',
      sizeBytes: 222_190,
      sha256: '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
      recordCount: 76_485,
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    },
  ],
  selectionMethod: 'most-query-associations-then-source-id',
  scientificClaimAllowed: false,
}

describe('EvidenceLensWorkspace', () => {
  it('keeps DuckDB stopped until explicit inspection and preserves unavailable source fields', async () => {
    const executeProvenance = vi.fn().mockResolvedValue(result)
    render(
      <EvidenceLensWorkspace
        facade={facade}
        replay={replay}
        executeProvenance={executeProvenance}
      />,
    )

    expect(executeProvenance).not.toHaveBeenCalled()
    expect(screen.getByText('Discovery query not yet executed')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Licensed source image unavailable' })).toHaveTextContent(
      '0 included · 0 licensed',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Inspect verified discovery record' }))

    expect(await screen.findByRole('heading', { name: 'Source flickr:55081300254' })).toBeInTheDocument()
    expect(executeProvenance).toHaveBeenCalledTimes(1)
    expect(executeProvenance.mock.calls[0]?.[0].artifacts).toHaveLength(4)
    expect(screen.getByText(result.sourceRecordHash)).toBeInTheDocument()
    expect(screen.getByText(/canonical source hash identifies one source payload/u)).toBeInTheDocument()
    expect(screen.getByText('Creator').parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText('Licence').parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText('Attribution').parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText('Duplicate group').parentElement).toHaveTextContent(
      'duplicate relationship rows are unavailable',
    )

    fireEvent.click(screen.getByText('Inspect all 2 query associations'))
    const associations = screen.getByRole('list', { name: 'Discovery query associations' })
    expect(within(associations).getAllByRole('listitem')).toHaveLength(2)
    expect(within(associations).getByText('lime swallowtail')).toBeInTheDocument()
    expect(within(associations).getByText('Papilio demoleus')).toBeInTheDocument()
    expect(within(associations).getByText('common name')).toBeInTheDocument()
    expect(within(associations).getAllByText('high')).toHaveLength(2)
  })
})
