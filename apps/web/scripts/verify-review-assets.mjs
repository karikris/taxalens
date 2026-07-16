import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const manifestUrl = new URL(
  '../../../demo/source/verification/papilio-demoleus-commons.campaign.json',
  import.meta.url,
)
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'))
const { manifestSha256, ...unsignedManifest } = manifest
const computedManifestSha256 = createHash('sha256')
  .update(JSON.stringify(unsignedManifest))
  .digest('hex')

if (manifestSha256 !== computedManifestSha256) {
  throw new Error(
    `Verification campaign manifest identity differs: ${fileURLToPath(manifestUrl)}`,
  )
}
if (
  manifest.schemaVersion !==
  'taxalens-verification-campaign-manifest:v1.0.0'
) {
  throw new Error(
    `Unsupported verification campaign manifest: ${manifest.schemaVersion}`,
  )
}
if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
  throw new Error('Verification campaign manifest contains no media items')
}

for (const item of manifest.items) {
  if (
    typeof item.previewAsset !== 'string' ||
    !/^[a-z0-9][a-z0-9.-]+$/u.test(item.previewAsset)
  ) {
    throw new Error(`Unsafe verification campaign asset: ${item.previewAsset}`)
  }
  if (item.campaignId !== manifest.campaign.campaignId) {
    throw new Error(`Verification item campaign differs: ${item.itemId}`)
  }
  const assetUrl = new URL(
    `../src/review/assets/${item.previewAsset}`,
    import.meta.url,
  )
  const content = await readFile(assetUrl)
  const digest = createHash('sha256').update(content).digest('hex')
  if (
    content.byteLength !== item.imageByteCount ||
    digest !== item.imageSha256
  ) {
    throw new Error(
      `Verification campaign asset identity differs: ${item.previewAsset}`,
    )
  }
  if (
    item.mediaType !== 'image/jpeg' ||
    content[0] !== 0xff ||
    content[1] !== 0xd8
  ) {
    throw new Error(
      `Verification campaign asset is not a JPEG: ${item.previewAsset}`,
    )
  }
}

console.log(
  `Verification campaign fixture verified: ${manifest.items.length} media items`,
)
