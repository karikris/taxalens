import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { useEffect, useState } from 'react'

import campaignUrl from '../../../../demo/source/verification/papilio-demoleus-flickr-audit.campaign.json?url'
import geographyManifest from '../../../../demo/source/biominer_phase14/flickr_geography/flickr_geography_verification_manifest.json'
import type { TaxaLensProjectFacade } from '../data/projectFacade'
import {
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type VerificationCampaign,
  type VerificationItem,
} from '../review/domain'
import { IndexedDbReviewRepository } from '../review/repositories/indexedDbReviewRepository'
import { subscribeToLocalReviewLedgerChanges } from '../review/repositories/localReviewLedgerEvents'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'
import {
  projectGeographicHumanReviewState,
  type GeographicHumanReviewState,
  type GeographicReviewProjection,
  type GeographicReviewSpatialBinding,
} from './geographicReviewProjection'
import { loadGeographicImpactProjectContext } from './geographicImpactSources'

const GEOGRAPHY_FILE_NAME = 'taxalens_flickr_geographic_review.parquet'
const MAXIMUM_BINDING_ROWS = 1_000
const CAMPAIGN_PACKET_SCHEMA_VERSION =
  'taxalens-flickr-audit-campaign-packet:v1.0.0'

const campaignInput = geographyManifest.inputs.verification_campaign

export interface CommittedFlickrAuditPacket {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
}

export type LocalGeographicReviewProjectionState =
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'loading' }
  | { readonly status: 'failure'; readonly message: string }
  | {
      readonly status: 'available'
      readonly projection: GeographicReviewProjection
      readonly campaignId: string
      readonly localEventCount: number
      readonly failureDiscoveryCampaignStatus: 'unavailable'
      readonly scientificClaimAllowed: false
    }

export function useLocalGeographicReviewProjection({
  enabled,
  load,
  project,
}: {
  readonly enabled: boolean
  readonly load?: (signal: AbortSignal) => Promise<LocalGeographicReviewProjectionState>
  readonly project?: TaxaLensProjectFacade | undefined
}): LocalGeographicReviewProjectionState {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LocalGeographicReviewProjectionState>(
    enabled
      ? { status: 'loading' }
      : {
          status: 'unavailable',
          reason: 'IndexedDB or the local analytical worker is unavailable.',
        },
  )

  useEffect(
    () =>
      enabled
        ? subscribeToLocalReviewLedgerChanges(() =>
            setRevision((current) => current + 1),
          )
        : undefined,
    [enabled],
  )
  useEffect(() => {
    if (!enabled || (load === undefined && project === undefined)) {
      setState({
        status: 'unavailable',
        reason: 'Verified geography, IndexedDB, or the local analytical worker is unavailable.',
      })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    const pending =
      load === undefined
        ? loadPublicGeographicReviewProjection(project!, controller.signal)
        : load(controller.signal)
    void pending.then(
      (next) => {
        if (!controller.signal.aborted) setState(next)
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'failure',
            message:
              error instanceof Error
                ? error.message
                : 'The local geographic review ledger could not be projected.',
          })
        }
      },
    )
    return () => controller.abort()
  }, [enabled, load, project, revision])
  return state
}

export async function loadPublicGeographicReviewProjection(
  project: TaxaLensProjectFacade,
  signal: AbortSignal,
): Promise<LocalGeographicReviewProjectionState> {
  throwIfAborted(signal)
  const context = loadGeographicImpactProjectContext(project)
  const packet = await loadCommittedFlickrAuditPacket(signal)
  if (
    packet.campaign.targetTaxon?.acceptedTaxonKey !==
    context.evidenceScope.targetAcceptedTaxonKey
  ) {
    throw new Error('Flickr audit packet identity differs from the verified geography project')
  }
  const bindings = await loadCommittedGeographicReviewBindings(
    context.flickrGeographyArtifact.bytes,
    packet.campaign.campaignId,
    signal,
  )
  throwIfAborted(signal)
  const repository = new IndexedDbReviewRepository({
    seeds: [{ campaign: packet.campaign, items: packet.items }],
  })
  try {
    const events = await repository.loadEvents(packet.campaign.campaignId)
    throwIfAborted(signal)
    return Object.freeze({
      status: 'available' as const,
      projection: projectGeographicHumanReviewState({
        campaigns: [
          {
            campaign: packet.campaign,
            items: packet.items,
            events,
            // No retained quality snapshot exists in the committed public replay.
            qualitySnapshots: [],
          },
        ],
        bindings,
        // A local ledger cannot create an occurrence-release decision.
        releaseDecisions: [],
      }),
      campaignId: packet.campaign.campaignId,
      localEventCount: events.length,
      failureDiscoveryCampaignStatus: 'unavailable' as const,
      scientificClaimAllowed: false as const,
    })
  } finally {
    await repository.close()
  }
}

export function parseCommittedFlickrAuditPacket(
  candidate: unknown,
): CommittedFlickrAuditPacket {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new Error('Flickr audit packet must be a JSON object')
  }
  const packet = candidate as Record<string, unknown>
  if (packet.schemaVersion !== CAMPAIGN_PACKET_SCHEMA_VERSION) {
    throw new Error('Flickr audit packet schema version differs')
  }
  const campaign = packet.campaign as VerificationCampaign
  const items = packet.items as readonly VerificationItem[]
  if (typeof campaign !== 'object' || campaign === null || !Array.isArray(items)) {
    throw new Error('Flickr audit packet campaign or items are unavailable')
  }
  const failures = [
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
    ...items.flatMap((item) => validateVerificationItem(item, campaign)),
  ]
  if (campaign.kind !== 'flickr_target_verification') {
    failures.push('Flickr audit packet is not a target-verification campaign')
  }
  if (
    campaign.samplingPlan.purpose !== 'quality_estimation' ||
    !campaign.samplingPlan.representative ||
    !campaign.samplingPlan.qualityEstimationAllowed
  ) {
    failures.push('Flickr audit packet no longer represents the declared audit design')
  }
  if (items.length !== campaign.samplingPlan.targetSampleSize) {
    failures.push('Flickr audit item count differs from its sampling plan')
  }
  if (failures.length > 0) {
    throw new Error(`Flickr audit packet is invalid: ${failures.join('; ')}`)
  }
  return deepFreeze({ campaign, items: [...items] })
}

async function loadCommittedFlickrAuditPacket(
  signal: AbortSignal,
): Promise<CommittedFlickrAuditPacket> {
  const bytes = await verifiedSameOriginBytes(
    campaignUrl,
    campaignInput.sha256,
    null,
    'Flickr audit packet',
    signal,
  )
  let candidate: unknown
  try {
    candidate = JSON.parse(new TextDecoder().decode(bytes))
  } catch (error) {
    throw new Error('Flickr audit packet is not valid UTF-8 JSON', { cause: error })
  }
  return parseCommittedFlickrAuditPacket(candidate)
}

async function loadCommittedGeographicReviewBindings(
  verifiedGeographyBytes: Uint8Array<ArrayBuffer>,
  campaignId: string,
  signal: AbortSignal,
): Promise<readonly GeographicReviewSpatialBinding[]> {
  const bytes = verifiedGeographyBytes.slice()
  throwIfAborted(signal)
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  try {
    if ((await database.getVersion()) !== DUCKDB_ENGINE_VERSION) {
      throw new Error('Flickr review projection DuckDB engine version differs')
    }
    await database.registerFileBuffer(GEOGRAPHY_FILE_NAME, bytes)
    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    throwIfAborted(signal)
    const table = await connection.query(`SELECT DISTINCT
        verification_campaign_id,
        verification_item_id,
        spatial_resolution,
        spatial_cell_id,
        cell_supported,
        reviewer_assignment_count,
        human_review_state
      FROM read_parquet(${sqlLiteral(GEOGRAPHY_FILE_NAME)})
      WHERE verification_campaign_id = ${sqlLiteral(campaignId)}
        AND verification_item_id IS NOT NULL
        AND cell_supported = TRUE
      ORDER BY verification_item_id, spatial_resolution, spatial_cell_id
      LIMIT ${MAXIMUM_BINDING_ROWS + 1}`)
    throwIfAborted(signal)
    if (table.numRows > MAXIMUM_BINDING_ROWS) {
      throw new Error('Flickr geographic review binding query exceeded its row bound')
    }
    return decodeBindings(table, campaignId)
  } finally {
    await connection?.close()
    await database.dropFiles()
    await database.terminate()
  }
}

function decodeBindings(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  campaignId: string,
): readonly GeographicReviewSpatialBinding[] {
  return Object.freeze(
    Array.from({ length: table.numRows }, (_, row) => {
      const returnedCampaignId = requiredString(table, 'verification_campaign_id', row)
      if (returnedCampaignId !== campaignId) {
        throw new Error('Flickr geographic review binding campaign differs')
      }
      return Object.freeze({
        campaignId,
        itemId: requiredString(table, 'verification_item_id', row),
        spatialResolution: requiredCount(table, 'spatial_resolution', row),
        spatialCellId: requiredString(table, 'spatial_cell_id', row),
        cellSupported: requiredBoolean(table, 'cell_supported', row),
        reviewerAssignmentCount: requiredCount(
          table,
          'reviewer_assignment_count',
          row,
        ),
        committedReviewState: requiredCommittedState(
          requiredString(table, 'human_review_state', row),
        ),
      })
    }),
  )
}

function requiredCommittedState(value: string): GeographicHumanReviewState {
  switch (value) {
    case 'pending':
    case 'reviewed_target_positive':
    case 'reviewed_non_target':
    case 'uncertain':
    case 'media_failure':
      return value
    case 'deferred':
      return 'skipped'
    default:
      throw new Error(`unsupported committed Flickr review state: ${value}`)
  }
}

async function verifiedSameOriginBytes(
  assetUrl: string,
  expectedSha256: string,
  expectedByteCount: number | null,
  label: string,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const url = new URL(assetUrl, window.location.href)
  if (url.origin !== window.location.origin) {
    throw new Error(`${label} must load from the application origin`)
  }
  const response = await fetch(url, {
    cache: 'force-cache',
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (expectedByteCount !== null && bytes.byteLength !== expectedByteCount) {
    throw new Error(`${label} byte count differs from its manifest`)
  }
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  if (digest !== expectedSha256) {
    throw new Error(`${label} checksum differs from its manifest`)
  }
  return bytes
}

function requiredString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Flickr review binding returned invalid ${column}`)
  }
  return value
}

function requiredCount(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): number {
  const value = table.getChild(column)?.get(row)
  const count = typeof value === 'bigint' ? Number(value) : value
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Flickr review binding returned invalid ${column}`)
  }
  return count
}

function requiredBoolean(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): boolean {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'boolean') {
    throw new Error(`Flickr review binding returned invalid ${column}`)
  }
  return value
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}
