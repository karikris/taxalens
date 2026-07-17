import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import judgeBundleSchema from '../../../../packages/contracts/schema/judge_bundle.schema.json'
import judgeBundleV1Schema from '../../../../packages/contracts/schema/judge_bundle_v1.schema.json'
import {
  JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
  JUDGE_BUNDLE_SCHEMA_VERSION,
  JUDGE_BUNDLE_SECTION_NAMES,
  JUDGE_BUNDLE_V1_SCHEMA_VERSION,
  JUDGE_BUNDLE_V1_SECTION_NAMES,
  type JudgeBundleArtifact,
  type JudgeBundleAvailability,
  type JudgeBundleContract,
  type JudgeBundleSectionName,
  type JudgeBundleV1Contract,
} from '../../../../packages/contracts/src/judge_bundle_contract'
import {
  BundleLoader,
  BundleVerifier,
  PapilioJudgeFixtureValidator,
  TaxaLensProjectFacade,
  type JudgeBundleMigrationReceipt,
  type JudgeBundleMigrationResult,
  type JsonValue,
  type VerifiedProjectArtifact,
} from './projectFacade'

const PAPILIO_FIXTURE = PapilioJudgeFixtureValidator.identity

export { BundleLoader, BundleVerifier, PapilioJudgeFixtureValidator, TaxaLensProjectFacade }
export type {
  JudgeBundleMigrationReceipt,
  JudgeBundleMigrationResult,
  JsonValue,
  VerifiedProjectArtifact,
} from './projectFacade'
export {
  loadCountryHierarchy,
  loadGeographicImpactInput,
  loadGeographicImpactSummary,
  loadGeographicRecordContext,
  type GeographicArtifactLoadResult,
  type GeographicArtifactLoadStatus,
  type GeographicProjectLoaderName,
  type GeographicSectionLoadState,
} from './geographicProjectFacade'

export interface StoredOpenAIReplayArtifact {
  readonly artifactId: string
  readonly path: string
  readonly sha256: string
  readonly value: JsonValue
}

export interface StoredOpenAIReplayTrace {
  readonly traceId: string
  readonly sequence: number
  readonly stageId: string | null
  readonly model: string
  readonly occurredAt: string | null
  readonly requestArtifact: StoredOpenAIReplayArtifact
  readonly responseArtifact: StoredOpenAIReplayArtifact
  readonly storedOutputOnly: true
  readonly credentialsRequired: false
  readonly liveRequestsAllowed: false
}

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

export interface MissionEvidence {
  readonly sourceRegistry: {
    readonly name: string
    readonly version: string
    readonly sourceSnapshotVersion: string
    readonly acceptedIdentityNamespace: string
  }
  readonly queryPolicy: {
    readonly queryCount: number
    readonly queriedSpeciesCount: number
    readonly defaultRetrievalPolicy: string
    readonly occurrenceSearchCeiling: number
    readonly registryIdentityRequired: boolean
    readonly humanReviewBeforeSupport: boolean
    readonly groundTruthPolicy: string
  }
  readonly regions: readonly {
    readonly name: string
    readonly rangeStatus: string
    readonly countryCount: number
    readonly requiresOccurrenceSupport: boolean
    readonly taxonomicCaution: boolean
  }[]
  readonly candidatePolicy: {
    readonly candidateCount: number
    readonly minimumPerSpecies: number
    readonly maximumPerSpecies: number
    readonly candidates: readonly {
      readonly recordId: string
      readonly acceptedTaxonKey: string
      readonly scientificName: string
      readonly candidateReason: string
      readonly verificationStatus: string
    }[]
  }
  readonly referenceRequirements: {
    readonly eligibleSourceMediaCount: number
    readonly humanVerifiedSourceMediaCount: number
    readonly sourceCandidateShortfall: number
    readonly humanVerifiedShortfall: number
    readonly unresolvedGroups: readonly {
      readonly name: string
      readonly status: string
    }[]
  }
  readonly budgets: {
    readonly materializedRequestCount: number
    readonly historicalLocalBuildVerificationImages: number
    readonly localBuildVerificationMaxImages: null
  }
  readonly prerequisiteGates: readonly {
    readonly gateId: string
    readonly status: string
    readonly requiredArtifactCount: number
    readonly requiredComputer: string | null
  }[]
  readonly stoppingConditions: {
    readonly phase15Authorized: boolean
    readonly requiredEvidence: readonly string[]
    readonly largeYoloeRuns: string
    readonly largeBioclipRuns: string
  }
  readonly pipelineStages: readonly {
    readonly stageId: string
    readonly status: string
    readonly recordCount: number
    readonly verificationStatus: string
    readonly scientificClaimAllowed: boolean
    readonly reason: string | null
  }[]
}

export interface ObservatoryEvidence {
  readonly registryTaxonCount: number
  readonly physicalQueryCount: number
  readonly flickrQueryHitCount: number
  readonly canonicalPhotoCount: number
  readonly locatedClusterCount: number
  readonly regionalCandidateCount: number
  readonly eligibleReferenceCandidateCount: number
  readonly yoloeImageCount: number
  readonly fullFrameTransformationCount: number
  readonly candidateVisualScoreCount: number
  readonly calibratedDecisionCount: number
  readonly humanCommentCount: number
  readonly finalEvidenceCount: number
}

export interface ReplayEvidence extends ReplayIdentity {
  readonly schemaVersion: typeof JUDGE_BUNDLE_SCHEMA_VERSION
  readonly title: string
  readonly bundleCreatedAt: string
  readonly mission: MissionEvidence
  readonly observatory: ObservatoryEvidence
  readonly discovery: DiscoveryEvidenceBoundary
  readonly geographyReference: GeographyReferenceEvidenceBoundary
  readonly selectiveDecision: SelectiveDecisionEvidenceBoundary
  readonly prototype: PrototypeEvidenceBoundary
  readonly rightsStatus: string
  readonly artifactCount: number
  readonly verifiedArtifactCount: number
  readonly unavailableSectionCount: number
  readonly unavailableSections: readonly EvidenceSectionState[]
  readonly sections: Readonly<Record<JudgeBundleSectionName, EvidenceSectionState>>
  readonly artifactInventory: readonly ReplayArtifactEvidence[]
  readonly heroRecordId: string
  readonly heroState: 'awaiting_human_review'
  readonly scientificClaimAllowed: false
  readonly verification: {
    readonly inventoryChecksumVerified: true
    readonly payloadRootChecksumVerified: true
    readonly artifactChecksumsVerified: true
    readonly dataMode: 'verified-json-bootstrap'
    readonly fallbackReason: 'analytics_on_demand'
    readonly wasmStarted: false
    readonly bundleMigration: JudgeBundleMigrationReceipt
  }
}

export interface PrototypeEvidenceBoundary {
  readonly status: 'prototype_only_available_with_limitations'
  readonly prototypeIntegrationAuthorized: true
  readonly scientificReleaseAuthorized: false
  readonly productionDefaultChangeAuthorized: false
  readonly publicReferenceImageDisplayAuthorized: false
  readonly scientificClaimAllowed: false
  readonly referenceBank: {
    readonly supportCount: number
    readonly providerSupportedCount: number
    readonly humanVerifiedCount: number
    readonly allowedCount: number
    readonly researchOnlyCount: number
    readonly adultRouteCount: number
    readonly larvalRouteCount: number
    readonly pinnedSpecimenRouteCount: number
    readonly supportTrainCount: number
    readonly modelSelectionCount: number
    readonly calibrationCount: number
    readonly finalTestCount: number
    readonly totalShortfall: number
  }
  readonly userGoalVerification: {
    readonly status: 'verified_complete'
    readonly assertionSource: 'direct_user_confirmation'
    readonly assertedBy: string
    readonly verificationCompletedOn: string
    readonly goal: string
    readonly providerSupportedRecordCount: number
    readonly verifiedRecordCount: number
    readonly recordsMeetingGoalCount: number
    readonly allProviderSupportedRecordsVerified: true
    readonly allVerifiedRecordsMeetGoal: true
    readonly independentHumanTaxonomicVerificationClaimed: false
  }
  readonly runtime: {
    readonly bioclipModelId: string
    readonly bioclipModelRevision: string
    readonly embeddingDimension: number
    readonly frozenSupportEmbeddings: number
    readonly yoloeModelId: string
    readonly yoloeRole: 'gate_and_router_only'
    readonly smokeImageCount: number
    readonly resumedEmbeddingCount: number
  }
  readonly benchmark: {
    readonly recordsScored: number
    readonly experimentCount: number
    readonly b0TargetScoreability: number
    readonly b13TargetScoreability: number
    readonly metricSemantics: string
    readonly classificationAccuracyReported: false
  }
  readonly policy: {
    readonly experimentId: string
    readonly targetAlwaysScored: true
    readonly rawMarginThreshold: number
    readonly scoresAreProbabilities: false
    readonly selectionCoverage: number
    readonly acceptedCount: number
    readonly abstainedCount: number
    readonly calibrationStatus: string
  }
  readonly staged: {
    readonly plannedCount: number
    readonly classifiedCount: number
    readonly retryableFailureCount: number
    readonly candidateScoreRowCount: number
    readonly speciesCandidatesPerRecord: number
    readonly allCandidatesPerRecord: number
    readonly targetScoredRate: number
    readonly stagedAbstainedCount: number
    readonly stagedAbstentionRate: number
    readonly stagedDiagnosticThreshold: number
    readonly recordsPerSecond: number
  }
  readonly semantics: {
    readonly classificationAccuracy: null
    readonly calibrationError: null
    readonly providerSupportedIsHumanVerified: false
    readonly rawScoresAreProbabilities: false
    readonly modelOutputIsTaxonomicValidation: false
    readonly stagedDistributionIsAccuracy: false
    readonly stagedDistributionIsPrevalence: false
  }
  readonly releaseGate: {
    readonly decision: 'GO_PROTOTYPE_ONLY'
    readonly requestedMode: 'explicit_prototype'
    readonly requiredGateCount: number
    readonly passedGateCount: number
    readonly failedGateCount: number
    readonly prototypeIntegrationAuthorized: true
    readonly explicitPrototypeModeOnly: true
    readonly productionDefaultChangeAuthorized: false
    readonly scientificReleaseAuthorized: false
    readonly publicReferenceImageDisplayAuthorized: false
    readonly scientificClaimAllowed: false
  }
  readonly provenance: {
    readonly artifactId: 'prototype-evidence-snapshot'
    readonly snapshotSha256: string
    readonly producerSha: string
    readonly originCommit: string
    readonly importManifestSha256: string
    readonly importedArtifactCount: number
  }
}

export interface DiscoveryEvidenceBoundary {
  readonly media: {
    readonly status: 'unavailable'
    readonly includedImageCount: number
    readonly licensedImageCount: number
    readonly reason: string
  }
  readonly duplicateRelationships: {
    readonly available: false
    readonly reason: string
  }
}

export interface GeographyReferenceEvidenceBoundary {
  readonly geography: {
    readonly recordId: string
    readonly candidateSemantics: string
    readonly verificationStatus: string
    readonly locatedClusterCount: number
    readonly eligibleReferenceClusterCount: number
    readonly fallbackClusterCount: number
    readonly outlierRecordCount: number
    readonly unassignedGeotaggedRecordCount: number
    readonly payloadRowsAvailable: false
  }
  readonly reference: {
    readonly readinessVerificationStatus: string
    readonly shortfallVerificationStatus: string
    readonly eligibleSourceMediaCount: number
    readonly humanVerifiedSourceMediaCount: number
    readonly sourceCandidateShortfall: number
    readonly humanVerifiedShortfall: number
    readonly groupsAwaitingHumanReview: number
    readonly unresolvedGroupCount: number
    readonly workflowMeasurements: {
      readonly observedRequestCount: number
      readonly retryCount: number
      readonly rateLimitCount: number
      readonly checkpointCount: number
      readonly completeCheckpointCount: number
      readonly checkpointPageCount: number
      readonly checkpointObservationRowCount: number
      readonly observationCount: number
      readonly deduplicatedObservationCount: number
      readonly checkpointMediaCandidateRowCount: number
      readonly mediaCandidateCount: number
      readonly deduplicatedMediaCandidateCount: number
      readonly imagesDownloaded: number
    }
  }
  readonly sourceRights: {
    readonly creatorOrOwner: string
    readonly sourceUrl: string
    readonly licenseName: string
    readonly licenseUri: string
    readonly attributionRequired: boolean
    readonly metadataRightsVerified: true
    readonly includedImageCount: number
    readonly licensedImageCount: number
    readonly mediaPolicy: string
  }
}

export interface SelectiveDecisionEvidenceBoundary {
  readonly recordId: string
  readonly state: 'awaiting_human_review'
  readonly displayLabel: string
  readonly allowedTransition: string
  readonly verificationStatus: string
  readonly unavailableReason: string
  readonly decisionStatus: 'unavailable'
  readonly candidateVisualScoreCount: number
  readonly gates: readonly {
    readonly name: string
    readonly satisfied: false
  }[]
}

export interface ReplayArtifactEvidence {
  readonly artifactId: string
  readonly path: string
  readonly role: JudgeBundleArtifact['role']
  readonly sha256: string
  readonly sizeBytes: number
  readonly recordCount: number | null
  readonly producerSha: string
  readonly verified: true
}

export interface AnalyticsCandidateInput {
  readonly acceptedTaxonKey: string
  readonly scientificName: string
  readonly evidenceRole: 'target_under_study' | 'regional_competitor_hypothesis'
  readonly scientificClaimAllowed: false
}

export interface AnalyticsReplayInput {
  readonly artifacts: readonly ParquetArtifactInput[]
  readonly candidateArtifact: AnalyticsArtifactProvenance
  readonly candidates: readonly AnalyticsCandidateInput[]
  readonly receipt: {
    readonly schemaVersion: 'taxalens-biominer-analytics-import:v1.0.0'
    readonly originCommit: string
    readonly sourceManifestSha256: string
  }
}

export interface DiscoveryProvenanceInput {
  readonly artifacts: readonly ParquetArtifactInput[]
  readonly boundary: DiscoveryEvidenceBoundary
  readonly receipt: AnalyticsReplayInput['receipt']
}

export interface AnalyticsArtifactProvenance {
  readonly artifactId: string
  readonly mediaType: string
  readonly path: string
  readonly schemaVersion?: string | null
  readonly sizeBytes: number
  readonly sha256: string
  readonly recordCount: number | null
  readonly producerSha: string
}

export interface ParquetArtifactInput extends AnalyticsArtifactProvenance {
  readonly bytes: Uint8Array<ArrayBuffer>
}

export interface GeographicWorkloadReplayInput {
  readonly artifacts: readonly ParquetArtifactInput[]
  readonly boundary: GeographyReferenceEvidenceBoundary
  readonly targetAcceptedTaxonKey: string
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

type VerifiedArtifact = VerifiedProjectArtifact

export interface EvidenceFacade {
  readonly replay: ReplayEvidence
  loadStoredOpenAIReplay(): readonly StoredOpenAIReplayTrace[]
  loadAnalyticsReplayInput(): AnalyticsReplayInput
  loadDiscoveryProvenanceInput(): DiscoveryProvenanceInput
  loadGeographicWorkloadInput(): GeographicWorkloadReplayInput
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
const validateJudgeBundleV1 = ajv.compile<JudgeBundleV1Contract>(judgeBundleV1Schema)

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

function v1PreservationProjection(
  bundle: JudgeBundleV1Contract | JudgeBundleContract,
): Record<string, unknown> {
  return {
    bundle_id: bundle.bundle_id,
    title: bundle.title,
    created_at: bundle.created_at,
    target: bundle.target,
    source_revisions: bundle.source_revisions,
    artifact_inventory: bundle.artifact_inventory,
    sections: Object.fromEntries(
      JUDGE_BUNDLE_V1_SECTION_NAMES.map((name) => [name, bundle.sections[name]]),
    ),
    rights: bundle.rights,
    attribution: bundle.attribution,
    openai_replay: bundle.openai_replay,
    expected_ui_counts: {
      section_records: Object.fromEntries(
        JUDGE_BUNDLE_V1_SECTION_NAMES.map((name) => [
          name,
          bundle.expected_ui_counts.section_records[name],
        ]),
      ),
      screen_items: bundle.expected_ui_counts.screen_items,
      artifact_count: bundle.expected_ui_counts.artifact_count,
      attribution_count: bundle.expected_ui_counts.attribution_count,
      openai_replay_trace_count: bundle.expected_ui_counts.openai_replay_trace_count,
    },
    checksums: bundle.checksums,
  }
}

function unavailableGeographicSection(name: JudgeBundleSectionName) {
  const hypothesisSections = new Set<JudgeBundleSectionName>([
    'flickr_geography',
    'geographic_impact_cells',
    'geographic_impact_summary',
  ])
  return {
    status: 'unavailable' as const,
    artifact_ids: [],
    reason: `${name} is not present in the source v1 bundle; migration did not invent geographic evidence`,
    candidate_semantics: hypothesisSections.has(name)
      ? ('hypothesis_not_occurrence' as const)
      : ('not_applicable' as const),
    verification_status: 'unavailable' as const,
    human_review_required: true,
    scientific_claim_allowed: false,
  }
}

function schemaVersionOf(candidate: JsonValue): string | null {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return null
  }
  return typeof candidate.schema_version === 'string' ? candidate.schema_version : null
}

function schemaFailure(label: string, instancePath?: string, keyword?: string): never {
  const location = instancePath === '' || instancePath === undefined ? '/' : instancePath
  throw new EvidenceFacadeError(
    `judge_bundle failed ${label} runtime schema validation at ${location} (${keyword ?? 'unknown'})`,
  )
}

/** Project a stored v1 manifest to canonical v2 without changing source files or evidence. */
export async function migrateJudgeBundleToCurrent(
  candidate: JsonValue,
): Promise<JudgeBundleMigrationResult> {
  const sourceSchemaVersion = schemaVersionOf(candidate)
  if (sourceSchemaVersion === JUDGE_BUNDLE_SCHEMA_VERSION) {
    if (!validateJudgeBundle(candidate)) {
      const firstError = validateJudgeBundle.errors?.[0]
      schemaFailure('v2', firstError?.instancePath, firstError?.keyword)
    }
    return {
      manifest: deepFreeze(candidate),
      receipt: deepFreeze({
        sourceSchemaVersion,
        targetSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
        applied: false,
        storedFilesRewritten: false,
        addedSections: [],
        preservedV1FingerprintSha256: null,
      }),
    }
  }
  if (sourceSchemaVersion !== JUDGE_BUNDLE_V1_SCHEMA_VERSION) {
    throw new EvidenceFacadeError(
      `judge_bundle schema_version ${JSON.stringify(sourceSchemaVersion)} is unsupported`,
    )
  }
  if (!validateJudgeBundleV1(candidate)) {
    const firstError = validateJudgeBundleV1.errors?.[0]
    schemaFailure('v1', firstError?.instancePath, firstError?.keyword)
  }

  const sourceCanonical = canonicalJson(candidate)
  const preservedV1FingerprintSha256 = await sha256Hex(
    new TextEncoder().encode(canonicalJson(v1PreservationProjection(candidate))),
  )
  const migrated = structuredClone(candidate) as unknown as JudgeBundleContract
  migrated.schema_version = JUDGE_BUNDLE_SCHEMA_VERSION
  for (const name of JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES) {
    migrated.sections[name] = unavailableGeographicSection(name)
    migrated.expected_ui_counts.section_records[name] = 0
  }
  migrated.expected_ui_counts.unavailable_section_count +=
    JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES.length

  if (!validateJudgeBundle(migrated)) {
    const firstError = validateJudgeBundle.errors?.[0]
    schemaFailure('migrated v2', firstError?.instancePath, firstError?.keyword)
  }
  if (canonicalJson(candidate) !== sourceCanonical) {
    throw new EvidenceFacadeError('v1-to-v2 migration mutated its source bundle')
  }
  const migratedFingerprint = await sha256Hex(
    new TextEncoder().encode(canonicalJson(v1PreservationProjection(migrated))),
  )
  if (migratedFingerprint !== preservedV1FingerprintSha256) {
    throw new EvidenceFacadeError('v1-to-v2 migration changed preserved v1 evidence')
  }
  return {
    manifest: deepFreeze(migrated),
    receipt: deepFreeze({
      sourceSchemaVersion,
      targetSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
      applied: true,
      storedFilesRewritten: false,
      addedSections: [...JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES],
      preservedV1FingerprintSha256,
    }),
  }
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

function array(value: JsonValue | undefined, location: string): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new EvidenceFacadeError(`${location} must be a JSON array`)
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

function numberField(
  record: Record<string, JsonValue>,
  field: string,
  location: string,
): number {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new EvidenceFacadeError(`${location}.${field} must be a finite number`)
  }
  return value
}

function countField(
  record: Record<string, JsonValue>,
  field: string,
  location: string,
): number {
  const value = numberField(record, field, location)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EvidenceFacadeError(`${location}.${field} must be a non-negative safe integer`)
  }
  return value
}

function booleanField(
  record: Record<string, JsonValue>,
  field: string,
  location: string,
): boolean {
  const value = record[field]
  if (typeof value !== 'boolean') {
    throw new EvidenceFacadeError(`${location}.${field} must be a boolean`)
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

const ANALYTICS_ARTIFACT_IDS = Object.freeze([
  'biominer-flickr-query-hits-parquet',
  'biominer-flickr-geography-parquet',
  'biominer-flickr-geo-assignments-parquet',
  'biominer-flickr-geo-clusters-parquet',
] as const)

const ANALYTICS_RECEIPT_ID = 'biominer-analytics-import-receipt'
const ANALYTICS_RECEIPT_SCHEMA = 'taxalens-biominer-analytics-import:v1.0.0' as const

function assertParquetMagic(bytes: Uint8Array<ArrayBuffer>, artifactId: string): void {
  const last = bytes.byteLength - 4
  if (
    bytes.byteLength < 8 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x41 ||
    bytes[2] !== 0x52 ||
    bytes[3] !== 0x31 ||
    bytes[last] !== 0x50 ||
    bytes[last + 1] !== 0x41 ||
    bytes[last + 2] !== 0x52 ||
    bytes[last + 3] !== 0x31
  ) {
    throw new EvidenceFacadeError(`${artifactId} is not a complete Parquet artifact`)
  }
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

async function assertBundleManifestSemantics(manifest: JudgeBundleContract): Promise<void> {
  const inventoryById = assertUniqueInventory(manifest)
  const inventoryIds = new Set(inventoryById.keys())
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
  if (
    manifest.openai_replay.status === 'available' &&
    (manifest.openai_replay.mode !== 'stored_structured_outputs_only' ||
      manifest.openai_replay.traces.length === 0 ||
      manifest.openai_replay.reason === null)
  ) {
    throw new EvidenceFacadeError('Available OpenAI replay lacks a stored-output declaration')
  }
  if (
    manifest.openai_replay.status === 'not_used' &&
    (manifest.openai_replay.mode !== 'not_used' || manifest.openai_replay.traces.length !== 0)
  ) {
    throw new EvidenceFacadeError('Unused OpenAI replay must not declare stored traces')
  }
  const replayTraceIds = new Set<string>()
  const replayTraceSequences = new Set<number>()
  for (const trace of manifest.openai_replay.traces) {
    const requestArtifact =
      trace.request_artifact_id === null
        ? undefined
        : inventoryById.get(trace.request_artifact_id)
    const responseArtifact =
      trace.response_artifact_id === null
        ? undefined
        : inventoryById.get(trace.response_artifact_id)
    if (
      replayTraceIds.has(trace.trace_id) ||
      replayTraceSequences.has(trace.sequence) ||
      trace.model === null ||
      requestArtifact === undefined ||
      responseArtifact === undefined ||
      requestArtifact.artifact_id === responseArtifact.artifact_id ||
      requestArtifact.role !== 'openai_replay_traces' ||
      responseArtifact.role !== 'openai_replay_traces' ||
      requestArtifact.media_type !== 'application/json' ||
      responseArtifact.media_type !== 'application/json' ||
      requestArtifact.record_count !== 1 ||
      responseArtifact.record_count !== 1 ||
      trace.prompt_sha256 !== requestArtifact.sha256 ||
      trace.response_sha256 !== responseArtifact.sha256
    ) {
      throw new EvidenceFacadeError('Stored OpenAI replay trace is incomplete or inconsistent')
    }
    replayTraceIds.add(trace.trace_id)
    replayTraceSequences.add(trace.sequence)
  }
  if (!manifest.rights.all_artifacts_covered || !manifest.attribution.complete) {
    throw new EvidenceFacadeError('Bundle requires complete rights and attribution coverage')
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

function artifactJsonForRole(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
  role: JudgeBundleSectionName,
): JsonValue {
  const artifact = [...artifacts.values()].find(
    (candidate) => candidate.descriptor.role === role && candidate.json !== undefined,
  )
  if (artifact?.json === undefined) {
    throw new EvidenceFacadeError(`${role} has no verified JSON artifact`)
  }
  return artifact.json
}

function artifactJsonById(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
  artifactId: string,
): JsonValue {
  const artifact = artifacts.get(artifactId)
  if (artifact?.json === undefined) {
    throw new EvidenceFacadeError(`${artifactId} has no verified JSON artifact`)
  }
  return artifact.json
}

function recordForRole(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
  role: JudgeBundleSectionName,
  recordId?: string,
): Record<string, JsonValue> {
  const records = array(artifactJsonForRole(artifacts, role), role)
  const value =
    recordId === undefined
      ? records[0]
      : records.find((candidate) => {
          const record = object(candidate, `${role} record`)
          return record.record_id === recordId
        })
  return object(value, recordId === undefined ? `${role}[0]` : `${role}.${recordId}`)
}

function projectMissionEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
): MissionEvidence {
  const queryRecord = recordForRole(artifacts, 'query_definitions')
  const queryData = object(queryRecord.data, 'query_definitions.data')
  const sourcePlan = object(queryData.source_plan, 'query_definitions.data.source_plan')
  const queryScope = object(
    queryData.query_scope_policy,
    'query_definitions.data.query_scope_policy',
  )
  const labelContract = object(queryData.label_contract, 'query_definitions.data.label_contract')
  const sourceRegistry = object(
    queryData.source_registry,
    'query_definitions.data.source_registry',
  )
  const phase15Gate = object(
    queryData.phase15_default_gate,
    'query_definitions.data.phase15_default_gate',
  )

  const rangeRecord = recordForRole(
    artifacts,
    'logical_associations',
    'target-range-planning-hypothesis',
  )
  const rangeData = object(rangeRecord.data, 'logical_associations.target_range.data')
  const regions = array(rangeData.regions, 'logical_associations.target_range.data.regions').map(
    (value, index) => {
      const region = object(value, `regions[${index}]`)
      return {
        name: stringField(region, 'region', `regions[${index}]`),
        rangeStatus: stringField(region, 'range_status', `regions[${index}]`),
        countryCount: array(region.countries, `regions[${index}].countries`).length,
        requiresOccurrenceSupport: booleanField(
          region,
          'requires_occurrence_support',
          `regions[${index}]`,
        ),
        taxonomicCaution: booleanField(region, 'taxonomic_caution', `regions[${index}]`),
      }
    },
  )

  const candidateRows = array(artifactJsonForRole(artifacts, 'candidate_sets'), 'candidate_sets')
  const candidates = candidateRows.map((value, index) => {
    const row = object(value, `candidate_sets[${index}]`)
    const candidate = object(row.candidate, `candidate_sets[${index}].candidate`)
    return {
      recordId: stringField(row, 'record_id', `candidate_sets[${index}]`),
      acceptedTaxonKey: stringField(
        candidate,
        'accepted_taxon_key',
        `candidate_sets[${index}].candidate`,
      ),
      scientificName: stringField(
        candidate,
        'scientific_name',
        `candidate_sets[${index}].candidate`,
      ),
      candidateReason: stringField(
        row,
        'candidate_semantics',
        `candidate_sets[${index}]`,
      ),
      verificationStatus: stringField(
        row,
        'verification_status',
        `candidate_sets[${index}]`,
      ),
    }
  })
  const candidatePolicy = object(candidateRows[0], 'candidate_sets[0]')

  const readinessRecord = recordForRole(artifacts, 'reference_readiness')
  const readinessData = object(readinessRecord.data, 'reference_readiness.data')
  const readinessCounts = object(readinessData.counts, 'reference_readiness.data.counts')
  const materialization = object(
    readinessData.materialization,
    'reference_readiness.data.materialization',
  )
  const executionConstraints = object(
    readinessData.execution_constraints,
    'reference_readiness.data.execution_constraints',
  )

  const shortfallRecord = recordForRole(artifacts, 'reference_shortfalls')
  const shortfallData = object(shortfallRecord.data, 'reference_shortfalls.data')
  const unresolvedGroups = object(
    shortfallData.unresolved_groups,
    'reference_shortfalls.data.unresolved_groups',
  )

  const prerequisiteGates = array(
    queryData.prerequisite_gates,
    'query_definitions.data.prerequisite_gates',
  ).map((value, index) => {
    const gate = object(value, `prerequisite_gates[${index}]`)
    const requiredArtifacts = gate.required_artifacts
    const requiredComputer = gate.required_computer
    if (requiredComputer !== undefined && typeof requiredComputer !== 'string') {
      throw new EvidenceFacadeError(
        `prerequisite_gates[${index}].required_computer must be text`,
      )
    }
    return {
      gateId: stringField(gate, 'gate_id', `prerequisite_gates[${index}]`),
      status: stringField(gate, 'status', `prerequisite_gates[${index}]`),
      requiredArtifactCount:
        requiredArtifacts === undefined
          ? 0
          : array(requiredArtifacts, `prerequisite_gates[${index}].required_artifacts`).length,
      requiredComputer: requiredComputer ?? null,
    }
  })

  const requiredEvidence = array(
    phase15Gate.required_evidence,
    'query_definitions.data.phase15_default_gate.required_evidence',
  ).map((value, index) => {
    if (typeof value !== 'string') {
      throw new EvidenceFacadeError(`required_evidence[${index}] must be text`)
    }
    return value
  })

  const pipelineStages = array(
    artifactJsonForRole(artifacts, 'pipeline_stages'),
    'pipeline_stages',
  ).map((value, index) => {
    const stage = object(value, `pipeline_stages[${index}]`)
    const reason = stage.reason
    if (reason !== undefined && typeof reason !== 'string') {
      throw new EvidenceFacadeError(`pipeline_stages[${index}].reason must be text`)
    }
    return {
      stageId: stringField(stage, 'stage_id', `pipeline_stages[${index}]`),
      status: stringField(stage, 'status', `pipeline_stages[${index}]`),
      recordCount: numberField(stage, 'record_count', `pipeline_stages[${index}]`),
      verificationStatus: stringField(
        stage,
        'verification_status',
        `pipeline_stages[${index}]`,
      ),
      scientificClaimAllowed: booleanField(
        stage,
        'scientific_claim_allowed',
        `pipeline_stages[${index}]`,
      ),
      reason: reason ?? null,
    }
  })

  return deepFreeze({
    sourceRegistry: {
      name: stringField(
        sourceRegistry,
        'registry_name',
        'query_definitions.data.source_registry',
      ),
      version: stringField(
        sourceRegistry,
        'registry_version',
        'query_definitions.data.source_registry',
      ),
      sourceSnapshotVersion: stringField(
        sourceRegistry,
        'source_snapshot_version',
        'query_definitions.data.source_registry',
      ),
      acceptedIdentityNamespace: stringField(
        sourceRegistry,
        'accepted_identity_namespace',
        'query_definitions.data.source_registry',
      ),
    },
    queryPolicy: {
      queryCount: numberField(queryData, 'query_count', 'query_definitions.data'),
      queriedSpeciesCount: numberField(
        sourcePlan,
        'queried_species_count',
        'query_definitions.data.source_plan',
      ),
      defaultRetrievalPolicy: stringField(
        queryScope,
        'default',
        'query_definitions.data.query_scope_policy',
      ),
      occurrenceSearchCeiling: numberField(
        queryScope,
        'gbif_occurrence_search_ceiling',
        'query_definitions.data.query_scope_policy',
      ),
      registryIdentityRequired: booleanField(
        sourcePlan,
        'registry_identity_required',
        'query_definitions.data.source_plan',
      ),
      humanReviewBeforeSupport: booleanField(
        sourcePlan,
        'human_review_required_before_support_use',
        'query_definitions.data.source_plan',
      ),
      groundTruthPolicy: stringField(
        labelContract,
        'ground_truth',
        'query_definitions.data.label_contract',
      ),
    },
    regions,
    candidatePolicy: {
      candidateCount: candidates.length,
      minimumPerSpecies: numberField(candidatePolicy, 'minimum_per_species', 'candidate_sets[0]'),
      maximumPerSpecies: numberField(candidatePolicy, 'maximum_per_species', 'candidate_sets[0]'),
      candidates,
    },
    referenceRequirements: {
      eligibleSourceMediaCount: numberField(
        readinessCounts,
        'eligible_source_media_candidate_count',
        'reference_readiness.data.counts',
      ),
      humanVerifiedSourceMediaCount: numberField(
        readinessCounts,
        'human_verified_source_media_count',
        'reference_readiness.data.counts',
      ),
      sourceCandidateShortfall: numberField(
        shortfallData,
        'source_candidate_shortfall',
        'reference_shortfalls.data',
      ),
      humanVerifiedShortfall: numberField(
        shortfallData,
        'human_verified_shortfall',
        'reference_shortfalls.data',
      ),
      unresolvedGroups: Object.entries(unresolvedGroups)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([name, status]) => {
          if (typeof status !== 'string') {
            throw new EvidenceFacadeError(`unresolved group ${name} status must be text`)
          }
          return { name, status }
        }),
    },
    budgets: {
      materializedRequestCount: numberField(
        materialization,
        'request_count',
        'reference_readiness.data.materialization',
      ),
      historicalLocalBuildVerificationImages: numberField(
        executionConstraints,
        'local_build_verification_max_images',
        'reference_readiness.data.execution_constraints',
      ),
      localBuildVerificationMaxImages: null,
    },
    prerequisiteGates,
    stoppingConditions: {
      phase15Authorized: booleanField(
        phase15Gate,
        'authorized',
        'query_definitions.data.phase15_default_gate',
      ),
      requiredEvidence,
      largeYoloeRuns: stringField(
        executionConstraints,
        'large_yoloe_runs',
        'reference_readiness.data.execution_constraints',
      ),
      largeBioclipRuns: stringField(
        executionConstraints,
        'large_bioclip_runs',
        'reference_readiness.data.execution_constraints',
      ),
    },
    pipelineStages,
  })
}

function projectObservatoryEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
  manifest: JudgeBundleContract,
): ObservatoryEvidence {
  const queryRecord = recordForRole(artifacts, 'query_definitions')
  const queryData = object(queryRecord.data, 'query_definitions.data')
  const sourcePlan = object(queryData.source_plan, 'query_definitions.data.source_plan')

  const flickrRecord = recordForRole(artifacts, 'flickr_candidate_summaries')
  const flickrData = object(flickrRecord.data, 'flickr_candidate_summaries.data')
  const geographyRecord = recordForRole(artifacts, 'geographic_clusters')
  const geographyData = object(geographyRecord.data, 'geographic_clusters.data')

  const candidateRows = array(artifactJsonForRole(artifacts, 'candidate_sets'), 'candidate_sets')
  const readinessRecord = recordForRole(artifacts, 'reference_readiness')
  const readinessData = object(readinessRecord.data, 'reference_readiness.data')
  const readinessCounts = object(readinessData.counts, 'reference_readiness.data.counts')
  const execution = object(
    readinessData.execution_constraints,
    'reference_readiness.data.execution_constraints',
  )

  const runSummary = object(artifactJsonForRole(artifacts, 'run_summary'), 'run_summary')
  const detectionData = object(runSummary.detection_data, 'run_summary.detection_data')
  const transformations = object(
    runSummary.full_frame_transformations,
    'run_summary.full_frame_transformations',
  )
  const candidateEvidence = object(
    runSummary.candidate_evidence,
    'run_summary.candidate_evidence',
  )
  const selectiveDecision = recordForRole(artifacts, 'selective_decision_metadata')
  const visualScores = array(
    selectiveDecision.candidate_visual_scores,
    'selective_decision_metadata.candidate_visual_scores',
  )

  const yoloeImageCount = numberField(
    execution,
    'yoloe_images_processed',
    'reference_readiness.data.execution_constraints',
  )
  const runDetectionCount = numberField(
    detectionData,
    'record_count',
    'run_summary.detection_data',
  )
  if (yoloeImageCount !== runDetectionCount) {
    throw new EvidenceFacadeError('YOLOE stage counts differ across verified artifacts')
  }

  const fullFrameTransformationCount = numberField(
    transformations,
    'record_count',
    'run_summary.full_frame_transformations',
  )
  const bioclipImageCount = numberField(
    execution,
    'bioclip_images_processed',
    'reference_readiness.data.execution_constraints',
  )
  if (fullFrameTransformationCount !== bioclipImageCount) {
    throw new EvidenceFacadeError('Full-frame stage counts differ across verified artifacts')
  }

  const candidateVisualScoreCount = numberField(
    candidateEvidence,
    'candidate_visual_score_count',
    'run_summary.candidate_evidence',
  )
  if (candidateVisualScoreCount !== visualScores.length) {
    throw new EvidenceFacadeError('Candidate visual-score counts differ across verified artifacts')
  }

  const calibratedDecisionCount = selectiveDecision.decision === null ? 0 : 1
  if (calibratedDecisionCount !== 0) {
    throw new EvidenceFacadeError('Truthful metadata replay cannot contain a decision output')
  }

  return deepFreeze({
    registryTaxonCount: numberField(
      sourcePlan,
      'queried_species_count',
      'query_definitions.data.source_plan',
    ),
    physicalQueryCount: numberField(queryData, 'query_count', 'query_definitions.data'),
    flickrQueryHitCount: numberField(
      flickrData,
      'query_hit_count',
      'flickr_candidate_summaries.data',
    ),
    canonicalPhotoCount: numberField(
      flickrData,
      'canonical_photo_count',
      'flickr_candidate_summaries.data',
    ),
    locatedClusterCount: numberField(
      geographyData,
      'located_cluster_count',
      'geographic_clusters.data',
    ),
    regionalCandidateCount: candidateRows.length,
    eligibleReferenceCandidateCount: numberField(
      readinessCounts,
      'eligible_source_media_candidate_count',
      'reference_readiness.data.counts',
    ),
    yoloeImageCount,
    fullFrameTransformationCount,
    candidateVisualScoreCount,
    calibratedDecisionCount,
    humanCommentCount: manifest.expected_ui_counts.section_records.comments,
    finalEvidenceCount: calibratedDecisionCount,
  })
}

function projectDiscoveryEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
): DiscoveryEvidenceBoundary {
  const runSummary = object(artifactJsonForRole(artifacts, 'run_summary'), 'run_summary')
  const media = object(runSummary.media, 'run_summary.media')
  const includedImageCount = numberField(
    media,
    'included_image_count',
    'run_summary.media',
  )
  const licensedImageCount = numberField(
    media,
    'licensed_image_count',
    'run_summary.media',
  )
  if (
    stringField(media, 'status', 'run_summary.media') !== 'unavailable' ||
    includedImageCount !== 0 ||
    licensedImageCount !== 0
  ) {
    throw new EvidenceFacadeError('Discovery media differs from the truthful no-image boundary')
  }

  const duplicateRows = array(
    artifactJsonForRole(artifacts, 'duplicate_summaries'),
    'duplicate_summaries',
  )
  if (duplicateRows.length !== 1) {
    throw new EvidenceFacadeError('Duplicate summary must contain exactly one verified row')
  }
  const duplicateRow = object(duplicateRows[0], 'duplicate_summaries[0]')
  const duplicateData = object(duplicateRow.data, 'duplicate_summaries[0].data')
  if (
    booleanField(
      duplicateData,
      'duplicate_relationship_rows_available',
      'duplicate_summaries[0].data',
    )
  ) {
    throw new EvidenceFacadeError('Truthful fixture cannot expose absent duplicate relationships')
  }

  return deepFreeze({
    media: {
      status: 'unavailable',
      includedImageCount,
      licensedImageCount,
      reason: stringField(media, 'reason', 'run_summary.media'),
    },
    duplicateRelationships: {
      available: false,
      reason:
        'The verified duplicate summary contains counts only; duplicate relationship rows are unavailable.',
    },
  })
}

function projectGeographyReferenceEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
  manifest: JudgeBundleContract,
): GeographyReferenceEvidenceBoundary {
  const geography = recordForRole(artifacts, 'geographic_clusters')
  const geographyData = object(geography.data, 'geographic_clusters.data')
  const readiness = recordForRole(artifacts, 'reference_readiness')
  const readinessData = object(readiness.data, 'reference_readiness.data')
  const readinessCounts = object(readinessData.counts, 'reference_readiness.data.counts')
  const readinessMaterialization = object(
    readinessData.materialization,
    'reference_readiness.data.materialization',
  )
  const readinessExecution = object(
    readinessData.execution_constraints,
    'reference_readiness.data.execution_constraints',
  )
  const shortfalls = recordForRole(artifacts, 'reference_shortfalls')
  const shortfallData = object(shortfalls.data, 'reference_shortfalls.data')
  const rightsArtifact = artifacts.get('rights-manifest')
  if (rightsArtifact?.json === undefined) {
    throw new EvidenceFacadeError('rights-manifest has no verified JSON artifact')
  }
  const rights = object(rightsArtifact.json, 'rights_manifest')
  const rightsItems = array(rights.items, 'rights_manifest.items')
  const metadataRights = rightsItems
    .map((value, index) => object(value, `rights_manifest.items[${index}]`))
    .find((item) => {
      const artifactIds = array(item.artifact_ids, 'rights_manifest.items[].artifact_ids')
      return artifactIds.includes('biominer-flickr-geography-parquet')
    })
  const humanVerifiedSourceMediaCount = numberField(
    readinessCounts,
    'human_verified_source_media_count',
    'reference_readiness.data.counts',
  )
  const includedImageCount = numberField(rights, 'included_image_count', 'rights_manifest')
  const licensedImageCount = numberField(rights, 'licensed_image_count', 'rights_manifest')
  if (
    metadataRights === undefined ||
    booleanField(
      geographyData,
      'payload_rows_available',
      'geographic_clusters.data',
    ) ||
    humanVerifiedSourceMediaCount !== 0 ||
    includedImageCount !== manifest.expected_ui_counts.section_records.verification_media ||
    licensedImageCount !== manifest.expected_ui_counts.section_records.verification_media
  ) {
    throw new EvidenceFacadeError('Geography/reference boundary exceeds the truthful pilot')
  }

  const workflowMeasurements = {
    observedRequestCount: numberField(
      readinessMaterialization,
      'request_count',
      'reference_readiness.data.materialization',
    ),
    retryCount: numberField(
      readinessMaterialization,
      'retry_count',
      'reference_readiness.data.materialization',
    ),
    rateLimitCount: numberField(
      readinessMaterialization,
      'rate_limit_count',
      'reference_readiness.data.materialization',
    ),
    checkpointCount: numberField(
      readinessMaterialization,
      'checkpoint_count',
      'reference_readiness.data.materialization',
    ),
    completeCheckpointCount: numberField(
      readinessMaterialization,
      'complete_checkpoint_count',
      'reference_readiness.data.materialization',
    ),
    checkpointPageCount: numberField(
      readinessMaterialization,
      'checkpoint_page_count',
      'reference_readiness.data.materialization',
    ),
    checkpointObservationRowCount: numberField(
      readinessCounts,
      'checkpoint_observation_row_count',
      'reference_readiness.data.counts',
    ),
    observationCount: numberField(
      readinessCounts,
      'observation_count',
      'reference_readiness.data.counts',
    ),
    deduplicatedObservationCount: numberField(
      readinessCounts,
      'deduplicated_observation_count',
      'reference_readiness.data.counts',
    ),
    checkpointMediaCandidateRowCount: numberField(
      readinessCounts,
      'checkpoint_media_candidate_row_count',
      'reference_readiness.data.counts',
    ),
    mediaCandidateCount: numberField(
      readinessCounts,
      'media_candidate_count',
      'reference_readiness.data.counts',
    ),
    deduplicatedMediaCandidateCount: numberField(
      readinessCounts,
      'deduplicated_media_candidate_count',
      'reference_readiness.data.counts',
    ),
    imagesDownloaded: numberField(
      readinessExecution,
      'images_downloaded',
      'reference_readiness.data.execution_constraints',
    ),
  }
  if (
    workflowMeasurements.completeCheckpointCount !== workflowMeasurements.checkpointCount ||
    workflowMeasurements.observedRequestCount !== workflowMeasurements.checkpointPageCount ||
    workflowMeasurements.checkpointObservationRowCount - workflowMeasurements.observationCount !==
      workflowMeasurements.deduplicatedObservationCount ||
    workflowMeasurements.checkpointMediaCandidateRowCount -
      workflowMeasurements.mediaCandidateCount !==
      workflowMeasurements.deduplicatedMediaCandidateCount ||
    workflowMeasurements.imagesDownloaded !== 0
  ) {
    throw new EvidenceFacadeError('Workflow measurements differ from the truthful pilot boundary')
  }

  return deepFreeze({
    geography: {
      recordId: stringField(geography, 'record_id', 'geographic_clusters'),
      candidateSemantics: stringField(
        geography,
        'candidate_semantics',
        'geographic_clusters',
      ),
      verificationStatus: stringField(
        geography,
        'verification_status',
        'geographic_clusters',
      ),
      locatedClusterCount: numberField(
        geographyData,
        'located_cluster_count',
        'geographic_clusters.data',
      ),
      eligibleReferenceClusterCount: numberField(
        geographyData,
        'eligible_reference_cluster_count',
        'geographic_clusters.data',
      ),
      fallbackClusterCount: numberField(
        geographyData,
        'fallback_cluster_count',
        'geographic_clusters.data',
      ),
      outlierRecordCount: numberField(
        geographyData,
        'outlier_record_count',
        'geographic_clusters.data',
      ),
      unassignedGeotaggedRecordCount: numberField(
        geographyData,
        'unassigned_geotagged_record_count',
        'geographic_clusters.data',
      ),
      payloadRowsAvailable: false,
    },
    reference: {
      readinessVerificationStatus: stringField(
        readiness,
        'verification_status',
        'reference_readiness',
      ),
      shortfallVerificationStatus: stringField(
        shortfalls,
        'verification_status',
        'reference_shortfalls',
      ),
      eligibleSourceMediaCount: numberField(
        readinessCounts,
        'eligible_source_media_candidate_count',
        'reference_readiness.data.counts',
      ),
      humanVerifiedSourceMediaCount,
      sourceCandidateShortfall: numberField(
        shortfallData,
        'source_candidate_shortfall',
        'reference_shortfalls.data',
      ),
      humanVerifiedShortfall: numberField(
        shortfallData,
        'human_verified_shortfall',
        'reference_shortfalls.data',
      ),
      groupsAwaitingHumanReview: numberField(
        shortfallData,
        'groups_awaiting_human_review',
        'reference_shortfalls.data',
      ),
      unresolvedGroupCount: numberField(
        shortfallData,
        'unresolved_group_count',
        'reference_shortfalls.data',
      ),
      workflowMeasurements: {
        ...workflowMeasurements,
        imagesDownloaded: workflowMeasurements.imagesDownloaded,
      },
    },
    sourceRights: {
      creatorOrOwner: stringField(
        metadataRights,
        'creator_or_owner',
        'rights_manifest.items[metadata]',
      ),
      sourceUrl: stringField(metadataRights, 'source_url', 'rights_manifest.items[metadata]'),
      licenseName: stringField(
        metadataRights,
        'license_name',
        'rights_manifest.items[metadata]',
      ),
      licenseUri: stringField(
        metadataRights,
        'license_uri',
        'rights_manifest.items[metadata]',
      ),
      attributionRequired: booleanField(
        metadataRights,
        'attribution_required',
        'rights_manifest.items[metadata]',
      ),
      metadataRightsVerified: true,
      includedImageCount: 0,
      licensedImageCount: 0,
      mediaPolicy: stringField(rights, 'media_policy', 'rights_manifest'),
    },
  })
}

function projectSelectiveDecisionEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
): SelectiveDecisionEvidenceBoundary {
  const record = recordForRole(artifacts, 'selective_decision_metadata')
  const visualScores = array(
    record.candidate_visual_scores,
    'selective_decision_metadata.candidate_visual_scores',
  )
  const gateRows = array(record.gates, 'selective_decision_metadata.gates')
  const gates = gateRows.map((value, index) => {
    const gate = object(value, `selective_decision_metadata.gates[${index}]`)
    if (booleanField(gate, 'satisfied', `selective_decision_metadata.gates[${index}]`)) {
      throw new EvidenceFacadeError('Truthful metadata replay cannot satisfy a decision gate')
    }
    return {
      name: stringField(gate, 'gate', `selective_decision_metadata.gates[${index}]`),
      satisfied: false as const,
    }
  })
  if (
    record.state !== 'awaiting_human_review' ||
    record.decision !== null ||
    record.target_classification !== null ||
    record.image_path !== null ||
    record.media_id !== null ||
    record.scientific_claim_allowed !== false ||
    visualScores.length !== 0
  ) {
    throw new EvidenceFacadeError('Selective decision boundary exceeds the truthful pilot')
  }

  return deepFreeze({
    recordId: stringField(record, 'evidence_record_id', 'selective_decision_metadata'),
    state: 'awaiting_human_review',
    displayLabel: stringField(record, 'display_label', 'selective_decision_metadata'),
    allowedTransition: stringField(
      record,
      'allowed_transition',
      'selective_decision_metadata',
    ),
    verificationStatus: stringField(
      record,
      'verification_status',
      'selective_decision_metadata',
    ),
    unavailableReason: stringField(
      record,
      'unavailable_reason',
      'selective_decision_metadata',
    ),
    decisionStatus: 'unavailable',
    candidateVisualScoreCount: visualScores.length,
    gates,
  })
}

function projectPrototypeEvidence(
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
): PrototypeEvidenceBoundary {
  const artifact = artifacts.get('prototype-evidence-snapshot')
  if (artifact?.json === undefined) {
    throw new EvidenceFacadeError('prototype-evidence-snapshot has no verified JSON artifact')
  }
  const snapshot = object(
    artifactJsonById(artifacts, 'prototype-evidence-snapshot'),
    'prototype_evidence_snapshot',
  )
  if (
    stringField(snapshot, 'schema_version', 'prototype_evidence_snapshot') !==
      'taxalens-biominer-prototype-evidence:v1.1.0' ||
    stringField(snapshot, 'origin_repository', 'prototype_evidence_snapshot') !==
      'karikris/BioMiner' ||
    stringField(snapshot, 'origin_commit', 'prototype_evidence_snapshot') !==
      PAPILIO_FIXTURE.biominerSha ||
    snapshot.status !== 'prototype_only_available_with_limitations' ||
    snapshot.prototype_integration_authorized !== true ||
    snapshot.production_default_change_authorized !== false ||
    snapshot.scientific_release_authorized !== false ||
    snapshot.public_reference_image_display_authorized !== false ||
    snapshot.scientific_claim_allowed !== false
  ) {
    throw new EvidenceFacadeError('Prototype evidence exceeds the admitted prototype boundary')
  }

  const contracts = object(snapshot.contracts, 'prototype_evidence_snapshot.contracts')
  if (
    countField(snapshot, 'contract_count', 'prototype_evidence_snapshot') !==
    Object.keys(contracts).length
  ) {
    throw new EvidenceFacadeError('Prototype contract count differs from the verified snapshot')
  }
  const contractData = (name: string): Record<string, JsonValue> => {
    const contract = object(contracts[name], `prototype_evidence_snapshot.contracts.${name}`)
    if (
      contract.scientific_claim_allowed !== false ||
      typeof contract.candidate_semantics !== 'string' ||
      typeof contract.verification_status !== 'string'
    ) {
      throw new EvidenceFacadeError(`${name} prototype contract has unsafe claim semantics`)
    }
    return object(contract.data, `prototype_evidence_snapshot.contracts.${name}.data`)
  }

  const reference = contractData('reference_bank')
  const referenceCounts = object(reference.counts, 'prototype.reference_bank.counts')
  const licence = object(
    reference.licence_policy_distribution,
    'prototype.reference_bank.licence_policy_distribution',
  )
  const routes = object(
    reference.route_distribution,
    'prototype.reference_bank.route_distribution',
  )
  const splits = object(
    reference.split_distribution,
    'prototype.reference_bank.split_distribution',
  )
  const shortfalls = object(
    reference.support_shortfalls,
    'prototype.reference_bank.support_shortfalls',
  )

  const runtime = contractData('vision_runtime')
  const bioclip = object(runtime.bioclip, 'prototype.vision_runtime.bioclip')
  const yoloe = object(runtime.yoloe, 'prototype.vision_runtime.yoloe')
  const smoke = object(runtime.smoke, 'prototype.vision_runtime.smoke')
  const resume = object(
    runtime.resume_and_cache,
    'prototype.vision_runtime.resume_and_cache',
  )

  const benchmark = contractData('benchmark')
  const benchmarkExecution = object(benchmark.execution, 'prototype.benchmark.execution')
  const comparison = object(
    benchmark.model_selection_comparison,
    'prototype.benchmark.model_selection_comparison',
  )
  const b0 = object(comparison.B0, 'prototype.benchmark.model_selection_comparison.B0')
  const b13 = object(comparison.B13, 'prototype.benchmark.model_selection_comparison.B13')
  const experimentIds = array(
    benchmarkExecution.experiment_ids,
    'prototype.benchmark.execution.experiment_ids',
  )

  const policy = contractData('selected_policy')
  const selectedPolicy = object(policy.selected_policy, 'prototype.selected_policy.policy')
  const marginPolicy = object(policy.margin_policy, 'prototype.selected_policy.margin_policy')
  const selection = object(
    policy.selection_evidence,
    'prototype.selected_policy.selection_evidence',
  )
  const calibration = object(policy.calibration, 'prototype.selected_policy.calibration')

  const staged = contractData('staged_inference')
  const preselection = object(
    staged.staged_preselection_abstention,
    'prototype.staged_inference.staged_preselection_abstention',
  )
  const reasonCounts = object(
    preselection.reason_counts,
    'prototype.staged_inference.staged_preselection_abstention.reason_counts',
  )
  const performance = object(staged.performance, 'prototype.staged_inference.performance')
  const stagedSemantics = object(
    staged.staged_manifest_semantics,
    'prototype.staged_inference.semantics',
  )

  const semantics = contractData('evidence_semantics')
  const limitations = array(semantics.known_limitations, 'prototype.evidence_semantics.limitations')
  const phase15 = contractData('phase15_release')
  const authorization = object(phase15.authorization, 'prototype.phase15_release.authorization')
  const userGoal = contractData('provider_support_goal_verification')
  const userGoalSemantics = object(
    userGoal.semantics,
    'prototype.provider_support_goal_verification.semantics',
  )
  const fingerprints = contractData('handoff_fingerprints')
  const gateSummary = object(phase15.gate_summary, 'prototype.phase15_release.gate_summary')
  const importedFiles = array(
    fingerprints.imported_files,
    'prototype.handoff_fingerprints.imported_files',
  )

  const supportCount = countField(
    referenceCounts,
    'prototype_support',
    'prototype.reference_bank.counts',
  )
  const providerSupportedCount = countField(
    referenceCounts,
    'provider_supported',
    'prototype.reference_bank.counts',
  )
  const humanVerifiedCount = countField(
    referenceCounts,
    'human_verified',
    'prototype.reference_bank.counts',
  )
  const allowedCount = countField(licence, 'allowed', 'prototype.reference_bank.licence')
  const researchOnlyCount = countField(
    licence,
    'research_only',
    'prototype.reference_bank.licence',
  )
  const adultRouteCount = countField(
    routes,
    'adult_field',
    'prototype.reference_bank.routes',
  )
  const larvalRouteCount = countField(routes, 'larval', 'prototype.reference_bank.routes')
  const pinnedSpecimenRouteCount = countField(
    routes,
    'pinned_specimen',
    'prototype.reference_bank.routes',
  )
  const supportTrainCount = countField(
    splits,
    'support_train',
    'prototype.reference_bank.splits',
  )
  const modelSelectionCount = countField(
    splits,
    'model_selection',
    'prototype.reference_bank.splits',
  )
  const calibrationCount = countField(
    splits,
    'calibration',
    'prototype.reference_bank.splits',
  )
  const finalTestCount = countField(splits, 'final_test', 'prototype.reference_bank.splits')
  const totalShortfall = countField(
    shortfalls,
    'total_shortfall',
    'prototype.reference_bank.shortfalls',
  )
  const embeddingDimension = countField(
    bioclip,
    'embedding_dimension',
    'prototype.vision_runtime.bioclip',
  )
  const frozenSupportEmbeddings = countField(
    bioclip,
    'frozen_support_embeddings',
    'prototype.vision_runtime.bioclip',
  )
  const smokeImageCount = countField(smoke, 'images', 'prototype.vision_runtime.smoke')
  const resumedEmbeddingCount = countField(
    resume,
    'support_embedding_resume_reused',
    'prototype.vision_runtime.resume',
  )
  const recordsScored = countField(benchmark, 'records_scored', 'prototype.benchmark')
  const b0TargetScoreability = numberField(
    b0,
    'target_scoreability_rate',
    'prototype.benchmark.B0',
  )
  const b13TargetScoreability = numberField(
    b13,
    'target_scoreability_rate',
    'prototype.benchmark.B13',
  )
  const experimentCount = experimentIds.length
  const rawMarginThreshold = numberField(
    marginPolicy,
    'threshold',
    'prototype.selected_policy.margin',
  )
  const selectionCoverage = numberField(
    selection,
    'coverage_at_raw_margin_policy',
    'prototype.selected_policy.selection',
  )
  const acceptedCount = countField(
    selection,
    'accepted_count',
    'prototype.selected_policy.selection',
  )
  const abstainedCount = countField(
    selection,
    'abstained_count',
    'prototype.selected_policy.selection',
  )
  const plannedCount = countField(staged, 'planned', 'prototype.staged_inference')
  const classifiedCount = countField(staged, 'classified', 'prototype.staged_inference')
  const retryableFailureCount = countField(
    staged,
    'retryable_failures',
    'prototype.staged_inference',
  )
  const candidateScoreRowCount = countField(
    staged,
    'candidate_score_rows',
    'prototype.staged_inference',
  )
  const speciesCandidatesPerRecord = countField(
    staged,
    'species_candidates_per_classified_record',
    'prototype.staged_inference',
  )
  const allCandidatesPerRecord = countField(
    staged,
    'all_candidates_per_classified_record',
    'prototype.staged_inference',
  )
  const targetScoredRate = numberField(
    staged,
    'target_scored_rate',
    'prototype.staged_inference',
  )
  const stagedAbstainedCount = countField(
    preselection,
    'abstained',
    'prototype.staged_inference.preselection',
  )
  const stagedAbstentionRate = numberField(
    preselection,
    'abstention_rate',
    'prototype.staged_inference.preselection',
  )
  const providerSupportedRecordCount = countField(
    userGoal,
    'provider_supported_record_count',
    'prototype.provider_support_goal_verification',
  )
  const verifiedRecordCount = countField(
    userGoal,
    'verified_record_count',
    'prototype.provider_support_goal_verification',
  )
  const recordsMeetingGoalCount = countField(
    userGoal,
    'records_meeting_goal_count',
    'prototype.provider_support_goal_verification',
  )
  const importedArtifactCount = countField(
    fingerprints,
    'imported_artifact_count',
    'prototype.handoff_fingerprints',
  )
  const requiredGateCount = countField(
    gateSummary,
    'required',
    'prototype.phase15_release.gate_summary',
  )
  const passedGateCount = countField(
    gateSummary,
    'passed',
    'prototype.phase15_release.gate_summary',
  )
  const failedGateCount = countField(
    gateSummary,
    'failed',
    'prototype.phase15_release.gate_summary',
  )

  const shortfallRows = array(
    shortfalls.by_reference_group,
    'prototype.reference_bank.shortfalls.by_reference_group',
  )
  const shortfallTotal = shortfallRows.reduce<number>((total, value, index) => {
    const row = object(value, `prototype.reference_bank.shortfalls.by_reference_group[${index}]`)
    return (
      total +
      countField(row, 'shortfall', 'prototype.reference_bank.shortfalls.by_reference_group')
    )
  }, 0)
  const reasonCountTotal = Object.keys(reasonCounts).reduce(
    (total, field) =>
      total + countField(reasonCounts, field, 'prototype.staged.reason_counts'),
    0,
  )
  const observedAbstentionRate = classifiedCount === 0 ? 0 : stagedAbstainedCount / classifiedCount
  const observedSelectionCoverage =
    modelSelectionCount === 0 ? 0 : acceptedCount / modelSelectionCount

  if (
    supportCount !== providerSupportedCount ||
    supportCount !== allowedCount + researchOnlyCount ||
    supportCount !== adultRouteCount + larvalRouteCount + pinnedSpecimenRouteCount ||
    supportCount !== supportTrainCount + modelSelectionCount + calibrationCount + finalTestCount ||
    supportCount !== frozenSupportEmbeddings ||
    supportCount !== resumedEmbeddingCount ||
    supportCount !== recordsScored ||
    humanVerifiedCount > providerSupportedCount ||
    totalShortfall !== shortfallTotal ||
    countField(
      benchmarkExecution,
      'experiment_rows_per_record',
      'prototype.benchmark.execution',
    ) !== experimentCount ||
    modelSelectionCount !== acceptedCount + abstainedCount ||
    Math.abs(selectionCoverage - observedSelectionCoverage) > 0.000001 ||
    plannedCount !== classifiedCount + retryableFailureCount ||
    candidateScoreRowCount !== classifiedCount * allCandidatesPerRecord ||
    speciesCandidatesPerRecord > allCandidatesPerRecord ||
    stagedAbstainedCount > classifiedCount ||
    stagedAbstainedCount !== reasonCountTotal ||
    Math.abs(stagedAbstentionRate - observedAbstentionRate) > 0.000001 ||
    providerSupportedRecordCount !== providerSupportedCount ||
    verifiedRecordCount !== providerSupportedRecordCount ||
    recordsMeetingGoalCount !== verifiedRecordCount ||
    importedArtifactCount !== importedFiles.length ||
    requiredGateCount !== passedGateCount + failedGateCount ||
    passedGateCount !== requiredGateCount ||
    failedGateCount > 0 ||
    embeddingDimension < 1 ||
    smokeImageCount < 1 ||
    b0TargetScoreability < 0 ||
    b0TargetScoreability > 1 ||
    b13TargetScoreability < 0 ||
    b13TargetScoreability > 1 ||
    rawMarginThreshold < 0 ||
    rawMarginThreshold > 1 ||
    targetScoredRate < 0 ||
    targetScoredRate > 1
  ) {
    throw new EvidenceFacadeError('Prototype evidence counts do not reconcile')
  }
  if (
    stringField(selectedPolicy, 'experiment_id', 'prototype.selected_policy.policy') !== 'B13' ||
    selectedPolicy.target_always_scored !== true ||
    marginPolicy.scores_are_probabilities !== false ||
    benchmark.classification_accuracy_reported !== false ||
    stringField(yoloe, 'role', 'prototype.vision_runtime.yoloe') !== 'gate_and_router_only' ||
    semantics.classification_accuracy !== null ||
    semantics.calibration_error !== null ||
    semantics.provider_supported_is_human_verified !== false ||
    semantics.raw_scores_are_probabilities !== false ||
    semantics.model_output_is_taxonomic_validation !== false ||
    stagedSemantics.model_output_is_taxonomic_validation !== false ||
    stagedSemantics.scores_are_calibrated_probabilities !== false ||
    authorization.prototype_integration !== true ||
    authorization.explicit_prototype_mode_only !== true ||
    authorization.production_default_change !== false ||
    authorization.scientific_release !== false ||
    authorization.public_reference_image_display !== false ||
    userGoal.status !== 'verified_complete' ||
    userGoal.assertion_source !== 'direct_user_confirmation' ||
    userGoal.all_provider_supported_records_verified !== true ||
    userGoal.all_verified_records_meet_goal !== true ||
    userGoalSemantics.verification_is_user_goal_suitability_confirmation !== true ||
    userGoalSemantics.independent_human_taxonomic_verification_claimed !== false ||
    userGoalSemantics.classification_accuracy_authorized !== false ||
    userGoalSemantics.scientific_release_authorized !== false ||
    userGoalSemantics.production_default_change_authorized !== false ||
    !stringField(preselection, 'policy_note', 'prototype.staged.preselection').includes('0.10') ||
    !limitations.some(
      (value) => typeof value === 'string' && value.toLowerCase().includes('prevalence'),
    )
  ) {
    throw new EvidenceFacadeError('Prototype evidence semantics are incomplete or contradictory')
  }

  return deepFreeze({
    status: 'prototype_only_available_with_limitations',
    prototypeIntegrationAuthorized: true,
    scientificReleaseAuthorized: false,
    productionDefaultChangeAuthorized: false,
    publicReferenceImageDisplayAuthorized: false,
    scientificClaimAllowed: false,
    referenceBank: {
      supportCount,
      providerSupportedCount,
      humanVerifiedCount,
      allowedCount,
      researchOnlyCount,
      adultRouteCount,
      larvalRouteCount,
      pinnedSpecimenRouteCount,
      supportTrainCount,
      modelSelectionCount,
      calibrationCount,
      finalTestCount,
      totalShortfall,
    },
    userGoalVerification: {
      status: 'verified_complete',
      assertionSource: 'direct_user_confirmation',
      assertedBy: stringField(
        userGoal,
        'asserted_by',
        'prototype.provider_support_goal_verification',
      ),
      verificationCompletedOn: stringField(
        userGoal,
        'verification_completed_on',
        'prototype.provider_support_goal_verification',
      ),
      goal: stringField(
        userGoal,
        'goal',
        'prototype.provider_support_goal_verification',
      ),
      providerSupportedRecordCount,
      verifiedRecordCount,
      recordsMeetingGoalCount,
      allProviderSupportedRecordsVerified: true,
      allVerifiedRecordsMeetGoal: true,
      independentHumanTaxonomicVerificationClaimed: false,
    },
    runtime: {
      bioclipModelId: stringField(bioclip, 'model_id', 'prototype.vision_runtime.bioclip'),
      bioclipModelRevision: stringField(
        bioclip,
        'model_revision',
        'prototype.vision_runtime.bioclip',
      ),
      embeddingDimension,
      frozenSupportEmbeddings,
      yoloeModelId: stringField(yoloe, 'model_id', 'prototype.vision_runtime.yoloe'),
      yoloeRole: 'gate_and_router_only',
      smokeImageCount,
      resumedEmbeddingCount,
    },
    benchmark: {
      recordsScored,
      experimentCount,
      b0TargetScoreability,
      b13TargetScoreability,
      metricSemantics: stringField(benchmark, 'metric_semantics', 'prototype.benchmark'),
      classificationAccuracyReported: false,
    },
    policy: {
      experimentId: stringField(
        selectedPolicy,
        'experiment_id',
        'prototype.selected_policy.policy',
      ),
      targetAlwaysScored: true,
      rawMarginThreshold,
      scoresAreProbabilities: false,
      selectionCoverage,
      acceptedCount,
      abstainedCount,
      calibrationStatus: stringField(
        calibration,
        'status',
        'prototype.selected_policy.calibration',
      ),
    },
    staged: {
      plannedCount,
      classifiedCount,
      retryableFailureCount,
      candidateScoreRowCount,
      speciesCandidatesPerRecord,
      allCandidatesPerRecord,
      targetScoredRate,
      stagedAbstainedCount,
      stagedAbstentionRate,
      stagedDiagnosticThreshold: 0.02,
      recordsPerSecond: numberField(
        performance,
        'records_per_second',
        'prototype.staged_inference.performance',
      ),
    },
    semantics: {
      classificationAccuracy: null,
      calibrationError: null,
      providerSupportedIsHumanVerified: false,
      rawScoresAreProbabilities: false,
      modelOutputIsTaxonomicValidation: false,
      stagedDistributionIsAccuracy: false,
      stagedDistributionIsPrevalence: false,
    },
    releaseGate: {
      decision: 'GO_PROTOTYPE_ONLY',
      requestedMode: 'explicit_prototype',
      requiredGateCount,
      passedGateCount,
      failedGateCount,
      prototypeIntegrationAuthorized: true,
      explicitPrototypeModeOnly: true,
      productionDefaultChangeAuthorized: false,
      scientificReleaseAuthorized: false,
      publicReferenceImageDisplayAuthorized: false,
      scientificClaimAllowed: false,
    },
    provenance: {
      artifactId: 'prototype-evidence-snapshot',
      snapshotSha256: artifact.descriptor.sha256,
      producerSha: artifact.descriptor.source_commit,
      originCommit: PAPILIO_FIXTURE.biominerSha,
      importManifestSha256: stringField(
        fingerprints,
        'import_manifest_sha256',
        'prototype.handoff_fingerprints',
      ),
      importedArtifactCount,
    },
  })
}

function validateAnalyticsArtifacts(artifacts: ReadonlyMap<string, VerifiedArtifact>): void {
  const receiptArtifact = artifacts.get(ANALYTICS_RECEIPT_ID)
  if (receiptArtifact?.json === undefined) {
    throw new EvidenceFacadeError('Verified bundle has no analytics import receipt')
  }
  const receipt = object(receiptArtifact.json, 'analytics_import_receipt')
  if (
    stringField(receipt, 'schema_version', 'analytics_import_receipt') !==
      ANALYTICS_RECEIPT_SCHEMA ||
    stringField(receipt, 'origin_repository', 'analytics_import_receipt') !==
      'karikris/BioMiner' ||
    stringField(receipt, 'origin_commit', 'analytics_import_receipt') !==
      PAPILIO_FIXTURE.legacyBiominerSha ||
    receipt.scientific_claim_allowed !== false
  ) {
    throw new EvidenceFacadeError('Analytics receipt is outside the bounded BioMiner replay')
  }
  const sourceManifest = object(receipt.source_manifest, 'analytics_import_receipt.source_manifest')
  if (
    stringField(sourceManifest, 'sha256', 'analytics_import_receipt.source_manifest') !==
    PAPILIO_FIXTURE.analyticsSourceManifestSha256
  ) {
    throw new EvidenceFacadeError('Analytics source-manifest checksum differs')
  }
  const rows = array(receipt.artifacts, 'analytics_import_receipt.artifacts')
  const byId = new Map(
    rows.map((value, index) => {
      const row = object(value, `analytics_import_receipt.artifacts[${index}]`)
      return [stringField(row, 'artifact_id', `analytics_import_receipt.artifacts[${index}]`), row]
    }),
  )
  if (
    byId.size !== ANALYTICS_ARTIFACT_IDS.length ||
    [...byId.keys()].some(
      (artifactId) =>
        !ANALYTICS_ARTIFACT_IDS.includes(
          artifactId as (typeof ANALYTICS_ARTIFACT_IDS)[number],
        ),
    )
  ) {
    throw new EvidenceFacadeError('Analytics receipt artifact set differs')
  }
  for (const artifactId of ANALYTICS_ARTIFACT_IDS) {
    const verified = artifacts.get(artifactId)
    const row = byId.get(artifactId)
    if (verified === undefined || row === undefined) {
      throw new EvidenceFacadeError(`Analytics artifact ${artifactId} is missing`)
    }
    const descriptor = verified.descriptor
    if (
      descriptor.media_type !== 'application/vnd.apache.parquet' ||
      descriptor.path !== stringField(row, 'fixture_path', artifactId) ||
      descriptor.sha256 !== stringField(row, 'sha256', artifactId) ||
      descriptor.bytes !== numberField(row, 'byte_count', artifactId) ||
      descriptor.record_count !== numberField(row, 'record_count', artifactId) ||
      descriptor.schema_version !== stringField(row, 'schema_version', artifactId)
    ) {
      throw new EvidenceFacadeError(`${artifactId} differs from the analytics import receipt`)
    }
    assertParquetMagic(verified.bytes, artifactId)
  }
}

function projectStoredOpenAIReplay(
  manifest: JudgeBundleContract,
  artifacts: ReadonlyMap<string, VerifiedArtifact>,
): readonly StoredOpenAIReplayTrace[] {
  if (manifest.openai_replay.status !== 'available') {
    return Object.freeze([])
  }
  return deepFreeze(
    [...manifest.openai_replay.traces]
      .sort((left, right) => left.sequence - right.sequence)
      .map((trace) => {
        if (
          trace.model === null ||
          trace.request_artifact_id === null ||
          trace.response_artifact_id === null
        ) {
          throw new EvidenceFacadeError('Stored OpenAI replay trace references are incomplete')
        }
        const request = artifacts.get(trace.request_artifact_id)
        const response = artifacts.get(trace.response_artifact_id)
        if (request?.json === undefined || response?.json === undefined) {
          throw new EvidenceFacadeError('Stored OpenAI replay JSON was not verified')
        }
        return {
          traceId: trace.trace_id,
          sequence: trace.sequence,
          stageId: trace.stage_id,
          model: trace.model,
          occurredAt: trace.occurred_at,
          requestArtifact: {
            artifactId: request.descriptor.artifact_id,
            path: request.descriptor.path,
            sha256: request.descriptor.sha256,
            value: request.json,
          },
          responseArtifact: {
            artifactId: response.descriptor.artifact_id,
            path: response.descriptor.path,
            sha256: response.descriptor.sha256,
            value: response.json,
          },
          storedOutputOnly: true as const,
          credentialsRequired: false as const,
          liveRequestsAllowed: false as const,
        }
      }),
  )
}

class VerifiedEvidenceFacade implements EvidenceFacade {
  readonly replay: ReplayEvidence
  readonly #artifacts: ReadonlyMap<string, VerifiedArtifact>
  readonly #storedOpenAIReplay: readonly StoredOpenAIReplayTrace[]

  constructor(
    replay: ReplayEvidence,
    artifacts: ReadonlyMap<string, VerifiedArtifact>,
    storedOpenAIReplay: readonly StoredOpenAIReplayTrace[],
  ) {
    this.replay = replay
    this.#artifacts = artifacts
    this.#storedOpenAIReplay = storedOpenAIReplay
  }

  loadStoredOpenAIReplay(): readonly StoredOpenAIReplayTrace[] {
    return this.#storedOpenAIReplay
  }

  loadAnalyticsReplayInput(): AnalyticsReplayInput {
    const artifacts = ANALYTICS_ARTIFACT_IDS.map((artifactId) => {
      const artifact = this.#artifacts.get(artifactId)
      if (artifact === undefined) {
        throw new EvidenceFacadeError(`${artifactId} was not verified`)
      }
      return Object.freeze({
        artifactId,
        mediaType: artifact.descriptor.media_type,
        path: artifact.descriptor.path,
        schemaVersion: artifact.descriptor.schema_version,
        sizeBytes: artifact.descriptor.bytes,
        sha256: artifact.descriptor.sha256,
        recordCount: artifact.descriptor.record_count,
        producerSha: artifact.descriptor.source_commit,
        bytes: artifact.bytes.slice(),
      })
    })
    const candidateArtifact = this.#artifacts.get('candidate-sets')
    if (candidateArtifact === undefined || candidateArtifact.descriptor.record_count === null) {
      throw new EvidenceFacadeError('candidate-sets provenance was not verified')
    }
    const candidates: AnalyticsCandidateInput[] = [
      {
        acceptedTaxonKey: this.replay.target.acceptedTaxonKey,
        scientificName: this.replay.target.scientificName,
        evidenceRole: 'target_under_study',
        scientificClaimAllowed: false,
      },
      ...this.replay.mission.candidatePolicy.candidates.map((candidate) => ({
        ...candidate,
        evidenceRole: 'regional_competitor_hypothesis' as const,
        scientificClaimAllowed: false as const,
      })),
    ]
    return Object.freeze({
      artifacts: Object.freeze(artifacts),
      candidateArtifact: Object.freeze({
        artifactId: candidateArtifact.descriptor.artifact_id,
        mediaType: candidateArtifact.descriptor.media_type,
        path: candidateArtifact.descriptor.path,
        schemaVersion: candidateArtifact.descriptor.schema_version,
        sizeBytes: candidateArtifact.descriptor.bytes,
        sha256: candidateArtifact.descriptor.sha256,
        recordCount: candidateArtifact.descriptor.record_count,
        producerSha: candidateArtifact.descriptor.source_commit,
      }),
      candidates: deepFreeze(candidates),
      receipt: Object.freeze({
        schemaVersion: ANALYTICS_RECEIPT_SCHEMA,
        originCommit: PAPILIO_FIXTURE.legacyBiominerSha,
        sourceManifestSha256: PAPILIO_FIXTURE.analyticsSourceManifestSha256,
      }),
    })
  }

  loadDiscoveryProvenanceInput(): DiscoveryProvenanceInput {
    const analytics = this.loadAnalyticsReplayInput()
    const artifactIds = new Set([
      'biominer-flickr-query-hits-parquet',
      'biominer-flickr-geography-parquet',
      'biominer-flickr-geo-assignments-parquet',
      'biominer-flickr-geo-clusters-parquet',
    ])
    const artifacts = analytics.artifacts.filter(({ artifactId }) => artifactIds.has(artifactId))
    if (artifacts.length !== 4) {
      throw new EvidenceFacadeError('Discovery context requires four verified Parquet artifacts')
    }
    return Object.freeze({
      artifacts: Object.freeze(artifacts),
      boundary: this.replay.discovery,
      receipt: analytics.receipt,
    })
  }

  loadGeographicWorkloadInput(): GeographicWorkloadReplayInput {
    const workloadSchemas = new Set([
      'biominer-flickr-geo-assignments-parquet:v1.0.0',
      'biominer-flickr-geo-clusters-parquet:v1.0.0',
    ])
    const artifacts = this.loadAnalyticsReplayInput().artifacts.filter(({ schemaVersion }) =>
      schemaVersion === null || schemaVersion === undefined
        ? false
        : workloadSchemas.has(schemaVersion),
    )
    if (artifacts.length !== workloadSchemas.size) {
      throw new EvidenceFacadeError('Geographic workload requires both verified semantic schemas')
    }
    return Object.freeze({
      artifacts: Object.freeze(artifacts),
      boundary: this.replay.geographyReference,
      targetAcceptedTaxonKey: this.replay.target.acceptedTaxonKey,
    })
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
            sizeBytes: parquet.descriptor.bytes,
            sha256: parquet.descriptor.sha256,
            recordCount: parquet.descriptor.record_count,
            producerSha: parquet.descriptor.source_commit,
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
  const loader = new BundleLoader(
    new BundleVerifier(migrateJudgeBundleToCurrent, assertBundleManifestSemantics),
    (path, loadSignal) => fetchBytes(path, loadSignal, fetcher),
    parseJson,
    verifyBundleArtifact,
  )
  const project = await loader.load(signal)
  try {
    new PapilioJudgeFixtureValidator().verify(project)
  } catch (error) {
    throw new EvidenceFacadeError(error instanceof Error ? error.message : 'Papilio fixture failed')
  }
  const manifest = project.manifest
  const migration = { receipt: project.migrationReceipt }
  const artifacts = new Map<string, VerifiedArtifact>(project.artifactEntries())
  const orderedInventory = [...manifest.artifact_inventory].sort(comparePaths)

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
  validateAnalyticsArtifacts(artifacts)
  const storedOpenAIReplay = projectStoredOpenAIReplay(manifest, artifacts)
  const mission = projectMissionEvidence(artifacts)
  const observatory = projectObservatoryEvidence(artifacts, manifest)
  const discovery = projectDiscoveryEvidence(artifacts)
  const geographyReference = projectGeographyReferenceEvidence(artifacts, manifest)
  const selectiveDecision = projectSelectiveDecisionEvidence(artifacts)
  const prototype = projectPrototypeEvidence(artifacts)
  const unavailableSections = Object.freeze(
    JUDGE_BUNDLE_SECTION_NAMES.map((name) => sections[name]).filter(
      (section) => section.status === 'unavailable',
    ),
  )
  const replay = deepFreeze<ReplayEvidence>({
    schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundleId: manifest.bundle_id,
    title: manifest.title,
    bundleCreatedAt: manifest.created_at,
    mission,
    observatory,
    discovery,
    geographyReference,
    selectiveDecision,
    prototype,
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
    artifactInventory: orderedInventory.map((artifact) => ({
      artifactId: artifact.artifact_id,
      path: artifact.path,
      role: artifact.role,
      sha256: artifact.sha256,
      sizeBytes: artifact.bytes,
      recordCount: artifact.record_count,
      producerSha: artifact.source_commit,
      verified: true,
    })),
    heroRecordId: stringField(runSummary, 'hero_record_id', 'run_summary'),
    heroState: 'awaiting_human_review',
    scientificClaimAllowed: false,
    verification: {
      inventoryChecksumVerified: true,
      payloadRootChecksumVerified: true,
      artifactChecksumsVerified: true,
      dataMode: 'verified-json-bootstrap',
      fallbackReason: 'analytics_on_demand',
      wasmStarted: false,
      bundleMigration: migration.receipt,
    },
  })
  return Object.freeze(new VerifiedEvidenceFacade(replay, artifacts, storedOpenAIReplay))
}

async function verifyBundleArtifact(
  descriptor: JudgeBundleArtifact,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<VerifiedProjectArtifact> {
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
  } else if (isParquetArtifact(descriptor)) {
    assertParquetMagic(bytes, descriptor.artifact_id)
  }
  return Object.freeze({ descriptor: Object.freeze(descriptor), bytes, json })
}

export const replayEvidenceContract = Object.freeze({
  schemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
  bundleId: PAPILIO_FIXTURE.bundleId,
  taxalensSha: PAPILIO_FIXTURE.taxalensSha,
  biominerSha: PAPILIO_FIXTURE.biominerSha,
})
