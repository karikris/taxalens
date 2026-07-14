export type Nullable<T> = T | null;

export type AuditTrail = {
  step: string;
  actor: string;
  detail: string;
};

export interface BaseContract {
  schema_version: string;
  biominer_commit: Nullable<string>;
}

export interface RunSummary extends BaseContract {
  run_id: string;
  title: Nullable<string>;
  source_manifest_path: Nullable<string>;
  source_biominer_run_artifact: Nullable<string>;
  status: Nullable<'complete' | 'failed' | 'running' | 'unknown'>;
  started_at: Nullable<string>;
  completed_at: Nullable<string>;
  records_in: Nullable<number>;
  records_out: Nullable<number>;
  stage_count: Nullable<number>;
  expected_output_artifacts: string[];
  notes: Nullable<string[]>;
}

export interface StageMetric extends BaseContract {
  stage_id: string;
  stage_name: Nullable<string>;
  operation_type: Nullable<string>;
  join_type: Nullable<'hash_join' | 'semi_join' | 'anti_join' | 'spatial_cell_join' | 'range_join' | 'grouped_aggregation' | 'nearest_neighbour' | 'matrix_scoring' | 'other'>;
  input_keys: Nullable<string[]>;
  output_keys: Nullable<string[]>;
  input_artifact_id: Nullable<string>;
  output_artifact_id: Nullable<string>;
  rows_in: Nullable<number>;
  rows_out: Nullable<number>;
  expected_rows: Nullable<number>;
  elapsed_seconds: Nullable<number>;
  peak_memory_mb: Nullable<number>;
  bytes_scanned: Nullable<number>;
  bytes_written: Nullable<number>;
  cache_hits: Nullable<number>;
  cache_misses: Nullable<number>;
  retries: Nullable<number>;
  artifact_uri: Nullable<string>;
  produced_sha256: Nullable<string>;
  schema_version_ref: Nullable<string>;
}

export interface ArtifactInventoryRow extends BaseContract {
  artifact_id: string;
  artifact_uri: string;
  stage_name: Nullable<string>;
  artifact_path: Nullable<string>;
  row_count: Nullable<number>;
  byte_count: Nullable<number>;
  sha256: Nullable<string>;
  schema_version: Nullable<string>;
  producer_commit: Nullable<string>;
  created_at: Nullable<string>;
}

export interface QueryAssociation extends BaseContract {
  query_id: string;
  parent_record_id: Nullable<string>;
  search_query: Nullable<string>;
  logical_group: Nullable<'species' | 'genus' | 'family' | 'order' | 'platform' | 'other'>;
  rank: Nullable<string>;
  query_source: Nullable<'flickr' | 'registry' | 'comment' | 'other'>;
  deduplicated_with: Nullable<string[]>;
}

export interface QueryDefinition extends BaseContract {
  query_definition_id: string;
  logical_query_id: Nullable<string>;
  canonical_keyword_id: Nullable<string>;
  keyword_id: Nullable<string>;
  registry_schema_version: Nullable<string>;
  compiler_version: Nullable<string>;
  registry_version: Nullable<string>;
  accepted_taxon_key: Nullable<string>;
  accepted_scientific_name: Nullable<string>;
  accepted_rank: Nullable<string>;
  family_key: Nullable<string>;
  family: Nullable<string>;
  genus_key: Nullable<string>;
  genus: Nullable<string>;
  species_key: Nullable<string>;
  species: Nullable<string>;
  name_id: Nullable<string>;
  source_term: Nullable<string>;
  normalized_query_term: Nullable<string>;
  normalized_match_key: Nullable<string>;
  language: Nullable<string>;
  api_language_code: Nullable<string>;
  script: Nullable<string>;
  region: Nullable<string>;
  bcp47: Nullable<string>;
  bbox: Nullable<string>;
  name_class: Nullable<string>;
  source: Nullable<string>;
  source_taxon_id: Nullable<string>;
  lineage_check: Nullable<string>;
  trust_tier: Nullable<string>;
  original_trust_tier: Nullable<string>;
  effective_trust_tier: Nullable<string>;
  confidence: Nullable<string>;
  precision_tier: Nullable<string>;
  search_field: Nullable<string>;
  search_priority: Nullable<number>;
  enabled: Nullable<boolean>;
  disabled_reason: Nullable<string>;
  query_eligible: Nullable<boolean>;
  query_disabled_reason: Nullable<string>;
  species_specificity_score: Nullable<number>;
}

export interface QueryDefinitionSummary extends BaseContract {
  run_id: string;
  source_manifest_path: Nullable<string>;
  query_definition_artifact_path: Nullable<string>;
  total_query_definitions: Nullable<number>;
  eligible_query_definitions: Nullable<number>;
  ineligible_query_definitions: Nullable<number>;
  query_definitions_by_source: Nullable<Record<string, number>>;
  query_definitions_by_rank: Nullable<Record<string, number>>;
  disabled_query_definitions: Nullable<number>;
  max_search_priority: Nullable<number>;
  query_curation_rule_count: Nullable<number>;
}

export interface GeographicSpreadRecord extends BaseContract {
  schema_version: Nullable<string>;
  registry_version: Nullable<string>;
  accepted_taxon_key: Nullable<string>;
  gbif_species_key: Nullable<number>;
  scientific_name: Nullable<string>;
  source: Nullable<string>;
  source_dataset_key: Nullable<string>;
  source_dataset_citation: Nullable<string>;
  source_query_hash: Nullable<string>;
  spatial_cell_id: Nullable<string>;
  spatial_resolution: Nullable<number>;
  country_code: Nullable<string>;
  admin1: Nullable<string>;
  bioregion: Nullable<string>;
  centroid_latitude: Nullable<number>;
  centroid_longitude: Nullable<number>;
  occurrence_count: Nullable<number>;
  georeferenced_occurrence_count: Nullable<number>;
  range_inference_eligible_count: Nullable<number>;
  preserved_specimen_count: Nullable<number>;
  fossil_count: Nullable<number>;
  geospatial_issue_count: Nullable<number>;
  coordinate_uncertainty_summary: Nullable<Record<string, number>>;
  earliest_occurrence_date: Nullable<string>;
  latest_occurrence_date: Nullable<string>;
  known_range_role: Nullable<string>;
  taxon_key_match: Nullable<boolean>;
  coordinate_valid: Nullable<boolean>;
}

export interface GeographicOccurrenceEvidence extends BaseContract {
  schema_version: Nullable<string>;
  source: Nullable<string>;
  gbif_id: Nullable<string>;
  accepted_taxon_key: Nullable<string>;
  scientific_name: Nullable<string>;
  source_dataset_key: Nullable<string>;
  source_dataset_name: Nullable<string>;
  basis_of_record: Nullable<string>;
  country_code: Nullable<string>;
  admin1_code: Nullable<string>;
  coordinate_latitude: Nullable<number>;
  coordinate_longitude: Nullable<number>;
  event_date: Nullable<string>;
  coordinate_uncertainty_m: Nullable<number>;
  georeferenced: Nullable<boolean>;
  preserved_specimen: Nullable<boolean>;
  range_inference_eligible: Nullable<boolean>;
  known_range_role: Nullable<string>;
}

export interface GeographicSpreadManifestSummary extends BaseContract {
  run_id: string;
  source_manifest_path: Nullable<string>;
  geographic_spread_manifest_path: Nullable<string>;
  taxon_geographic_spread_artifact_path: Nullable<string>;
  geographic_occurrence_evidence_artifact_path: Nullable<string>;
  status: Nullable<string>;
  retrieved_at: Nullable<string>;
  resumed: Nullable<boolean>;
  completed_occurrence_count: Nullable<number>;
  invalid_coordinate_count: Nullable<number>;
  taxon_key_mismatch_count: Nullable<number>;
  range_inference_eligible_occurrence_count: Nullable<number>;
  evidence_row_count: Nullable<number>;
  evidence_confidence_method: Nullable<string>;
  spread_row_count: Nullable<number>;
  checkpoint_part_count: Nullable<number>;
  source_total_records: Nullable<number>;
  source: Nullable<string>;
  source_query_hash: Nullable<string>;
  source_snapshot_version: Nullable<string>;
}

export interface TaxonGeographicSummaryRecord extends BaseContract {
  schema_version: Nullable<string>;
  registry_version: Nullable<string>;
  accepted_taxon_key: Nullable<string>;
  scientific_name: Nullable<string>;
  geographic_evidence_version: Nullable<string>;
  cell_counts_by_resolution: Nullable<Array<Record<string, number>>>;
  countries: Nullable<string[]>;
  admin_regions: Nullable<string[]>;
  occupied_envelope: Nullable<Record<string, number | boolean>>;
  disconnected_range_component_count: Nullable<number>;
  occurrence_density_summary: Nullable<Record<string, number>>;
  data_deficient: Nullable<boolean>;
  data_deficient_reasons: Nullable<string[]>;
  suspicious_outlier_cell_count: Nullable<number>;
  range_source_coverage: Nullable<Array<Record<string, number>>>;
  known_introduced_regions: Nullable<string[]>;
  current_evidence_count: Nullable<number>;
  historical_evidence_count: Nullable<number>;
  spread_fingerprint: Nullable<string>;
  created_at: Nullable<string>;
}

export interface GeographicSummaryManifestSummary extends BaseContract {
  run_id: string;
  source_manifest_path: Nullable<string>;
  geographic_summary_manifest_path: Nullable<string>;
  taxon_geographic_summary_artifact_path: Nullable<string>;
  geographic_qa_findings_artifact_path: Nullable<string>;
  status: Nullable<string>;
  qa_status: Nullable<string>;
  qa_fatal_count: Nullable<number>;
  qa_warning_count: Nullable<number>;
  summary_row_count: Nullable<number>;
  qa_row_count: Nullable<number>;
  created_at: Nullable<string>;
  policy_version: Nullable<string>;
  grid_name: Nullable<string>;
  grid_version: Nullable<string>;
}

export interface MediaIdentity extends BaseContract {
  media_id: string;
  source_system: Nullable<string>;
  source_record_id: Nullable<string>;
  source_image_uri: Nullable<string>;
  thumbnail_uri: Nullable<string>;
  creator_name: Nullable<string>;
  creator_profile_uri: Nullable<string>;
  license_name: Nullable<string>;
  license_uri: Nullable<string>;
  retrieval_url: Nullable<string>;
  content_fingerprint: Nullable<string>;
  width: Nullable<number>;
  height: Nullable<number>;
  content_type: Nullable<string>;
  created_at: Nullable<string>;
}

export interface GeographicAssignment extends BaseContract {
  media_id: string;
  region_cell: Nullable<string>;
  latitude: Nullable<number>;
  longitude: Nullable<number>;
  country_code: Nullable<string>;
  locality_text: Nullable<string>;
  geofence_source: Nullable<string>;
  geofence_version: Nullable<string>;
  soft_prior: Nullable<boolean>;
}

export interface CandidateSetSummary extends BaseContract {
  run_id: string;
  media_id: string;
  target_taxon_key: Nullable<string>;
  target_taxon_name: Nullable<string>;
  total_candidates: Nullable<number>;
  eligible_candidates: Nullable<number>;
  candidate_names: Nullable<string[]>;
  candidate_version: Nullable<number>;
  source_artifact: Nullable<string>;
}

export interface ObjectEvidenceSummary extends BaseContract {
  run_id: string;
  source_manifest_path: Nullable<string>;
  object_evidence_artifact_path: Nullable<string>;
  photo_summary_artifact_path: Nullable<string>;
  object_evidence_rows: Nullable<number>;
  photo_summary_rows: Nullable<number>;
  object_occurrence_bin_counts: Nullable<Record<string, number>>;
  photo_occurrence_bin_counts: Nullable<Record<string, number>>;
}

export interface ReferenceReadinessSummary extends BaseContract {
  run_id: string;
  status: Nullable<string>;
  source_manifest_path: Nullable<string>;
  readiness_artifact_path: Nullable<string>;
  permits_vision: Nullable<boolean>;
  target_accepted_taxon_key: Nullable<string>;
  registry_version: Nullable<string>;
  reference_bank_version: Nullable<string>;
  policy_version: Nullable<string>;
  policy_fingerprint: Nullable<string>;
  readiness_artifact_schema_version: Nullable<string>;
  created_at: Nullable<string>;
  git_sha: Nullable<string>;
  checks_total: Nullable<number>;
  checks_passed: Nullable<number>;
  checks_warning: Nullable<number>;
  checks_failed: Nullable<number>;
  checks_pending: Nullable<number>;
  documented_shortfall_count: Nullable<number>;
  candidate_set_count: Nullable<number>;
  candidate_set_fingerprint_count: Nullable<number>;
  support_manifest_rows: Nullable<number>;
  eligible_support_rows: Nullable<number>;
  pending_review_count: Nullable<number>;
  pending_target_review_count: Nullable<number>;
  unresolved_duplicate_count: Nullable<number>;
  licence_blocker_count: Nullable<number>;
  attribution_blocker_count: Nullable<number>;
  unverified_support_count: Nullable<number>;
  route_separation_conflict_count: Nullable<number>;
  split_leakage_count: Nullable<number>;
  structural_issue_count: Nullable<number>;
  model_input_fingerprint: Nullable<string>;
  support_manifest_file: Nullable<string>;
  support_manifest_sha256: Nullable<string>;
  summary_file: Nullable<string>;
  summary_sha256: Nullable<string>;
  candidate_set_ids: Nullable<string[]>;
  check_ids: Nullable<string[]>;
}

export interface ReferenceReadinessCheck extends BaseContract {
  check_id: Nullable<string>;
  status: Nullable<string>;
  observed_count: Nullable<number>;
  required_count: Nullable<number>;
  observed_type: Nullable<string>;
  required_type: Nullable<string>;
  affected_species_count: Nullable<number>;
  affected_clusters_count: Nullable<number>;
  affected_routes_count: Nullable<number>;
  evidence_fields: Nullable<string[]>;
}

export interface ReferenceReviewQueueRecord extends BaseContract {
  review_request_id: Nullable<string>;
  reference_media_id: Nullable<string>;
  reference_observation_id: Nullable<string>;
  accepted_taxon_key: Nullable<string>;
  scientific_name: Nullable<string>;
  source: Nullable<string>;
  provider_media_id: Nullable<string>;
  review_status: Nullable<string>;
  review_priority: Nullable<number>;
  required_review_count: Nullable<number>;
  life_stage: Nullable<string>;
  visual_domain: Nullable<string>;
  review_reason: Nullable<string>;
  reference_bank_version: Nullable<string>;
  created_at: Nullable<string>;
  artifact_path: Nullable<string>;
}

export interface ReferenceReviewQueueSummary extends BaseContract {
  run_id: string;
  source_manifest_path: Nullable<string>;
  review_queue_artifact_path: Nullable<string>;
  total_records: Nullable<number>;
  pending_records: Nullable<number>;
  in_review_records: Nullable<number>;
  completed_records: Nullable<number>;
  conflict_records: Nullable<number>;
  cancelled_records: Nullable<number>;
  unique_taxon_count: Nullable<number>;
  unique_media_count: Nullable<number>;
  max_review_priority: Nullable<number>;
  max_required_review_count: Nullable<number>;
}

export interface DetectionRoute extends BaseContract {
  media_id: string;
  route: Nullable<'adult' | 'larva' | 'pupa' | 'pupa_like' | 'specimen' | 'moth' | 'artifact' | 'other_insect' | 'none'>;
  model_name: Nullable<string>;
  route_confidence: Nullable<number>;
  route_reason: Nullable<string>;
  detector_boxes: Nullable<Array<{ x: number; y: number; w: number; h: number }>>;
  detector_masks: Nullable<string[]>;
  subject_area_ratio: Nullable<number>;
  route_artifacts: Nullable<string[]>;
}

export interface VisualInput extends BaseContract {
  media_id: string;
  visual_input_id: string;
  variant: Nullable<'raw_full_image' | 'detector_focused_full_frame' | 'detector_masked_full_frame' | 'multi_object_full_frame'>;
  image_uri: Nullable<string>;
  width: Nullable<number>;
  height: Nullable<number>;
  bytes: Nullable<number>;
  sha256: Nullable<string>;
  produced_by_stage: Nullable<string>;
}

export interface ReferenceEvidence extends BaseContract {
  media_id: string;
  candidate_taxon_key: Nullable<string>;
  reference_id: Nullable<string>;
  evidence_type: Nullable<'image' | 'description' | 'comment' | 'regional_distribution'>;
  raw_similarity: Nullable<number>;
  similarity_type: Nullable<string>;
  nearest_reference_id: Nullable<string>;
  nearest_reference_distance: Nullable<number>;
  source_registry: Nullable<string>;
  source_artifact: Nullable<string>;
}

export interface CandidateScore extends BaseContract {
  media_id: string;
  candidate_set_id: string;
  candidate_taxon_key: Nullable<string>;
  candidate_name: Nullable<string>;
  raw_similarity: Nullable<number>;
  calibrated_score: Nullable<number>;
  calibrated_label: Nullable<'target_confirmed' | 'target_probable' | 'competitor' | 'abstain' | 'negative' | 'other'>;
  competitor_margin: Nullable<number>;
  threshold_version: Nullable<string>;
  threshold_value: Nullable<number>;
  score_artifact_uri: Nullable<string>;
}

export interface CommentMention extends BaseContract {
  media_id: string;
  comment_id: string;
  comment_author: Nullable<string>;
  comment_text: Nullable<string>;
  matched_text: Nullable<string>;
  referenced_taxon_key: Nullable<string>;
  referenced_name: Nullable<string>;
  stance: Nullable<'supports' | 'contradicts' | 'expands' | 'uncertain' | 'irrelevant'>;
  certainty: Nullable<number>;
  candidate_added: Nullable<boolean>;
  parsed_from_evidence: Nullable<boolean>;
}

export interface CandidateSetRevision extends BaseContract {
  media_id: string;
  revision_id: string;
  reason: Nullable<string>;
  revision_actor: Nullable<'comments' | 'engine' | 'manual' | 'planner'>;
  added_candidates: Nullable<string[]>;
  removed_candidates: Nullable<string[]>;
  candidate_set_version: Nullable<number>;
  source_artifact: Nullable<string>;
  created_at: Nullable<string>;
}

export interface EvidenceRecord extends BaseContract {
  evidence_record_id: string;
  media_id: string;
  run_id: string;
  target_taxon_key: Nullable<string>;
  target_name: Nullable<string>;
  strongest_competitor_key: Nullable<string>;
  strongest_competitor_name: Nullable<string>;
  decision: Nullable<'target_confirmed' | 'target_probable' | 'competitor' | 'other_butterfly' | 'other_insect' | 'specimen' | 'artifact' | 'out_of_distribution' | 'insufficient_detail' | 'insufficient_reference' | 'abstain'>;
  calibrated_output: Nullable<number>;
  decision_threshold: Nullable<number>;
  candidate_count: Nullable<number>;
  comment_revision_count: Nullable<number>;
  raw_similarity_available: Nullable<boolean>;
  decision_artifact_uri: Nullable<string>;
  ledger: Nullable<AuditTrail[]>;
}

export interface EvaluationSummary extends BaseContract {
  run_id: string;
  source_dataset: Nullable<string>;
  tested_at: Nullable<string>;
  model_version: Nullable<string>;
  prompt_version: Nullable<string>;
  reference_bank_version: Nullable<string>;
  target_taxon_key: Nullable<string>;
  total_records: Nullable<number>;
  target_confirmed_count: Nullable<number>;
  target_probable_count: Nullable<number>;
  abstain_count: Nullable<number>;
  competitor_count: Nullable<number>;
  comment_supported_records: Nullable<number>;
  comment_conflicted_records: Nullable<number>;
  precision_proxy: Nullable<number>;
  recall_proxy: Nullable<number>;
}

export const REPLAY_SCHEMA_VERSION = 'taxalens-contracts:v1';
