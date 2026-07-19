import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createAnalystRunFixture } from '../test/agentFixtures'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildPublicAgentTrace, PublicAgentTraceError } from './agentTraceModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildPublicAgentTrace', () => {
  it('projects only public request, plan, tools, outputs, artifacts, answer, and budgets', () => {
    const run = createAnalystRunFixture(replay)
    const trace = buildPublicAgentTrace(
      {
        mode: 'live',
        requestKind: 'evidence_explanation',
        request: 'What target does this replay resolve?',
        run,
      },
      replay,
    )

    expect(trace).toMatchObject({
      schemaVersion: 'taxalens-public-agent-trace:v1.0.0',
      mode: 'live',
      model: 'configured-model',
      reasoningEffort: 'medium',
      responseStatus: 'completed',
      request: {
        kind: 'evidence_explanation',
        text: 'What target does this replay resolve?',
      },
      budgets: {
        maxToolCalls: 4,
        usedToolCalls: 1,
        maxResponseTurns: 3,
        usedResponseTurns: 2,
        exhausted: false,
      },
    })
    expect(trace.plan).toHaveLength(1)
    expect(trace.tools).toHaveLength(1)
    expect(trace.tools[0]).toMatchObject({
      sequence: 1,
      name: 'resolve_taxon',
      arguments: { query: 'Papilio demoleus' },
      artifactIds: ['query-definitions'],
    })
    expect(trace.artifacts).toHaveLength(1)
    expect(trace.artifacts[0]).toMatchObject({
      artifactId: 'query-definitions',
      verified: true,
    })
    expect(trace.answer).toBe(run.output.answer)
    expect(trace.privacy).toEqual({
      rawResponseItemsCollected: false,
      privateReasoningCollected: false,
      chainOfThoughtAvailable: false,
      statement:
        'Only the public request, public plan, validated tool exchange, structured output, answer, and measured budgets are retained.',
    })
    expect(JSON.stringify(trace)).not.toMatch(/encrypted_content|chain-of-thought|reasoning item/iu)
    expect(Object.isFrozen(trace)).toBe(true)
  })

  it('rejects mismatched tool receipts, unknown citations, and changed replay targets', () => {
    const run = createAnalystRunFixture(replay)
    const mismatchedReceipt = {
      ...run,
      toolReceipts: [
        { ...run.toolReceipts[0]!, resultStatus: 'blocked' as const },
      ],
    }
    const unknownCitation = {
      ...run,
      output: { ...run.output, artifactIds: ['not-an-artifact'] },
    }
    const changedTarget = {
      ...run,
      output: {
        ...run.output,
        target: { ...run.output.target, scientificName: 'Papilio xuthus' },
      },
    }

    for (const invalidRun of [mismatchedReceipt, unknownCitation, changedTarget]) {
      expect(() =>
        buildPublicAgentTrace(
          {
            mode: 'live',
            requestKind: 'evidence_explanation',
            request: 'Explain the replay target.',
            run: invalidRun,
          },
          replay,
        ),
      ).toThrow(PublicAgentTraceError)
    }
  })
})
