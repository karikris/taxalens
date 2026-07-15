import type { ParquetArtifactInput, ReplayEvidence } from '../data/evidenceFacade'
import { buildEvidenceLedger } from './evidenceLedgerModel'

const EXPORT_SCHEMA_VERSION = 'taxalens-evidence-export:v1.0.0'
const MANIFEST_SCHEMA_VERSION = 'taxalens-evidence-export-manifest:v1.0.0'
const PROVENANCE_SCHEMA_VERSION = 'taxalens-evidence-export-provenance:v1.0.0'
const QUERY_HITS_ARTIFACT_ID = 'biominer-flickr-query-hits-parquet'
const PARQUET_MEDIA_TYPE = 'application/vnd.apache.parquet'
const FILE_ORDER: Readonly<Record<EvidenceExportRole, number>> = Object.freeze({
  evidence_json: 1,
  csv_summary: 2,
  source_parquet: 3,
  manifest: 4,
  provenance_report: 5,
})

export type EvidenceExportRole =
  | 'evidence_json'
  | 'csv_summary'
  | 'source_parquet'
  | 'manifest'
  | 'provenance_report'

export interface EvidenceExportFile {
  readonly role: EvidenceExportRole
  readonly filename: string
  readonly mediaType: string
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly sha256: string
}

export interface EvidenceExportBundle {
  readonly schemaVersion: typeof EXPORT_SCHEMA_VERSION
  readonly prefix: string
  readonly files: readonly EvidenceExportFile[]
  readonly manifestSignatureStatus: 'unavailable'
  readonly sourceParquetArtifactId: typeof QUERY_HITS_ARTIFACT_ID
}

interface PayloadFile {
  readonly role: Exclude<EvidenceExportRole, 'manifest'>
  readonly filename: string
  readonly mediaType: string
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly sha256: string
}

export async function prepareEvidenceExport(
  replay: ReplayEvidence,
  sourceParquet: ParquetArtifactInput,
): Promise<EvidenceExportBundle> {
  await assertSourceParquet(replay, sourceParquet)

  const ledger = buildEvidenceLedger(replay)
  const prefix = exportPrefix(replay)
  const evidenceBytes = canonicalExportJsonBytes({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    bundleId: replay.bundleId,
    target: replay.target,
    recordId: replay.heroRecordId,
    reviewState: replay.heroState,
    scientificClaimAllowed: false,
    ledger,
  })
  const csvBytes = new TextEncoder().encode(evidenceLedgerCsv(replay))
  const parquetBytes = sourceParquet.bytes.slice()
  const provenanceBytes = canonicalExportJsonBytes({
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    bundleId: replay.bundleId,
    sourceRevisions: replay.sourceRevisions,
    sourceBundleCreatedAt: replay.bundleCreatedAt,
    exportTimestamp: null,
    exportTimestampReason: 'No export time is added so repeated preparation remains deterministic.',
    execution: {
      environment: 'browser',
      method: 'local_verified_artifact_export',
      networkRequestsRequired: 0,
      scientificClaimsAdded: false,
    },
    sourceParquet: {
      artifactId: sourceParquet.artifactId,
      sourcePath: sourceParquet.path,
      sourceSha256: sourceParquet.sha256,
      producerSha: sourceParquet.producerSha,
      recordCount: sourceParquet.recordCount,
      byteCount: sourceParquet.sizeBytes,
      transferMethod: 'byte_for_byte_copy',
      scope: 'BioMiner Flickr query-hit source; not a serialization of the evidence ledger.',
    },
    limitations: [
      'No signing key is committed, so the manifest is unsigned.',
      'The export records candidate metadata and review state, not a species classification.',
      'The Parquet payload preserves one verified BioMiner source artifact and does not add rows.',
    ],
  })

  const payloadFiles = await Promise.all([
    payloadFile('evidence_json', `${prefix}.evidence.json`, 'application/json', evidenceBytes),
    payloadFile('csv_summary', `${prefix}.summary.csv`, 'text/csv;charset=utf-8', csvBytes),
    payloadFile('source_parquet', `${prefix}.source-query-hits.parquet`, PARQUET_MEDIA_TYPE, parquetBytes),
    payloadFile(
      'provenance_report',
      `${prefix}.provenance.json`,
      'application/json',
      provenanceBytes,
    ),
  ])
  payloadFiles.sort(compareFiles)

  const manifestBytes = canonicalExportJsonBytes({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleId: replay.bundleId,
    recordId: replay.heroRecordId,
    files: payloadFiles.map(({ bytes, filename, mediaType, role, sha256 }) => ({
      role,
      filename,
      mediaType,
      byteCount: bytes.byteLength,
      sha256,
    })),
    signature: {
      status: 'unavailable',
      algorithm: null,
      signer: null,
      value: null,
      reason: 'No signing key is committed in the verified replay boundary.',
    },
    verification: {
      digestAlgorithm: 'SHA-256',
      manifestSelfDigestIncluded: false,
      sourceParquetPreservedByteForByte: true,
    },
    scientificClaimAllowed: false,
  })
  const manifestFile: EvidenceExportFile = {
    role: 'manifest',
    filename: `${prefix}.manifest.json`,
    mediaType: 'application/json',
    bytes: manifestBytes,
    sha256: await sha256Hex(manifestBytes),
  }
  const files: EvidenceExportFile[] = [...payloadFiles, manifestFile]
  files.sort(compareFiles)

  return Object.freeze({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    prefix,
    files: Object.freeze(files.map((file) => Object.freeze(file))),
    manifestSignatureStatus: 'unavailable',
    sourceParquetArtifactId: QUERY_HITS_ARTIFACT_ID,
  })
}

export function evidenceLedgerCsv(replay: ReplayEvidence): string {
  const ledger = buildEvidenceLedger(replay)
  const rows: readonly (readonly (number | string)[])[] = [
    [
      'sequence',
      'event_id',
      'label',
      'status',
      'event_time',
      'verification',
      'artifact_ids',
      'detail',
      'scientific_claim_allowed',
    ],
    ...ledger.events.map((event) => [
      event.sequence,
      event.id,
      event.label,
      event.status,
      event.recordedAt ?? '',
      event.verification,
      event.artifactIds.join('|'),
      event.detail,
      String(event.scientificClaimAllowed),
    ]),
  ]
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export interface DownloadableEvidenceFile {
  readonly filename: string
  readonly mediaType: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

export function downloadEvidenceFile(file: DownloadableEvidenceFile): void {
  const url = URL.createObjectURL(new Blob([file.bytes], { type: file.mediaType }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function canonicalExportJsonBytes(value: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`)
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Evidence export contains a non-finite number')
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
  throw new Error('Evidence export contains a value that is not JSON-compatible')
}

async function payloadFile(
  role: PayloadFile['role'],
  filename: string,
  mediaType: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<PayloadFile> {
  return {
    role,
    filename,
    mediaType,
    bytes,
    sha256: await sha256Hex(bytes),
  }
}

async function assertSourceParquet(
  replay: ReplayEvidence,
  source: ParquetArtifactInput,
): Promise<void> {
  const inventory = replay.artifactInventory.find(
    ({ artifactId }) => artifactId === QUERY_HITS_ARTIFACT_ID,
  )
  const last = source.bytes.byteLength - 4
  const hasParquetMagic =
    source.bytes.byteLength >= 8 &&
    source.bytes[0] === 0x50 &&
    source.bytes[1] === 0x41 &&
    source.bytes[2] === 0x52 &&
    source.bytes[3] === 0x31 &&
    source.bytes[last] === 0x50 &&
    source.bytes[last + 1] === 0x41 &&
    source.bytes[last + 2] === 0x52 &&
    source.bytes[last + 3] === 0x31
  if (
    source.artifactId !== QUERY_HITS_ARTIFACT_ID ||
    source.mediaType !== PARQUET_MEDIA_TYPE ||
    source.producerSha !== replay.sourceRevisions.biominerSha ||
    source.sizeBytes !== source.bytes.byteLength ||
    inventory?.sha256 !== source.sha256 ||
    inventory.sizeBytes !== source.sizeBytes ||
    !hasParquetMagic ||
    (await sha256Hex(source.bytes)) !== source.sha256
  ) {
    throw new Error('Evidence export requires the exact verified BioMiner query-hit Parquet artifact')
  }
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function csvCell(value: number | string): string {
  const text = String(value)
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function compareFiles(
  left: Pick<EvidenceExportFile, 'filename' | 'role'>,
  right: Pick<EvidenceExportFile, 'filename' | 'role'>,
): number {
  const roleOrder = FILE_ORDER[left.role] - FILE_ORDER[right.role]
  return roleOrder !== 0
    ? roleOrder
    : left.filename < right.filename
      ? -1
      : left.filename > right.filename
        ? 1
        : 0
}

function exportPrefix(replay: ReplayEvidence): string {
  const taxon = replay.target.scientificName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  return `taxalens-${taxon}-${replay.heroState.replaceAll('_', '-')}`
}
