import { describe, expect, it, vi } from 'vitest'

import type { JudgeBundleContract } from '../../../../packages/contracts/src/judge_bundle_contract'
import {
  committedFixtureFiles,
  committedJudgeBundle,
  createCommittedFixtureFetcher,
} from '../test/fixtures'
import {
  EvidenceFacadeError,
  loadEvidenceFacade,
  replayEvidenceContract,
} from './evidenceFacade'

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new Error('Test fixture is not JSON-compatible')
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

async function parquetFixtureOverrides(): Promise<
  Readonly<Record<string, string | Uint8Array<ArrayBuffer>>>
> {
  const manifest = structuredClone(committedJudgeBundle) as unknown as JudgeBundleContract
  const parquetBytes = new TextEncoder().encode('PAR1-taxalens-test')
  const artifactId = 'run-summary-parquet'
  manifest.artifact_inventory.push({
    artifact_id: artifactId,
    path: 'data/run_summary.parquet',
    media_type: 'application/vnd.apache.parquet',
    role: 'run_summary',
    sha256: await sha256Hex(parquetBytes),
    bytes: parquetBytes.byteLength,
    record_count: 0,
    schema_version: null,
    source_repository: 'karikris/TaxaLens',
    source_commit: replayEvidenceContract.taxalensSha,
    required: false,
  })
  manifest.sections.run_summary.artifact_ids.push(artifactId)
  const rightsItem = manifest.rights.items[0]
  const attributionEntry = manifest.attribution.entries[0]
  if (rightsItem === undefined || attributionEntry === undefined) {
    throw new Error('Committed fixture needs rights and attribution entries')
  }
  rightsItem.artifact_ids.push(artifactId)
  attributionEntry.artifact_ids.push(artifactId)
  manifest.expected_ui_counts.artifact_count = manifest.artifact_inventory.length
  manifest.checksums.inventory_sha256 = await sha256Hex(
    new TextEncoder().encode(canonicalJson(manifest.artifact_inventory)),
  )
  const files = [...manifest.artifact_inventory]
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    .map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 }))
  manifest.checksums.payload_root_sha256 = await sha256Hex(
    new TextEncoder().encode(canonicalJson({ files })),
  )
  return {
    'judge_bundle.json': JSON.stringify(manifest),
    'data/run_summary.parquet': parquetBytes,
  }
}

describe('loadEvidenceFacade', () => {
  it('validates the committed contract and verifies every artifact in deterministic order', async () => {
    const fetcher = vi.fn(createCommittedFixtureFetcher())

    const facade = await loadEvidenceFacade(new AbortController().signal, fetcher)

    expect(facade.replay.bundleId).toBe(replayEvidenceContract.bundleId)
    expect(facade.replay.target.scientificName).toBe('Papilio demoleus')
    expect(facade.replay.artifactCount).toBe(17)
    expect(facade.replay.verifiedArtifactCount).toBe(17)
    expect(facade.replay.unavailableSections).toHaveLength(6)
    expect(facade.replay.sections.yoloe_evidence.status).toBe('unavailable')
    expect(facade.replay.mission).toMatchObject({
      queryPolicy: {
        queryCount: 22,
        queriedSpeciesCount: 22,
        defaultRetrievalPolicy: 'global_then_assign_to_flickr_clusters',
        occurrenceSearchCeiling: 100000,
      },
      candidatePolicy: {
        candidateCount: 5,
        minimumPerSpecies: 20,
        maximumPerSpecies: 50,
      },
      referenceRequirements: {
        eligibleSourceMediaCount: 838,
        humanVerifiedSourceMediaCount: 0,
        sourceCandidateShortfall: 247,
        humanVerifiedShortfall: 490,
      },
      budgets: {
        materializedRequestCount: 314,
        localBuildVerificationMaxImages: 5,
      },
    })
    expect(facade.replay.mission.regions).toHaveLength(8)
    expect(facade.replay.mission.prerequisiteGates).toHaveLength(4)
    expect(facade.replay.mission.pipelineStages).toHaveLength(8)
    expect(facade.replay.mission.pipelineStages[4]).toMatchObject({
      stageId: 'yoloe-detection',
      status: 'unavailable',
      recordCount: 0,
      scientificClaimAllowed: false,
    })
    expect(facade.replay.verification).toMatchObject({
      inventoryChecksumVerified: true,
      payloadRootChecksumVerified: true,
      artifactChecksumsVerified: true,
      dataMode: 'verified-json-fallback',
      fallbackReason: 'parquet_unavailable',
      wasmStarted: false,
    })

    const requestedArtifacts = fetcher.mock.calls.slice(1).map(([input]) => {
      const url = input instanceof Request ? input.url : input.toString()
      return new URL(url, window.location.href).pathname.replace(/^\//u, '')
    })
    const expectedArtifacts = Object.keys(committedFixtureFiles)
      .filter((path) => path !== 'judge_bundle.json')
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    expect(requestedArtifacts).toEqual(expectedArtifacts)

    const runSummary = await facade.loadSection('run_summary')
    expect(runSummary).toMatchObject({
      status: 'available',
      mode: 'json-fallback',
      fallbackReason: 'parquet_unavailable',
    })
    const unavailable = await facade.loadSection('yoloe_evidence')
    expect(unavailable).toMatchObject({ status: 'unavailable', mode: 'unavailable' })
  })

  it('stops before display when an artifact has the right length but the wrong checksum', async () => {
    const original = committedFixtureFiles['data/run_summary.json']
    if (original === undefined) {
      throw new Error('Committed run summary fixture is missing')
    }
    const tampered = original.replace('awaiting_human_review', 'awaiting_human_rexiew')

    await expect(
      loadEvidenceFacade(
        new AbortController().signal,
        createCommittedFixtureFetcher({ 'data/run_summary.json': tampered }),
      ),
    ).rejects.toThrow('run-summary checksum verification failed')
  })

  it('rejects a stale manifest through the authoritative runtime schema', async () => {
    const stale = { ...committedJudgeBundle, schema_version: 'future-bundle:v2' }

    await expect(
      loadEvidenceFacade(
        new AbortController().signal,
        createCommittedFixtureFetcher({ 'judge_bundle.json': JSON.stringify(stale) }),
      ),
    ).rejects.toThrow('runtime schema validation')
  })

  it('uses verified JSON when Parquet or its Wasm reader is unavailable', async () => {
    const facade = await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(await parquetFixtureOverrides()),
    )

    await expect(facade.loadSection('run_summary')).resolves.toMatchObject({
      mode: 'json-fallback',
      fallbackReason: 'wasm_unavailable',
    })
    await expect(
      facade.loadSection('run_summary', async () => {
        throw new Error('Wasm worker unavailable')
      }),
    ).resolves.toMatchObject({
      mode: 'json-fallback',
      fallbackReason: 'parquet_wasm_failed',
    })
    await expect(
      facade.loadSection('run_summary', async (artifact) => ({ bytes: artifact.bytes.byteLength })),
    ).resolves.toMatchObject({
      mode: 'parquet-wasm',
      fallbackReason: null,
      value: { bytes: 18 },
    })
  })

  it('reports facade-specific errors', () => {
    expect(new EvidenceFacadeError('stopped')).toMatchObject({
      name: 'EvidenceFacadeError',
      message: 'stopped',
    })
  })
})
