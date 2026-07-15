import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type ReplayEvidence,
} from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { ObservatoryWorkspace } from './ObservatoryWorkspace'
import type { AnalyticsOperationId, AnalyticsReplayResult } from './analyticsReplay'

let replay: ReplayEvidence
let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
  replay = facade.replay
})

describe('ObservatoryWorkspace', () => {
  it('renders the verified fixture as an accessible textual pipeline', () => {
    render(<ObservatoryWorkspace facade={facade} replay={replay} replayLaunch={null} />)

    expect(screen.getByRole('heading', { name: 'Evidence pipeline' })).toBeInTheDocument()
    const pipeline = screen.getByRole('list', { name: 'Evidence pipeline stages' })
    expect(within(pipeline).getAllByRole('listitem')).toHaveLength(13)
    expect(within(pipeline).getByText('76,485')).toBeInTheDocument()
    expect(within(pipeline).getByText('13,501')).toBeInTheDocument()
    expect(within(pipeline).getByText(/butterflies-v2-20260712/u)).toBeInTheDocument()
    expect(within(pipeline).getAllByText('Unavailable')).toHaveLength(5)
    expect(screen.getByText(/Zero means the verified fixture records no output/u)).toBeInTheDocument()
  })

  it('runs an injected analytics executor only after explicit activation', async () => {
    const operationIds = [
      'physical-query-deduplication',
      'logical-association-fan-back',
      'source-id-hash-join',
      'duplicate-anti-join',
      'spatial-cluster-join',
      'candidate-set-union',
      'stage-aggregation',
      'evidence-assembly',
    ] as const satisfies readonly AnalyticsOperationId[]
    const queryHitsArtifact = {
      artifactId: 'biominer-flickr-query-hits-parquet',
      mediaType: 'application/vnd.apache.parquet',
      path: 'analytics/flickr_query_hits.parquet',
      sizeBytes: 222_190,
      sha256: '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
      recordCount: 76_485,
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
      parquetRowGroups: 1,
    } as const
    const result: AnalyticsReplayResult = {
      backend: 'duckdb-wasm-parquet',
      packageVersion: '1.32.0',
      engineVersion: 'v1.4.3',
      registeredArtifactCount: 4,
      registeredBytes: 1_647_550,
      operationCount: 8,
      operations: operationIds.map((operationId, index) => ({
        operationId,
        label: operationId.replaceAll('-', ' '),
        inputRelation: `input_${index}`,
        outputRelation: `output_${index}`,
        inputRows: index + 1,
        outputRows: index + 1,
        whatOccurred: `Measured operation ${index}`,
        why: 'To preserve inspectable evidence lineage.',
        userConsequence: 'The result remains reviewable.',
        keys: ['source_id'],
        cardinality: 'One input record to one output record.',
        nullRows: 0,
        sourceArtifactBytes: 222_190,
        parquetRowGroups: 1,
        cache: 'fresh DuckDB worker memory; no persistent cache',
        artifacts: [queryHitsArtifact],
        planOperators: operationId === 'source-id-hash-join' ? ['HASH_JOIN'] : [],
        explainPlan: `plan ${index}`,
        elapsedMilliseconds: 1,
      })),
      workAvoided: {
        measuredMetricCount: 2,
        notInstrumentedMetricCount: 5,
        metrics: [
          {
            metricId: 'requests-avoided',
            label: 'Requests avoided',
            status: 'measured',
            value: 62_984,
            unit: 'request-equivalent query hits',
            baselineRows: 76_485,
            retainedRows: 13_501,
            method: 'Measured deduplication.',
            sourceArtifacts: [queryHitsArtifact],
          },
          {
            metricId: 'duplicate-hits-collapsed',
            label: 'Duplicate hits collapsed',
            status: 'measured',
            value: 62_984,
            unit: 'query hits',
            baselineRows: 76_485,
            retainedRows: 13_501,
            method: 'Measured canonicalization.',
            sourceArtifacts: [queryHitsArtifact],
          },
          ...(
            [
              ['downloads-avoided', 'Downloads avoided'],
              ['inference-avoided', 'Inference avoided'],
              ['embeddings-reused', 'Embeddings reused'],
              ['completed-items-anti-joined', 'Completed items anti-joined'],
              [
                'remote-handoff-reads-avoided',
                'Remote handoff reads avoided through local cache',
              ],
            ] as const
          ).map(([metricId, label]) => ({
            metricId,
            label,
            status: 'not_instrumented' as const,
            value: null,
            unit: 'not measured',
            baselineRows: null,
            retainedRows: null,
            method: 'No fixture counter is available.',
            sourceArtifacts: [],
          })),
        ],
        estimatesShown: false,
      },
      matrixScoringExecuted: false,
      scientificClaimAllowed: false,
    }
    const executeReplay = vi.fn().mockResolvedValue(result)
    render(
      <ObservatoryWorkspace
        facade={facade}
        replay={replay}
        replayLaunch={null}
        executeReplay={executeReplay}
      />,
    )

    expect(executeReplay).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Run verified analytics' }))

    expect(await screen.findByText('Eight analytical operations completed')).toBeInTheDocument()
    expect(executeReplay).toHaveBeenCalledTimes(1)
    const workAvoided = screen.getByRole('list', { name: 'Work avoided measurements' })
    expect(workAvoided.children).toHaveLength(7)
    expect(screen.getByRole('meter', { name: 'Requests avoided' })).toHaveAttribute(
      'aria-valuenow',
      '62984',
    )
    expect(screen.getByRole('meter', { name: 'Requests avoided' })).toHaveAttribute(
      'aria-valuetext',
      '62,984 request-equivalent query hits',
    )
    expect(within(workAvoided).getAllByText('Not instrumented')).toHaveLength(5)
    expect(
      within(screen.getByRole('list', { name: 'Research operation explanations' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(8)
    expect(screen.getAllByText('What occurred')).toHaveLength(8)

    const researchTab = screen.getByRole('tab', { name: 'Research mode' })
    researchTab.focus()
    fireEvent.keyDown(researchTab, { key: 'ArrowRight' })
    const engineeringTab = screen.getByRole('tab', { name: 'Engineering mode' })
    expect(engineeringTab).toHaveAttribute('aria-selected', 'true')
    const engineeringOperations = screen.getByRole('list', {
      name: 'Completed analytical operations',
    })
    expect(engineeringOperations.children).toHaveLength(8)
    expect(within(engineeringOperations).getAllByText('Checksum')).toHaveLength(8)
    expect(within(engineeringOperations).getAllByText('Producer SHA')).toHaveLength(8)
    expect(screen.getByText('Not executed', { exact: true })).toBeInTheDocument()
  })
})
