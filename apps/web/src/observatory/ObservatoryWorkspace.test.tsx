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
        planOperators: operationId === 'source-id-hash-join' ? ['HASH_JOIN'] : [],
        explainPlan: `plan ${index}`,
        elapsedMilliseconds: 1,
      })),
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
    expect(
      within(screen.getByRole('list', { name: 'Completed analytical operations' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(8)
    expect(screen.getByText('Not executed', { exact: true })).toBeInTheDocument()
  })
})
