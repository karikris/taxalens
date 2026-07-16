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

  console.log(
    `Supabase migrations validated in PostgreSQL: ${migrationNames.join(', ')}`,
  )
} finally {
  await database.close()
}
