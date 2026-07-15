import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import judgeBundleSchema from '../../../../packages/contracts/schema/judge_bundle.schema.json'
import {
  JUDGE_BUNDLE_SCHEMA_VERSION,
  JUDGE_BUNDLE_SECTION_NAMES,
  type JudgeBundleArtifact,
  type JudgeBundleAvailability,
  type JudgeBundleContract,
  type JudgeBundleSectionName,
} from '../../../../packages/contracts/src/judge_bundle_contract'

const EXPECTED_BUNDLE_ID = 'papilio-demoleus-pilot-75461d9c-v1'
const EXPECTED_TAXALENS_SHA = '188187d73ca8e0ef2c670bdf6cefcb20c8a59d9d'
const EXPECTED_BIOMINER_SHA = '75461d9c065af0cd96b41cd1f845c2e920f7ae34'

type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface EvidenceSectionState {
  readonly name: JudgeBundleSectionName
  readonly status: JudgeBundleAvailability
  readonly reason: string | null
  readonly artifactIds: readonly string[]
  readonly candidateSemantics: string
  readonly verificationStatus: string
  readonly humanReviewRequired: boolean
  readonly scientificClaimAllowed: boolean
}

export interface ReplayIdentity {
  readonly bundleId: string
  readonly target: {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly rank: string
  }
  readonly sourceRevisions: {
    readonly taxalensSha: string
    readonly biominerSha: string
  }
}

export interface ReplayEvidence extends ReplayIdentity {
  readonly schemaVersion: typeof JUDGE_BUNDLE_SCHEMA_VERSION
  readonly title: string
  readonly rightsStatus: string
  readonly artifactCount: number
  readonly verifiedArtifactCount: number
  readonly unavailableSectionCount: number
  readonly unavailableSections: readonly EvidenceSectionState[]
  readonly sections: Readonly<Record<JudgeBundleSectionName, EvidenceSectionState>>
  readonly heroRecordId: string
  readonly heroState: 'awaiting_human_review'
  readonly scientificClaimAllowed: false
  readonly verification: {
    readonly inventoryChecksumVerified: true
    readonly payloadRootChecksumVerified: true
    readonly artifactChecksumsVerified: true
    readonly dataMode: 'verified-json-fallback'
    readonly fallbackReason: 'parquet_unavailable'
    readonly wasmStarted: false
  }
}

export interface ParquetArtifactInput {
  readonly artifactId: string
  readonly mediaType: string
  readonly path: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

export type ParquetReader = (artifact: ParquetArtifactInput) => Promise<unknown>

export type SectionEvidenceResult =
  | {
      readonly status: 'unavailable'
      readonly section: EvidenceSectionState
      readonly mode: 'unavailable'
      readonly reason: string
    }
  | {
      readonly status: 'available' | 'partial'
      readonly section: EvidenceSectionState
      readonly mode: 'parquet-wasm'
      readonly fallbackReason: null
      readonly value: unknown
    }
  | {
      readonly status: 'available' | 'partial'
      readonly section: EvidenceSectionState
      readonly mode: 'json-fallback'
      readonly fallbackReason: 'parquet_unavailable' | 'wasm_unavailable' | 'parquet_wasm_failed'
      readonly artifacts: readonly {
        readonly artifactId: string
        readonly value: JsonValue
      }[]
    }

interface VerifiedArtifact {
  readonly descriptor: JudgeBundleArtifact
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly json: JsonValue | undefined
}

export interface EvidenceFacade {
  readonly replay: ReplayEvidence
  loadSection(
    name: JudgeBundleSectionName,
    parquetReader?: ParquetReader,
  ): Promise<SectionEvidenceResult>
}

export class EvidenceFacadeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvidenceFacadeError'
  }
}

const ajv = new Ajv2020({ allErrors: false, strict: true })
addFormats(ajv)
const validateJudgeBundle = ajv.compile<JudgeBundleContract>(judgeBundleSchema)

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new EvidenceFacadeError('Bundle checksum input contains a non-finite number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new EvidenceFacadeError('Bundle checksum input is not JSON-compatible')
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function replayAssetUrl(path: string): URL {
  const replayRoot = new URL(import.meta.env.BASE_URL, window.location.href)
  return new URL(path, replayRoot)
}

async function fetchBytes(
  path: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<Uint8Array<ArrayBuffer>> {
  const url = replayAssetUrl(path)
  const response = await fetcher(url, {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new EvidenceFacadeError(
      `Static replay asset ${url.pathname} returned HTTP ${response.status}`,
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}

function parseJson(bytes: Uint8Array<ArrayBuffer>, location: string): JsonValue {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return JSON.parse(text) as JsonValue
  } catch {
    throw new EvidenceFacadeError(`${location} is not valid UTF-8 JSON`)
  }
}

function object(value: JsonValue | undefined, location: string): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EvidenceFacadeError(`${location} must be a JSON object`)
  }
  return value
}

function stringField(
  record: Record<string, JsonValue>,
  field: string,
  location: string,
): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new EvidenceFacadeError(`${location}.${field} must be non-empty text`)
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || ArrayBuffer.isView(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

function isJsonArtifact(artifact: JudgeBundleArtifact): boolean {
  return artifact.media_type === 'application/json' || artifact.media_type.endsWith('+json')
}

function isParquetArtifact(artifact: JudgeBundleArtifact): boolean {
  return artifact.path.endsWith('.parquet') || artifact.media_type.includes('parquet')
}

function comparePaths(left: { readonly path: string }, right: { readonly path: string }): number {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}

function assertRecordCount(artifact: JudgeBundleArtifact, value: JsonValue): void {
  if (artifact.record_count === null) {
    return
  }
  let actual = Array.isArray(value) ? value.length : 1
  if (
    artifact.role === 'attribution' &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray(value.entries)
  ) {
    actual = value.entries.length
  }
  if (actual !== artifact.record_count) {
    throw new EvidenceFacadeError(
      `${artifact.artifact_id} record count is ${actual}; expected ${artifact.record_count}`,
    )
  }
}

function assertUniqueInventory(manifest: JudgeBundleContract): Map<string, JudgeBundleArtifact> {
  const byId = new Map<string, JudgeBundleArtifact>()
  const paths = new Set<string>()
  for (const artifact of manifest.artifact_inventory) {
    if (byId.has(artifact.artifact_id)) {
      throw new EvidenceFacadeError(`Artifact id ${artifact.artifact_id} is duplicated`)
    }
    if (paths.has(artifact.path)) {
      throw new EvidenceFacadeError(`Artifact path ${artifact.path} is duplicated`)
    }
    byId.set(artifact.artifact_id, artifact)
    paths.add(artifact.path)
  }
  return byId
}

function assertCoverage(
  label: string,
  inventoryIds: ReadonlySet<string>,
  groups: readonly { readonly artifact_ids: readonly string[] }[],
): void {
  const covered = new Set<string>()
  for (const group of groups) {
    for (const artifactId of group.artifact_ids) {
      if (!inventoryIds.has(artifactId)) {
        throw new EvidenceFacadeError(`${label} references unknown artifact ${artifactId}`)
      }
      covered.add(artifactId)
    }
  }
  for (const artifactId of inventoryIds) {
    if (!covered.has(artifactId)) {
      throw new EvidenceFacadeError(`${label} does not cover artifact ${artifactId}`)
    }
  }
}

async function assertManifestSemantics(manifest: JudgeBundleContract): Promise<void> {
  if (manifest.bundle_id !== EXPECTED_BUNDLE_ID) {
    throw new EvidenceFacadeError('judge_bundle.bundle_id is not the truthful pilot')
  }
  if (
    manifest.source_revisions.taxalens_sha !== EXPECTED_TAXALENS_SHA ||
    manifest.source_revisions.biominer_sha !== EXPECTED_BIOMINER_SHA
  ) {
    throw new EvidenceFacadeError('judge_bundle source revisions do not match the pinned replay')
  }

  const inventoryById = assertUniqueInventory(manifest)
  const inventoryIds = new Set(inventoryById.keys())
  for (const artifact of manifest.artifact_inventory) {
    const expectedCommit =
      artifact.source_repository === 'karikris/TaxaLens'
        ? manifest.source_revisions.taxalens_sha
        : artifact.source_repository === 'karikris/BioMiner'
          ? manifest.source_revisions.biominer_sha
          : undefined
    if (expectedCommit === undefined || artifact.source_commit !== expectedCommit) {
      throw new EvidenceFacadeError(
        `${artifact.artifact_id} source revision is outside the pinned replay`,
      )
    }
  }
  if (manifest.expected_ui_counts.artifact_count !== manifest.artifact_inventory.length) {
    throw new EvidenceFacadeError('Artifact inventory count differs from expected UI count')
  }

  let unavailableCount = 0
  for (const name of JUDGE_BUNDLE_SECTION_NAMES) {
    const section = manifest.sections[name]
    if (section.status === 'unavailable') {
      unavailableCount += 1
    }
    let recordCount = 0
    for (const artifactId of section.artifact_ids) {
      const artifact = inventoryById.get(artifactId)
      if (artifact === undefined) {
        throw new EvidenceFacadeError(`${name} references unknown artifact ${artifactId}`)
      }
      if (artifact.role !== name) {
        throw new EvidenceFacadeError(`${name} references artifact with role ${artifact.role}`)
      }
      if (artifact.record_count === null) {
        throw new EvidenceFacadeError(`${name} has no deterministic record count`)
      }
      recordCount += artifact.record_count
    }
    if (recordCount !== manifest.expected_ui_counts.section_records[name]) {
      throw new EvidenceFacadeError(`${name} record count differs from expected UI count`)
    }
  }
  if (unavailableCount !== manifest.expected_ui_counts.unavailable_section_count) {
    throw new EvidenceFacadeError('Unavailable section count differs from the manifest')
  }
  if (manifest.attribution.entries.length !== manifest.expected_ui_counts.attribution_count) {
    throw new EvidenceFacadeError('Attribution count differs from expected UI count')
  }
  if (manifest.openai_replay.traces.length !== manifest.expected_ui_counts.openai_replay_trace_count) {
    throw new EvidenceFacadeError('OpenAI replay trace count differs from expected UI count')
  }
  if (!manifest.rights.all_artifacts_covered || !manifest.attribution.complete) {
    throw new EvidenceFacadeError('Truthful replay requires complete rights and attribution coverage')
  }
  assertCoverage('Rights manifest', inventoryIds, manifest.rights.items)
  assertCoverage('Attribution manifest', inventoryIds, manifest.attribution.entries)

  const inventoryBytes = new TextEncoder().encode(canonicalJson(manifest.artifact_inventory))
  if ((await sha256Hex(inventoryBytes)) !== manifest.checksums.inventory_sha256) {
    throw new EvidenceFacadeError('Artifact inventory checksum differs from the manifest')
  }
  const payloadProjection = [...manifest.artifact_inventory]
    .sort(comparePaths)
    .map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 }))
  const payloadBytes = new TextEncoder().encode(canonicalJson({ files: payloadProjection }))
  if ((await sha256Hex(payloadBytes)) !== manifest.checksums.payload_root_sha256) {
    throw new EvidenceFacadeError('Payload root checksum differs from the manifest')
  }
}

function projectSections(
  manifest: JudgeBundleContract,
): Readonly<Record<JudgeBundleSectionName, EvidenceSectionState>> {
  return Object.freeze(
    Object.fromEntries(
      JUDGE_BUNDLE_SECTION_NAMES.map((name) => {
        const section = manifest.sections[name]
        return [
          name,
          Object.freeze({
            name,
            status: section.status,
            reason: section.reason,
            artifactIds: Object.freeze([...section.artifact_ids]),
            candidateSemantics: section.candidate_semantics,
            verificationStatus: section.verification_status,
            humanReviewRequired: section.human_review_required,
            scientificClaimAllowed: section.scientific_claim_allowed,
          }),
        ]
      }),
    ) as Record<JudgeBundleSectionName, EvidenceSectionState>,
  )
}

class VerifiedEvidenceFacade implements EvidenceFacade {
  readonly replay: ReplayEvidence
  readonly #artifacts: ReadonlyMap<string, VerifiedArtifact>

  constructor(replay: ReplayEvidence, artifacts: ReadonlyMap<string, VerifiedArtifact>) {
    this.replay = replay
    this.#artifacts = artifacts
  }

  async loadSection(
    name: JudgeBundleSectionName,
    parquetReader?: ParquetReader,
  ): Promise<SectionEvidenceResult> {
    const section = this.replay.sections[name]
    if (section.status === 'unavailable') {
      return Object.freeze({
        status: 'unavailable',
        section,
        mode: 'unavailable',
        reason: section.reason ?? 'No committed evidence artifact is available.',
      })
    }

    const artifacts = section.artifactIds.map((artifactId) => {
      const artifact = this.#artifacts.get(artifactId)
      if (artifact === undefined) {
        throw new EvidenceFacadeError(`${name} artifact ${artifactId} was not verified`)
      }
      return artifact
    })
    const parquet = artifacts.find(({ descriptor }) => isParquetArtifact(descriptor))
    const json = artifacts.filter(({ descriptor }) => isJsonArtifact(descriptor))
    let fallbackReason: 'parquet_unavailable' | 'wasm_unavailable' | 'parquet_wasm_failed'

    if (parquet !== undefined && parquetReader !== undefined) {
      try {
        const value = deepFreeze(
          await parquetReader({
            artifactId: parquet.descriptor.artifact_id,
            mediaType: parquet.descriptor.media_type,
            path: parquet.descriptor.path,
            bytes: parquet.bytes.slice(),
          }),
        )
        return Object.freeze({
          status: section.status,
          section,
          mode: 'parquet-wasm',
          fallbackReason: null,
          value,
        } as const)
      } catch {
        fallbackReason = 'parquet_wasm_failed'
      }
    } else {
      fallbackReason = parquet === undefined ? 'parquet_unavailable' : 'wasm_unavailable'
    }

    if (json.length === 0) {
      throw new EvidenceFacadeError(`${name} has no verified JSON fallback`)
    }
    return Object.freeze({
      status: section.status,
      section,
      mode: 'json-fallback',
      fallbackReason,
      artifacts: Object.freeze(
        json.map((artifact) => {
          if (artifact.json === undefined) {
            throw new EvidenceFacadeError(`${artifact.descriptor.artifact_id} JSON was not decoded`)
          }
          return Object.freeze({
            artifactId: artifact.descriptor.artifact_id,
            value: artifact.json,
          })
        }),
      ),
    } as const)
  }
}

export async function loadEvidenceFacade(
  signal: AbortSignal,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<EvidenceFacade> {
  const manifestBytes = await fetchBytes('judge_bundle.json', signal, fetcher)
  const candidate = parseJson(manifestBytes, 'judge_bundle')
  if (!validateJudgeBundle(candidate)) {
    const firstError = validateJudgeBundle.errors?.[0]
    const location = firstError?.instancePath === '' ? '/' : firstError?.instancePath
    throw new EvidenceFacadeError(
      `judge_bundle failed runtime schema validation at ${location ?? '/'} (${firstError?.keyword ?? 'unknown'})`,
    )
  }
  const manifest = candidate
  await assertManifestSemantics(manifest)

  const artifacts = new Map<string, VerifiedArtifact>()
  const orderedInventory = [...manifest.artifact_inventory].sort(comparePaths)
  for (const descriptor of orderedInventory) {
    const bytes = await fetchBytes(descriptor.path, signal, fetcher)
    if (bytes.byteLength !== descriptor.bytes) {
      throw new EvidenceFacadeError(
        `${descriptor.artifact_id} byte count is ${bytes.byteLength}; expected ${descriptor.bytes}`,
      )
    }
    if ((await sha256Hex(bytes)) !== descriptor.sha256) {
      throw new EvidenceFacadeError(`${descriptor.artifact_id} checksum verification failed`)
    }
    const json = isJsonArtifact(descriptor)
      ? deepFreeze(parseJson(bytes, descriptor.artifact_id))
      : undefined
    if (json !== undefined) {
      assertRecordCount(descriptor, json)
    }
    artifacts.set(
      descriptor.artifact_id,
      Object.freeze({ descriptor: Object.freeze(descriptor), bytes, json }),
    )
  }

  const runSummaryArtifact = [...artifacts.values()].find(
    ({ descriptor }) => descriptor.role === 'run_summary' && isJsonArtifact(descriptor),
  )
  if (runSummaryArtifact === undefined) {
    throw new EvidenceFacadeError('Verified bundle has no run_summary artifact')
  }
  const runSummary = object(runSummaryArtifact.json, 'run_summary')
  if (runSummary.hero_state !== 'awaiting_human_review') {
    throw new EvidenceFacadeError('Metadata-only hero must await human review')
  }
  if (runSummary.scientific_claim_allowed !== false) {
    throw new EvidenceFacadeError('Metadata-only hero cannot allow a scientific claim')
  }

  const sections = projectSections(manifest)
  const unavailableSections = Object.freeze(
    JUDGE_BUNDLE_SECTION_NAMES.map((name) => sections[name]).filter(
      (section) => section.status === 'unavailable',
    ),
  )
  const replay = deepFreeze<ReplayEvidence>({
    schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundleId: manifest.bundle_id,
    title: manifest.title,
    target: {
      acceptedTaxonKey: manifest.target.accepted_taxon_key,
      scientificName: manifest.target.scientific_name,
      rank: manifest.target.rank,
    },
    sourceRevisions: {
      taxalensSha: manifest.source_revisions.taxalens_sha,
      biominerSha: manifest.source_revisions.biominer_sha,
    },
    rightsStatus: manifest.rights.status,
    artifactCount: manifest.artifact_inventory.length,
    verifiedArtifactCount: artifacts.size,
    unavailableSectionCount: unavailableSections.length,
    unavailableSections,
    sections,
    heroRecordId: stringField(runSummary, 'hero_record_id', 'run_summary'),
    heroState: 'awaiting_human_review',
    scientificClaimAllowed: false,
    verification: {
      inventoryChecksumVerified: true,
      payloadRootChecksumVerified: true,
      artifactChecksumsVerified: true,
      dataMode: 'verified-json-fallback',
      fallbackReason: 'parquet_unavailable',
      wasmStarted: false,
    },
  })
  return Object.freeze(new VerifiedEvidenceFacade(replay, artifacts))
}

export const replayEvidenceContract = Object.freeze({
  schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
  bundleId: EXPECTED_BUNDLE_ID,
  taxalensSha: EXPECTED_TAXALENS_SHA,
  biominerSha: EXPECTED_BIOMINER_SHA,
})
