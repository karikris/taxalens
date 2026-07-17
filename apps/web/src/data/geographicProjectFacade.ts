import {
  BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  COUNTRY_HIERARCHY_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import type {
  JudgeBundleGeographicSectionName,
  JudgeBundleSection,
} from '../../../../packages/contracts/src/judge_bundle_contract'
import type { TaxaLensProjectFacade, VerifiedProjectArtifact } from './projectFacade'

const GEOGRAPHIC_SECTION_SCHEMA_VERSIONS = Object.freeze({
  baseline_geographic_spread: Object.freeze([
    'taxon-geographic-spread-v1.0.0',
    'taxon-geographic-summary-v1.0.0',
    'geographic-spread-build-v1.0.0',
  ]),
  baseline_provider_union: Object.freeze([BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION]),
  flickr_geography: Object.freeze([
    'flickr-geography-v1.0.0',
    'flickr-workload-manifest-v1.1.0',
  ]),
  geographic_impact_cells: Object.freeze([GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION]),
  geographic_impact_summary: Object.freeze([GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION]),
  country_hierarchy: Object.freeze([COUNTRY_HIERARCHY_SCHEMA_VERSION]),
} satisfies Readonly<Record<JudgeBundleGeographicSectionName, readonly string[]>>)

const GEOGRAPHIC_IMPACT_INPUT_SECTIONS = Object.freeze([
  'baseline_geographic_spread',
  'baseline_provider_union',
  'flickr_geography',
  'geographic_impact_cells',
] as const satisfies readonly JudgeBundleGeographicSectionName[])

const GEOGRAPHIC_RECORD_CONTEXT_SECTIONS = Object.freeze([
  'baseline_provider_union',
  'flickr_geography',
  'geographic_impact_cells',
  'country_hierarchy',
] as const satisfies readonly JudgeBundleGeographicSectionName[])

export type GeographicProjectLoaderName =
  | 'geographic_impact_input'
  | 'geographic_impact_summary'
  | 'country_hierarchy'
  | 'geographic_record_context'

export type GeographicArtifactLoadStatus = 'available' | 'partial' | 'unavailable'

export interface GeographicSectionLoadState {
  readonly name: JudgeBundleGeographicSectionName
  readonly section: JudgeBundleSection
  readonly artifacts: readonly VerifiedProjectArtifact[]
}

export interface GeographicArtifactLoadResult {
  readonly loader: GeographicProjectLoaderName
  readonly status: GeographicArtifactLoadStatus
  readonly sections: readonly GeographicSectionLoadState[]
  readonly artifacts: readonly VerifiedProjectArtifact[]
  readonly manifestArtifact: VerifiedProjectArtifact | null
  readonly unavailableSections: readonly JudgeBundleGeographicSectionName[]
  readonly reason: string | null
}

/** Load the bounded artifacts needed to compare baseline and Flickr cells. */
export function loadGeographicImpactInput(
  project: TaxaLensProjectFacade,
): GeographicArtifactLoadResult {
  return loadGeographicArtifacts(project, 'geographic_impact_input', GEOGRAPHIC_IMPACT_INPUT_SECTIONS)
}

/** Load materialized global-to-admin1 impact rollups. */
export function loadGeographicImpactSummary(
  project: TaxaLensProjectFacade,
): GeographicArtifactLoadResult {
  return loadGeographicArtifacts(project, 'geographic_impact_summary', [
    'geographic_impact_summary',
  ])
}

/** Load the self-contained country and administrative hierarchy. */
export function loadCountryHierarchy(
  project: TaxaLensProjectFacade,
): GeographicArtifactLoadResult {
  return loadGeographicArtifacts(project, 'country_hierarchy', ['country_hierarchy'])
}

/** Load the cell, source and boundary handles required for one record context query. */
export function loadGeographicRecordContext(
  project: TaxaLensProjectFacade,
): GeographicArtifactLoadResult {
  return loadGeographicArtifacts(
    project,
    'geographic_record_context',
    GEOGRAPHIC_RECORD_CONTEXT_SECTIONS,
  )
}

function loadGeographicArtifacts(
  project: TaxaLensProjectFacade,
  loader: GeographicProjectLoaderName,
  sectionNames: readonly JudgeBundleGeographicSectionName[],
): GeographicArtifactLoadResult {
  const sectionStates: GeographicSectionLoadState[] = []
  const artifacts: VerifiedProjectArtifact[] = []
  const unavailableSections: JudgeBundleGeographicSectionName[] = []
  const errors: string[] = []
  let hasPartialSection = false

  for (const name of sectionNames) {
    const section = project.section(name)
    if (section.status === 'unavailable') {
      unavailableSections.push(name)
      sectionStates.push(Object.freeze({ name, section, artifacts: Object.freeze([]) }))
      continue
    }
    hasPartialSection ||= section.status === 'partial'
    const sectionArtifacts: VerifiedProjectArtifact[] = []
    for (const artifactId of section.artifact_ids) {
      const artifact = project.artifact(artifactId)
      if (artifact === undefined) {
        errors.push(`${name} references an unloaded artifact`)
        continue
      }
      if (artifact.descriptor.role !== name) {
        errors.push(`${name} contains an artifact with a different semantic role`)
        continue
      }
      const schemaVersion = artifact.descriptor.schema_version
      const supportedSchemaVersions: readonly string[] = GEOGRAPHIC_SECTION_SCHEMA_VERSIONS[name]
      if (
        schemaVersion === null ||
        !supportedSchemaVersions.includes(schemaVersion)
      ) {
        errors.push(`${name} contains an unsupported schema version`)
        continue
      }
      sectionArtifacts.push(artifact)
      artifacts.push(artifact)
    }
    if (sectionArtifacts.length === 0) {
      errors.push(`${name} has no supported artifact`)
    }
    sectionStates.push(
      Object.freeze({ name, section, artifacts: Object.freeze(sectionArtifacts) }),
    )
  }

  const declaredSectionCount = sectionNames.length - unavailableSections.length
  if (declaredSectionCount === 0) {
    return freezeLoadResult({
      loader,
      status: 'unavailable',
      sections: sectionStates,
      artifacts: [],
      manifestArtifact: null,
      unavailableSections,
      reason: unavailableReason(sectionStates),
    })
  }

  const manifestArtifacts = project.artifactsForRole('geographic_impact_manifest')
  const manifestArtifact = manifestArtifacts.length === 1 ? manifestArtifacts[0] : undefined
  if (
    manifestArtifact === undefined ||
    manifestArtifact.descriptor.schema_version !== GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION ||
    manifestArtifact.json === undefined
  ) {
    errors.push('geographic impact manifest is missing, ambiguous or unsupported')
  }

  if (errors.length > 0) {
    return freezeLoadResult({
      loader,
      status: 'unavailable',
      sections: sectionStates,
      artifacts: [],
      manifestArtifact: null,
      unavailableSections,
      reason: errors.join('; '),
    })
  }

  const status =
    unavailableSections.length > 0 || hasPartialSection ? ('partial' as const) : ('available' as const)
  return freezeLoadResult({
    loader,
    status,
    sections: sectionStates,
    artifacts,
    manifestArtifact: manifestArtifact ?? null,
    unavailableSections,
    reason: status === 'partial' ? unavailableReason(sectionStates) : null,
  })
}

function unavailableReason(states: readonly GeographicSectionLoadState[]): string {
  const reasons = states
    .filter(({ section }) => section.status !== 'available')
    .map(({ name, section }) => `${name}: ${section.reason ?? section.status}`)
  return reasons.length > 0 ? reasons.join('; ') : 'geographic evidence is unavailable'
}

function freezeLoadResult(
  result: Omit<GeographicArtifactLoadResult, 'artifacts' | 'sections' | 'unavailableSections'> & {
    readonly artifacts: readonly VerifiedProjectArtifact[]
    readonly sections: readonly GeographicSectionLoadState[]
    readonly unavailableSections: readonly JudgeBundleGeographicSectionName[]
  },
): GeographicArtifactLoadResult {
  return Object.freeze({
    ...result,
    sections: Object.freeze([...result.sections]),
    artifacts: Object.freeze([...result.artifacts]),
    unavailableSections: Object.freeze([...result.unavailableSections]),
  })
}
