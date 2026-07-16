type Nullable<T> = T | null;

export const JUDGE_BUNDLE_SCHEMA_VERSION = 'taxalens-judge-bundle:v1.0.0';

export const JUDGE_BUNDLE_SECTION_NAMES = [
  'run_summary',
  'pipeline_stages',
  'stage_metrics',
  'query_definitions',
  'logical_associations',
  'flickr_candidate_summaries',
  'duplicate_summaries',
  'geographic_clusters',
  'candidate_sets',
  'reference_readiness',
  'reference_shortfalls',
  'biological_negatives',
  'visual_domain_negatives',
  'yoloe_evidence',
  'full_frame_visual_input_metadata',
  'target_aware_score_metadata',
  'selective_decision_metadata',
  'comments',
  'candidate_revisions',
  'evaluation_summaries',
  'verification_campaigns',
  'verification_items',
  'verification_media',
  'verification_decisions',
  'verification_quality',
] as const;

export type JudgeBundleSectionName = (typeof JUDGE_BUNDLE_SECTION_NAMES)[number];
export type JudgeBundleAvailability = 'available' | 'partial' | 'unavailable';
export type CandidateSemantics =
  | 'not_applicable'
  | 'hypothesis_not_occurrence'
  | 'candidate_reference_not_verified_support'
  | 'reviewed_evidence'
  | 'diagnostic_only';
export type VerificationStatus =
  | 'metadata_only'
  | 'unreviewed'
  | 'human_review_pending'
  | 'human_verified'
  | 'machine_verified_contract'
  | 'unavailable';

export interface JudgeBundleSection {
  status: JudgeBundleAvailability;
  artifact_ids: string[];
  reason: Nullable<string>;
  candidate_semantics: CandidateSemantics;
  verification_status: VerificationStatus;
  human_review_required: boolean;
  scientific_claim_allowed: boolean;
}

export interface JudgeBundleArtifact {
  artifact_id: string;
  path: string;
  media_type: string;
  role: JudgeBundleSectionName | 'rights' | 'attribution' | 'openai_replay_traces' | 'other';
  sha256: string;
  bytes: number;
  record_count: Nullable<number>;
  schema_version: Nullable<string>;
  source_repository: string;
  source_commit: string;
  required: boolean;
}

export interface JudgeBundleRightsItem {
  rights_id: string;
  artifact_ids: string[];
  status: 'rights_verified' | 'license_checked' | 'blocked' | 'fixture_only';
  license_name: Nullable<string>;
  license_uri: Nullable<string>;
  creator_or_owner: Nullable<string>;
  source_url: Nullable<string>;
  use_scope: string;
  attribution_required: boolean;
  notes: string[];
}

export interface JudgeBundleRights {
  status: 'rights_verified' | 'license_checked' | 'blocked' | 'fixture_only';
  all_artifacts_covered: boolean;
  all_media_rights_verified: boolean;
  items: JudgeBundleRightsItem[];
}

export interface JudgeBundleAttributionEntry {
  attribution_id: string;
  artifact_ids: string[];
  display_text: string;
  creator: Nullable<string>;
  source_title: Nullable<string>;
  source_url: Nullable<string>;
  license_name: Nullable<string>;
  license_uri: Nullable<string>;
}

export interface JudgeBundleAttribution {
  complete: boolean;
  entries: JudgeBundleAttributionEntry[];
}

export interface OpenAIReplayTrace {
  trace_id: string;
  sequence: number;
  stage_id: Nullable<string>;
  model: Nullable<string>;
  occurred_at: Nullable<string>;
  request_artifact_id: Nullable<string>;
  response_artifact_id: Nullable<string>;
  prompt_sha256: Nullable<string>;
  response_sha256: Nullable<string>;
  stored_output_only: true;
}

export interface JudgeBundleOpenAIReplay {
  status: 'available' | 'unavailable' | 'not_used';
  mode: 'stored_structured_outputs_only' | 'not_used';
  credentials_required: false;
  live_requests_allowed: false;
  reason: Nullable<string>;
  traces: OpenAIReplayTrace[];
}

export interface JudgeBundleExpectedUiCounts {
  section_records: Record<JudgeBundleSectionName, number>;
  screen_items: {
    research_mission: number;
    evidence_observatory: number;
    evidence_lens: number;
    butterfly_dashboard: number;
  };
  artifact_count: number;
  attribution_count: number;
  openai_replay_trace_count: number;
  unavailable_section_count: number;
}

export interface JudgeBundleChecksums {
  algorithm: 'sha256';
  canonicalization: 'json-sorted-keys-utf8-v1';
  inventory_sha256: string;
  payload_root_sha256: string;
}

export interface JudgeBundleContract {
  schema_version: typeof JUDGE_BUNDLE_SCHEMA_VERSION;
  bundle_id: string;
  title: string;
  created_at: string;
  target: {
    accepted_taxon_key: string;
    scientific_name: string;
    rank: string;
  };
  source_revisions: {
    taxalens_sha: string;
    biominer_sha: string;
  };
  artifact_inventory: JudgeBundleArtifact[];
  sections: Record<JudgeBundleSectionName, JudgeBundleSection>;
  rights: JudgeBundleRights;
  attribution: JudgeBundleAttribution;
  openai_replay: JudgeBundleOpenAIReplay;
  expected_ui_counts: JudgeBundleExpectedUiCounts;
  checksums: JudgeBundleChecksums;
}
