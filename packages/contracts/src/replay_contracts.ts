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
