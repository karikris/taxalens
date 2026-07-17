import impactManifest from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json'
import { canonicalExportJsonBytes, sha256Hex } from '../evidence/evidenceExport'
import storedReplayJson from './fixtures/geographicAnalystStoredReplay.json'
import { GEOGRAPHIC_ANALYST_MODEL } from './geographicAnalystWorkflow'

export const STORED_GEOGRAPHIC_ANALYST_REPLAY_VERSION =
  'taxalens-geographic-analyst-stored-replay:v1.0.0' as const

export interface StoredGeographicAnalystReplay {
  readonly schemaVersion: typeof STORED_GEOGRAPHIC_ANALYST_REPLAY_VERSION
  readonly model: typeof GEOGRAPHIC_ANALYST_MODEL
  readonly reasoningEffort: 'xhigh'
  readonly mode: 'stored_credential_free'
  readonly request: string
  readonly scope: Readonly<Record<string, unknown>>
  readonly sourceFingerprintSha256: string
  readonly sources: readonly Readonly<Record<string, unknown>>[]
  readonly toolReceipts: readonly Readonly<Record<string, unknown>>[]
  readonly answer: string
  readonly limitations: readonly string[]
  readonly externalActionsExecuted: false
  readonly scientificClaimAllowed: false
  readonly replaySha256: string
}

export async function loadStoredGeographicAnalystReplay(
  stored: unknown = storedReplayJson,
): Promise<StoredGeographicAnalystReplay> {
  const replay = record(stored, 'stored geographic analyst replay')
  if (replay.schemaVersion !== STORED_GEOGRAPHIC_ANALYST_REPLAY_VERSION || replay.model !== GEOGRAPHIC_ANALYST_MODEL || replay.reasoningEffort !== 'xhigh' || replay.mode !== 'stored_credential_free') {
    throw new Error('Stored geographic analyst replay identity differs')
  }
  const scope = record(replay.scope, 'stored geographic replay scope')
  const expectedScope = {
    projectId: impactManifest.project_id,
    runId: impactManifest.run_id,
    acceptedTaxonKey: impactManifest.accepted_taxon_key,
    baselineSnapshotId: impactManifest.baseline_snapshot_id,
    flickrSnapshotId: impactManifest.flickr_snapshot_id,
    spatialResolution: 7,
    scopeLevel: 'country',
    scopeId: 'country:SE',
    scopeName: 'Sweden',
  }
  for (const [field, value] of Object.entries(expectedScope)) {
    if (scope[field] !== value) throw new Error(`Stored geographic replay scope differs: ${field}`)
  }
  if (replay.sourceFingerprintSha256 !== impactManifest.deterministic_fingerprint_sha256) {
    throw new Error('Stored geographic replay source fingerprint differs')
  }
  const sources = array(replay.sources, 'stored geographic replay sources').map((value) => record(value, 'stored geographic replay source'))
  const requiredSources = ['baseline_occurrence_union', 'flickr_geography', 'geographic_impact_cells', 'geographic_impact_summary', 'quality_snapshot', 'verification_campaign']
  if (sources.length !== requiredSources.length || requiredSources.some((artifactId) => !sources.some((source) => source.artifactId === artifactId))) {
    throw new Error('Stored geographic replay citation chain is incomplete')
  }
  for (const source of sources) {
    if (source.artifactId === 'verification_campaign') {
      if (source.sha256 !== 'c9efb76f6c576b217aa7fd7469f49d671d81e3b248b2ab735d4fb874be6b61bc') throw new Error('Stored verification campaign citation differs')
      continue
    }
    const manifestSource = impactManifest.artifacts.find(({ logical_name }) => logical_name === source.artifactId)
    if (manifestSource === undefined || source.availability !== manifestSource.availability || source.sha256 !== manifestSource.sha256 || source.sourceCommit !== manifestSource.source_commit) {
      throw new Error(`Stored geographic replay source citation differs: ${String(source.artifactId)}`)
    }
  }
  const receipts = array(replay.toolReceipts, 'stored geographic tool receipts').map((value) => record(value, 'stored geographic tool receipt'))
  if (receipts.length !== 2 || receipts[0]?.sequence !== 1 || receipts[0]?.tool !== 'inspect_geographic_impact' || receipts[1]?.sequence !== 2 || receipts[1]?.tool !== 'list_candidate_gap_cells') {
    throw new Error('Stored geographic replay tool sequence differs')
  }
  const facts = record(receipts[0]?.facts, 'stored geographic inspection facts')
  if (facts.baseline_union_count !== 0 || facts.flickr_candidate_count !== 529 || facts.candidate_only_cells !== 12 || facts.reviewed_additional_cells !== 0 || facts.release_ready_additional_cells !== 0 || facts.data_deficient_state !== 'data_deficient') {
    throw new Error('Stored geographic replay inspection facts differ')
  }
  const records = array(receipts[1]?.records, 'stored geographic gap records').map((value) => record(value, 'stored geographic gap record'))
  const candidateTotal = records.reduce((total, value) => total + integer(value.flickrCandidateCount, 'stored cell candidate count'), 0)
  if (records.length !== 12 || candidateTotal !== 529) throw new Error('Stored geographic gap records do not reconcile')
  const answer = string(replay.answer, 'stored geographic answer')
  if (!answer.includes('potential coverage contribution') || /new Flickr records|confirmed knowledge gain|new range|species absent from GBIF|records added to science/iu.test(answer)) {
    throw new Error('Stored geographic replay answer violates scientific terminology')
  }
  const expectedDigest = string(replay.replaySha256, 'stored geographic replay digest')
  const payload = { ...replay }
  delete payload.replaySha256
  if (await sha256Hex(canonicalExportJsonBytes(payload)) !== expectedDigest) {
    throw new Error('Stored geographic replay fingerprint differs')
  }
  if (replay.externalActionsExecuted !== false || replay.scientificClaimAllowed !== false) {
    throw new Error('Stored geographic replay action boundary differs')
  }
  return deepFreeze(replay as unknown as StoredGeographicAnalystReplay)
}

function record(value: unknown, label: string): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as Record<string, unknown> }
function array(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array`); return value }
function string(value: unknown, label: string): string { if (typeof value !== 'string') throw new Error(`${label} must be a string`); return value }
function integer(value: unknown, label: string): number { if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`); return value as number }
function deepFreeze<Value>(value: Value): Value { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child) } return value }
