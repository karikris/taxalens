-- Align PostgreSQL revisions with the TypeScript append-only ledger.
-- A duplicate event ID is left to the primary key so clients can resolve
-- idempotent retries by comparing the already persisted payload.

create or replace function
  taxalens_private.validate_verification_event_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  campaign_record public.verification_campaigns%rowtype;
  item_record public.verification_items%rowtype;
  superseded_record public.verification_events%rowtype;
  prior_actor_round integer;
begin
  if exists (
    select 1
    from public.verification_events as event
    where event.event_id = new.event_id
  ) then
    return new;
  end if;

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

  select max(event.review_round)
  into prior_actor_round
  from public.verification_events as event
  where event.campaign_id = new.campaign_id
    and event.item_id = new.item_id
    and event.actor_id = new.actor_id;

  if new.review_round <> coalesce(prior_actor_round + 1, 1) then
    raise exception 'verification event reviewer round is not contiguous'
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
    if cardinality(new.source_conflict_event_ids) < 2
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
        or event.reviewed_at > new.reviewed_at
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
      or superseded_record.campaign_id <> new.campaign_id
      or superseded_record.item_id <> new.item_id
      or superseded_record.actor_id <> new.actor_id
      or new.reviewed_at <= superseded_record.reviewed_at
      or new.review_round <= superseded_record.review_round
    then
      raise exception 'superseded verification event relationship is invalid'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
