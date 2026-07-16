-- Explicit Data API grants and row-level authorization.
-- Authorization roles come only from trusted app_metadata claims.

create function taxalens_private.has_verification_role(required_role text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    required_role in (
      'reviewer',
      'adjudicator',
      'campaign_manager',
      'read_only_analyst'
    )
    and (select auth.uid()) is not null
    and coalesce(
      (select auth.jwt()) -> 'app_metadata' -> 'verification_roles',
      '[]'::jsonb
    ) ? required_role;
$$;

create function taxalens_private.owns_verification_campaign(
  target_campaign_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.verification_campaigns as campaign
      where campaign.campaign_id = target_campaign_id
        and campaign.created_by = (select auth.uid())
    );
$$;

revoke all on function
  taxalens_private.has_verification_role(text),
  taxalens_private.owns_verification_campaign(text)
from public, anon;
grant usage on schema taxalens_private to authenticated;
grant execute on function
  taxalens_private.has_verification_role(text),
  taxalens_private.owns_verification_campaign(text)
to authenticated;

alter table public.verification_campaigns
  enable row level security;
alter table public.verification_campaigns
  force row level security;
alter table public.verification_items
  enable row level security;
alter table public.verification_items
  force row level security;
alter table public.verification_assignments
  enable row level security;
alter table public.verification_assignments
  force row level security;
alter table public.verification_events
  enable row level security;
alter table public.verification_events
  force row level security;
alter table public.verification_consensus
  enable row level security;
alter table public.verification_consensus
  force row level security;
alter table public.verification_quality_snapshots
  enable row level security;
alter table public.verification_quality_snapshots
  force row level security;

revoke all on table
  public.verification_campaigns,
  public.verification_items,
  public.verification_assignments,
  public.verification_events,
  public.verification_consensus,
  public.verification_quality_snapshots
from anon, authenticated;

grant select on table
  public.verification_campaigns,
  public.verification_items,
  public.verification_assignments,
  public.verification_events,
  public.verification_consensus,
  public.verification_quality_snapshots
to authenticated;

grant insert, update on table
  public.verification_campaigns,
  public.verification_items,
  public.verification_assignments,
  public.verification_consensus
to authenticated;

grant insert on table
  public.verification_events,
  public.verification_quality_snapshots
to authenticated;

grant select, insert, update, delete on table
  public.verification_campaigns,
  public.verification_items,
  public.verification_assignments,
  public.verification_events,
  public.verification_consensus,
  public.verification_quality_snapshots
to service_role;

create policy verification_campaigns_select
on public.verification_campaigns
for select
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
  or created_by = (select auth.uid())
  or campaign_id in (
    select assignment.campaign_id
    from public.verification_assignments as assignment
    where assignment.reviewer_id = (select auth.uid())
      and assignment.status in ('pending', 'in_progress', 'completed')
  )
);

create policy verification_campaigns_insert
on public.verification_campaigns
for insert
to authenticated
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and created_by = (select auth.uid())
);

create policy verification_campaigns_update
on public.verification_campaigns
for update
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and created_by = (select auth.uid())
)
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and created_by = (select auth.uid())
);

create policy verification_items_select
on public.verification_items
for select
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
  or exists (
    select 1
    from public.verification_assignments as assignment
    where assignment.campaign_id = verification_items.campaign_id
      and assignment.item_id = verification_items.item_id
      and assignment.reviewer_id = (select auth.uid())
      and assignment.status in ('pending', 'in_progress', 'completed')
  )
);

create policy verification_items_insert
on public.verification_items
for insert
to authenticated
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and (
    select taxalens_private.owns_verification_campaign(
      verification_items.campaign_id
    )
  )
);

create policy verification_items_update
on public.verification_items
for update
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and (
    select taxalens_private.owns_verification_campaign(
      verification_items.campaign_id
    )
  )
)
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and (
    select taxalens_private.owns_verification_campaign(
      verification_items.campaign_id
    )
  )
);

create policy verification_assignments_select
on public.verification_assignments
for select
to authenticated
using (
  reviewer_id = (select auth.uid())
  or (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
);

create policy verification_assignments_insert
on public.verification_assignments
for insert
to authenticated
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and assigned_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_assignments.campaign_id
    )
  )
);

create policy verification_assignments_update
on public.verification_assignments
for update
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and assigned_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_assignments.campaign_id
    )
  )
)
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and assigned_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_assignments.campaign_id
    )
  )
);

create policy verification_events_select
on public.verification_events
for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
  or exists (
    select 1
    from public.verification_assignments as assignment
    where assignment.campaign_id = verification_events.campaign_id
      and assignment.item_id = verification_events.item_id
      and assignment.reviewer_id = (select auth.uid())
      and assignment.status in ('pending', 'in_progress', 'completed')
  )
);

create policy verification_events_insert_review
on public.verification_events
for insert
to authenticated
with check (
  event_type = 'review'
  and actor_id = (select auth.uid())
  and (select taxalens_private.has_verification_role('reviewer'))
  and exists (
    select 1
    from public.verification_assignments as assignment
    where assignment.campaign_id = verification_events.campaign_id
      and assignment.item_id = verification_events.item_id
      and assignment.reviewer_id = (select auth.uid())
      and assignment.assignment_role = 'reviewer'
      and assignment.status in ('pending', 'in_progress')
  )
);

create policy verification_events_insert_adjudication
on public.verification_events
for insert
to authenticated
with check (
  event_type = 'adjudication'
  and actor_id = (select auth.uid())
  and (select taxalens_private.has_verification_role('adjudicator'))
  and exists (
    select 1
    from public.verification_assignments as assignment
    where assignment.campaign_id = verification_events.campaign_id
      and assignment.item_id = verification_events.item_id
      and assignment.reviewer_id = (select auth.uid())
      and assignment.assignment_role = 'adjudicator'
      and assignment.status in ('pending', 'in_progress')
  )
);

create policy verification_consensus_select
on public.verification_consensus
for select
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
  or exists (
    select 1
    from public.verification_assignments as assignment
    where assignment.campaign_id = verification_consensus.campaign_id
      and assignment.item_id = verification_consensus.item_id
      and assignment.reviewer_id = (select auth.uid())
      and assignment.status in ('pending', 'in_progress', 'completed')
  )
);

create policy verification_consensus_insert
on public.verification_consensus
for insert
to authenticated
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and updated_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_consensus.campaign_id
    )
  )
);

create policy verification_consensus_update
on public.verification_consensus
for update
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and updated_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_consensus.campaign_id
    )
  )
)
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and updated_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_consensus.campaign_id
    )
  )
);

create policy verification_quality_snapshots_select
on public.verification_quality_snapshots
for select
to authenticated
using (
  (select taxalens_private.has_verification_role('campaign_manager'))
  or (select taxalens_private.has_verification_role('read_only_analyst'))
  or campaign_id in (
    select assignment.campaign_id
    from public.verification_assignments as assignment
    where assignment.reviewer_id = (select auth.uid())
      and assignment.status in ('pending', 'in_progress', 'completed')
  )
);

create policy verification_quality_snapshots_insert
on public.verification_quality_snapshots
for insert
to authenticated
with check (
  (select taxalens_private.has_verification_role('campaign_manager'))
  and created_by = (select auth.uid())
  and (
    select taxalens_private.owns_verification_campaign(
      verification_quality_snapshots.campaign_id
    )
  )
);
