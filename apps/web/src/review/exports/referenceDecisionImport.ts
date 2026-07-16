import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  loadLocalParquetExtension,
} from '../../data/duckdbRuntime'
import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import {
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
} from '../domain/verificationEvents'

export const REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION =
  'reference-review-decision-import-v1.0.0' as const
export const REFERENCE_REVIEW_DECISION_IMPORT_FILE =
  'reference_review_decision_import.parquet' as const
export const REFERENCE_REVIEW_DECISION_IMPORT_MEDIA_TYPE =
  'application/vnd.apache.parquet' as const

const EVENT_FIELDS = Object.freeze([
  'schemaVersion',
  'eventId',
  'campaignId',
  'itemId',
  'reviewerId',
  'reviewRound',
  'outcome',
  'comment',
  'nonTargetCategory',
  'alternativeTaxon',
  'correctedLifeStage',
  'correctedVisualDomain',
  'correctedView',
  'mediaQuality',
  'duplicateConcern',
  'captiveOrCultivatedConcern',
  'exclusionReason',
  'confidence',
  'reviewedAt',
  'durationMs',
  'imageSha256',
  'questionSha256',
  'campaignManifestSha256',
  'taxalensSha',
  'biominerSha',
  'supersedesEventId',
  'conflictsWithDecisionId',
] satisfies readonly (keyof VerificationEvent)[])

export interface BioMinerReferenceDecisionImportRow {
  readonly import_schema_version: typeof REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION
  readonly review_request_id: string
  readonly reference_media_id: string
  readonly review_round: number
  readonly verified_by: string
  readonly reviewed_at: string
  readonly target_identity_verified: boolean | null
  readonly verification_status: 'verified' | 'excluded' | 'uncertain'
  readonly life_stage: string
  readonly visual_domain: string
  readonly view: string
  readonly review_confidence: string
  readonly review_notes: string | null
  readonly exclusion_reason: string | null
  readonly conflicts_with_decision_id: string | null
}

export interface ReferenceDecisionImportFile {
  readonly filename: typeof REFERENCE_REVIEW_DECISION_IMPORT_FILE
  readonly mediaType: typeof REFERENCE_REVIEW_DECISION_IMPORT_MEDIA_TYPE
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly sha256: string
  readonly rowCount: number
}

export function mapReferenceReviewEventsToBioMinerRows(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
): readonly BioMinerReferenceDecisionImportRow[] {
  assertBioMinerCampaign(campaign, items)
  const ledgerFailures = validateVerificationEventLedger(events)
  if (ledgerFailures.length > 0) {
    throw new Error(
      `Reference event ledger is invalid: ${ledgerFailures.join('; ')}`,
    )
  }
  const itemById = new Map(items.map((item) => [item.itemId, item]))
  const eventIds = new Set<string>()
  const rows: BioMinerReferenceDecisionImportRow[] = []
  for (const event of events) {
    assertExactEventFields(event)
    if (eventIds.has(event.eventId)) {
      throw new Error(`Reference event ID is repeated: ${event.eventId}`)
    }
    eventIds.add(event.eventId)
    const item = itemById.get(event.itemId)
    if (item === undefined) {
      throw new Error('Reference event has a stale queue item binding.')
    }
    const failures = validateVerificationEvent(event, campaign, item)
    if (failures.length > 0) {
      throw new Error(`Reference event is invalid: ${failures.join('; ')}`)
    }
    assertCompleteEvent(event)
    if (event.outcome === 'cant_view' || event.outcome === 'skipped') {
      continue
    }
    rows.push(eventRow(event, item))
  }
  return Object.freeze(rows.sort(compareRows).map((row) => Object.freeze(row)))
}

export async function prepareReferenceReviewDecisionImport(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
): Promise<ReferenceDecisionImportFile> {
  const rows = mapReferenceReviewEventsToBioMinerRows(campaign, items, events)
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  let outputCreated = false
  try {
    const engineVersion = await database.getVersion()
    if (engineVersion !== DUCKDB_ENGINE_VERSION) {
      throw new Error(
        `DuckDB engine ${engineVersion} differs from the pinned ${DUCKDB_ENGINE_VERSION} runtime`,
      )
    }
    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      SET TimeZone = 'UTC';
      SET preserve_insertion_order = true;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    await connection.query(`CREATE TABLE reference_review_decision_import (
      import_schema_version VARCHAR NOT NULL,
      review_request_id VARCHAR NOT NULL,
      reference_media_id VARCHAR NOT NULL,
      review_round USMALLINT NOT NULL,
      verified_by VARCHAR NOT NULL,
      reviewed_at TIMESTAMPTZ NOT NULL,
      target_identity_verified BOOLEAN,
      verification_status VARCHAR NOT NULL,
      life_stage VARCHAR NOT NULL,
      visual_domain VARCHAR NOT NULL,
      view VARCHAR NOT NULL,
      review_confidence VARCHAR NOT NULL,
      review_notes VARCHAR,
      exclusion_reason VARCHAR,
      conflicts_with_decision_id VARCHAR
    )`)
    const insert = await connection.prepare(
      `INSERT INTO reference_review_decision_import VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
    )
    try {
      for (const row of rows) {
        await insert.query(
          row.import_schema_version,
          row.review_request_id,
          row.reference_media_id,
          row.review_round,
          row.verified_by,
          row.reviewed_at,
          row.target_identity_verified,
          row.verification_status,
          row.life_stage,
          row.visual_domain,
          row.view,
          row.review_confidence,
          row.review_notes,
          row.exclusion_reason,
          row.conflicts_with_decision_id,
        )
      }
    } finally {
      await insert.close()
    }
    await connection.query(
      `COPY reference_review_decision_import
       TO ${sqlLiteral(REFERENCE_REVIEW_DECISION_IMPORT_FILE)}
       (FORMAT PARQUET, COMPRESSION ZSTD)`,
    )
    outputCreated = true
    const copied = await database.copyFileToBuffer(
      REFERENCE_REVIEW_DECISION_IMPORT_FILE,
    )
    const bytes = new Uint8Array(copied)
    return Object.freeze({
      filename: REFERENCE_REVIEW_DECISION_IMPORT_FILE,
      mediaType: REFERENCE_REVIEW_DECISION_IMPORT_MEDIA_TYPE,
      bytes,
      sha256: await sha256Hex(bytes),
      rowCount: rows.length,
    })
  } finally {
    await connection?.close()
    if (outputCreated) {
      await database.dropFile(REFERENCE_REVIEW_DECISION_IMPORT_FILE)
    }
    await database.terminate()
  }
}

function assertBioMinerCampaign(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
): void {
  if (
    campaign.kind !== 'reference_identity_verification' ||
    campaign.biominerSha === null
  ) {
    throw new Error(
      'Campaign is not bound to a BioMiner reference review queue.',
    )
  }
  if (items.length === 0) {
    throw new Error('BioMiner reference review campaign has no queue items.')
  }
  for (const item of items) {
    if (
      item.campaignId !== campaign.campaignId ||
      !/^reference-review-request:[0-9a-f]{64}$/.test(item.itemId) ||
      !/^reference-media:[0-9a-f]{64}$/.test(item.sourceMediaId)
    ) {
      throw new Error('BioMiner reference review item identity is invalid.')
    }
  }
}

function assertExactEventFields(event: VerificationEvent): void {
  const actual = Object.keys(event).sort()
  const expected = [...EVENT_FIELDS].sort()
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw new Error(
      'Reference event fields differ from the supported handoff contract.',
    )
  }
}

function assertCompleteEvent(event: VerificationEvent): void {
  if (
    !/^[a-z0-9][a-z0-9._:@/-]{2,127}$/.test(event.reviewerId) ||
    event.reviewRound > 65_535
  ) {
    throw new Error('Reference reviewer identity or review round is invalid.')
  }
  if (
    event.alternativeTaxon !== null &&
    (event.alternativeTaxon.acceptedTaxonKey.trim() === '' ||
      event.alternativeTaxon.scientificName.trim() === '')
  ) {
    throw new Error('Reference event has an incomplete decisive outcome.')
  }
  if (
    event.outcome === 'yes' &&
    (event.alternativeTaxon !== null ||
      canonicalOptional(event.exclusionReason, 'exclusionReason') !== null)
  ) {
    throw new Error('Reference event has an incomplete decisive outcome.')
  }
  canonicalOptional(event.comment, 'comment')
  canonicalOptional(event.exclusionReason, 'exclusionReason')
}

function eventRow(
  event: VerificationEvent,
  item: VerificationItem,
): BioMinerReferenceDecisionImportRow {
  const comment = canonicalOptional(event.comment, 'comment')
  const lifeStage =
    event.correctedLifeStage ?? item.expectedLifeStage ?? 'unknown'
  const visualDomain =
    event.correctedVisualDomain ?? item.expectedVisualDomain ?? 'ambiguous'
  const view = event.correctedView ?? item.expectedView ?? 'unknown'
  if (event.outcome === 'yes') {
    return baseRow(event, item, {
      targetIdentityVerified: true,
      verificationStatus: 'verified',
      reviewNotes: comment,
      exclusionReason: null,
      lifeStage,
      visualDomain,
      view,
    })
  }
  if (event.outcome === 'no') {
    return baseRow(event, item, {
      targetIdentityVerified: false,
      verificationStatus: 'excluded',
      reviewNotes: comment,
      exclusionReason:
        canonicalOptional(event.exclusionReason, 'exclusionReason') ??
        'Reviewer selected No for target identity.',
      lifeStage,
      visualDomain,
      view,
    })
  }
  return baseRow(event, item, {
    targetIdentityVerified: null,
    verificationStatus: 'uncertain',
    reviewNotes: comment ?? 'Reviewer could not determine target identity.',
    exclusionReason: null,
    lifeStage,
    visualDomain,
    view,
  })
}

function baseRow(
  event: VerificationEvent,
  item: VerificationItem,
  decision: {
    readonly targetIdentityVerified: boolean | null
    readonly verificationStatus: 'verified' | 'excluded' | 'uncertain'
    readonly reviewNotes: string | null
    readonly exclusionReason: string | null
    readonly lifeStage: string
    readonly visualDomain: string
    readonly view: string
  },
): BioMinerReferenceDecisionImportRow {
  return {
    import_schema_version: REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
    review_request_id: event.itemId,
    reference_media_id: item.sourceMediaId,
    review_round: event.reviewRound,
    verified_by: event.reviewerId,
    reviewed_at: event.reviewedAt,
    target_identity_verified: decision.targetIdentityVerified,
    verification_status: decision.verificationStatus,
    life_stage: decision.lifeStage,
    visual_domain: decision.visualDomain,
    view: decision.view,
    review_confidence: event.confidence,
    review_notes: decision.reviewNotes,
    exclusion_reason: decision.exclusionReason,
    conflicts_with_decision_id: event.conflictsWithDecisionId,
  }
}

function compareRows(
  left: BioMinerReferenceDecisionImportRow,
  right: BioMinerReferenceDecisionImportRow,
): number {
  return (
    left.reference_media_id.localeCompare(right.reference_media_id) ||
    left.review_round - right.review_round ||
    left.verified_by.localeCompare(right.verified_by) ||
    left.reviewed_at.localeCompare(right.reviewed_at) ||
    left.review_request_id.localeCompare(right.review_request_id)
  )
}

function canonicalOptional(value: string | null, label: string): string | null {
  if (value === null) {
    return null
  }
  if (value === '' || value !== value.trim()) {
    throw new Error(`${label} must be nonblank canonical text.`)
  }
  return value
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
