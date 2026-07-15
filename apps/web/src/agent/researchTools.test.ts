import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import {
  executeResearchTool,
  RESEARCH_TOOL_DEFINITIONS,
  RESEARCH_TOOL_NAMES,
  ResearchToolError,
  type ResearchToolName,
  type ResearchToolResult,
} from './researchTools'

let replay: ReplayEvidence

const VALID_CALLS: Readonly<Record<ResearchToolName, Readonly<Record<string, unknown>>>> = {
  resolve_taxon: { query: 'Papilio demoleus' },
  inspect_query_coverage: { accepted_taxon_key: 'gbif:1938069' },
  estimate_mission: { accepted_taxon_key: 'gbif:1938069', candidate_limit: 5 },
  inspect_stage: { stage_id: 'compact-metadata-import' },
  trace_lineage: { record_id: 'papilio-demoleus-pilot-awaiting-review' },
  compare_candidates: { record_id: 'papilio-demoleus-pilot-awaiting-review' },
  explain_decision: { record_id: 'papilio-demoleus-pilot-awaiting-review' },
  inspect_reference_status: { accepted_taxon_key: 'gbif:1938069' },
  export_evidence: { record_id: 'papilio-demoleus-pilot-awaiting-review' },
}

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('research evidence tool registry', () => {
  it('publishes nine strict definitions with closed input and output schemas', () => {
    expect(RESEARCH_TOOL_DEFINITIONS.map(({ name }) => name)).toEqual(RESEARCH_TOOL_NAMES)
    expect(RESEARCH_TOOL_DEFINITIONS).toHaveLength(9)

    for (const definition of RESEARCH_TOOL_DEFINITIONS) {
      expect(definition).toMatchObject({
        type: 'function',
        strict: true,
        parameters: { type: 'object', additionalProperties: false },
        output_schema: { type: 'object', additionalProperties: false },
      })
      expect(definition.parameters.required).toEqual(Object.keys(definition.parameters.properties))
      expect(definition.output_schema.required).toEqual(
        Object.keys(definition.output_schema.properties),
      )
      expect(definition.output_schema.properties.tool).toEqual({
        type: 'string',
        const: definition.name,
      })
      expect(definition.allowed_callers).toEqual(
        definition.name === 'export_evidence'
          ? ['direct']
          : ['direct', 'programmatic'],
      )
      expect(Object.isFrozen(definition)).toBe(true)
    }
  })

  it('executes every tool with bounded, immutable, verified artifact citations', async () => {
    const inventory = new Set(replay.artifactInventory.map(({ artifactId }) => artifactId))
    const results = await executeAllTools()

    expect(results.map(({ status }) => status)).toEqual([
      'available',
      'partial',
      'partial',
      'available',
      'partial',
      'partial',
      'blocked',
      'blocked',
      'available',
    ])
    for (const result of results) {
      expect(result.artifactIds.length).toBeGreaterThan(0)
      expect(result.artifactIds.length).toBeLessThanOrEqual(32)
      expect(result.artifactIds.every((artifactId) => inventory.has(artifactId))).toBe(true)
      expect(
        result.records.every(({ artifactIds }) =>
          artifactIds.length > 0 && artifactIds.every((artifactId) => inventory.has(artifactId)),
        ),
      ).toBe(true)
      expect(result.facts.length).toBeLessThanOrEqual(48)
      expect(result.records.length).toBeLessThanOrEqual(64)
      expect(result.scientificClaimAllowed).toBe(false)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.artifactIds)).toBe(true)
    }
  })

  it('reports exact replay evidence without promoting search candidates', async () => {
    const coverage = await executeResearchTool(
      'inspect_query_coverage',
      VALID_CALLS.inspect_query_coverage,
      replay,
    )
    const mission = await executeResearchTool(
      'estimate_mission',
      VALID_CALLS.estimate_mission,
      replay,
    )
    const comparison = await executeResearchTool(
      'compare_candidates',
      VALID_CALLS.compare_candidates,
      replay,
    )
    const references = await executeResearchTool(
      'inspect_reference_status',
      VALID_CALLS.inspect_reference_status,
      replay,
    )

    expect(factValues(coverage)).toMatchObject({
      query_definition_count: 22,
      physical_query_definition_count: 22,
      observed_request_count: 314,
      query_hit_count: 76_485,
      canonical_photo_count: 13_501,
    })
    expect(coverage.limitations.join(' ')).toContain('not taxonomic observations')
    expect(factValues(mission)).toMatchObject({
      mode: 'replay',
      launches_work: false,
      candidate_limit: 5,
      phase15_authorized: false,
    })
    expect(comparison.records).toHaveLength(6)
    expect(factValues(comparison)).toMatchObject({ scored_candidate_count: 0 })
    expect(factValues(references)).toMatchObject({
      eligible_source_media_count: 838,
      human_verified_source_media_count: 0,
      source_candidate_shortfall: 247,
      human_verified_shortfall: 490,
    })
  })

  it('returns cited unavailable and blocked results for valid unsupported lookups', async () => {
    const taxon = await executeResearchTool('resolve_taxon', { query: 'Papilio xuthus' }, replay)
    const stage = await executeResearchTool('inspect_stage', { stage_id: 'not-a-stage' }, replay)
    const record = await executeResearchTool(
      'trace_lineage',
      { record_id: 'not-a-record' },
      replay,
    )
    const mission = await executeResearchTool(
      'estimate_mission',
      { accepted_taxon_key: replay.target.acceptedTaxonKey, candidate_limit: 4 },
      replay,
    )

    expect(
      [taxon, stage, record].every(
        (result) => result.status === 'unavailable' && result.artifactIds.length > 0,
      ),
    ).toBe(true)
    expect(mission.status).toBe('blocked')
    expect(factValues(mission)).toMatchObject({
      requested_candidate_limit: 4,
      required_candidate_limit: 5,
    })
  })

  it('rejects unknown tools and malformed or additional arguments', async () => {
    await expect(executeResearchTool('delete_evidence', {}, replay)).rejects.toMatchObject({
      code: 'unknown_tool',
    })
    await expect(executeResearchTool('resolve_taxon', { query: '' }, replay)).rejects.toMatchObject({
      code: 'invalid_arguments',
    })
    await expect(
      executeResearchTool(
        'resolve_taxon',
        { query: 'Papilio demoleus', unexpected: true },
        replay,
      ),
    ).rejects.toBeInstanceOf(ResearchToolError)
    await expect(
      executeResearchTool(
        'estimate_mission',
        { accepted_taxon_key: replay.target.acceptedTaxonKey, candidate_limit: 1.5 },
        replay,
      ),
    ).rejects.toMatchObject({ code: 'invalid_arguments' })
  })

  it('is deterministic and does not use network, wall-clock, or randomness', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const nowSpy = vi.spyOn(Date, 'now')
    const randomSpy = vi.spyOn(Math, 'random')

    const first = await executeAllTools()
    const second = await executeAllTools()

    expect(second).toEqual(first)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    nowSpy.mockRestore()
    randomSpy.mockRestore()
  })
})

async function executeAllTools(): Promise<readonly ResearchToolResult[]> {
  return Promise.all(
    RESEARCH_TOOL_NAMES.map((name) => executeResearchTool(name, VALID_CALLS[name], replay)),
  )
}

function factValues(result: ResearchToolResult): Readonly<Record<string, unknown>> {
  return Object.fromEntries(result.facts.map(({ id, value }) => [id, value]))
}
