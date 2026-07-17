export const BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION =
  'taxalens-baseline-occurrence-union:v1.0.0' as const

export const BASELINE_PROVIDER_UNION_POLICY_VERSION =
  'baseline-provider-union-policy-v1.0.0' as const

export const GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION =
  'taxalens-geographic-impact-cell:v1.0.0' as const
export const GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION =
  'taxalens-geographic-impact-summary:v1.0.0' as const
export const COUNTRY_HIERARCHY_SCHEMA_VERSION =
  'taxalens-country-hierarchy:v1.0.0' as const
export const GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION =
  'taxalens-geographic-impact-manifest:v1.0.0' as const

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
export type EvidenceAvailability = 'available' | 'unavailable'
export type DirectProviderDeltaStatus = EvidenceAvailability
export type NearestBaselineDistanceStatus =
  | 'available'
  | 'unavailable'
  | 'not_applicable'
export type NearestBaselineDistanceMethod = 'haversine_cell_centroid'
export type DataDeficientState =
  | 'sufficient'
  | 'data_deficient'
  | 'unavailable'
export type GeographicScopeLevel =
  | 'global'
  | 'continent'
  | 'country'
  | 'admin1'
export type GeographicArtifactLogicalName =
  | 'baseline_geographic_spread'
  | 'baseline_occurrence_union'
  | 'flickr_geography'
  | 'verification_consensus'
  | 'quality_snapshot'
  | 'release_decisions'
  | 'geographic_impact_cells'
  | 'geographic_impact_summary'
  | 'country_hierarchy'
export type GeographicSourceRepository =
  | 'karikris/taxalens'
  | 'karikris/BioMiner'

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

/**
 * One full-outer-join cell comparing baseline occurrence evidence with Flickr
 * candidate evidence. Nullable baseline fields represent unavailable inputs,
 * never measured zero. Review and release counts remain separate.
 */
export interface GeographicImpactCellRow {
  readonly schema_version: typeof GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION
  readonly geographic_impact_build_id: string
  readonly project_id: string
  readonly run_id: string
  readonly registry_version: string
  readonly accepted_taxon_key: string
  readonly scientific_name: string
  readonly baseline_snapshot_id: string
  readonly flickr_snapshot_id: string
  readonly provider_union_policy_version: typeof BASELINE_PROVIDER_UNION_POLICY_VERSION
  readonly verification_projection_version: string
  readonly release_policy_version: string
  readonly verification_campaign_id: string | null
  readonly quality_snapshot_id: string | null
  readonly release_decision_id: string | null
  readonly grid_name: string
  readonly grid_version: string
  readonly spatial_resolution: number
  readonly spatial_cell_id: string
  readonly parent_spatial_cell_id: string | null
  readonly country_hierarchy_id: string
  readonly continent: GeographicContinent | null
  readonly country_code: string | null
  readonly country: string | null
  readonly admin1: string | null
  readonly centroid_latitude: number
  readonly centroid_longitude: number
  readonly baseline_evidence_status: EvidenceAvailability
  readonly provider_input_row_count: number | null
  readonly baseline_union_count: number | null
  readonly baseline_range_inference_eligible_count: number | null
  readonly baseline_excluded_occurrence_count: number | null
  readonly gbif_only_count: number | null
  readonly inaturalist_origin_through_gbif_count: number | null
  readonly direct_inaturalist_delta_status: DirectProviderDeltaStatus
  readonly direct_inaturalist_delta_count: number | null
  readonly duplicates_removed_count: number | null
  readonly unresolved_provider_duplicate_group_count: number | null
  readonly flickr_candidate_count: number
  readonly flickr_visually_eligible_count: number
  readonly reviewed_positive_count: number
  readonly reviewed_negative_count: number
  readonly uncertain_count: number
  readonly pending_count: number
  readonly media_failure_count: number
  readonly skipped_count: number
  readonly release_ready_count: number
  readonly baseline_only_cell: boolean
  readonly matched_cell: boolean
  readonly candidate_only_cell: boolean
  /** Product label: Human-supported additional cell. */
  readonly reviewed_additional_cell: boolean
  readonly release_ready_additional_cell: boolean
  readonly nearest_baseline_distance_status: NearestBaselineDistanceStatus
  readonly nearest_baseline_distance_km: number | null
  readonly nearest_baseline_cell_id: string | null
  readonly nearest_baseline_distance_method: NearestBaselineDistanceMethod | null
  readonly latest_baseline_event_date: string | null
  readonly latest_flickr_candidate_date: string | null
  readonly latest_reviewed_positive_date: string | null
  readonly latest_release_ready_date: string | null
  readonly data_deficient_state: DataDeficientState
  readonly data_deficient_reasons: readonly string[]
}

/** One materialized scope rollup in geographic_impact_summary.parquet. */
export interface GeographicImpactSummaryRow {
  readonly schema_version: typeof GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION
  readonly geographic_impact_build_id: string
  readonly project_id: string
  readonly run_id: string
  readonly registry_version: string
  readonly accepted_taxon_key: string
  readonly scientific_name: string
  readonly baseline_snapshot_id: string
  readonly flickr_snapshot_id: string
  readonly provider_union_policy_version: typeof BASELINE_PROVIDER_UNION_POLICY_VERSION
  readonly verification_projection_version: string
  readonly release_policy_version: string
  readonly country_hierarchy_id: string
  readonly spatial_resolution: number
  readonly scope_level: GeographicScopeLevel
  readonly scope_id: string
  readonly scope_name: string
  readonly parent_scope_id: string | null
  readonly continent: GeographicContinent | null
  readonly country_code: string | null
  readonly country: string | null
  readonly admin1: string | null
  readonly baseline_evidence_status: EvidenceAvailability
  readonly provider_input_row_count: number | null
  readonly baseline_union_count: number | null
  readonly baseline_range_inference_eligible_count: number | null
  readonly baseline_excluded_occurrence_count: number | null
  readonly gbif_only_count: number | null
  readonly inaturalist_origin_through_gbif_count: number | null
  readonly direct_inaturalist_delta_status: DirectProviderDeltaStatus
  readonly direct_inaturalist_delta_count: number | null
  readonly duplicates_removed_count: number | null
  readonly unresolved_provider_duplicate_group_count: number | null
  readonly cell_count: number
  readonly baseline_occupied_cell_count: number | null
  readonly flickr_candidate_count: number
  readonly flickr_visually_eligible_count: number
  readonly reviewed_positive_count: number
  readonly reviewed_negative_count: number
  readonly uncertain_count: number
  readonly pending_count: number
  readonly media_failure_count: number
  readonly skipped_count: number
  readonly release_ready_count: number
  readonly flickr_occupied_cell_count: number
  readonly baseline_only_cell_count: number | null
  readonly matched_cell_count: number | null
  readonly candidate_only_cell_count: number | null
  readonly reviewed_additional_cell_count: number | null
  readonly release_ready_additional_cell_count: number | null
  readonly nearest_baseline_distance_status: NearestBaselineDistanceStatus
  readonly maximum_nearest_baseline_distance_km: number | null
  readonly latest_baseline_event_date: string | null
  readonly latest_flickr_candidate_date: string | null
  readonly latest_reviewed_positive_date: string | null
  readonly latest_release_ready_date: string | null
  readonly data_deficient_state: DataDeficientState
  readonly data_deficient_reasons: readonly string[]
}

/** One flat node in the self-contained geographic navigation hierarchy. */
export interface CountryHierarchyNode {
  readonly scope_level: GeographicScopeLevel
  readonly scope_id: string
  readonly scope_name: string
  readonly parent_scope_id: string | null
  readonly continent: GeographicContinent | null
  readonly country_code: string | null
  readonly country: string | null
  readonly admin1_code: string | null
  readonly admin1: string | null
  readonly geometry_feature_id: string | null
  readonly centroid_latitude: number
  readonly centroid_longitude: number
  /** [west, south, east, north]. */
  readonly bounds: readonly [number, number, number, number]
  readonly sort_key: string
}

export interface CountryHierarchyDocument {
  readonly schema_version: typeof COUNTRY_HIERARCHY_SCHEMA_VERSION
  readonly country_hierarchy_id: string
  readonly boundary_dataset_id: string
  readonly boundary_dataset_version: string
  readonly created_at: string
  readonly root_scope_id: 'global'
  readonly nodes: readonly CountryHierarchyNode[]
}

export interface GeographicImpactSourceCommit {
  readonly repository: GeographicSourceRepository
  readonly commit_sha: string
}

export interface GeographicImpactArtifactEntry {
  readonly logical_name: GeographicArtifactLogicalName
  readonly availability: EvidenceAvailability
  readonly path: string | null
  readonly media_type: string | null
  readonly schema_version: string | null
  readonly sha256: string | null
  readonly byte_size: number | null
  readonly row_count: number | null
  readonly snapshot_id: string | null
  readonly source_repository: GeographicSourceRepository | null
  readonly source_commit: string | null
  readonly rights_id: string | null
  readonly unavailable_reason: string | null
}

export interface GeographicImpactManifestDocument {
  readonly schema_version: typeof GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION
  readonly manifest_id: string
  readonly geographic_impact_build_id: string
  readonly created_at: string
  readonly project_id: string
  readonly run_id: string
  readonly registry_version: string
  readonly accepted_taxon_key: string
  readonly scientific_name: string
  readonly baseline_snapshot_id: string
  readonly flickr_snapshot_id: string
  readonly provider_union_policy_version: typeof BASELINE_PROVIDER_UNION_POLICY_VERSION
  readonly verification_projection_version: string
  readonly release_policy_version: string
  readonly country_hierarchy_id: string
  readonly spatial_resolutions: readonly number[]
  readonly summary_scope_levels: readonly GeographicScopeLevel[]
  readonly source_commits: readonly GeographicImpactSourceCommit[]
  readonly artifacts: readonly GeographicImpactArtifactEntry[]
  readonly impact_cell_count: number
  readonly summary_row_count: number
  readonly hierarchy_node_count: number
  readonly baseline_evidence_status: EvidenceAvailability
  readonly baseline_union_count: number | null
  readonly direct_inaturalist_delta_status: DirectProviderDeltaStatus
  readonly direct_inaturalist_delta_count: number | null
  readonly flickr_candidate_count: number
  readonly geographically_supported_flickr_candidate_count: number
  readonly geographically_unsupported_flickr_candidate_count: number
  readonly reviewed_positive_count: number
  readonly reviewed_negative_count: number
  readonly uncertain_count: number
  readonly pending_count: number
  readonly media_failure_count: number
  readonly skipped_count: number
  readonly release_ready_count: number
  readonly baseline_only_cell_count: number | null
  readonly matched_cell_count: number | null
  readonly candidate_only_cell_count: number | null
  readonly reviewed_additional_cell_count: number | null
  readonly release_ready_additional_cell_count: number | null
  readonly unassigned_cartographic_cell_count: number
  readonly deterministic_fingerprint_sha256: string
  readonly generated_by: string
}

export type ParquetPhysicalType =
  | 'utf8'
  | 'boolean'
  | 'uint8'
  | 'uint64'
  | 'float32'
  | 'float64'
  | 'date32'
  | 'list_utf8'

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

/** Ordered physical column contract for geographic_impact_cells.parquet. */
export const GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS = Object.freeze({
  schema_version: { physicalType: 'utf8', nullable: false },
  geographic_impact_build_id: { physicalType: 'utf8', nullable: false },
  project_id: { physicalType: 'utf8', nullable: false },
  run_id: { physicalType: 'utf8', nullable: false },
  registry_version: { physicalType: 'utf8', nullable: false },
  accepted_taxon_key: { physicalType: 'utf8', nullable: false },
  scientific_name: { physicalType: 'utf8', nullable: false },
  baseline_snapshot_id: { physicalType: 'utf8', nullable: false },
  flickr_snapshot_id: { physicalType: 'utf8', nullable: false },
  provider_union_policy_version: { physicalType: 'utf8', nullable: false },
  verification_projection_version: { physicalType: 'utf8', nullable: false },
  release_policy_version: { physicalType: 'utf8', nullable: false },
  verification_campaign_id: { physicalType: 'utf8', nullable: true },
  quality_snapshot_id: { physicalType: 'utf8', nullable: true },
  release_decision_id: { physicalType: 'utf8', nullable: true },
  grid_name: { physicalType: 'utf8', nullable: false },
  grid_version: { physicalType: 'utf8', nullable: false },
  spatial_resolution: { physicalType: 'uint8', nullable: false },
  spatial_cell_id: { physicalType: 'utf8', nullable: false },
  parent_spatial_cell_id: { physicalType: 'utf8', nullable: true },
  country_hierarchy_id: { physicalType: 'utf8', nullable: false },
  continent: { physicalType: 'utf8', nullable: true },
  country_code: { physicalType: 'utf8', nullable: true },
  country: { physicalType: 'utf8', nullable: true },
  admin1: { physicalType: 'utf8', nullable: true },
  centroid_latitude: { physicalType: 'float64', nullable: false },
  centroid_longitude: { physicalType: 'float64', nullable: false },
  baseline_evidence_status: { physicalType: 'utf8', nullable: false },
  provider_input_row_count: { physicalType: 'uint64', nullable: true },
  baseline_union_count: { physicalType: 'uint64', nullable: true },
  baseline_range_inference_eligible_count: { physicalType: 'uint64', nullable: true },
  baseline_excluded_occurrence_count: { physicalType: 'uint64', nullable: true },
  gbif_only_count: { physicalType: 'uint64', nullable: true },
  inaturalist_origin_through_gbif_count: { physicalType: 'uint64', nullable: true },
  direct_inaturalist_delta_status: { physicalType: 'utf8', nullable: false },
  direct_inaturalist_delta_count: { physicalType: 'uint64', nullable: true },
  duplicates_removed_count: { physicalType: 'uint64', nullable: true },
  unresolved_provider_duplicate_group_count: { physicalType: 'uint64', nullable: true },
  flickr_candidate_count: { physicalType: 'uint64', nullable: false },
  flickr_visually_eligible_count: { physicalType: 'uint64', nullable: false },
  reviewed_positive_count: { physicalType: 'uint64', nullable: false },
  reviewed_negative_count: { physicalType: 'uint64', nullable: false },
  uncertain_count: { physicalType: 'uint64', nullable: false },
  pending_count: { physicalType: 'uint64', nullable: false },
  media_failure_count: { physicalType: 'uint64', nullable: false },
  skipped_count: { physicalType: 'uint64', nullable: false },
  release_ready_count: { physicalType: 'uint64', nullable: false },
  baseline_only_cell: { physicalType: 'boolean', nullable: false },
  matched_cell: { physicalType: 'boolean', nullable: false },
  candidate_only_cell: { physicalType: 'boolean', nullable: false },
  reviewed_additional_cell: { physicalType: 'boolean', nullable: false },
  release_ready_additional_cell: { physicalType: 'boolean', nullable: false },
  nearest_baseline_distance_status: { physicalType: 'utf8', nullable: false },
  nearest_baseline_distance_km: { physicalType: 'float64', nullable: true },
  nearest_baseline_cell_id: { physicalType: 'utf8', nullable: true },
  nearest_baseline_distance_method: { physicalType: 'utf8', nullable: true },
  latest_baseline_event_date: { physicalType: 'date32', nullable: true },
  latest_flickr_candidate_date: { physicalType: 'date32', nullable: true },
  latest_reviewed_positive_date: { physicalType: 'date32', nullable: true },
  latest_release_ready_date: { physicalType: 'date32', nullable: true },
  data_deficient_state: { physicalType: 'utf8', nullable: false },
  data_deficient_reasons: { physicalType: 'list_utf8', nullable: false },
} as const satisfies Readonly<
  Record<keyof GeographicImpactCellRow, ParquetColumnContract>
>)

export type GeographicImpactCellColumn =
  keyof typeof GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS

/** Ordered physical column contract for geographic_impact_summary.parquet. */
export const GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS = Object.freeze({
  schema_version: { physicalType: 'utf8', nullable: false },
  geographic_impact_build_id: { physicalType: 'utf8', nullable: false },
  project_id: { physicalType: 'utf8', nullable: false },
  run_id: { physicalType: 'utf8', nullable: false },
  registry_version: { physicalType: 'utf8', nullable: false },
  accepted_taxon_key: { physicalType: 'utf8', nullable: false },
  scientific_name: { physicalType: 'utf8', nullable: false },
  baseline_snapshot_id: { physicalType: 'utf8', nullable: false },
  flickr_snapshot_id: { physicalType: 'utf8', nullable: false },
  provider_union_policy_version: { physicalType: 'utf8', nullable: false },
  verification_projection_version: { physicalType: 'utf8', nullable: false },
  release_policy_version: { physicalType: 'utf8', nullable: false },
  country_hierarchy_id: { physicalType: 'utf8', nullable: false },
  spatial_resolution: { physicalType: 'uint8', nullable: false },
  scope_level: { physicalType: 'utf8', nullable: false },
  scope_id: { physicalType: 'utf8', nullable: false },
  scope_name: { physicalType: 'utf8', nullable: false },
  parent_scope_id: { physicalType: 'utf8', nullable: true },
  continent: { physicalType: 'utf8', nullable: true },
  country_code: { physicalType: 'utf8', nullable: true },
  country: { physicalType: 'utf8', nullable: true },
  admin1: { physicalType: 'utf8', nullable: true },
  baseline_evidence_status: { physicalType: 'utf8', nullable: false },
  provider_input_row_count: { physicalType: 'uint64', nullable: true },
  baseline_union_count: { physicalType: 'uint64', nullable: true },
  baseline_range_inference_eligible_count: { physicalType: 'uint64', nullable: true },
  baseline_excluded_occurrence_count: { physicalType: 'uint64', nullable: true },
  gbif_only_count: { physicalType: 'uint64', nullable: true },
  inaturalist_origin_through_gbif_count: { physicalType: 'uint64', nullable: true },
  direct_inaturalist_delta_status: { physicalType: 'utf8', nullable: false },
  direct_inaturalist_delta_count: { physicalType: 'uint64', nullable: true },
  duplicates_removed_count: { physicalType: 'uint64', nullable: true },
  unresolved_provider_duplicate_group_count: { physicalType: 'uint64', nullable: true },
  cell_count: { physicalType: 'uint64', nullable: false },
  baseline_occupied_cell_count: { physicalType: 'uint64', nullable: true },
  flickr_candidate_count: { physicalType: 'uint64', nullable: false },
  flickr_visually_eligible_count: { physicalType: 'uint64', nullable: false },
  reviewed_positive_count: { physicalType: 'uint64', nullable: false },
  reviewed_negative_count: { physicalType: 'uint64', nullable: false },
  uncertain_count: { physicalType: 'uint64', nullable: false },
  pending_count: { physicalType: 'uint64', nullable: false },
  media_failure_count: { physicalType: 'uint64', nullable: false },
  skipped_count: { physicalType: 'uint64', nullable: false },
  release_ready_count: { physicalType: 'uint64', nullable: false },
  flickr_occupied_cell_count: { physicalType: 'uint64', nullable: false },
  baseline_only_cell_count: { physicalType: 'uint64', nullable: true },
  matched_cell_count: { physicalType: 'uint64', nullable: true },
  candidate_only_cell_count: { physicalType: 'uint64', nullable: true },
  reviewed_additional_cell_count: { physicalType: 'uint64', nullable: true },
  release_ready_additional_cell_count: { physicalType: 'uint64', nullable: true },
  nearest_baseline_distance_status: { physicalType: 'utf8', nullable: false },
  maximum_nearest_baseline_distance_km: { physicalType: 'float64', nullable: true },
  latest_baseline_event_date: { physicalType: 'date32', nullable: true },
  latest_flickr_candidate_date: { physicalType: 'date32', nullable: true },
  latest_reviewed_positive_date: { physicalType: 'date32', nullable: true },
  latest_release_ready_date: { physicalType: 'date32', nullable: true },
  data_deficient_state: { physicalType: 'utf8', nullable: false },
  data_deficient_reasons: { physicalType: 'list_utf8', nullable: false },
} as const satisfies Readonly<
  Record<keyof GeographicImpactSummaryRow, ParquetColumnContract>
>)

export type GeographicImpactSummaryColumn =
  keyof typeof GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS
