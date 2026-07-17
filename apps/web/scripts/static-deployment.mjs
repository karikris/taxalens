import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  lstat,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptRoot, '../../..')
const defaultBuildRoot = resolve(repositoryRoot, 'dist/web')

export const DEPLOYMENT_MANIFEST = 'build-fingerprint.json'
export const DEPLOYMENT_SCHEMA = 'taxalens-static-deployment/v1'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function normalizeBasePath(value) {
  if (value === '' || value === '/') {
    return '/'
  }
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('//') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /[\s<>"']/u.test(value) ||
    value.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid static deployment base path: ${String(value)}`)
  }
  return `${value.replace(/\/+$/u, '')}/`
}

function validateSourceSha(sourceSha) {
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error(
      'Static deployment source SHA must be exactly 40 lowercase hexadecimal characters',
    )
  }
  return sourceSha
}

async function resolveSourceSha(environment, root) {
  const configured = environment.TAXALENS_BUILD_SHA
  if (configured !== undefined && configured !== '') {
    return validateSourceSha(configured)
  }
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
  return validateSourceSha(stdout.trim())
}

async function collectFiles(buildRoot) {
  const files = []

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      const artifactPath = relative(buildRoot, absolutePath).split(sep).join('/')
      if (entry.isSymbolicLink()) {
        throw new Error(`Static deployment cannot contain a symbolic link: ${artifactPath}`)
      }
      if (entry.isDirectory()) {
        await visit(absolutePath)
        continue
      }
      if (!entry.isFile()) {
        throw new Error(`Static deployment contains a non-regular entry: ${artifactPath}`)
      }
      if (artifactPath === DEPLOYMENT_MANIFEST) {
        continue
      }
      const metadata = await lstat(absolutePath)
      if (!metadata.isFile() || metadata.nlink !== 1) {
        throw new Error(`Static deployment file must be regular and unlinked: ${artifactPath}`)
      }
      const bytes = await readFile(absolutePath)
      files.push(
        Object.freeze({
          path: artifactPath,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        }),
      )
    }
  }

  await visit(buildRoot)
  return Object.freeze(files)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function staticFallback(basePath) {
  const target = escapeHtml(normalizeBasePath(basePath))
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>Return to TaxaLens Judge Replay</title>
  </head>
  <body>
    <p>This static route is unavailable. <a href="${target}">Return to TaxaLens Judge Replay</a>.</p>
  </body>
</html>
`
}

async function readBundleIdentity(buildRoot) {
  const bundle = JSON.parse(await readFile(join(buildRoot, 'judge_bundle.json'), 'utf8'))
  const { bundle_id: bundleId, source_revisions: revisions } = bundle
  if (
    typeof bundleId !== 'string' ||
    !revisions ||
    typeof revisions.taxalens_sha !== 'string' ||
    typeof revisions.biominer_sha !== 'string'
  ) {
    throw new Error('Built judge bundle does not expose its required source identity')
  }
  return Object.freeze({
    bundle_id: bundleId,
    fixture_taxalens_sha: validateSourceSha(revisions.taxalens_sha),
    biominer_sha: validateSourceSha(revisions.biominer_sha),
  })
}

async function readReviewMediaIdentity(buildRoot) {
  const bundle = JSON.parse(await readFile(join(buildRoot, 'judge_bundle.json'), 'utf8'))
  const expectedItemCount = bundle.expected_ui_counts?.section_records?.verification_media
  const manifest = JSON.parse(
    await readFile(
      join(buildRoot, 'verification/campaign_manifest.json'),
      'utf8',
    ),
  )
  if (
    manifest.schemaVersion !==
      'taxalens-verification-campaign-manifest:v1.0.0' ||
    typeof manifest.manifestSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(manifest.manifestSha256) ||
    manifest.campaign?.publicReplay !== true ||
    manifest.campaign?.samplingPlan?.purpose !==
      'credential_free_fixture' ||
    !Array.isArray(manifest.items) ||
    !Number.isSafeInteger(expectedItemCount) ||
    expectedItemCount < 1 ||
    manifest.items.length !== expectedItemCount ||
    manifest.items.some(
      (item) =>
        item.rights?.policyStatus !== 'allowed' ||
        item.privateMedia !== undefined ||
        item.mediaObjectKey !== undefined,
    )
  ) {
    throw new Error(
      'Built review media does not expose a credential-free fixture.',
    )
  }
  return Object.freeze({
    schema_version: manifest.schemaVersion,
    manifest_sha256: manifest.manifestSha256,
    campaign_id: manifest.campaign.campaignId,
    delivery: 'bundled_checksum_verified_fixture',
    item_count: manifest.items.length,
    private_media_included: false,
  })
}

function fingerprintPayload({
  basePath,
  bundle,
  files,
  reviewMedia,
  sourceSha,
}) {
  return Object.freeze({
    schema_version: DEPLOYMENT_SCHEMA,
    source_sha: sourceSha,
    base_path: basePath,
    public: true,
    login_required: false,
    backend_required: false,
    credentials_required: false,
    resettable: true,
    static_fallback: Object.freeze({ path: '404.html', redirect_to: basePath }),
    evidence_bundle: bundle,
    review_media: reviewMedia,
    files,
  })
}

function manifestFor(payload) {
  return Object.freeze({
    ...payload,
    build_fingerprint_sha256: sha256(JSON.stringify(payload)),
  })
}

export async function prepareStaticDeployment({
  buildRoot = defaultBuildRoot,
  environment = process.env,
  root = repositoryRoot,
} = {}) {
  const sourceSha = await resolveSourceSha(environment, root)
  const basePath = normalizeBasePath(environment.TAXALENS_DEPLOY_BASE_PATH ?? '')

  const indexMetadata = await lstat(join(buildRoot, 'index.html'))
  if (!indexMetadata.isFile() || indexMetadata.nlink !== 1) {
    throw new Error('Static deployment requires a regular dist/web/index.html')
  }

  await rm(join(buildRoot, DEPLOYMENT_MANIFEST), { force: true })
  await writeFile(join(buildRoot, '.nojekyll'), '')
  await writeFile(join(buildRoot, '404.html'), staticFallback(basePath))

  const bundle = await readBundleIdentity(buildRoot)
  const reviewMedia = await readReviewMediaIdentity(buildRoot)
  const files = await collectFiles(buildRoot)
  const payload = fingerprintPayload({
    basePath,
    bundle,
    files,
    reviewMedia,
    sourceSha,
  })
  const manifest = manifestFor(payload)
  await writeFile(
    join(buildRoot, DEPLOYMENT_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return manifest
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export async function verifyStaticDeployment({
  buildRoot = defaultBuildRoot,
  environment = process.env,
  root = repositoryRoot,
} = {}) {
  const sourceSha = await resolveSourceSha(environment, root)
  const manifestPath = join(buildRoot, DEPLOYMENT_MANIFEST)
  const manifestMetadata = await lstat(manifestPath)
  if (!manifestMetadata.isFile() || manifestMetadata.nlink !== 1) {
    throw new Error('Deployment fingerprint must be a regular, unlinked file')
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const basePath = normalizeBasePath(manifest.base_path)

  if (
    manifest.schema_version !== DEPLOYMENT_SCHEMA ||
    manifest.source_sha !== sourceSha ||
    manifest.public !== true ||
    manifest.login_required !== false ||
    manifest.backend_required !== false ||
    manifest.credentials_required !== false ||
    manifest.resettable !== true ||
    !sameJson(manifest.static_fallback, { path: '404.html', redirect_to: basePath })
  ) {
    throw new Error('Deployment fingerprint violates the public static replay contract')
  }

  const fallback = await readFile(join(buildRoot, '404.html'), 'utf8')
  if (fallback !== staticFallback(basePath)) {
    throw new Error('Static 404 fallback differs from the declared base path')
  }
  if ((await readFile(join(buildRoot, '.nojekyll'))).byteLength !== 0) {
    throw new Error('Static deployment .nojekyll marker must be empty')
  }

  const bundle = await readBundleIdentity(buildRoot)
  const reviewMedia = await readReviewMediaIdentity(buildRoot)
  const files = await collectFiles(buildRoot)
  if (
    !sameJson(manifest.evidence_bundle, bundle) ||
    !sameJson(manifest.review_media, reviewMedia) ||
    !sameJson(manifest.files, files)
  ) {
    throw new Error('Static deployment file inventory or evidence identity differs')
  }

  const payload = fingerprintPayload({
    basePath,
    bundle,
    files,
    reviewMedia,
    sourceSha,
  })
  const expected = manifestFor(payload)
  if (!sameJson(manifest, expected)) {
    throw new Error('Static deployment build fingerprint differs')
  }
  return manifest
}

async function main() {
  const command = process.argv[2]
  let manifest
  if (command === 'prepare') {
    manifest = await prepareStaticDeployment()
  } else if (command === 'verify') {
    manifest = await verifyStaticDeployment()
  } else {
    throw new Error('Usage: node scripts/static-deployment.mjs <prepare|verify>')
  }
  console.log(
    `Static deployment ${command === 'prepare' ? 'prepared' : 'verified'}: source=${manifest.source_sha}, fingerprint=${manifest.build_fingerprint_sha256}, files=${manifest.files.length}, base=${manifest.base_path}`,
  )
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
