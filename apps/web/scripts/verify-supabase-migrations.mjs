import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const repositoryRoot = resolve(webRoot, '../..')
const migrationsRoot = resolve(repositoryRoot, 'supabase/migrations')
const expectedTables = [
  'verification_assignments',
  'verification_campaigns',
  'verification_consensus',
  'verification_events',
  'verification_items',
  'verification_quality_snapshots',
]

const database = new PGlite()

try {
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        current_setting('request.jwt.claim.sub', true),
        ''
      )::uuid
    $$;
    create function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
      )
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(), auth.jwt() to authenticated;
  `)

  const migrationNames = (await readdir(migrationsRoot))
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
    .sort()
  assert.ok(migrationNames.length > 0, 'No Supabase migrations were found.')

  for (const migrationName of migrationNames) {
    const sql = await readFile(resolve(migrationsRoot, migrationName), 'utf8')
    assert.ok(sql.trim() !== '', `${migrationName} is empty.`)
    await database.exec(sql)
  }

  const tables = await database.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name like 'verification_%'
    order by table_name
  `)
  assert.deepEqual(
    tables.rows.map(({ table_name: tableName }) => tableName),
    expectedTables,
  )

  const primaryKeys = await database.query(`
    select count(*)::integer as count
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name like 'verification_%'
      and constraint_type = 'PRIMARY KEY'
  `)
  assert.equal(primaryKeys.rows[0]?.count, expectedTables.length)

  const foreignKeys = await database.query(`
    select count(*)::integer as count
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name like 'verification_%'
      and constraint_type = 'FOREIGN KEY'
  `)
  assert.ok(
    foreignKeys.rows[0]?.count >= 11,
    'Verification foreign-key coverage is incomplete.',
  )

  const indexes = await database.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename like 'verification_%'
    order by indexname
  `)
  const indexNames = new Set(
    indexes.rows.map(({ indexname: indexName }) => indexName),
  )
  for (const indexName of [
    'verification_assignments_reviewer_status_idx',
    'verification_events_campaign_item_reviewed_at_idx',
    'verification_items_campaign_stratum_idx',
    'verification_quality_snapshots_campaign_captured_at_idx',
  ]) {
    assert.ok(indexNames.has(indexName), `Missing index: ${indexName}`)
  }

  await verifyRowLevelSecurityCatalog(database)
  await verifyImmutableEventLedger(database)
  await verifyRowLevelSecurity(database)

  console.log(
    `Supabase migrations validated in PostgreSQL: ${migrationNames.join(', ')}`,
  )
} finally {
  await database.close()
}

async function verifyRowLevelSecurityCatalog(database) {
  const rowLevelSecurity = await database.query(`
    select
      relname as table_name,
      relrowsecurity as enabled,
      relforcerowsecurity as forced
    from pg_class
    join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and relname like 'verification_%'
      and relkind = 'r'
    order by relname
  `)
  assert.deepEqual(
    rowLevelSecurity.rows.map(({ table_name: tableName, enabled, forced }) => ({
      tableName,
      enabled,
      forced,
    })),
    expectedTables.map((tableName) => ({
      tableName,
      enabled: true,
      forced: true,
    })),
  )

  const policies = await database.query(`
    select tablename, count(*)::integer as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename like 'verification_%'
    group by tablename
    order by tablename
  `)
  assert.deepEqual(
    policies.rows.map(
      ({ tablename: tableName, policy_count: policyCount }) => ({
        tableName,
        policyCount,
      }),
    ),
    [
      { tableName: 'verification_assignments', policyCount: 3 },
      { tableName: 'verification_campaigns', policyCount: 3 },
      { tableName: 'verification_consensus', policyCount: 3 },
      { tableName: 'verification_events', policyCount: 3 },
      { tableName: 'verification_items', policyCount: 3 },
      { tableName: 'verification_quality_snapshots', policyCount: 2 },
    ],
  )

  const authorizationHelpers = await database.query(`
    select
      proname as function_name,
      prosecdef as security_definer,
      has_function_privilege(
        'anon',
        pg_proc.oid,
        'EXECUTE'
      ) as anon_can_execute,
      has_function_privilege(
        'authenticated',
        pg_proc.oid,
        'EXECUTE'
      ) as authenticated_can_execute
    from pg_proc
    join pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'taxalens_private'
      and proname in (
        'has_verification_role',
        'owns_verification_campaign'
      )
    order by proname
  `)
  assert.deepEqual(authorizationHelpers.rows, [
    {
      function_name: 'has_verification_role',
      security_definer: false,
      anon_can_execute: false,
      authenticated_can_execute: true,
    },
    {
      function_name: 'owns_verification_campaign',
      security_definer: true,
      anon_can_execute: false,
      authenticated_can_execute: true,
    },
  ])
}

async function verifyImmutableEventLedger(database) {
  const userA = '00000000-0000-4000-8000-000000000001'
  const userB = '00000000-0000-4000-8000-000000000002'
  const userC = '00000000-0000-4000-8000-000000000003'
  const imageSha = '1'.repeat(64)
  const questionSha = '2'.repeat(64)
  const manifestSha = '3'.repeat(64)
  const taxalensSha = '4'.repeat(40)
  const biominerSha = '5'.repeat(40)

  await database.query(
    'insert into auth.users (id) values ($1), ($2), ($3)',
    [userA, userB, userC],
  )
  await database.query(
    `
      insert into public.verification_campaigns (
        campaign_id,
        schema_version,
        title,
        description,
        kind,
        status,
        review_requirement,
        sampling_plan,
        disclosure_policy,
        question_sha256,
        manifest_sha256,
        taxalens_sha,
        biominer_sha,
        created_by
      )
      values (
        'campaign-test',
        'campaign:v1',
        'Migration test',
        'Migration test campaign',
        'flickr_target_verification',
        'active',
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        $1,
        $2,
        $3,
        $4,
        $5
      )
    `,
    [questionSha, manifestSha, taxalensSha, biominerSha, userA],
  )
  await database.query(
    `
      insert into public.verification_items (
        campaign_id,
        item_id,
        schema_version,
        source_provider,
        source_observation_id,
        source_media_id,
        image_sha256,
        question_sha256,
        source_payload,
        duplicate_group_id,
        observation_group_id,
        owner_photographer_group_id,
        sampling_stratum_id,
        rights_payload
      )
      values (
        'campaign-test',
        'item-test',
        'item:v1',
        'flickr',
        'observation-test',
        'media-test',
        $1,
        $2,
        '{}'::jsonb,
        'duplicate-test',
        'observation-test',
        'owner-test',
        'all',
        '{}'::jsonb
      )
    `,
    [imageSha, questionSha],
  )

  const insertEvent = async ({
    actorId = userA,
    eventId,
    imageFingerprint = imageSha,
    outcome = 'yes',
    reviewRound = 1,
    supersedesEventId = null,
    reviewedAt,
  }) =>
    database.query(
      `
        insert into public.verification_events (
          event_id,
          campaign_id,
          item_id,
          actor_id,
          schema_version,
          review_round,
          outcome,
          event_payload,
          reviewed_at,
          received_at,
          image_sha256,
          question_sha256,
          campaign_manifest_sha256,
          taxalens_sha,
          biominer_sha,
          supersedes_event_id
        )
        values (
          $1,
          'campaign-test',
          'item-test',
          $2,
          'event:v1',
          $3,
          $4,
          '{}'::jsonb,
          $5,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
      `,
      [
        eventId,
        actorId,
        reviewRound,
        outcome,
        reviewedAt,
        imageFingerprint,
        questionSha,
        manifestSha,
        taxalensSha,
        biominerSha,
        supersedesEventId,
      ],
    )

  await insertEvent({
    eventId: 'event-original',
    reviewedAt: '2026-07-16T19:00:00.000Z',
  })
  await assertRejectsSql(
    () =>
      insertEvent({
        eventId: 'event-original',
        reviewedAt: '2026-07-16T19:01:00.000Z',
      }),
    /duplicate key|unique constraint/iu,
  )
  await assertRejectsSql(
    () =>
      insertEvent({
        eventId: 'event-stale',
        imageFingerprint: '9'.repeat(64),
        reviewedAt: '2026-07-16T19:01:00.000Z',
      }),
    /source fingerprints are stale/iu,
  )
  await assertRejectsSql(
    () =>
      database.exec(`
        update public.verification_events
        set outcome = 'no'
        where event_id = 'event-original'
      `),
    /append only/iu,
  )
  await assertRejectsSql(
    () =>
      database.exec(`
        delete from public.verification_events
        where event_id = 'event-original'
      `),
    /append only/iu,
  )
  await insertEvent({
    eventId: 'event-revision',
    reviewRound: 2,
    reviewedAt: '2026-07-16T19:02:00.000Z',
    supersedesEventId: 'event-original',
  })
  await assertRejectsSql(
    () =>
      insertEvent({
        eventId: 'event-second-revision',
        reviewRound: 3,
        reviewedAt: '2026-07-16T19:03:00.000Z',
        supersedesEventId: 'event-original',
      }),
    /duplicate key|unique constraint/iu,
  )
  await assertRejectsSql(
    () =>
      insertEvent({
        eventId: 'event-round-gap',
        reviewRound: 4,
        reviewedAt: '2026-07-16T19:03:30.000Z',
        supersedesEventId: 'event-revision',
      }),
    /reviewer round is not contiguous/iu,
  )
  await assertRejectsSql(
    () =>
      insertEvent({
        actorId: userB,
        eventId: 'event-cross-reviewer-revision',
        reviewedAt: '2026-07-16T19:04:00.000Z',
        supersedesEventId: 'event-revision',
      }),
    /superseded verification event relationship is invalid/iu,
  )
  await insertEvent({
    actorId: userB,
    eventId: 'event-reviewer-b',
    outcome: 'no',
    reviewedAt: '2026-07-16T19:05:00.000Z',
  })
  await insertAdjudication({
    actorId: userC,
    eventId: 'event-adjudication',
  })
  await assertRejectsSql(
    () =>
      insertAdjudication({
        actorId: userA,
        eventId: 'event-self-adjudication',
        reviewRound: 3,
      }),
    /source events are invalid or not independent/iu,
  )

  async function insertAdjudication({
    actorId,
    eventId,
    reviewRound = 1,
  }) {
    return database.query(
      `
        insert into public.verification_events (
          event_id,
          campaign_id,
          item_id,
          actor_id,
          schema_version,
          event_type,
          review_round,
          outcome,
          event_payload,
          reviewed_at,
          received_at,
          image_sha256,
          question_sha256,
          campaign_manifest_sha256,
          taxalens_sha,
          biominer_sha,
          source_conflict_event_ids,
          source_conflict_fields
        )
        values (
          $1,
          'campaign-test',
          'item-test',
          $2,
          'event:v1',
          'adjudication',
          $3,
          'yes',
          '{}'::jsonb,
          '2026-07-16T19:06:00.000Z',
          '2026-07-16T19:06:00.000Z',
          $4,
          $5,
          $6,
          $7,
          $8,
          array['event-revision', 'event-reviewer-b'],
          array['outcome']
        )
      `,
      [
        eventId,
        actorId,
        reviewRound,
        imageSha,
        questionSha,
        manifestSha,
        taxalensSha,
        biominerSha,
      ],
    )
  }
}

async function verifyRowLevelSecurity(database) {
  const reviewerId = '00000000-0000-4000-8000-000000000001'
  const unassignedReviewerId = '00000000-0000-4000-8000-000000000006'
  const adjudicatorId = '00000000-0000-4000-8000-000000000003'
  const managerId = '00000000-0000-4000-8000-000000000004'
  const analystId = '00000000-0000-4000-8000-000000000005'

  await database.query('insert into auth.users (id) values ($1), ($2), ($3)', [
    managerId,
    analystId,
    unassignedReviewerId,
  ])
  await database.query(
    `
      insert into public.verification_assignments (
        campaign_id,
        item_id,
        reviewer_id,
        assignment_role,
        status,
        assigned_by
      )
      values
        (
          'campaign-test',
          'item-test',
          $1,
          'reviewer',
          'in_progress',
          $3
        ),
        (
          'campaign-test',
          'item-test',
          $2,
          'adjudicator',
          'in_progress',
          $3
        )
    `,
    [reviewerId, adjudicatorId, managerId],
  )

  await setAnonymousContext(database)
  await assertRejectsSql(
    () => countRows(database, 'public.verification_campaigns'),
    /permission denied/iu,
  )

  await setAuthenticatedContext(database, reviewerId, ['reviewer'])
  assert.equal(await countRows(database, 'public.verification_campaigns'), 1)
  assert.equal(await countRows(database, 'public.verification_items'), 1)
  assert.equal(await countRows(database, 'public.verification_assignments'), 1)
  await assertRejectsSql(
    () =>
      database.exec(`
        insert into public.verification_campaigns (
          campaign_id,
          schema_version,
          title,
          description,
          kind,
          status,
          review_requirement,
          sampling_plan,
          disclosure_policy,
          question_sha256,
          manifest_sha256,
          taxalens_sha,
          created_by
        )
        values (
          'reviewer-created',
          'campaign:v1',
          'Rejected',
          'Rejected',
          'quality_control',
          'draft',
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          '${'6'.repeat(64)}',
          '${'7'.repeat(64)}',
          '${'8'.repeat(40)}',
          '${reviewerId}'
        )
      `),
    /row-level security|permission denied/iu,
  )
  await database.exec(`
    insert into public.verification_events (
      event_id,
      campaign_id,
      item_id,
      actor_id,
      schema_version,
      review_round,
      outcome,
      event_payload,
      reviewed_at,
      received_at,
      image_sha256,
      question_sha256,
      campaign_manifest_sha256,
      taxalens_sha,
      biominer_sha,
      supersedes_event_id
    )
    select
      'event-rls-reviewer',
      campaign.campaign_id,
      item.item_id,
      '${reviewerId}',
      'event:v1',
      3,
      'yes',
      '{}'::jsonb,
      '2026-07-16T19:10:00.000Z',
      '2026-07-16T19:10:00.000Z',
      item.image_sha256,
      item.question_sha256,
      campaign.manifest_sha256,
      campaign.taxalens_sha,
      campaign.biominer_sha,
      'event-revision'
    from public.verification_campaigns as campaign
    join public.verification_items as item
      on item.campaign_id = campaign.campaign_id
    where campaign.campaign_id = 'campaign-test'
      and item.item_id = 'item-test'
  `)
  await assertRejectsSql(
    () =>
      database.exec(`
        update public.verification_events
        set outcome = 'no'
        where event_id = 'event-rls-reviewer'
      `),
    /permission denied|append only/iu,
  )

  await setAuthenticatedContext(database, unassignedReviewerId, ['reviewer'])
  assert.equal(await countRows(database, 'public.verification_campaigns'), 0)
  assert.equal(await countRows(database, 'public.verification_events'), 0)
  await setAuthenticatedClaims(database, {
    sub: unassignedReviewerId,
    user_metadata: {
      verification_roles: ['campaign_manager'],
    },
  })
  assert.equal(await countRows(database, 'public.verification_campaigns'), 0)

  await setAuthenticatedContext(database, adjudicatorId, ['adjudicator'])
  assert.equal(await countRows(database, 'public.verification_events'), 5)
  await database.exec(`
    insert into public.verification_events (
      event_id,
      campaign_id,
      item_id,
      actor_id,
      schema_version,
      event_type,
      review_round,
      outcome,
      event_payload,
      reviewed_at,
      received_at,
      image_sha256,
      question_sha256,
      campaign_manifest_sha256,
      taxalens_sha,
      biominer_sha,
      supersedes_event_id,
      source_conflict_event_ids,
      source_conflict_fields
    )
    select
      'event-rls-adjudication',
      campaign.campaign_id,
      item.item_id,
      '${adjudicatorId}',
      'event:v1',
      'adjudication',
      2,
      'yes',
      '{}'::jsonb,
      '2026-07-16T19:11:00.000Z',
      '2026-07-16T19:11:00.000Z',
      item.image_sha256,
      item.question_sha256,
      campaign.manifest_sha256,
      campaign.taxalens_sha,
      campaign.biominer_sha,
      'event-adjudication',
      array['event-rls-reviewer', 'event-reviewer-b'],
      array['outcome']
    from public.verification_campaigns as campaign
    join public.verification_items as item
      on item.campaign_id = campaign.campaign_id
    where campaign.campaign_id = 'campaign-test'
      and item.item_id = 'item-test'
  `)
  assert.equal(await countRows(database, 'public.verification_events'), 6)

  await setAuthenticatedContext(database, managerId, ['campaign_manager'])
  await database.exec(`
    update public.verification_assignments
    set status = 'cancelled'
    where campaign_id = 'campaign-test'
      and reviewer_id = '${reviewerId}'
  `)
  const protectedAssignment = await database.query(`
    select status
    from public.verification_assignments
    where campaign_id = 'campaign-test'
      and reviewer_id = '${reviewerId}'
  `)
  assert.equal(protectedAssignment.rows[0]?.status, 'in_progress')
  await database.exec(`
    insert into public.verification_campaigns (
      campaign_id,
      schema_version,
      title,
      description,
      kind,
      status,
      review_requirement,
      sampling_plan,
      disclosure_policy,
      question_sha256,
      manifest_sha256,
      taxalens_sha,
      created_by
    )
    values (
      'campaign-manager-created',
      'campaign:v1',
      'Manager campaign',
      'Created through the manager policy',
      'quality_control',
      'draft',
      '{}'::jsonb,
      '{"qualityEstimationAllowed": false}'::jsonb,
      '{}'::jsonb,
      '${'6'.repeat(64)}',
      '${'7'.repeat(64)}',
      '${'8'.repeat(40)}',
      '${managerId}'
    )
  `)
  await database.exec(`
    insert into public.verification_quality_snapshots (
      snapshot_sha256,
      campaign_id,
      schema_version,
      captured_at,
      decisive_sample_count,
      release_status,
      snapshot_payload,
      created_by
    )
    values (
      '${'a'.repeat(64)}',
      'campaign-manager-created',
      'quality:v1',
      now(),
      0,
      'not_evaluated',
      '{}'::jsonb,
      '${managerId}'
    )
  `)
  await database.exec(`
    update public.verification_campaigns
    set title = 'Manager campaign updated'
    where campaign_id = 'campaign-manager-created'
  `)
  const managerCampaign = await database.query(`
    select title
    from public.verification_campaigns
    where campaign_id = 'campaign-manager-created'
  `)
  assert.equal(managerCampaign.rows[0]?.title, 'Manager campaign updated')

  await setAuthenticatedContext(database, analystId, ['read_only_analyst'])
  assert.equal(await countRows(database, 'public.verification_campaigns'), 2)
  assert.equal(
    await countRows(database, 'public.verification_quality_snapshots'),
    1,
  )
  await assertRejectsSql(
    () =>
      database.exec(`
        insert into public.verification_quality_snapshots (
          snapshot_sha256,
          campaign_id,
          schema_version,
          captured_at,
          decisive_sample_count,
          release_status,
          snapshot_payload,
          created_by
        )
        values (
          '${'9'.repeat(64)}',
          'campaign-test',
          'quality:v1',
          now(),
          0,
          'not_evaluated',
          '{}'::jsonb,
          '${analystId}'
        )
      `),
    /row-level security|permission denied/iu,
  )

  await database.exec('reset role')
}

async function setAnonymousContext(database) {
  await database.exec(`
    reset role;
    reset request.jwt.claim.sub;
    reset request.jwt.claims;
    set role anon;
  `)
}

async function setAuthenticatedContext(database, userId, roles) {
  await setAuthenticatedClaims(database, {
    sub: userId,
    app_metadata: {
      verification_roles: roles,
    },
  })
}

async function setAuthenticatedClaims(database, claimsValue) {
  const claims = JSON.stringify(claimsValue).replaceAll("'", "''")
  await database.exec(`
    reset role;
    set request.jwt.claim.sub = '${claimsValue.sub}';
    set request.jwt.claims = '${claims}';
    set role authenticated;
  `)
}

async function countRows(database, table) {
  const result = await database.query(
    `select count(*)::integer as count from ${table}`,
  )
  return result.rows[0]?.count
}

async function assertRejectsSql(operation, pattern) {
  await assert.rejects(operation, pattern)
}
