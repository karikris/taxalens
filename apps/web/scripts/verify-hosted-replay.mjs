import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const DEPLOYMENT_SCHEMA = 'taxalens-static-deployment/v1'
const RECEIPT_SCHEMA = 'taxalens-hosted-replay-verification:v1.0.0'
const DEFAULT_URL = 'https://karikris.github.io/taxalens/'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function hostedRoot() {
  const value = process.env.TAXALENS_HOSTED_REPLAY_URL ?? DEFAULT_URL
  const url = new URL(value)
  assert.equal(url.protocol, 'https:', 'Hosted replay must use HTTPS')
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/'
  }
  return url
}

function expectedSourceSha() {
  const value = process.env.TAXALENS_EXPECTED_SHA
  assert.match(
    value ?? '',
    /^[0-9a-f]{40}$/u,
    'TAXALENS_EXPECTED_SHA must be a full lowercase commit SHA',
  )
  return value
}

async function fetchBytes(url, expectedStatus = 200) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      accept: '*/*',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  assert.equal(response.status, expectedStatus, `${url} returned ${response.status}`)
  assert.equal(
    response.headers.get('www-authenticate'),
    null,
    `${url} issued an authentication challenge`,
  )
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type'),
    status: response.status,
  }
}

async function verifiedDeployment(root, sourceSha) {
  const cacheKey = `release=${sourceSha}`
  const rootResponse = await fetchBytes(new URL(`?${cacheKey}`, root))
  assert.match(rootResponse.contentType ?? '', /^text\/html\b/u)

  const fingerprintUrl = new URL(`build-fingerprint.json?${cacheKey}`, root)
  const fingerprintResponse = await fetchBytes(fingerprintUrl)
  const fingerprint = JSON.parse(fingerprintResponse.bytes.toString('utf8'))
  assert.equal(fingerprint.schema_version, DEPLOYMENT_SCHEMA)
  assert.equal(fingerprint.source_sha, sourceSha)
  assert.equal(fingerprint.base_path, root.pathname)
  assert.equal(fingerprint.public, true)
  assert.equal(fingerprint.login_required, false)
  assert.equal(fingerprint.backend_required, false)
  assert.equal(fingerprint.credentials_required, false)
  assert.equal(fingerprint.resettable, true)
  assert.deepEqual(fingerprint.static_fallback, {
    path: '404.html',
    redirect_to: root.pathname,
  })
  const {
    build_fingerprint_sha256: declaredFingerprint,
    ...fingerprintPayload
  } = fingerprint
  assert.match(declaredFingerprint, /^[0-9a-f]{64}$/u)
  assert.equal(sha256(JSON.stringify(fingerprintPayload)), declaredFingerprint)

  const fileByPath = new Map(
    fingerprint.files.map((file) => [file.path, file]),
  )
  const manifestFile = fileByPath.get('verification/campaign_manifest.json')
  assert.ok(manifestFile, 'Campaign manifest is absent from the file inventory')
  const manifestResponse = await fetchBytes(
    new URL(`verification/campaign_manifest.json?${cacheKey}`, root),
  )
  assert.equal(manifestResponse.bytes.byteLength, manifestFile.bytes)
  assert.equal(sha256(manifestResponse.bytes), manifestFile.sha256)
  const campaign = JSON.parse(manifestResponse.bytes.toString('utf8'))
  assert.equal(campaign.manifestSha256, fingerprint.review_media.manifest_sha256)
  assert.equal(campaign.campaign.campaignId, fingerprint.review_media.campaign_id)
  assert.equal(campaign.campaign.publicReplay, true)
  assert.equal(campaign.items.length, 3)

  const media = []
  for (const item of campaign.items) {
    const path = `verification/media/${item.previewAsset}`
    const file = fileByPath.get(path)
    assert.ok(file, `${path} is absent from the deployment inventory`)
    const response = await fetchBytes(new URL(`${path}?${cacheKey}`, root))
    const digest = sha256(response.bytes)
    assert.equal(response.bytes.byteLength, item.imageByteCount)
    assert.equal(response.bytes.byteLength, file.bytes)
    assert.equal(digest, item.imageSha256)
    assert.equal(digest, file.sha256)
    media.push({
      item_id: item.itemId,
      path,
      bytes: response.bytes.byteLength,
      sha256: digest,
    })
  }

  const fallbackUrl = new URL(
    `phase-14-release-check-${Date.now()}?${cacheKey}`,
    root,
  )
  const fallback = await fetchBytes(fallbackUrl, 404)
  const fallbackHtml = fallback.bytes.toString('utf8')
  assert.match(
    fallbackHtml,
    new RegExp(
      `<meta http-equiv="refresh" content="0; url=${root.pathname.replaceAll('/', '\\/')}" \\/>`,
      'u',
    ),
  )
  assert.match(fallbackHtml, /Return to TaxaLens Judge Replay/u)

  return {
    fingerprint,
    media,
    fallback: {
      status: fallback.status,
      redirect_to: root.pathname,
    },
  }
}

async function verifiedGeographicImpact(page, root) {
  await page.goto(new URL('#dashboard', root).href, {
    waitUntil: 'networkidle',
  })
  await page
    .getByRole('heading', { name: 'TaxaLens Geographic Impact Lens' })
    .waitFor({ state: 'visible' })
  await page
    .getByText('Baseline and Flickr evidence mapped', { exact: true })
    .waitFor({ state: 'visible', timeout: 60_000 })
  const geographicScope = page.locator('.geographic-impact-lens__scope')
  assert.match((await geographicScope.textContent()) ?? '', /Global/u)
  assert.doesNotMatch(page.url(), /[?&]geo=/u)
  const summary = page.getByRole('heading', { name: 'Geographic evidence at a glance' }).locator('..')
  assert.match((await summary.textContent()) ?? '', /Global contains/u)
  assert.match((await summary.textContent()) ?? '', /Flickr candidates/u)
  await page.getByRole('button', { name: 'Prepare geographic export' }).click()
  await page
    .getByText('Seven geographic export files prepared', { exact: true })
    .waitFor({ state: 'visible', timeout: 60_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Checksum manifest' }).click()
  const download = await downloadPromise
  assert.match(
    download.suggestedFilename(),
    /^taxalens-papilio-demoleus-global-r3\.manifest\.json$/u,
  )
  const downloadPath = await download.path()
  assert.ok(downloadPath)
  const manifest = JSON.parse(await readFile(downloadPath, 'utf8'))
  assert.equal(manifest.scopeId, 'global')
  assert.equal(manifest.signature.status, 'unavailable')
  assert.equal(manifest.scientificClaimAllowed, false)

  return {
    global: 'passed',
    canonical_scope: 'global',
    named_scope_hard_coded: false,
    export_filename: download.suggestedFilename(),
    export_signature: manifest.signature.status,
    scientific_claim_allowed: manifest.scientificClaimAllowed,
  }
}

async function verifiedFreshBrowser(root, campaignId) {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    assert.deepEqual(await context.cookies(), [])
    const page = await context.newPage()
    const unexpectedOrigins = new Set()
    const credentialHeaders = []
    page.on('request', (request) => {
      const requestUrl = new URL(request.url())
      if (
        ['http:', 'https:'].includes(requestUrl.protocol) &&
        requestUrl.origin !== root.origin
      ) {
        unexpectedOrigins.add(requestUrl.origin)
      }
      const headers = request.headers()
      for (const name of ['authorization', 'cookie', 'x-api-key']) {
        if (headers[name] !== undefined) {
          credentialHeaders.push(name)
        }
      }
    })

    await page.goto(root.href, { waitUntil: 'networkidle' })
    await page
      .getByRole('heading', { name: 'TaxaLens Judge Replay' })
      .waitFor({ state: 'visible' })
    await page
      .getByRole('heading', { name: 'Papilio demoleus' })
      .waitFor({ state: 'visible' })
    assert.equal(await page.locator('input[type="password"]').count(), 0)
    assert.equal(
      await page.getByRole('button', { name: /log ?in|sign ?in/iu }).count(),
      0,
    )

    const geographicImpact = await verifiedGeographicImpact(page, root)

    await page.goto(new URL('#verification', root).href)
    await page
      .getByRole('heading', {
        name: 'Review the label, one image at a time',
      })
      .waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Prepare review cache' }).click()
    await page
      .getByRole('button', { name: 'Cache ready' })
      .waitFor({ state: 'visible' })
    await page
      .getByRole('img', {
        name: /Does this image show an adult Papilio demoleus/u,
      })
      .waitFor({ state: 'visible' })
    await page.getByLabel(/Reviewer ID/u).fill('hosted-release-check')
    await page.getByLabel(/Comment/u).fill('Disposable hosted release check.')
    await page.getByRole('button', { name: 'Can’t view' }).click()
    await page.getByText('Image 2 of 3').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Skip' }).click()
    await page
      .getByText('Review event saved locally')
      .waitFor({ state: 'visible' })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export review receipt' }).click()
    const download = await downloadPromise
    assert.equal(
      download.suggestedFilename(),
      'papilio-demoleus-commons-review-v1.review-receipt.json',
    )
    const downloadPath = await download.path()
    assert.ok(downloadPath)
    const receipt = JSON.parse(await readFile(downloadPath, 'utf8'))
    assert.equal(receipt.currentReviewerId, 'hosted-release-check')
    assert.equal(receipt.counts.recorded, 2)
    assert.equal(receipt.counts.cantView, 1)
    assert.equal(receipt.counts.skipped, 1)
    assert.equal(receipt.semantics.localBrowserReview, true)
    assert.equal(receipt.semantics.scientificClaimAllowed, false)

    await page.getByRole('button', { name: 'Reset replay' }).click()
    await page
      .getByRole('heading', { name: 'Papilio demoleus' })
      .waitFor({ state: 'visible' })
    assert.ok(
      page.url() === root.href || page.url() === `${root.href}#mission`,
      `Reset returned to an unexpected route: ${page.url()}`,
    )
    assert.deepEqual([...unexpectedOrigins], [])
    assert.deepEqual([...new Set(credentialHeaders)], [])
    assert.deepEqual(await context.cookies(), [])

    return {
      browser_name: 'chromium',
      browser_version: browser.version(),
      fresh_context: true,
      campaign_id: campaignId,
      outcomes: receipt.events.map(({ outcome }) => outcome),
      export_filename: download.suggestedFilename(),
      reset_route: new URL(page.url()).hash || root.pathname,
      unexpected_origins: [],
      credential_headers: [],
      geographic_impact: geographicImpact,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const root = hostedRoot()
  const sourceSha = expectedSourceSha()
  const deployment = await verifiedDeployment(root, sourceSha)
  const browser = await verifiedFreshBrowser(
    root,
    deployment.fingerprint.review_media.campaign_id,
  )
  const receipt = {
    schema_version: RECEIPT_SCHEMA,
    verified_at: new Date().toISOString(),
    hosted_url: root.href,
    source_sha: sourceSha,
    build_fingerprint_sha256:
      deployment.fingerprint.build_fingerprint_sha256,
    file_count: deployment.fingerprint.files.length,
    public: true,
    login_required: false,
    backend_required: false,
    credentials_required: false,
    resettable: true,
    media: deployment.media,
    static_fallback: deployment.fallback,
    browser,
    checks: {
      public_root: 'passed',
      no_login: 'passed',
      no_credentials: 'passed',
      reset: 'passed',
      verification_campaign: 'passed',
      media_hashes: 'passed',
      export: 'passed',
      static_fallback: 'passed',
      build_fingerprint: 'passed',
      geographic_impact: 'passed',
      geographic_global_framing: 'passed',
      geographic_export: 'passed',
    },
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`)
}

await main()
