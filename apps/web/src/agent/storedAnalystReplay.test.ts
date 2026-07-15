import { beforeAll, describe, expect, it } from 'vitest'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type JsonValue,
} from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import {
  loadStoredAnalystReplay,
  StoredAnalystReplayError,
} from './storedAnalystReplay'

let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
})

describe('loadStoredAnalystReplay', () => {
  it('loads a checksum-verified run, replays its tool result, and preserves source links', async () => {
    const trace = await loadStoredAnalystReplay(facade)

    expect(trace).toMatchObject({
      mode: 'stored_replay',
      model: 'gpt-5.6-sol',
      source: {
        kind: 'stored_replay',
        traceId: 'papilio-target-resolution-stored-replay',
        requestArtifactId: 'stored-analyst-request',
        responseArtifactId: 'stored-analyst-run',
        storedOutputOnly: true,
        liveRequestExecuted: false,
        credentialsRequired: false,
      },
      request: {
        kind: 'evidence_explanation',
        text: 'What target does this verified replay resolve?',
      },
    })
    expect(trace?.tools).toHaveLength(1)
    expect(trace?.tools[0]).toMatchObject({
      name: 'resolve_taxon',
      arguments: { query: 'Papilio demoleus' },
      result: {
        summary: 'Papilio demoleus resolves to gbif:1938069.',
      },
    })
    expect(trace?.artifacts.map(({ artifactId }) => artifactId)).toEqual([
      'query-definitions',
      'stored-analyst-request',
      'stored-analyst-run',
    ])
    expect(JSON.stringify(trace)).not.toMatch(
      /"encrypted_content":|"rawResponseItems":|must never/iu,
    )
  })

  it('returns no session when the verified bundle declares no stored trace', async () => {
    const withoutTrace = overrideStoredTraces(() => [])

    await expect(loadStoredAnalystReplay(withoutTrace)).resolves.toBeUndefined()
  })

  it('rejects private fields, changed deterministic results, and changed target identity', async () => {
    const source = facade.loadStoredOpenAIReplay()[0]
    expect(source).toBeDefined()

    const privateRun = structuredClone(source!.responseArtifact.value) as Record<string, unknown>
    privateRun.privateReasoning = 'must never be rendered'

    const changedResult = structuredClone(source!.responseArtifact.value) as {
      toolResults: { summary: string }[]
    }
    changedResult.toolResults[0]!.summary = 'A different stored result.'

    const changedRequest = structuredClone(source!.requestArtifact.value) as {
      target: { scientificName: string }
    }
    changedRequest.target.scientificName = 'Papilio xuthus'

    const invalidFacades = [
      overrideStoredTraces((traces) => [
        {
          ...traces[0]!,
          responseArtifact: {
            ...traces[0]!.responseArtifact,
            value: privateRun as unknown as JsonValue,
          },
        },
      ]),
      overrideStoredTraces((traces) => [
        {
          ...traces[0]!,
          responseArtifact: {
            ...traces[0]!.responseArtifact,
            value: changedResult as unknown as JsonValue,
          },
        },
      ]),
      overrideStoredTraces((traces) => [
        {
          ...traces[0]!,
          requestArtifact: {
            ...traces[0]!.requestArtifact,
            value: changedRequest as unknown as JsonValue,
          },
        },
      ]),
    ]

    for (const invalidFacade of invalidFacades) {
      await expect(loadStoredAnalystReplay(invalidFacade)).rejects.toBeInstanceOf(
        StoredAnalystReplayError,
      )
    }
  })
})

function overrideStoredTraces(
  replacement: (
    traces: ReturnType<EvidenceFacade['loadStoredOpenAIReplay']>,
  ) => ReturnType<EvidenceFacade['loadStoredOpenAIReplay']>,
): EvidenceFacade {
  return new Proxy(facade, {
    get(target, property, receiver) {
      if (property === 'loadStoredOpenAIReplay') {
        return () => replacement(target.loadStoredOpenAIReplay())
      }
      const value: unknown = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
