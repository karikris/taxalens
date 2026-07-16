-- TaxaLens verification collaboration schema.
-- Grants and RLS policies are added in a later migration so exposure remains opt-in.

create table public.verification_campaigns (
  campaign_id text primary key,
  schema_version text not null,
  title text not null,
  description text not null,
  kind text not null
    check (
      kind in (
        'flickr_target_verification',
        'reference_identity_verification',
        'reference_route_verification',
        'adjudication',
        'quality_control'
      )
    ),
  status text not null
    check (
      status in (
        'draft',
        'ready',
        'active',
        'paused',
        'complete',
        'archived'
      )
    ),
  target_taxon jsonb,
  source_providers text[] not null default array[]::text[],
  review_requirement jsonb not null,
  sampling_plan jsonb not null,
  disclosure_policy jsonb not null,
  question_sha256 text,
  manifest_sha256 text,
  taxalens_sha text,
  biominer_sha text,
  public_replay boolean not null default false,
  scientific_claim_allowed boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(campaign_id) <> ''),
  check (btrim(schema_version) <> ''),
  check (btrim(title) <> ''),
  check (updated_at >= created_at)
);

create index verification_campaigns_created_by_idx
  on public.verification_campaigns (created_by);

create index verification_campaigns_status_created_at_idx
  on public.verification_campaigns (status, created_at desc);

create table public.verification_items (
  campaign_id text not null,
  item_id text not null,
  schema_version text not null,
  source_provider text not null,
  source_observation_id text not null,
  source_media_id text not null,
  media_object_key text,
  image_sha256 text,
  question_sha256 text,
  source_payload jsonb not null,
  duplicate_group_id text not null,
  observation_group_id text not null,
  owner_photographer_group_id text not null,
  sampling_stratum_id text not null,
  inclusion_probability double precision,
  rights_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, item_id),
  foreign key (campaign_id)
    references public.verification_campaigns (campaign_id)
    on delete restrict,
  check (btrim(item_id) <> ''),
  check (btrim(schema_version) <> ''),
  check (btrim(source_provider) <> ''),
  check (btrim(source_observation_id) <> ''),
  check (btrim(source_media_id) <> ''),
  check (btrim(duplicate_group_id) <> ''),
  check (btrim(observation_group_id) <> ''),
  check (btrim(owner_photographer_group_id) <> ''),
  check (btrim(sampling_stratum_id) <> ''),
  check (
    inclusion_probability is null
    or (
      inclusion_probability > 0
      and inclusion_probability <= 1
    )
  )
);

create index verification_items_campaign_stratum_idx
  on public.verification_items (campaign_id, sampling_stratum_id);

create index verification_items_campaign_duplicate_group_idx
  on public.verification_items (campaign_id, duplicate_group_id);

create index verification_items_campaign_owner_group_idx
  on public.verification_items (
    campaign_id,
    owner_photographer_group_id
  );

create table public.verification_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  item_id text not null,
  reviewer_id uuid not null references auth.users (id) on delete restrict,
  assignment_role text not null
    check (assignment_role in ('reviewer', 'adjudicator')),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  assigned_by uuid not null references auth.users (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  foreign key (campaign_id, item_id)
    references public.verification_items (campaign_id, item_id)
    on delete restrict,
  unique (campaign_id, item_id, reviewer_id, assignment_role),
  check (accepted_at is null or accepted_at >= assigned_at),
  check (completed_at is null or completed_at >= assigned_at)
);

create index verification_assignments_reviewer_status_idx
  on public.verification_assignments (
    reviewer_id,
    status,
    assigned_at
  );

create index verification_assignments_campaign_item_status_idx
  on public.verification_assignments (campaign_id, item_id, status);

create index verification_assignments_assigned_by_idx
  on public.verification_assignments (assigned_by);

create table public.verification_events (
  event_id text primary key,
  campaign_id text not null,
  item_id text not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  schema_version text not null,
  event_type text not null default 'review'
    check (event_type in ('review', 'adjudication')),
  review_round integer not null check (review_round >= 1),
  outcome text not null
    check (
      outcome in (
        'yes',
        'no',
        'cant_tell',
        'cant_view',
        'skipped'
      )
    ),
  event_payload jsonb not null,
  reviewed_at timestamptz not null,
  received_at timestamptz not null default now(),
  image_sha256 text,
  question_sha256 text,
  campaign_manifest_sha256 text,
  taxalens_sha text,
  biominer_sha text,
  supersedes_event_id text,
  conflicts_with_decision_id text,
  source_conflict_event_ids text[] not null default array[]::text[],
  source_conflict_fields text[] not null default array[]::text[],
  foreign key (campaign_id, item_id)
    references public.verification_items (campaign_id, item_id)
    on delete restrict,
  check (btrim(event_id) <> ''),
  check (btrim(schema_version) <> ''),
  check (received_at >= reviewed_at)
);

create index verification_events_campaign_item_reviewed_at_idx
  on public.verification_events (
    campaign_id,
    item_id,
    reviewed_at desc,
    event_id
  );

create index verification_events_actor_reviewed_at_idx
  on public.verification_events (actor_id, reviewed_at desc);

create index verification_events_supersedes_event_idx
  on public.verification_events (supersedes_event_id)
  where supersedes_event_id is not null;

create table public.verification_consensus (
  campaign_id text not null,
  item_id text not null,
  schema_version text not null,
  status text not null
    check (
      status in (
        'pending',
        'complete_agreement',
        'unresolved_disagreement',
        'uncertain_only',
        'media_failure',
        'deferred',
        'adjudicated'
      )
    ),
  consensus_outcome text
    check (consensus_outcome is null or consensus_outcome in ('yes', 'no')),
  consensus_payload jsonb not null,
  source_event_ids text[] not null default array[]::text[],
  revision bigint not null default 1 check (revision >= 1),
  resolved_at timestamptz,
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, item_id),
  foreign key (campaign_id, item_id)
    references public.verification_items (campaign_id, item_id)
    on delete restrict,
  check (btrim(schema_version) <> '')
);

create index verification_consensus_campaign_status_idx
  on public.verification_consensus (campaign_id, status, updated_at desc);

create index verification_consensus_updated_by_idx
  on public.verification_consensus (updated_by);

create table public.verification_quality_snapshots (
  snapshot_sha256 text primary key,
  campaign_id text not null,
  schema_version text not null,
  captured_at timestamptz not null,
  decisive_sample_count integer not null
    check (decisive_sample_count >= 0),
  release_status text not null
    check (
      release_status in (
        'not_evaluated',
        'blocked',
        'release_ready'
      )
    ),
  snapshot_payload jsonb not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (campaign_id)
    references public.verification_campaigns (campaign_id)
    on delete restrict,
  check (btrim(snapshot_sha256) <> ''),
  check (btrim(schema_version) <> '')
);

create index verification_quality_snapshots_campaign_captured_at_idx
  on public.verification_quality_snapshots (
    campaign_id,
    captured_at desc
  );

create index verification_quality_snapshots_created_by_idx
  on public.verification_quality_snapshots (created_by);
