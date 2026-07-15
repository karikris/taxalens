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
if (manifest.bundle_id !== 'papilio-demoleus-pilot-75461d9c-v1') {
  throw new Error('Static build contains an unexpected bundle ID')
}
if (manifest.artifact_inventory.length !== 17) {
  throw new Error('Static build expects exactly 17 fixture artifacts')
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
