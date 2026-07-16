import type { ReplayEvidence } from '../data/evidenceFacade'
import {
  canonicalExportJsonBytes,
  sha256Hex,
} from '../evidence/evidenceExport'
import { buildEvidenceFunnel } from './evidenceFunnelModel'
import { buildReviewedEvaluationModel } from './reviewedEvaluationModel'
import { buildReviewPriorityModel } from './reviewPriorityModel'

const EXPORT_SCHEMA_VERSION = 'taxalens-research-outputs:v1.0.0'
const MANIFEST_SCHEMA_VERSION = 'taxalens-research-output-manifest:v1.0.0'
const FILE_ORDER: Readonly<Record<ResearchOutputRole, number>> = Object.freeze({
  review_queue: 1,
  evidence_summary: 2,
  prototype_boundary: 3,
  manifest: 4,
  provenance: 5,
  evaluation_report: 6,
})

export type ResearchOutputRole =
  | 'review_queue'
  | 'evidence_summary'
  | 'prototype_boundary'
  | 'manifest'
  | 'provenance'
  | 'evaluation_report'

export interface ResearchOutputFile {
  readonly role: ResearchOutputRole
  readonly filename: string
  readonly mediaType: 'application/json'
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly sha256: string
}

export interface ResearchOutputBundle {
  readonly schemaVersion: typeof EXPORT_SCHEMA_VERSION
  readonly prefix: string
  readonly files: readonly ResearchOutputFile[]
  readonly manifestSignatureStatus: 'unavailable'
  readonly scientificClaimAllowed: false
}

type PayloadRole = Exclude<ResearchOutputRole, 'manifest'>

export async function prepareResearchOutputs(
  replay: ReplayEvidence,
): Promise<ResearchOutputBundle> {
  const review = buildReviewPriorityModel(replay)
  const funnel = buildEvidenceFunnel(replay)
  const evaluation = buildReviewedEvaluationModel(replay)
  const prefix = researchOutputPrefix(replay)

  const payloads = await Promise.all([
    outputFile('review_queue', `${prefix}.review-queue.json`, {
      schemaVersion: 'taxalens-review-queue-export:v1.0.0',
      bundleId: replay.bundleId,
      queueMaterialized: review.queueMaterialized,
      comparativeRankingAvailable: review.comparativeRankingAvailable,
      itemCount: 1,
      item: review.item,
      factorAudit: review.factors,
      interpretation: 'Single committed awaiting-review record; not a materialized ranked queue.',
      scientificClaimAllowed: false,
    }),
    outputFile('evidence_summary', `${prefix}.evidence-summary.json`, {
      schemaVersion: 'taxalens-evidence-summary-export:v1.0.0',
      bundleId: replay.bundleId,
      target: replay.target,
      record: {
        recordId: replay.heroRecordId,
        reviewState: replay.heroState,
      },
      bundleVerification: {
        artifactCount: replay.artifactCount,
        verifiedArtifactCount: replay.verifiedArtifactCount,
        rightsStatus: replay.rightsStatus,
        unavailableSectionCount: replay.unavailableSectionCount,
      },
      sectionStates: Object.values(replay.sections).map((section) => ({
        name: section.name,
        status: section.status,
        reason: section.reason,
        verificationStatus: section.verificationStatus,
        scientificClaimAllowed: section.scientificClaimAllowed,
      })),
      workflowCounts: replay.observatory,
      evidenceFunnel: {
        comparisonPolicy: funnel.comparisonPolicy,
        stages: funnel.stages.map((stage) => ({
          sequence: stage.sequence,
          id: stage.id,
          label: stage.label,
          value: stage.value,
          unit: stage.unit,
          status: stage.status,
          detail: stage.detail,
          artifactIds: stage.artifacts.map(({ artifactId }) => artifactId),
        })),
      },
      scientificClaimAllowed: false,
    }),
    outputFile('prototype_boundary', `${prefix}.prototype-boundary.json`, {
      schemaVersion: 'taxalens-prototype-boundary-export:v1.0.0',
      bundleId: replay.bundleId,
      target: replay.target,
      prototype: replay.prototype,
      interpretation:
        'Aggregate prototype evidence and GO_PROTOTYPE_ONLY scope; not a per-record classification, accuracy result, prevalence estimate, or scientific release.',
      scientificClaimAllowed: false,
    }),
    outputFile('provenance', `${prefix}.provenance.json`, {
      schemaVersion: 'taxalens-research-provenance-export:v1.0.0',
      bundleId: replay.bundleId,
      sourceBundleCreatedAt: replay.bundleCreatedAt,
      sourceRevisions: replay.sourceRevisions,
      exportTimestamp: null,
      exportTimestampReason: 'No export time is added so repeated preparation remains deterministic.',
      verification: replay.verification,
      artifacts: [...replay.artifactInventory]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((artifact) => ({ ...artifact })),
      generation: {
        environment: 'browser',
        method: 'local_verified_metadata_export',
        networkRequestsRequired: 0,
        scientificClaimsAdded: false,
      },
    }),
    outputFile('evaluation_report', `${prefix}.evaluation-report.json`, {
      schemaVersion: 'taxalens-reviewed-evaluation-export:v1.0.0',
      bundleId: replay.bundleId,
      target: replay.target,
      committedReviewedMetricCount: evaluation.committedReviewedMetricCount,
      phase13: evaluation.phase13,
      phase14: evaluation.phase14,
      metrics: evaluation.metrics,
      interpretation:
        'Unavailable metrics remain unavailable; workload counts are not substituted for reviewed outcomes.',
      scientificClaimAllowed: false,
    }),
  ])
  payloads.sort(compareFiles)

  const manifestBytes = canonicalExportJsonBytes({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleId: replay.bundleId,
    recordId: replay.heroRecordId,
    files: payloads.map(({ bytes, filename, mediaType, role, sha256 }) => ({
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
      payloadFileCount: payloads.length,
    },
    scientificClaimAllowed: false,
  })
  const manifest: ResearchOutputFile = Object.freeze({
    role: 'manifest',
    filename: `${prefix}.manifest.json`,
    mediaType: 'application/json',
    bytes: manifestBytes,
    sha256: await sha256Hex(manifestBytes),
  })
  const files = [...payloads, manifest].sort(compareFiles)

  return Object.freeze({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    prefix,
    files: Object.freeze(files),
    manifestSignatureStatus: 'unavailable' as const,
    scientificClaimAllowed: false as const,
  })
}

async function outputFile(
  role: PayloadRole,
  filename: string,
  value: unknown,
): Promise<ResearchOutputFile> {
  const bytes = canonicalExportJsonBytes(value)
  return Object.freeze({
    role,
    filename,
    mediaType: 'application/json' as const,
    bytes,
    sha256: await sha256Hex(bytes),
  })
}

function compareFiles(
  left: Pick<ResearchOutputFile, 'filename' | 'role'>,
  right: Pick<ResearchOutputFile, 'filename' | 'role'>,
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

function researchOutputPrefix(replay: ReplayEvidence): string {
  const taxon = replay.target.scientificName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  return `taxalens-${taxon}-${replay.heroState.replaceAll('_', '-')}`
}
