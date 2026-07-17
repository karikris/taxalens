import { describe, expect, it, vi } from 'vitest'

import {
  JUDGE_BUNDLE_SCHEMA_VERSION,
  JUDGE_BUNDLE_SECTION_NAMES,
  type JudgeBundleArtifact,
  type JudgeBundleContract,
  type JudgeBundleSection,
} from '../../../../packages/contracts/src/judge_bundle_contract'
import { committedJudgeBundle } from '../test/fixtures'
import { migrateJudgeBundleToCurrent, type JsonValue } from './evidenceFacade'
import {
  BundleLoader,
  BundleVerifier,
  PapilioJudgeFixtureValidator,
  TaxaLensProjectFacade,
  type JudgeBundleMigrationResult,
} from './projectFacade'

const descriptor: JudgeBundleArtifact = {
  artifact_id: 'synthetic-summary',
  path: 'artifacts/summary.json',
  media_type: 'application/json',
  role: 'run_summary',
  sha256: 'a'.repeat(64),
  bytes: 11,
  record_count: 1,
  schema_version: 'synthetic-summary:v1.0.0',
  source_repository: 'example/research-project',
  source_commit: '1'.repeat(40),
  required: true,
}

describe('generic project bundle boundary', () => {
  it('separates contract verification, loading and role-based facade reads', async () => {
    const manifest = syntheticManifest()
    const receipt = migrationReceipt()
    const verifyContract = vi.fn(async () => ({ manifest, receipt }))
    const verifySemantics = vi.fn(async (value: JudgeBundleContract) => {
      expect(value.bundle_id).toBe('synthetic-project-bundle')
    })
    const readAsset = vi.fn(async (path: string) =>
      new TextEncoder().encode(path === 'judge_bundle.json' ? '{}' : '{"ok":true}'),
    )
    const verifyArtifact = vi.fn(async (artifact: JudgeBundleArtifact, bytes: Uint8Array) =>
      Object.freeze({ descriptor: artifact, bytes: bytes.slice(), json: { ok: true } as const }),
    )
    const loader = new BundleLoader(
      new BundleVerifier(verifyContract, verifySemantics),
      readAsset,
      () => ({}),
      verifyArtifact,
    )

    const project = await loader.load(new AbortController().signal)

    expect(project).toBeInstanceOf(TaxaLensProjectFacade)
    expect(project.manifest.bundle_id).toBe('synthetic-project-bundle')
    expect(project.section('run_summary').artifact_ids).toEqual(['synthetic-summary'])
    expect(project.artifactsForRole('run_summary')).toHaveLength(1)
    expect(project.artifact('synthetic-summary')?.json).toEqual({ ok: true })
    expect(project.migrationReceipt.applied).toBe(false)
    expect(verifyContract).toHaveBeenCalledOnce()
    expect(verifySemantics).toHaveBeenCalledOnce()
    expect(readAsset.mock.calls.map(([path]) => path)).toEqual([
      'judge_bundle.json',
      'artifacts/summary.json',
    ])
    expect(verifyArtifact).toHaveBeenCalledOnce()
    expect(verifyArtifact.mock.calls[0]?.[0]).toBe(descriptor)
    expect([...((verifyArtifact.mock.calls[0]?.[1] ?? new Uint8Array()) as Uint8Array)]).toEqual(
      [...new TextEncoder().encode('{"ok":true}')],
    )
  })

  it('keeps exact Papilio identities in the explicit fixture validator', async () => {
    const migration = await migrateJudgeBundleToCurrent(
      structuredClone(committedJudgeBundle) as JsonValue,
    )
    const fixture = new PapilioJudgeFixtureValidator()
    const accepted = new TaxaLensProjectFacade(migration, new Map())
    const wrongManifest = structuredClone(migration.manifest)
    wrongManifest.bundle_id = 'different-fixture'
    const rejected = new TaxaLensProjectFacade(
      { manifest: wrongManifest, receipt: migration.receipt },
      new Map(),
    )

    expect(() => fixture.verify(accepted)).not.toThrow()
    expect(() => fixture.verify(rejected)).toThrow(/frozen Papilio fixture/)
  })
})

function syntheticManifest(): JudgeBundleContract {
  const unavailable: JudgeBundleSection = {
    status: 'unavailable',
    artifact_ids: [],
    reason: 'not supplied by the synthetic project',
    candidate_semantics: 'not_applicable',
    verification_status: 'unavailable',
    human_review_required: true,
    scientific_claim_allowed: false,
  }
  const sections = Object.fromEntries(
    JUDGE_BUNDLE_SECTION_NAMES.map((name) => [name, structuredClone(unavailable)]),
  ) as JudgeBundleContract['sections']
  sections.run_summary = {
    ...structuredClone(unavailable),
    status: 'available',
    artifact_ids: [descriptor.artifact_id],
    reason: null,
    verification_status: 'machine_verified_contract',
  }
  return {
    schema_version: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundle_id: 'synthetic-project-bundle',
    title: 'Synthetic project bundle',
    created_at: '2026-07-17T09:00:00Z',
    target: {
      accepted_taxon_key: 'gbif:synthetic',
      scientific_name: 'Papilio syntheticus',
      rank: 'species',
    },
    source_revisions: {
      taxalens_sha: '1'.repeat(40),
      biominer_sha: '2'.repeat(40),
    },
    artifact_inventory: [descriptor],
    sections,
    rights: {
      status: 'fixture_only',
      all_artifacts_covered: true,
      all_media_rights_verified: false,
      items: [],
    },
    attribution: { complete: true, entries: [] },
    openai_replay: {
      status: 'not_used',
      mode: 'not_used',
      credentials_required: false,
      live_requests_allowed: false,
      reason: 'not used',
      traces: [],
    },
    expected_ui_counts: {
      section_records: Object.fromEntries(
        JUDGE_BUNDLE_SECTION_NAMES.map((name) => [name, name === 'run_summary' ? 1 : 0]),
      ) as JudgeBundleContract['expected_ui_counts']['section_records'],
      screen_items: {
        research_mission: 0,
        evidence_observatory: 0,
        evidence_lens: 0,
        butterfly_dashboard: 0,
      },
      artifact_count: 1,
      attribution_count: 0,
      openai_replay_trace_count: 0,
      unavailable_section_count: JUDGE_BUNDLE_SECTION_NAMES.length - 1,
    },
    checksums: {
      algorithm: 'sha256',
      canonicalization: 'json-sorted-keys-utf8-v1',
      inventory_sha256: '0'.repeat(64),
      payload_root_sha256: '0'.repeat(64),
    },
  }
}

function migrationReceipt(): JudgeBundleMigrationResult['receipt'] {
  return {
    sourceSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    targetSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    applied: false,
    storedFilesRewritten: false,
    addedSections: [],
    preservedV1FingerprintSha256: null,
  }
}
