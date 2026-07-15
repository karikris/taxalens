import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type EvidenceFacade } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { QueryYieldAnalysis } from './QueryYieldAnalysis'
import type { QueryYieldRankRow, QueryYieldResult, TaxonomicRank } from './queryYield'

let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
})

const measured: Readonly<Record<'family' | 'genus' | 'species', readonly number[]>> = {
  family: [16_636, 5_658, 2, 68],
  genus: [41_243, 6_773, 1, 165],
  species: [3_458, 1_063, 3, 19],
}

function row(rank: TaxonomicRank, label: string): QueryYieldRankRow {
  const values = rank === 'family' || rank === 'genus' || rank === 'species'
    ? measured[rank]
    : undefined
  return {
    rank,
    label,
    status: values === undefined ? 'unavailable' : 'measured',
    sourceTier:
      values === undefined ? null : rank === 'species' ? 'scientific_name:*:*' : `${rank}:*:*`,
    hitCount: values?.[0] ?? null,
    uniqueImageCount: values?.[1] ?? null,
    representedSearchTermCount: values?.[2] ?? null,
    representedQueryHashCount: values?.[3] ?? null,
    logicalQueryCount: null,
    physicalRequestCount: null,
    marginalApiCost: null,
  }
}

const result: QueryYieldResult = {
  backend: 'duckdb-wasm-parquet',
  packageVersion: '1.32.0',
  engineVersion: 'v1.4.3',
  ranks: [
    row('kingdom', 'Kingdom'),
    row('phylum', 'Phylum'),
    row('class', 'Class'),
    row('order', 'Order'),
    row('family', 'Family tier'),
    row('genus', 'Genus tier'),
    row('species', 'Species-scientific tier'),
  ],
  context: {
    hitCount: 15_148,
    uniqueImageCount: 3_681,
    representedSearchTermCount: 145,
    representedQueryHashCount: 304,
    termClassCount: 7,
  },
  queryHitCount: 76_485,
  uniqueImageCount: 13_501,
  globalAdultRouteCount: 0,
  globalEvidenceRecordCount: 0,
  logicalQueriesAvailable: false,
  physicalRequestsAvailable: false,
  marginalApiCostAvailable: false,
  artifact: {
    artifactId: 'biominer-flickr-query-hits-parquet',
    mediaType: 'application/vnd.apache.parquet',
    path: 'analytics/flickr_query_hits.parquet',
    sizeBytes: 222_190,
    sha256: '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
    recordCount: 76_485,
    producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
  },
  scientificClaimAllowed: false,
}

describe('QueryYieldAnalysis', () => {
  it('keeps the worker idle and request/cost measures unavailable until requested', () => {
    const execute = vi.fn().mockResolvedValue(result)
    render(<QueryYieldAnalysis facade={facade} replay={facade.replay} execute={execute} />)

    expect(execute).not.toHaveBeenCalled()
    expect(screen.getByText('Rank slices not yet queried')).toBeInTheDocument()
    expect(screen.getByText('Query hits').parentElement).toHaveTextContent('76,485')
    expect(screen.getByText('Unique source photos').parentElement).toHaveTextContent('13,501')
    expect(screen.getByText('Physical requests').parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText('Marginal API cost').parentElement).toHaveTextContent('Unavailable')
  })

  it('renders three measured tiers, four unavailable ranks, and unassigned context', async () => {
    const execute = vi.fn().mockResolvedValue(result)
    render(<QueryYieldAnalysis facade={facade} replay={facade.replay} execute={execute} />)
    fireEvent.click(screen.getByRole('button', { name: 'Measure verified discovery yield' }))

    expect(await screen.findByText('Measured rank slices ready')).toBeInTheDocument()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]?.[0].artifact.artifactId).toBe(
      'biominer-flickr-query-hits-parquet',
    )
    const table = screen.getByRole('table')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(7)
    expect(within(table).getByText('Family tier').closest('tr')).toHaveTextContent('16,636')
    expect(within(table).getByText('Genus tier').closest('tr')).toHaveTextContent('41,243')
    expect(within(table).getByText('Species-scientific tier').closest('tr')).toHaveTextContent(
      '3,458',
    )
    expect(table.querySelectorAll('tr[data-rank-status="unavailable"]')).toHaveLength(4)

    const context = screen.getByRole('heading', { name: 'Unassigned context tiers' }).parentElement
      ?.parentElement
    expect(context).toHaveTextContent('15,148')
    expect(context).toHaveTextContent('3,681')
    expect(context).toHaveTextContent('145')
    expect(context).toHaveTextContent('304')
    expect(context).toHaveTextContent('7')
    fireEvent.click(screen.getByText('Inspect query-yield provenance'))
    expect(screen.getByText('biominer-flickr-query-hits-parquet')).toBeInTheDocument()
    expect(screen.getByText(result.artifact.sha256)).toBeInTheDocument()
  })
})
