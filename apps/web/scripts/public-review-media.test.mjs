import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { verifyPublicReviewMediaBuild } from './public-review-media.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  )
})

test('accepts only the three approved bundled review images', async () => {
  const fixture = await publicBuildFixture()

  const result = await verifyPublicReviewMediaBuild(fixture)

  assert.deepEqual(result, {
    campaignId: 'public-review-fixture',
    manifestSha256: fixture.manifestSha256,
    approvedItemCount: 3,
    mediaFileCount: 3,
    privateMediaIncluded: false,
  })
})

test('rejects an unapproved research image', async () => {
  const fixture = await publicBuildFixture()
  await writeFile(
    join(fixture.buildRoot, 'assets/research-only.jpg'),
    jpegBytes(99),
  )

  await assert.rejects(
    verifyPublicReviewMediaBuild(fixture),
    /research-only or unapproved media/u,
  )
})

test('rejects private-media delivery code in a public executable asset', async () => {
  const fixture = await publicBuildFixture()
  await writeFile(
    join(fixture.buildRoot, 'assets/app.js'),
    'const endpoint = "sign-review-media-preview";\n',
  )

  await assert.rejects(
    verifyPublicReviewMediaBuild(fixture),
    /private-media marker/u,
  )
})

test('rejects private item metadata in the approved manifest', async () => {
  const fixture = await publicBuildFixture({
    mutateItem: (item) => ({
      ...item,
      privateMedia: {
        provider: 'backblaze_b2',
        objectKey: 'research/private.jpg',
      },
    }),
  })

  await assert.rejects(
    verifyPublicReviewMediaBuild(fixture),
    /rights-cleared bundled JPEG/u,
  )
})

async function publicBuildFixture({ mutateItem = (item) => item } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'taxalens-public-media-'))
  temporaryRoots.push(root)
  const buildRoot = join(root, 'dist/web')
  const manifestPath = join(root, 'campaign.json')
  await mkdir(join(buildRoot, 'assets'), { recursive: true })
  await mkdir(join(buildRoot, 'verification'), { recursive: true })
  await writeFile(join(buildRoot, 'index.html'), '<!doctype html>\n')
  await writeFile(join(buildRoot, 'assets/app.js'), 'console.log("public")\n')

  const items = Array.from({ length: 3 }, (_, index) => {
    const bytes = jpegBytes(index)
    return mutateItem({
      itemId: `public-item-${index}`,
      mediaType: 'image/jpeg',
      imageSha256: sha256(bytes),
      imageByteCount: bytes.byteLength,
      previewAsset: `public-item-${index}.jpg`,
      rights: { policyStatus: 'allowed' },
    })
  })
  const unsignedManifest = {
    schemaVersion: 'taxalens-verification-campaign-manifest:v1.0.0',
    campaign: {
      campaignId: 'public-review-fixture',
      publicReplay: true,
      samplingPlan: { purpose: 'credential_free_fixture' },
    },
    items,
  }
  const manifestSha256 = sha256(
    new TextEncoder().encode(JSON.stringify(unsignedManifest)),
  )
  const manifest = { manifestSha256, ...unsignedManifest }
  await writeFile(manifestPath, JSON.stringify(manifest))
  await writeFile(
    join(buildRoot, 'verification/campaign_manifest.json'),
    JSON.stringify(manifest),
  )
  await Promise.all(
    items.map((item, index) =>
      writeFile(
        join(buildRoot, 'assets', `public-item-${index}.jpg`),
        jpegBytes(index),
      ),
    ),
  )
  return { buildRoot, manifestPath, manifestSha256 }
}

function jpegBytes(index) {
  return Uint8Array.from([0xff, 0xd8, index, 1, 2, 3, 0xff, 0xd9])
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
