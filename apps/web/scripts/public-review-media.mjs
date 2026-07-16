import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptRoot, '../../..')
const defaultBuildRoot = resolve(repositoryRoot, 'dist/web')
const defaultManifestPath = resolve(
  repositoryRoot,
  'demo/source/verification/papilio-demoleus-commons.campaign.json',
)

const EXECUTABLE_TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs'])
const MEDIA_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
])
const FORBIDDEN_EXECUTABLE_MARKERS = Object.freeze([
  'backblazeb2.com',
  'sign-review-media-preview',
  'taxalens-private-media',
  'taxalens-private-review-media',
  '__taxalens_private_review_media__',
  'B2_APPLICATION_KEY',
  'BIOMINER_S3_SECRET_ACCESS_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'sb_secret_',
])
const FORBIDDEN_FILE_EXTENSIONS = new Set([
  '.env',
  '.key',
  '.p12',
  '.pem',
])

export async function verifyPublicReviewMediaBuild({
  buildRoot = defaultBuildRoot,
  manifestPath = defaultManifestPath,
} = {}) {
  const manifestBytes = await readFile(manifestPath)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const approved = approvedMediaFromManifest(manifest)
  const files = await collectFiles(buildRoot)
  const foundByDigest = new Map(
    [...approved.keys()].map((digest) => [digest, []]),
  )

  for (const file of files) {
    const extension = extname(file.path).toLowerCase()
    if (FORBIDDEN_FILE_EXTENSIONS.has(extension)) {
      throw new Error(
        `Public build contains a credential-like file: ${file.path}`,
      )
    }
    if (MEDIA_EXTENSIONS.has(extension)) {
      const digest = sha256(file.bytes)
      const approvedMedia = approved.get(digest)
      if (approvedMedia === undefined) {
        throw new Error(
          `Public build contains research-only or unapproved media: ${file.path}`,
        )
      }
      if (file.bytes.byteLength !== approvedMedia.imageByteCount) {
        throw new Error(
          `Public review media byte count differs: ${file.path}`,
        )
      }
      foundByDigest.get(digest)?.push(file.path)
    }
    if (EXECUTABLE_TEXT_EXTENSIONS.has(extension)) {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes)
      const marker = FORBIDDEN_EXECUTABLE_MARKERS.find((candidate) =>
        text.includes(candidate),
      )
      if (marker !== undefined) {
        throw new Error(
          `Public executable asset contains private-media marker ${marker}: ${file.path}`,
        )
      }
    }
  }

  for (const [digest, paths] of foundByDigest) {
    if (paths.length === 0) {
      throw new Error(
        `Public review media is missing from the build: ${approved.get(digest)?.previewAsset}`,
      )
    }
  }

  const builtManifest = JSON.parse(
    await readFile(
      join(buildRoot, 'verification/campaign_manifest.json'),
      'utf8',
    ),
  )
  if (
    builtManifest.manifestSha256 !== manifest.manifestSha256 ||
    builtManifest.campaign?.campaignId !== manifest.campaign.campaignId ||
    builtManifest.campaign?.publicReplay !== true ||
    builtManifest.items?.length !== 3
  ) {
    throw new Error(
      'Built verification campaign differs from the approved public fixture.',
    )
  }

  return Object.freeze({
    campaignId: manifest.campaign.campaignId,
    manifestSha256: manifest.manifestSha256,
    approvedItemCount: approved.size,
    mediaFileCount: [...foundByDigest.values()].reduce(
      (count, paths) => count + paths.length,
      0,
    ),
    privateMediaIncluded: false,
  })
}

function approvedMediaFromManifest(manifest) {
  const { manifestSha256, ...unsignedManifest } = manifest
  const computedManifestSha256 = sha256(
    new TextEncoder().encode(JSON.stringify(unsignedManifest)),
  )
  if (
    manifest.schemaVersion !==
      'taxalens-verification-campaign-manifest:v1.0.0' ||
    manifestSha256 !== computedManifestSha256 ||
    manifest.campaign?.publicReplay !== true ||
    manifest.campaign?.samplingPlan?.purpose !==
      'credential_free_fixture' ||
    !Array.isArray(manifest.items) ||
    manifest.items.length !== 3
  ) {
    throw new Error(
      'Public review media verification requires the signed three-image fixture manifest.',
    )
  }
  const approved = new Map()
  for (const item of manifest.items) {
    if (
      item.mediaType !== 'image/jpeg' ||
      !/^[0-9a-f]{64}$/u.test(item.imageSha256) ||
      !Number.isSafeInteger(item.imageByteCount) ||
      item.imageByteCount < 1 ||
      typeof item.previewAsset !== 'string' ||
      !/^[a-z0-9][a-z0-9.-]+$/u.test(item.previewAsset) ||
      item.rights?.policyStatus !== 'allowed' ||
      item.privateMedia !== undefined ||
      item.mediaObjectKey !== undefined ||
      item.objectKey !== undefined
    ) {
      throw new Error(
        `Public review item is not a rights-cleared bundled JPEG: ${String(item.itemId)}`,
      )
    }
    if (approved.has(item.imageSha256)) {
      throw new Error(
        `Public review image digest is repeated: ${item.imageSha256}`,
      )
    }
    approved.set(item.imageSha256, item)
  }
  return approved
}

async function collectFiles(root) {
  const files = []

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      const artifactPath = relative(root, absolutePath).split(sep).join('/')
      if (entry.isDirectory()) {
        await visit(absolutePath)
      } else if (entry.isFile()) {
        files.push({
          path: artifactPath,
          bytes: await readFile(absolutePath),
        })
      } else {
        throw new Error(
          `Public build contains a non-regular entry: ${artifactPath}`,
        )
      }
    }
  }

  await visit(root)
  return files
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function main() {
  const result = await verifyPublicReviewMediaBuild()
  console.log(
    `Public review media verified: campaign=${result.campaignId}, items=${result.approvedItemCount}, files=${result.mediaFileCount}`,
  )
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}
