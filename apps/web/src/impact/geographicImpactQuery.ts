import type { GeographicScopeLevel } from '../../../../packages/contracts/src/geographic_impact_contract'
import type { GeographicEvidenceScopeIdentity } from '../data/geographicProjectFacade'

export const GEOGRAPHIC_EVIDENCE_MODES = Object.freeze([
  'comparison',
  'baseline',
  'flickr_candidates',
  'human_reviewed',
  'release_ready',
] as const)

export const GEOGRAPHIC_IMPACT_METRICS = Object.freeze([
  'record_count',
  'candidate_only_cells',
  'reviewed_additional_cells',
  'release_ready_additional_cells',
  'range_edge_distance',
  'review_backlog',
] as const)

export const GEOGRAPHIC_SCOPE_LEVELS = Object.freeze([
  'global',
  'continent',
  'country',
  'admin1',
] as const satisfies readonly GeographicScopeLevel[])

export type GeographicEvidenceMode = (typeof GEOGRAPHIC_EVIDENCE_MODES)[number]
export type GeographicImpactMetric = (typeof GEOGRAPHIC_IMPACT_METRICS)[number]

export interface GeographicScopeSelection {
  readonly level: GeographicScopeLevel
  readonly id: string
}

export interface GeographicImpactQueryInput {
  readonly evidenceScope: GeographicEvidenceScopeIdentity
  readonly spatialResolution: number
  readonly geographicScope: GeographicScopeSelection
  readonly evidenceMode: GeographicEvidenceMode
  readonly metric: GeographicImpactMetric
}

const MAX_H3_RESOLUTION = 15

/**
 * Validate the complete analytical boundary before loading DuckDB-Wasm.
 * Bundle registration later verifies that the selected resolution and scope
 * are actually declared by the selected Geographic Impact manifest.
 */
export function validateGeographicImpactQueryInput(
  candidate: unknown,
): GeographicImpactQueryInput {
  const input = requiredRecord(candidate, 'geographic impact query input')
  const evidenceScope = requiredRecord(input.evidenceScope, 'evidenceScope')
  const geographicScope = requiredRecord(input.geographicScope, 'geographicScope')

  const validatedEvidenceScope = Object.freeze({
    projectId: requiredIdentity(evidenceScope.projectId, 'evidenceScope.projectId'),
    runId: requiredIdentity(evidenceScope.runId, 'evidenceScope.runId'),
    targetAcceptedTaxonKey: requiredIdentity(
      evidenceScope.targetAcceptedTaxonKey,
      'evidenceScope.targetAcceptedTaxonKey',
    ),
    baselineSnapshotId: requiredIdentity(
      evidenceScope.baselineSnapshotId,
      'evidenceScope.baselineSnapshotId',
    ),
    flickrSnapshotId: requiredIdentity(
      evidenceScope.flickrSnapshotId,
      'evidenceScope.flickrSnapshotId',
    ),
  })
  const spatialResolution = requiredSpatialResolution(input.spatialResolution)
  const level = requiredMember(
    geographicScope.level,
    GEOGRAPHIC_SCOPE_LEVELS,
    'geographicScope.level',
  )
  const id = requiredIdentity(geographicScope.id, 'geographicScope.id')
  if ((level === 'global') !== (id === 'global')) {
    throw new Error('global geographic scope must use the scope id global')
  }

  return Object.freeze({
    evidenceScope: validatedEvidenceScope,
    spatialResolution,
    geographicScope: Object.freeze({ level, id }),
    evidenceMode: requiredMember(
      input.evidenceMode,
      GEOGRAPHIC_EVIDENCE_MODES,
      'evidenceMode',
    ),
    metric: requiredMember(input.metric, GEOGRAPHIC_IMPACT_METRICS, 'metric'),
  })
}

function requiredRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Readonly<Record<string, unknown>>
}

function requiredIdentity(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new Error(`${field} must be a non-empty canonical string`)
  }
  return value
}

function requiredSpatialResolution(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_H3_RESOLUTION) {
    throw new Error(`spatialResolution must be an integer from 0 to ${MAX_H3_RESOLUTION}`)
  }
  return value as number
}

function requiredMember<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  field: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${values.join(', ')}`)
  }
  return value as Values[number]
}
