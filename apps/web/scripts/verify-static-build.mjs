import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const repositoryRoot = resolve(appRoot, '../..')
const fixtureRoot = resolve(repositoryRoot, 'demo/fixture/papilio_pilot')
const buildRoot = resolve(repositoryRoot, 'dist/web')

const sourceManifestBytes = await readFile(resolve(fixtureRoot, 'judge_bundle.json'))
const builtManifestBytes = await readFile(resolve(buildRoot, 'judge_bundle.json'))
if (!sourceManifestBytes.equals(builtManifestBytes)) {
  throw new Error('Built judge_bundle.json differs from the verified source fixture')
}

const manifest = JSON.parse(sourceManifestBytes.toString('utf8'))
if (manifest.bundle_id !== 'papilio-demoleus-prototype-74a7d648-v3') {
  throw new Error('Static build contains an unexpected bundle ID')
}
if (manifest.artifact_inventory.length !== 25) {
  throw new Error('Static build expects exactly 25 fixture artifacts')
}

const parquetExtension = await readFile(
  resolve(buildRoot, 'assets/parquet.duckdb_extension.wasm'),
)
if (
  parquetExtension.byteLength !== 2_867_304 ||
  createHash('sha256').update(parquetExtension).digest('hex') !==
    '0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600'
) {
  throw new Error('Built same-origin DuckDB Parquet extension differs from the pinned signed asset')
}

for (const artifact of manifest.artifact_inventory) {
  const source = await readFile(resolve(fixtureRoot, artifact.path))
  const built = await readFile(resolve(buildRoot, artifact.path))
  const digest = createHash('sha256').update(built).digest('hex')
  if (!source.equals(built) || built.byteLength !== artifact.bytes || digest !== artifact.sha256) {
    throw new Error(`Static fixture artifact differs: ${artifact.path}`)
  }
}

const index = await readFile(resolve(buildRoot, 'index.html'), 'utf8')
if (!index.includes('./assets/') || /(?:src|href)="\/(?!\/)/u.test(index)) {
  throw new Error('Static index must use relative build asset URLs')
}
if (!(await stat(resolve(buildRoot, 'index.html'))).isFile()) {
  throw new Error('Static index is not a regular file')
}

console.log(
  `Static replay verified: bundle=${manifest.bundle_id}, artifacts=${manifest.artifact_inventory.length}`,
)
