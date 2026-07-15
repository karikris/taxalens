const JUDGE_BUNDLE_SCHEMA_VERSION = 'taxalens-judge-bundle:v1.0.0'
const EXPECTED_BUNDLE_ID = 'papilio-demoleus-pilot-75461d9c-v1'
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const SAFE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u

type JsonObject = Record<string, unknown>

export interface ReplayBootstrap {
  readonly schemaVersion: typeof JUDGE_BUNDLE_SCHEMA_VERSION
  readonly bundleId: string
  readonly title: string
  readonly target: {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly rank: string
  }
  readonly sourceRevisions: {
    readonly taxalensSha: string
    readonly biominerSha: string
  }
  readonly rightsStatus: string
  readonly artifactCount: number
  readonly unavailableSectionCount: number
  readonly heroRecordId: string
  readonly heroState: 'awaiting_human_review'
  readonly scientificClaimAllowed: false
}

export class ReplayBootstrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplayBootstrapError'
  }
}

function object(value: unknown, location: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ReplayBootstrapError(`${location} must be an object`)
  }
  return value as JsonObject
}

function array(value: unknown, location: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ReplayBootstrapError(`${location} must be an array`)
  }
  return value
}

function text(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ReplayBootstrapError(`${location} must be non-empty text`)
  }
  return value
}

function count(value: unknown, location: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ReplayBootstrapError(`${location} must be a non-negative integer`)
  }
  return Number(value)
}

function fullSha(value: unknown, location: string): string {
  const result = text(value, location)
  if (!FULL_SHA_PATTERN.test(result)) {
    throw new ReplayBootstrapError(`${location} must be a full Git SHA`)
  }
  return result
}

function replayAssetUrl(path: string): URL {
  const replayRoot = new URL(import.meta.env.BASE_URL, window.location.href)
  return new URL(path, replayRoot)
}

async function fetchJson(
  url: URL,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(url, {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new ReplayBootstrapError(
      `Static replay asset ${url.pathname} returned HTTP ${response.status}`,
    )
  }
  return response.json() as Promise<unknown>
}

function runSummaryPath(manifest: JsonObject): string {
  const inventory = array(manifest.artifact_inventory, 'artifact_inventory')
  const runSummary = inventory.find((entry) => {
    const artifact = object(entry, 'artifact_inventory entry')
    return artifact.role === 'run_summary'
  })
  const artifact = object(runSummary, 'run_summary artifact')
  const path = text(artifact.path, 'run_summary.path')
  if (!SAFE_PATH_PATTERN.test(path)) {
    throw new ReplayBootstrapError('run_summary.path is not a safe relative path')
  }
  return path
}

export async function loadReplayBootstrap(
  signal: AbortSignal,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ReplayBootstrap> {
  const manifest = object(
    await fetchJson(replayAssetUrl('judge_bundle.json'), signal, fetcher),
    'judge_bundle',
  )
  if (manifest.schema_version !== JUDGE_BUNDLE_SCHEMA_VERSION) {
    throw new ReplayBootstrapError('judge_bundle.schema_version is unsupported')
  }
  if (manifest.bundle_id !== EXPECTED_BUNDLE_ID) {
    throw new ReplayBootstrapError('judge_bundle.bundle_id is not the truthful pilot')
  }

  const inventory = array(manifest.artifact_inventory, 'artifact_inventory')
  const sections = object(manifest.sections, 'sections')
  const expectedCounts = object(manifest.expected_ui_counts, 'expected_ui_counts')
  const unavailableSectionCount = Object.values(sections).filter(
    (value) => object(value, 'section').status === 'unavailable',
  ).length
  if (
    count(expectedCounts.artifact_count, 'expected_ui_counts.artifact_count') !==
    inventory.length
  ) {
    throw new ReplayBootstrapError('artifact inventory count differs from expected UI count')
  }
  if (
    count(
      expectedCounts.unavailable_section_count,
      'expected_ui_counts.unavailable_section_count',
    ) !== unavailableSectionCount
  ) {
    throw new ReplayBootstrapError('unavailable section count differs from the manifest')
  }

  const target = object(manifest.target, 'target')
  const revisions = object(manifest.source_revisions, 'source_revisions')
  const rights = object(manifest.rights, 'rights')
  if (rights.all_artifacts_covered !== true) {
    throw new ReplayBootstrapError('truthful replay requires complete artifact rights coverage')
  }

  const runSummary = object(
    await fetchJson(replayAssetUrl(runSummaryPath(manifest)), signal, fetcher),
    'run_summary',
  )
  if (runSummary.hero_state !== 'awaiting_human_review') {
    throw new ReplayBootstrapError('metadata-only hero must await human review')
  }
  if (runSummary.scientific_claim_allowed !== false) {
    throw new ReplayBootstrapError('metadata-only hero cannot allow a scientific claim')
  }

  return Object.freeze({
    schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundleId: text(manifest.bundle_id, 'bundle_id'),
    title: text(manifest.title, 'title'),
    target: Object.freeze({
      acceptedTaxonKey: text(target.accepted_taxon_key, 'target.accepted_taxon_key'),
      scientificName: text(target.scientific_name, 'target.scientific_name'),
      rank: text(target.rank, 'target.rank'),
    }),
    sourceRevisions: Object.freeze({
      taxalensSha: fullSha(revisions.taxalens_sha, 'source_revisions.taxalens_sha'),
      biominerSha: fullSha(revisions.biominer_sha, 'source_revisions.biominer_sha'),
    }),
    rightsStatus: text(rights.status, 'rights.status'),
    artifactCount: inventory.length,
    unavailableSectionCount,
    heroRecordId: text(runSummary.hero_record_id, 'run_summary.hero_record_id'),
    heroState: 'awaiting_human_review',
    scientificClaimAllowed: false,
  })
}

export const replayBootstrapContract = Object.freeze({
  schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
  bundleId: EXPECTED_BUNDLE_ID,
})
