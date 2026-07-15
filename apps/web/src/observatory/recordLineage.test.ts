import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildPipelineStages } from './pipelineModel'
import { buildRecordLineage, traceRecordLineage } from './recordLineage'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('record lineage', () => {
  it('projects every contributing stage and verified artifact without inventing missing evidence', () => {
    const lineage = buildRecordLineage(replay, buildPipelineStages(replay))

    expect(lineage.record).toMatchObject({
      recordId: 'papilio-demoleus-pilot-awaiting-review',
      state: 'awaiting_human_review',
      scientificClaimAllowed: false,
    })
    expect(lineage.stages).toHaveLength(13)
    expect(lineage.artifacts).toHaveLength(12)
    expect(lineage.artifacts.every(({ verified }) => verified)).toBe(true)
    expect(lineage.stages.find(({ stageId }) => stageId === 'yoloe-routing')).toMatchObject({
      artifactIds: [],
      contributionKind: 'missing_evidence_state',
    })
    expect(lineage.artifacts.find(({ artifactId }) => artifactId === 'run-summary')).toMatchObject({
      contributionKind: 'record_frame',
      stageIds: [],
    })
    expect(
      lineage.artifacts.find(({ artifactId }) => artifactId === 'query-definitions'),
    ).toMatchObject({
      contributionKind: 'stage_input',
      stageIds: ['trusted-registry', 'query-compilation'],
    })
  })

  it('traces the selected final replay record through the complete upstream closure', () => {
    const lineage = buildRecordLineage(replay, buildPipelineStages(replay))
    const selection = traceRecordLineage(lineage, lineage.record.recordId)

    expect(selection.stageIds.size).toBe(13)
    expect(selection.artifactIds.size).toBe(12)
    expect(selection.stageIds.has('final-evidence')).toBe(true)
    expect(selection.stageIds.has('yoloe-routing')).toBe(true)
    expect(selection.artifactIds.has('run-summary')).toBe(true)
    expect(selection.artifactIds.has('selective-decision-metadata')).toBe(true)
    expect(() => traceRecordLineage(lineage, 'invented-final-record')).toThrow(
      'Unknown final replay record',
    )
  })
})
