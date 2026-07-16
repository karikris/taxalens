-- Verification events are an immutable scientific ledger.

create schema if not exists taxalens_private;
revoke all on schema taxalens_private from public;

alter table public.verification_campaigns
  alter column question_sha256 set not null,
  alter column manifest_sha256 set not null,
  alter column taxalens_sha set not null;

alter table public.verification_campaigns
  add constraint verification_campaigns_question_sha256_check
    check (question_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_campaigns_manifest_sha256_check
    check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_campaigns_taxalens_sha_check
    check (taxalens_sha ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'),
  add constraint verification_campaigns_biominer_sha_check
    check (
      biominer_sha is null
      or biominer_sha ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'
    );

alter table public.verification_items
  alter column image_sha256 set not null,
  alter column question_sha256 set not null;

alter table public.verification_items
  add constraint verification_items_image_sha256_check
    check (image_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_items_question_sha256_check
    check (question_sha256 ~ '^[0-9a-f]{64}$');

alter table public.verification_events
  alter column image_sha256 set not null,
  alter column question_sha256 set not null,
  alter column campaign_manifest_sha256 set not null,
  alter column taxalens_sha set not null;

alter table public.verification_events
  add constraint verification_events_image_sha256_check
    check (image_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_events_question_sha256_check
    check (question_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_events_campaign_manifest_sha256_check
    check (campaign_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint verification_events_taxalens_sha_check
    check (taxalens_sha ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'),
  add constraint verification_events_biominer_sha_check
    check (
      biominer_sha is null
      or biominer_sha ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'
    ),
  add constraint verification_events_not_self_superseding_check
    check (
      supersedes_event_id is null
      or supersedes_event_id <> event_id
    ),
  add constraint verification_events_supersedes_event_fkey
    foreign key (supersedes_event_id)
    references public.verification_events (event_id)
    on delete restrict;

create unique index verification_events_supersedes_once_idx
  on public.verification_events (supersedes_event_id)
  where supersedes_event_id is not null;

alter table public.verification_quality_snapshots
  add constraint verification_quality_snapshots_sha256_check
    check (snapshot_sha256 ~ '^[0-9a-f]{64}$');

create function taxalens_private.validate_verification_item_fingerprints()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  campaign_question_sha256 text;
begin
  select campaign.question_sha256
  into campaign_question_sha256
  from public.verification_campaigns as campaign
  where campaign.campaign_id = new.campaign_id;

  if campaign_question_sha256 is null then
    raise exception 'verification item campaign is unavailable'
      using errcode = '23503';
  end if;

  if new.question_sha256 <> campaign_question_sha256 then
    raise exception 'verification item question fingerprint differs from campaign'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.image_sha256 is distinct from old.image_sha256
      or new.question_sha256 is distinct from old.question_sha256
    )
    and exists (
      select 1
      from public.verification_events as event
      where event.campaign_id = old.campaign_id
        and event.item_id = old.item_id
    )
  then
    raise exception 'reviewed verification item fingerprints are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger verification_items_validate_fingerprints
before insert or update of image_sha256, question_sha256
on public.verification_items
for each row
execute function taxalens_private.validate_verification_item_fingerprints();

create function taxalens_private.validate_verification_campaign_fingerprints()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.question_sha256 is distinct from old.question_sha256
    or new.manifest_sha256 is distinct from old.manifest_sha256
    or new.taxalens_sha is distinct from old.taxalens_sha
    or new.biominer_sha is distinct from old.biominer_sha
  )
  and exists (
    select 1
    from public.verification_items as item
    where item.campaign_id = old.campaign_id
  )
  then
    raise exception 'materialized campaign fingerprints are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger verification_campaigns_validate_fingerprints
before update of
  question_sha256,
  manifest_sha256,
  taxalens_sha,
  biominer_sha
on public.verification_campaigns
for each row
execute function taxalens_private.validate_verification_campaign_fingerprints();

create function taxalens_private.validate_verification_event_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  campaign_record public.verification_campaigns%rowtype;
  item_record public.verification_items%rowtype;
  superseded_record public.verification_events%rowtype;
begin
  select campaign.*
  into campaign_record
  from public.verification_campaigns as campaign
  where campaign.campaign_id = new.campaign_id;

  select item.*
  into item_record
  from public.verification_items as item
  where item.campaign_id = new.campaign_id
    and item.item_id = new.item_id;

  if item_record.item_id is null then
    raise exception 'verification event item is unavailable'
      using errcode = '23503';
  end if;

  if new.image_sha256 <> item_record.image_sha256
    or new.question_sha256 <> item_record.question_sha256
    or new.question_sha256 <> campaign_record.question_sha256
    or new.campaign_manifest_sha256 <> campaign_record.manifest_sha256
    or new.taxalens_sha <> campaign_record.taxalens_sha
    or new.biominer_sha is distinct from campaign_record.biominer_sha
  then
    raise exception 'verification event source fingerprints are stale'
      using errcode = '23514';
  end if;

  if new.event_type = 'review'
    and (
      cardinality(new.source_conflict_event_ids) <> 0
      or cardinality(new.source_conflict_fields) <> 0
    )
  then
    raise exception 'ordinary review event cannot carry adjudication lineage'
      using errcode = '23514';
  end if;

  if new.event_type = 'adjudication' then
    if new.supersedes_event_id is not null
      or cardinality(new.source_conflict_event_ids) < 2
      or cardinality(new.source_conflict_fields) < 1
      or cardinality(new.source_conflict_event_ids) <> (
        select count(distinct conflict_event_id)
        from unnest(new.source_conflict_event_ids) as conflict_event_id
      )
      or cardinality(new.source_conflict_fields) <> (
        select count(distinct conflict_field)
        from unnest(new.source_conflict_fields) as conflict_field
      )
    then
      raise exception 'adjudication lineage is incomplete or repeated'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from unnest(new.source_conflict_event_ids) as source(event_id)
      left join public.verification_events as event
        on event.event_id = source.event_id
      where event.event_id is null
        or event.campaign_id <> new.campaign_id
        or event.item_id <> new.item_id
        or event.event_type <> 'review'
        or event.actor_id = new.actor_id
    )
    then
      raise exception 'adjudication source events are invalid or not independent'
        using errcode = '23514';
    end if;
  end if;

  if new.supersedes_event_id is not null then
    select event.*
    into superseded_record
    from public.verification_events as event
    where event.event_id = new.supersedes_event_id;

    if superseded_record.event_id is null
      or new.event_type <> 'review'
      or superseded_record.event_type <> 'review'
      or superseded_record.campaign_id <> new.campaign_id
      or superseded_record.item_id <> new.item_id
      or superseded_record.actor_id <> new.actor_id
      or new.reviewed_at <= superseded_record.reviewed_at
      or new.review_round < superseded_record.review_round
    then
      raise exception 'superseded review event relationship is invalid'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger verification_events_validate_insert
before insert on public.verification_events
for each row
execute function taxalens_private.validate_verification_event_insert();

create function taxalens_private.reject_verification_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'verification events are append only'
    using errcode = '55000';
end;
$$;

create trigger verification_events_reject_mutation
before update or delete on public.verification_events
for each row
execute function taxalens_private.reject_verification_event_mutation();

revoke all on all functions in schema taxalens_private from public;
