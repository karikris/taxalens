export const BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION =
  'taxalens-baseline-occurrence-union:v1.0.0' as const

export const BASELINE_PROVIDER_UNION_POLICY_VERSION =
  'baseline-provider-union-policy-v1.0.0' as const

export const GEOGRAPHIC_CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const

export type GeographicContinent = (typeof GEOGRAPHIC_CONTINENTS)[number]
export type BaselineProviderSource = 'gbif' | 'inaturalist'
export type BaselineDeliveryProvider = 'gbif' | 'inaturalist'
export type KnownRangeRole =
  | 'native'
  | 'introduced'
  | 'vagrant'
  | 'uncertain'
  | 'unknown'

export type BaselineProviderRelationshipKind =
  | 'canonical_source'
  | 'same_provider_repeat'
  | 'inaturalist_via_gbif'
  | 'direct_inaturalist_equivalent'
  | 'scoped_occurrence_id_equivalent'
  | 'stable_source_reference_equivalent'
  | 'strict_composite_equivalent'
  | 'unresolved_duplicate_candidate'

export type BaselineProviderMatchMethod =
  | 'singleton'
  | 'provider_identity'
  | 'inaturalist_via_gbif'
  | 'scoped_occurrence_id'
  | 'stable_source_reference'
  | 'strict_composite'
  | 'unresolved_candidate'

/**
 * One provider relationship in baseline_occurrence_union.parquet.
 * Canonical totals count rows with canonical_flag=true. Relationship rows
 * with exact_duplicate_removed=true remain provenance, not observations.
 */
export interface BaselineOccurrenceUnionRow {
  readonly schema_version: typeof BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION
  readonly baseline_snapshot_id: string
  readonly project_id: string
  readonly run_id: string
  readonly registry_version: string
  readonly accepted_taxon_key: string
  readonly scientific_name: string
  readonly canonical_observation_id: string
  readonly provider_relationship_id: string
  readonly provider_union_policy_version: typeof BASELINE_PROVIDER_UNION_POLICY_VERSION
  readonly provider_source: BaselineProviderSource
  readonly delivery_provider: BaselineDeliveryProvider
  readonly provider_observation_id: string | null
  readonly gbif_occurrence_key: string | null
  readonly inaturalist_observation_id: string | null
  readonly source_dataset_key: string | null
  readonly source_dataset_citation: string
  readonly source_record_sha256: string
  readonly spatial_cell_id: string | null
  readonly spatial_resolution: number | null
  readonly grid_name: string
  readonly grid_version: string
  readonly country_code: string | null
  readonly country: string | null
  readonly continent: GeographicContinent | null
  readonly admin1: string | null
  readonly centroid_latitude: number | null
  readonly centroid_longitude: number | null
  readonly event_date: string | null
  readonly coordinate_uncertainty_m: number | null
  readonly basis_of_record: string | null
  readonly occurrence_status: string | null
  readonly known_range_role: KnownRangeRole
  readonly range_inference_eligible: boolean
  /** Evidence confidence is an upstream evidence field, not a probability. */
  readonly evidence_confidence: number
  readonly coordinate_valid: boolean
  readonly has_geospatial_issue: boolean
  readonly preserved_specimen: boolean
  readonly fossil: boolean
  readonly exclusion_reason: string | null
  readonly provider_relationship_kind: BaselineProviderRelationshipKind
  readonly match_method: BaselineProviderMatchMethod
  readonly duplicate_group_id: string | null
  readonly unresolved_duplicate_group_id: string | null
  readonly exact_duplicate_removed: boolean
  readonly canonical_flag: boolean
}

export type ParquetPhysicalType =
  | 'utf8'
  | 'boolean'
  | 'uint8'
  | 'float32'
  | 'float64'
  | 'date32'

export interface ParquetColumnContract {
  readonly physicalType: ParquetPhysicalType
  readonly nullable: boolean
}

/** Ordered physical column contract for deterministic Parquet writers. */
export const BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS = Object.freeze({
  schema_version: { physicalType: 'utf8', nullable: false },
  baseline_snapshot_id: { physicalType: 'utf8', nullable: false },
  project_id: { physicalType: 'utf8', nullable: false },
  run_id: { physicalType: 'utf8', nullable: false },
  registry_version: { physicalType: 'utf8', nullable: false },
  accepted_taxon_key: { physicalType: 'utf8', nullable: false },
  scientific_name: { physicalType: 'utf8', nullable: false },
  canonical_observation_id: { physicalType: 'utf8', nullable: false },
  provider_relationship_id: { physicalType: 'utf8', nullable: false },
  provider_union_policy_version: { physicalType: 'utf8', nullable: false },
  provider_source: { physicalType: 'utf8', nullable: false },
  delivery_provider: { physicalType: 'utf8', nullable: false },
  provider_observation_id: { physicalType: 'utf8', nullable: true },
  gbif_occurrence_key: { physicalType: 'utf8', nullable: true },
  inaturalist_observation_id: { physicalType: 'utf8', nullable: true },
  source_dataset_key: { physicalType: 'utf8', nullable: true },
  source_dataset_citation: { physicalType: 'utf8', nullable: false },
  source_record_sha256: { physicalType: 'utf8', nullable: false },
  spatial_cell_id: { physicalType: 'utf8', nullable: true },
  spatial_resolution: { physicalType: 'uint8', nullable: true },
  grid_name: { physicalType: 'utf8', nullable: false },
  grid_version: { physicalType: 'utf8', nullable: false },
  country_code: { physicalType: 'utf8', nullable: true },
  country: { physicalType: 'utf8', nullable: true },
  continent: { physicalType: 'utf8', nullable: true },
  admin1: { physicalType: 'utf8', nullable: true },
  centroid_latitude: { physicalType: 'float64', nullable: true },
  centroid_longitude: { physicalType: 'float64', nullable: true },
  event_date: { physicalType: 'date32', nullable: true },
  coordinate_uncertainty_m: { physicalType: 'float64', nullable: true },
  basis_of_record: { physicalType: 'utf8', nullable: true },
  occurrence_status: { physicalType: 'utf8', nullable: true },
  known_range_role: { physicalType: 'utf8', nullable: false },
  range_inference_eligible: { physicalType: 'boolean', nullable: false },
  evidence_confidence: { physicalType: 'float32', nullable: false },
  coordinate_valid: { physicalType: 'boolean', nullable: false },
  has_geospatial_issue: { physicalType: 'boolean', nullable: false },
  preserved_specimen: { physicalType: 'boolean', nullable: false },
  fossil: { physicalType: 'boolean', nullable: false },
  exclusion_reason: { physicalType: 'utf8', nullable: true },
  provider_relationship_kind: { physicalType: 'utf8', nullable: false },
  match_method: { physicalType: 'utf8', nullable: false },
  duplicate_group_id: { physicalType: 'utf8', nullable: true },
  unresolved_duplicate_group_id: { physicalType: 'utf8', nullable: true },
  exact_duplicate_removed: { physicalType: 'boolean', nullable: false },
  canonical_flag: { physicalType: 'boolean', nullable: false },
} as const satisfies Readonly<
  Record<keyof BaselineOccurrenceUnionRow, ParquetColumnContract>
>)

export type BaselineOccurrenceUnionColumn =
  keyof typeof BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS
