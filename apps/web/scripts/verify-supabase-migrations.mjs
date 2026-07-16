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
    create schema auth;
    create table auth.users (
      id uuid primary key
    );
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

  await verifyImmutableEventLedger(database)

  console.log(
    `Supabase migrations validated in PostgreSQL: ${migrationNames.join(', ')}`,
  )
} finally {
  await database.close()
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
          1,
          $3,
          '{}'::jsonb,
          $4,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )
      `,
      [
        eventId,
        actorId,
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
    reviewedAt: '2026-07-16T19:02:00.000Z',
    supersedesEventId: 'event-original',
  })
  await assertRejectsSql(
    () =>
      insertEvent({
        eventId: 'event-second-revision',
        reviewedAt: '2026-07-16T19:03:00.000Z',
        supersedesEventId: 'event-original',
      }),
    /duplicate key|unique constraint/iu,
  )
  await assertRejectsSql(
    () =>
      insertEvent({
        actorId: userB,
        eventId: 'event-cross-reviewer-revision',
        reviewedAt: '2026-07-16T19:04:00.000Z',
        supersedesEventId: 'event-revision',
      }),
    /superseded review event relationship is invalid/iu,
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
      }),
    /source events are invalid or not independent/iu,
  )

  async function insertAdjudication({ actorId, eventId }) {
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
          2,
          'yes',
          '{}'::jsonb,
          '2026-07-16T19:06:00.000Z',
          '2026-07-16T19:06:00.000Z',
          $3,
          $4,
          $5,
          $6,
          $7,
          array['event-revision', 'event-reviewer-b'],
          array['outcome']
        )
      `,
      [
        eventId,
        actorId,
        imageSha,
        questionSha,
        manifestSha,
        taxalensSha,
        biominerSha,
      ],
    )
  }
}

async function assertRejectsSql(operation, pattern) {
  await assert.rejects(operation, pattern)
}
