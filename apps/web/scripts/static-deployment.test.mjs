import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import {
  DEPLOYMENT_SCHEMA,
  prepareStaticDeployment,
  staticFallback,
  verifyStaticDeployment,
} from './static-deployment.mjs'

const sourceSha = 'a'.repeat(40)
const fixtureTaxaLensSha = 'b'.repeat(40)
const biominerSha = '74a7d648a562efa744e6502ef504a23b63b4e02f'
const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

async function buildFixture() {
  const root = await mkdtemp(join(tmpdir(), 'taxalens-deployment-'))
  temporaryRoots.push(root)
  const buildRoot = join(root, 'dist/web')
  await mkdir(join(buildRoot, 'assets'), { recursive: true })
  await writeFile(
    join(buildRoot, 'index.html'),
    '<!doctype html><script src="./assets/app.js"></script>\n',
  )
  await writeFile(join(buildRoot, 'assets/app.js'), 'console.log("static replay")\n')
  await writeFile(
    join(buildRoot, 'judge_bundle.json'),
    `${JSON.stringify({
      bundle_id: 'test-bundle',
      source_revisions: {
        taxalens_sha: fixtureTaxaLensSha,
        biominer_sha: biominerSha,
      },
      expected_ui_counts: { section_records: { verification_media: 3 } },
    })}\n`,
  )
  await mkdir(join(buildRoot, 'verification'), { recursive: true })
  await writeFile(
    join(buildRoot, 'verification/campaign_manifest.json'),
    `${JSON.stringify({
      schemaVersion: 'taxalens-verification-campaign-manifest:v1.0.0',
      manifestSha256: 'd'.repeat(64),
      campaign: {
        campaignId: 'public-review-fixture',
        publicReplay: true,
        samplingPlan: { purpose: 'credential_free_fixture' },
      },
      items: Array.from({ length: 3 }, (_, index) => ({
        itemId: `public-item-${index}`,
        rights: { policyStatus: 'allowed' },
      })),
    })}\n`,
  )
  return { buildRoot, root }
}

test('prepares and verifies a public backend-free Pages artifact', async () => {
  const { buildRoot, root } = await buildFixture()
  const environment = {
    TAXALENS_BUILD_SHA: sourceSha,
    TAXALENS_DEPLOY_BASE_PATH: '/taxalens',
  }
  const manifest = await prepareStaticDeployment({ buildRoot, environment, root })

  assert.equal(manifest.schema_version, DEPLOYMENT_SCHEMA)
  assert.equal(manifest.source_sha, sourceSha)
  assert.equal(manifest.base_path, '/taxalens/')
  assert.equal(manifest.public, true)
  assert.equal(manifest.login_required, false)
  assert.equal(manifest.backend_required, false)
  assert.equal(manifest.credentials_required, false)
  assert.equal(manifest.resettable, true)
  assert.deepEqual(manifest.review_media, {
    schema_version: 'taxalens-verification-campaign-manifest:v1.0.0',
    manifest_sha256: 'd'.repeat(64),
    campaign_id: 'public-review-fixture',
    delivery: 'bundled_checksum_verified_fixture',
    item_count: 3,
    private_media_included: false,
  })
  assert.deepEqual(manifest.static_fallback, {
    path: '404.html',
    redirect_to: '/taxalens/',
  })
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    [
      '.nojekyll',
      '404.html',
      'assets/app.js',
      'index.html',
      'judge_bundle.json',
      'verification/campaign_manifest.json',
    ],
  )
  assert.match(manifest.build_fingerprint_sha256, /^[0-9a-f]{64}$/u)
  assert.equal(
    await readFile(join(buildRoot, '404.html'), 'utf8'),
    staticFallback('/taxalens/'),
  )
  assert.equal((await readFile(join(buildRoot, '.nojekyll'))).byteLength, 0)

  assert.deepEqual(
    await verifyStaticDeployment({ buildRoot, environment, root }),
    manifest,
  )
})

test('fails closed when a fingerprinted file changes', async () => {
  const { buildRoot, root } = await buildFixture()
  const environment = { TAXALENS_BUILD_SHA: sourceSha }
  await prepareStaticDeployment({ buildRoot, environment, root })
  await writeFile(join(buildRoot, 'assets/app.js'), 'console.log("tampered")\n')

  await assert.rejects(
    verifyStaticDeployment({ buildRoot, environment, root }),
    /file inventory or evidence identity differs/u,
  )
})

test('fails closed when the verified event commit differs', async () => {
  const { buildRoot, root } = await buildFixture()
  await prepareStaticDeployment({
    buildRoot,
    environment: { TAXALENS_BUILD_SHA: sourceSha },
    root,
  })

  await assert.rejects(
    verifyStaticDeployment({
      buildRoot,
      environment: { TAXALENS_BUILD_SHA: 'c'.repeat(40) },
      root,
    }),
    /public static replay contract/u,
  )
})
