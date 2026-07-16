import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

test('serves the truthful shell entirely from the static origin', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))

  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'TaxaLens Judge Replay' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Awaiting human review')
  await expect(page.getByText('Static replay · no live backend')).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(requestUrls.length).toBeGreaterThan(2)
  expect(requestUrls.every((url) => new URL(url).origin === expectedOrigin)).toBe(true)
})

test('preserves hierarchy at a narrow viewport and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
  await expect(page.getByText('Metadata only', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Awaiting human review')

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
  expect(viewport.scrollBehavior).toBe('auto')
})

test('navigates the evidence views and guided tour from the keyboard', async ({ page }) => {
  await page.goto('./')

  const tourTrigger = page.getByRole('button', { name: 'Start 90-second judge tour' })
  await tourTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Research Mission' })).toBeVisible()
  await expect(page.getByText('90-second judge tour · Step 1 of 6')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Resume 90-second judge tour' }),
  ).toBeFocused()

  const evidenceLens = page.getByRole('link', { name: 'Evidence Lens' })
  await evidenceLens.focus()
  await page.keyboard.press('Enter')
  await expect(evidenceLens).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()

  const agentTrace = page.getByRole('link', { name: 'Agent Trace' })
  await agentTrace.focus()
  await page.keyboard.press('Enter')
  await expect(agentTrace).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('heading', { name: 'GPT-5.6 Sol research analyst' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Replayed analyst session' })).toBeVisible()
  await expect(page.getByText('gpt-5.6-sol', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Stored output · no live call')).toBeVisible()
  await expect(page.getByText('What target does this verified replay resolve?')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'resolve_taxon' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Answer' })).toBeVisible()
  await expect(
    page.locator('.agent-answer').getByText(/This target resolution is not an occurrence/u),
  ).toBeVisible()
  await expect(page.getByText('stored-analyst-request', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('stored-analyst-run', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No analyst session loaded' })).toBeHidden()

  const reset = page.getByRole('button', { name: 'Reset replay' })
  await reset.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Mission' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
})

test('downloads the human-review cache and records all non-binary controls locally', async ({
  page,
}) => {
  await page.goto('./#human-review')

  await expect(
    page.getByRole('heading', { name: 'Review the label, one image at a time' }),
  ).toBeVisible()
  await expect(page.getByText(/81 \/ 81 provider-supported items/u)).toBeVisible()
  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await expect(
    page.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()

  await page.getByLabel(/Comment/u).fill('Could not inspect the image at full clarity.')
  await page.getByRole('button', { name: 'Can’t view' }).click()
  await expect(page.getByText('Image 2 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText(/Can’t view 1 · Skipped 1/u)).toBeVisible()
  await expect(page.getByText('Review event saved locally')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export review receipt' })).toBeEnabled()

  const events = await readReviewEvents(page)
  expect(events.map(({ outcome }) => outcome)).toEqual([
    'cant_view',
    'skipped',
  ])
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem(
        'taxalens-human-review:papilio-demoleus-commons-review-v1',
      ),
    ),
  ).toBeNull()
})

test('routes Evidence Lens through Verification and returns local review lineage', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto('./#evidence-lens')

  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  await expect(
    page.getByRole('heading', { name: 'Source flickr:55081300254' }),
  ).toBeVisible({ timeout: 60_000 })
  const verifyResult = page.getByRole('link', { name: 'Verify this result' })
  await expect(verifyResult).toHaveAttribute(
    'href',
    '#verification?campaign=papilio-demoleus-flickr-candidate-intake-v1&item=flickr%3A55081300254&return=evidence-lens',
  )
  await verifyResult.click()

  await expect(page.getByRole('tab', { name: 'Flickr Results' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(
    page.getByRole('heading', {
      name: 'Papilio demoleus Flickr candidate intake',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('Flickr candidate review media is unavailable'),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Return to Evidence Lens' }).click()
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()

  await page.goto(
    './#verification?campaign=papilio-demoleus-commons-review-v1&item=commons-papilio-demoleus-open-wing&return=evidence-lens',
  )
  const cantView = page.getByRole('button', { name: 'Can’t view' })
  await expect(cantView).toBeEnabled()
  await cantView.click()
  await expect(page.getByText('Review event saved locally')).toBeVisible()
  await page.getByRole('link', { name: 'Return to Evidence Lens' }).click()

  const humanEvidence = page.locator('.human-verification-evidence')
  await expect(
    humanEvidence.getByRole('heading', {
      name: 'Local human verification evidence',
    }),
  ).toBeVisible()
  await expect(
    humanEvidence.getByText('Current human outcomes').locator('..'),
  ).toContainText('1 of 3')
  const humanSummary = humanEvidence.locator(
    '.human-verification-evidence__summary > div',
  )
  await expect(
    humanSummary.filter({ hasText: 'Reviewer count' }),
  ).toContainText('1 recorded reviewer identity')
  await expect(
    humanSummary.filter({ hasText: 'Conflict status' }),
  ).toContainText('Not calculated')
  await expect(
    humanEvidence.getByRole('list', {
      name: 'Current human verification outcomes',
    }),
  ).toContainText('Can’t view')
  await expect(
    humanEvidence.getByText(/local-review-event/u).first(),
  ).toBeVisible()

  const ledger = page.getByRole('list', { name: 'Evidence lifecycle ledger' })
  await expect(
    ledger.getByRole('heading', { name: 'Local human verification' }),
  ).toBeVisible()
  await expect(ledger).toContainText('local-review-event')
})

test('shows only checksum-verified evidence with explicit analytics and unavailable states', async ({
  page,
}) => {
  await page.goto('./#observatory')

  await expect(page.getByText('30 / 30 verified')).toBeVisible()
  await expect(page.getByText('Inventory and payload verified')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Evidence pipeline' })).toBeVisible()
  const pipeline = page.getByRole('list', { name: 'Evidence pipeline stages' })
  await expect(pipeline.locator(':scope > li')).toHaveCount(13)
  await expect(pipeline.getByRole('heading', { name: 'Trusted Registry' })).toBeVisible()
  await expect(pipeline.getByRole('heading', { name: 'Final Evidence' })).toBeVisible()
  await expect(pipeline.getByText('76,485', { exact: true })).toBeVisible()
  await expect(pipeline.getByText('13,501', { exact: true })).toBeVisible()

  const lineageRecord = page.getByRole('button', {
    name: /Final replay record awaiting review/u,
  })
  await expect(lineageRecord).toHaveAttribute('aria-pressed', 'false')
  await lineageRecord.focus()
  await page.keyboard.press('Enter')
  await expect(lineageRecord).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText(/13 contributing stages and 12 contributing artifacts highlighted/u),
  ).toBeVisible()
  await expect(pipeline.locator(':scope > li[data-lineage-highlighted="true"]')).toHaveCount(13)
  const lineageArtifacts = page.getByRole('list', { name: 'Contributing lineage artifacts' })
  await expect(
    lineageArtifacts.locator(':scope > li[data-lineage-highlighted="true"]'),
  ).toHaveCount(12)
  const queryDefinitions = lineageArtifacts
    .getByText('query-definitions', { exact: true })
    .locator('xpath=ancestor::li[1]')
  await expect(queryDefinitions).toContainText('Trusted Registry · Query Compilation')
  await queryDefinitions.getByText('Inspect artifact identity').click()
  await expect(queryDefinitions).toContainText('Checksum verified')

  await page.getByRole('link', { name: 'Evidence Lens' }).click()
  await expect(page.getByRole('heading', { name: 'Explicitly unavailable evidence' })).toBeVisible()
  await expect(page.locator('.unavailable-evidence-list > li')).toHaveCount(8)

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Verified local data boundary' })).toBeVisible()
  await expect(page.getByText('analytics on demand')).toBeVisible()
  await expect(page.getByText(/no worker starts at bootstrap/u)).toBeVisible()
})

test('configures a bounded mission without enabling unsupported live work', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.goto('./#mission')

  const target = page.getByRole('textbox', { name: 'Target species' })
  await expect(target).toHaveValue('Papilio demoleus')
  await expect(page.getByRole('textbox', { name: 'Maximum API calls' })).toHaveValue('314')
  await expect(page.getByRole('textbox', { name: 'Candidate limit' })).toHaveValue('5')
  await expect(page.getByRole('radio', { name: 'Replay committed evidence' })).toBeChecked()
  await expect(
    page.getByRole('radio', { name: 'Live work unavailable in the submitted build' }),
  ).toBeDisabled()
  await expect(page.getByText('22 committed definitions')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live scientific work is not ready' })).toBeVisible()

  await page.getByRole('button', { name: 'Generate deterministic plan' }).click()
  await expect(page.getByRole('heading', { name: 'Evidence plan' })).toBeVisible()
  await expect(page.getByText('taxalens-evidence-plan-v1.0.0', { exact: true })).toBeVisible()
  await expect(page.getByText(/^sha256:[0-9a-f]{64}$/u)).toBeVisible()
  await expect(page.getByText('butterflies-v2-20260712', { exact: true })).toBeVisible()
  await expect(page.getByText('Explicit approval remains required')).toBeVisible()

  await target.fill('Papilio polytes')
  await expect(page.getByText('No matching verified fixture')).toBeVisible()
  await page.getByRole('textbox', { name: 'Optional device' }).fill('external GPU computer')

  await page.getByRole('button', { name: 'Restore replay baseline' }).click()
  await expect(target).toHaveValue('Papilio demoleus')
  await expect(page.getByRole('textbox', { name: 'Optional device' })).toHaveValue('')
  await expect(page.getByText('No matching verified fixture')).toBeHidden()

  const requestsBeforeLaunch = requestUrls.length
  await page.getByRole('button', { name: 'Generate deterministic plan' }).click()
  await expect(page.getByRole('button', { name: 'Launch submitted replay' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Live work/u })).toBeDisabled()
  await page.getByRole('button', { name: 'Launch submitted replay' }).click()

  await expect(page.getByRole('heading', { name: 'Replay launch receipt' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Observatory' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.locator('.replay-launch-receipt').getByText(/^sha256:[0-9a-f]{64}$/u)).toBeVisible()
  await expect(page.getByText('30 / 30 verified')).toBeVisible()
  await expect(page.getByText('Fixture replay only · no live actions · no remote requests')).toBeVisible()
  expect(requestUrls).toHaveLength(requestsBeforeLaunch)
})

test('executes the eight real DuckDB-Wasm Parquet operations and inspects their plans', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#observatory')

  await expect(page.getByText('Analytics not yet executed')).toBeVisible()
  await page.getByRole('button', { name: 'Run verified analytics' }).click()
  await expect(page.getByText('Eight analytical operations completed')).toBeVisible({
    timeout: 60_000,
  })

  const workAvoided = page.getByRole('list', { name: 'Work avoided measurements' })
  await expect(workAvoided.locator(':scope > li')).toHaveCount(7)
  const requestsAvoided = page.getByRole('meter', { name: 'Requests avoided' })
  await expect(requestsAvoided).toHaveAttribute('aria-valuenow', '62984')
  await expect(requestsAvoided).toHaveAttribute('aria-valuemax', '76485')
  await expect(requestsAvoided).toHaveAttribute(
    'aria-valuetext',
    '62,984 request-equivalent query hits',
  )
  const requestsAvoidedCard = requestsAvoided.locator('xpath=ancestor::li[1]')
  await expect(requestsAvoidedCard).toContainText('62,984')
  await requestsAvoidedCard.getByText('Measurement basis').click()
  await expect(requestsAvoidedCard).toContainText(
    'discovery_metrics.api_requests_avoided_by_deduplication',
  )
  await expect(requestsAvoidedCard).toContainText(
    '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
  )
  await expect(workAvoided.getByText('Not instrumented', { exact: true })).toHaveCount(5)
  await expect(workAvoided.getByText('Downloads avoided')).toBeVisible()
  await expect(workAvoided.getByText('Inference avoided')).toBeVisible()
  await expect(workAvoided.getByText('Embeddings reused')).toBeVisible()
  await expect(workAvoided.getByText('Completed items anti-joined')).toBeVisible()
  await expect(
    workAvoided.getByText('Remote handoff reads avoided through local cache'),
  ).toBeVisible()

  const researchOperations = page.getByRole('list', { name: 'Research operation explanations' })
  await expect(researchOperations.locator(':scope > li')).toHaveCount(8)
  const physicalResearch = researchOperations
    .getByText('physical-query-deduplication', { exact: true })
    .locator('xpath=ancestor::li[1]')
  await expect(physicalResearch).toContainText('What occurred')
  await expect(physicalResearch).toContainText('Records entering')
  await expect(physicalResearch).toContainText('76,485 from flickr_query_hits')
  await expect(physicalResearch).toContainText('556 in physical_queries')
  await expect(physicalResearch).toContainText('User consequence')

  const researchTab = page.getByRole('tab', { name: 'Research mode' })
  await researchTab.focus()
  await researchTab.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Engineering mode' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  const operations = page.getByRole('list', { name: 'Completed analytical operations' })
  await expect(operations.locator(':scope > li')).toHaveCount(8)
  const operation = (operationId: string) =>
    operations.getByText(operationId, { exact: true }).locator('xpath=ancestor::li[1]')
  const physical = operation('physical-query-deduplication')
  await expect(physical).toContainText('556 rows out')
  const fanback = operation('logical-association-fan-back')
  await expect(fanback).toContainText('76,485 rows out')
  const sourceJoin = operation('source-id-hash-join')
  await expect(sourceJoin).toContainText('HASH_JOIN')
  await expect(sourceJoin).toContainText('Keys')
  await expect(sourceJoin).toContainText('source · flickr_photo_id')
  await expect(sourceJoin).toContainText('Nulls')
  await expect(sourceJoin).toContainText('Elapsed time')
  await expect(sourceJoin).toContainText('verified source artifact bytes')
  await expect(sourceJoin).toContainText('measured Parquet row groups')
  await expect(sourceJoin).toContainText('fresh DuckDB worker memory; no persistent cache')
  await expect(sourceJoin).toContainText(
    '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
  )
  await expect(sourceJoin).toContainText('75461d9c065af0cd96b41cd1f845c2e920f7ae34')
  const antiJoin = operation('duplicate-anti-join')
  await expect(antiJoin).toContainText('13,501 rows out')
  await expect(antiJoin).toContainText('ANTI')
  const candidates = operation('candidate-set-union')
  await expect(candidates).toContainText('6 rows out')
  const assembly = operation('evidence-assembly')
  await expect(assembly).toContainText('1 rows out')
  await expect(page.getByText('Not executed', { exact: true })).toBeVisible()
  await expect(page.getByText('Scientific claim: not allowed')).toBeVisible()

  await page.getByRole('button', { name: /Final replay record awaiting review/u }).click()
  await expect(
    page.getByText(/13 contributing stages and 12 contributing artifacts highlighted/u),
  ).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  const remoteRequests = requestUrls.filter((url) => {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
  })
  expect(remoteRequests).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

async function readReviewEvents(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('taxalens-verification', 1)
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB open failed'))
      request.onsuccess = () => resolve(request.result)
    })
    try {
      const transaction = database.transaction('events', 'readonly')
      const records = await new Promise<
        readonly {
          readonly event: {
            readonly eventId: string
            readonly outcome: string
            readonly reviewedAt: string
          }
        }[]
      >((resolve, reject) => {
        const request = transaction.objectStore('events').getAll()
        request.onerror = () =>
          reject(request.error ?? new Error('IndexedDB event read failed'))
        request.onsuccess = () => resolve(request.result)
      })
      return records
        .map(({ event }) => event)
        .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
    } finally {
      database.close()
    }
  })
}

test('traces discovery and geography without inventing occurrences or image rights', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(page.getByText('Discovery query not yet executed')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Licensed source image unavailable' })).toContainText(
    '0 included · 0 licensed',
  )
  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()

  await expect(page.getByRole('heading', { name: 'Source flickr:55081300254' })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText('181 associations', { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      'sha256:ddce85e192e3fe8548a75681f0dff6b6f0d00bb818eca891521faa0197274e40',
    ),
  ).toBeVisible()
  await expect(page.getByText('Creator', { exact: true }).locator('..')).toContainText(
    'Unavailable',
  )
  await expect(page.getByText('Licence', { exact: true }).locator('..')).toContainText(
    'Unavailable',
  )
  await expect(page.getByText('Attribution', { exact: true }).locator('..')).toContainText(
    'Unavailable',
  )
  await expect(page.getByText('Duplicate group', { exact: true }).locator('..')).toContainText(
    'duplicate relationship rows are unavailable',
  )

  const geography = page.locator('.geography-reference')
  await expect(geography.getByText('Candidate geography traced locally', { exact: true })).toBeVisible()
  await expect(
    geography.getByText('Candidate coordinate', { exact: true }).locator('..'),
  ).toContainText('59.366308, 18.031366')
  await expect(geography.getByText('Uncertainty', { exact: true }).locator('..')).toContainText(
    'Unavailable in metres',
  )
  await expect(geography.getByText('Cluster', { exact: true }).locator('..')).toContainText(
    'geo:be72642ae1a67685c5a68725',
  )
  await expect(geography.getByText('Cluster', { exact: true }).locator('..')).toContainText(
    '437 candidates · 7 cells · P95 radius 52.120 km',
  )
  await expect(geography.getByText('Fallback', { exact: true }).locator('..')).toContainText(
    'Not used for this record. 1 fallback cluster exists in the summary.',
  )
  await expect(geography.getByText('Target evidence', { exact: true }).locator('..')).toContainText(
    'Papilio demoleus',
  )
  await expect(
    geography.getByText('Competitor evidence', { exact: true }).locator('..'),
  ).toContainText('5 planning hypotheses')
  await expect(geography.getByRole('img', { name: /evidence image unavailable/u })).toHaveCount(2)
  await expect(
    geography.getByText('Source-candidate shortfall', { exact: true }).locator('..'),
  ).toContainText('247')
  await expect(
    geography.getByText('Human-verified shortfall', { exact: true }).locator('..'),
  ).toContainText('490')
  await expect(geography.getByText('Metadata licence', { exact: true }).locator('..')).toContainText(
    'MIT · Kris Kari',
  )
  await expect(
    geography.getByText('Image source and licence', { exact: true }).locator('..'),
  ).toContainText('0 included and 0 licensed images')

  await page.getByText('Inspect all 181 query associations', { exact: true }).click()
  const associations = page.getByRole('list', { name: 'Discovery query associations' })
  await expect(associations.locator(':scope > li')).toHaveCount(181)
  const firstAssociation = associations.locator(':scope > li').first()
  await expect(firstAssociation).toContainText('broad butterfly')
  await expect(firstAssociation).toContainText('Papilio demoleus Schmetterling')
  await expect(firstAssociation).toContainText('broad')
  await expect(firstAssociation).toContainText('text')

  const expectedOrigin = new URL(page.url()).origin
  const remoteRequests = requestUrls.filter((url) => {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
  })
  expect(remoteRequests).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('shows the complete unavailable YOLOE routing contract without a synthetic overlay', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(
    page.getByText('YOLOE routes evidence; it does not identify species.', { exact: true }),
  ).toBeVisible()
  const figure = page.getByRole('figure', {
    name: 'Original image, detection box, and segmentation mask',
  })
  await expect(figure).toContainText('Evidence unavailable')
  await expect(
    page.getByRole('img', {
      name: 'YOLOE image, detection box, and segmentation mask unavailable',
    }),
  ).toBeVisible()
  await expect(page.locator('.yoloe-routing img')).toHaveCount(0)

  const layers = page.getByRole('list', { name: 'YOLOE visual layers' })
  await expect(layers.locator(':scope > li')).toHaveCount(3)
  await expect(layers.getByText('Original full image', { exact: true })).toBeVisible()
  await expect(layers.getByText('Detection box', { exact: true })).toBeVisible()
  await expect(layers.getByText('Segmentation mask', { exact: true })).toBeVisible()

  const attributes = page.getByRole('group', { name: 'YOLOE routing attributes' })
  await expect(attributes.locator(':scope > div')).toHaveCount(6)
  for (const label of [
    'Route',
    'Visual domain',
    'Life stage',
    'Subject area',
    'Multiple organisms',
    'Route reason',
  ]) {
    await expect(attributes.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(attributes.getByText('Unavailable', { exact: true })).toHaveCount(6)

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('compares every full-frame input contract without inventing transformation identity', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  const modes = page.getByRole('tablist', { name: 'Full-frame visual-input mode' })
  await expect(modes.getByRole('tab')).toHaveCount(4)
  const focused = modes.getByRole('tab', { name: 'Focused full frame' })
  await expect(focused).toHaveAttribute('aria-selected', 'true')
  await focused.focus()
  await focused.press('ArrowRight')

  const masked = modes.getByRole('tab', { name: 'Masked full frame' })
  await expect(masked).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel', { name: 'Masked full frame' })
  await expect(panel.getByRole('img', { name: 'Raw full image unavailable' })).toBeVisible()
  await expect(panel.getByRole('img', { name: 'Masked attention view unavailable' })).toBeVisible()
  await expect(panel.getByText('Crossfade unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('.full-frame-comparison img')).toHaveCount(0)

  const identities = page.getByRole('group', { name: 'Full-frame identities' })
  await expect(identities.locator(':scope > div')).toHaveCount(4)
  for (const label of [
    'Full canvas retained',
    'Transformation version',
    'Transformation fingerprint',
    'Embedding identity',
  ]) {
    await expect(identities.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(identities.getByText('Unavailable', { exact: true })).toHaveCount(4)

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('shows candidate-plan reasons while withholding every absent score-derived rank', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(
    page.getByText('All eligible candidates scored; four strongest alternatives displayed.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByText('Unavailable assertion', { exact: true })).toBeVisible()
  await expect(page.getByText('Target', { exact: true }).locator('..')).toContainText(
    'Papilio demoleus',
  )
  await expect(page.getByText('Total candidate count', { exact: true }).locator('..')).toContainText(
    '6',
  )
  await expect(page.getByText('Target rank', { exact: true }).locator('..')).toContainText(
    'Unavailable',
  )

  const displayed = page.getByRole('list', { name: 'Displayed candidate alternatives' })
  await expect(displayed.locator(':scope > li')).toHaveCount(4)
  await expect(displayed.getByText('Papilio memnon', { exact: true })).toBeVisible()
  await expect(displayed.getByText('Papilio polytes', { exact: true })).toBeVisible()
  await expect(displayed.getByText('Score unavailable', { exact: true })).toHaveCount(4)
  await expect(displayed.getByText(/not score rank/u)).toHaveCount(4)

  const outcomes = page.getByLabel('Best candidate outcomes')
  await expect(outcomes.getByText('Best regional competitor', { exact: true })).toBeVisible()
  await expect(outcomes.getByText('Best non-regional competitor', { exact: true })).toBeVisible()
  await expect(outcomes.getByText('Best domain negative', { exact: true })).toBeVisible()
  await expect(outcomes.getByText(/Unavailable\./u)).toHaveCount(3)
  await expect(
    page.getByText('Eligible source media candidates', { exact: true }).locator('..'),
  ).toContainText('838')
  await expect(
    page.getByText('Human-verified source media', { exact: true }).locator('..'),
  ).toContainText('0')

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('separates raw evidence from an unavailable calibrated decision', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(page.getByRole('heading', { name: 'Explain selective decision' })).toBeVisible()
  await expect(page.getByText('Raw similarity — not a probability')).toBeVisible()
  await expect(page.getByText('Calibrated output unavailable')).toBeVisible()
  await expect(
    page.getByText('Awaiting human review is not model abstention', { exact: true }),
  ).toBeVisible()

  const raw = page.getByRole('list', { name: 'Raw evidence fields' })
  const decision = page.getByRole('list', { name: 'Decision evidence fields' })
  await expect(raw.locator(':scope > li')).toHaveCount(7)
  await expect(decision.locator(':scope > li')).toHaveCount(7)
  await expect(raw.getByText('Text similarity', { exact: true })).toBeVisible()
  await expect(raw.getByText('Prototype similarity', { exact: true })).toBeVisible()
  await expect(raw.getByText('Nearest support', { exact: true })).toBeVisible()
  await expect(raw.getByText('Top-k support', { exact: true })).toBeVisible()
  await expect(raw.getByText('Visual-input fusion', { exact: true })).toBeVisible()
  await expect(raw.getByText('Geography', { exact: true })).toBeVisible()
  await expect(raw.getByText('Quality', { exact: true })).toBeVisible()
  await expect(decision.getByText('Calibrated target probability', { exact: true })).toBeVisible()
  await expect(
    decision.getByText('Calibrated non-target probability', { exact: true }),
  ).toBeVisible()
  await expect(decision.getByText('Margin threshold', { exact: true })).toBeVisible()
  await expect(decision.getByText('Abstention', { exact: true })).toBeVisible()
  await expect(decision.getByText('Policy fingerprint', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('img', {
      name: 'Raw score artifact unavailable, calibration not run, selective decision unavailable',
    }),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('shows a truthful lifecycle ledger without fabricated event times or comments', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(page.getByRole('heading', { name: 'Evidence ledger' })).toBeVisible()
  await expect(page.getByText('comment enrichment unavailable for this record', { exact: true })).toBeVisible()
  const ledger = page.getByRole('list', { name: 'Evidence lifecycle ledger' })
  await expect(ledger.locator(':scope > li')).toHaveCount(10)
  for (const label of [
    'Discovery',
    'Deduplication',
    'Geography',
    'Reference status',
    'Route',
    'Visual inputs',
    'Candidates',
    'Decision',
    'Review state',
    'Export',
  ]) {
    await expect(ledger.getByRole('heading', { name: label, exact: true })).toBeVisible()
  }
  await expect(
    ledger.getByText('Unavailable — no per-event timestamp committed', { exact: true }),
  ).toHaveCount(9)
  await expect(ledger.getByRole('time')).toHaveCount(1)
  await expect(
    ledger.getByRole('heading', { name: 'Export' }).locator('xpath=ancestor::article[1]'),
  ).toContainText('30 / 30 checksum-verified artifacts')

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('downloads a deterministic six-file evidence audit boundary without remote requests', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#evidence-lens')

  await expect(page.getByRole('heading', { name: 'Export evidence' })).toBeVisible()
  await expect(page.getByText('Unsigned manifest', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Prepare local audit bundle' }).click()

  await expect(page.getByText('Six audit files prepared locally', { exact: true })).toBeVisible()
  const files = page.getByRole('list', { name: 'Prepared evidence export files' })
  await expect(files.locator(':scope > li')).toHaveCount(6)
  for (const label of [
    'Download JSON evidence',
    'Download CSV summary',
    'Download Source Parquet',
    'Download Prototype receipt',
    'Download Checksum manifest',
    'Download Provenance report',
  ]) {
    await expect(files.getByRole('button', { name: label })).toBeVisible()
  }
  await expect(files).toContainText(
    '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
  )
  await expect(
    page.getByText(/verified BioMiner Flickr query-hit source, not a serialization/u),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await files.getByRole('button', { name: 'Download JSON evidence' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    'taxalens-papilio-demoleus-awaiting-human-review.evidence.json',
  )
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const evidence = JSON.parse(await readFile(downloadedPath!, 'utf8')) as {
    scientificClaimAllowed: boolean
    ledger: { events: readonly unknown[] }
  }
  expect(evidence.scientificClaimAllowed).toBe(false)
  expect(evidence.ledger.events).toHaveLength(10)

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('shows an evidence funnel without comparing unlike stage units', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  await expect(page.getByRole('heading', { name: 'Evidence funnel' })).toBeVisible()
  await expect(page.getByText('Workflow counts, not confirmed occurrences')).toBeVisible()
  const funnel = page.getByRole('list', { name: 'Evidence funnel stages' })
  await expect(funnel.locator(':scope > li')).toHaveCount(7)
  for (const label of [
    'Query hits',
    'Canonical photos',
    'Unique content',
    'Route counts',
    'Candidate states',
    'Decision states',
    'Review queue state',
  ]) {
    await expect(funnel.getByRole('heading', { name: label, exact: true })).toBeVisible()
  }

  const stage = (label: string) =>
    funnel.getByRole('heading', { name: label, exact: true }).locator('xpath=ancestor::article[1]')
  await expect(stage('Query hits')).toContainText('76,485')
  await expect(stage('Query hits')).toContainText('query associations')
  await expect(stage('Canonical photos')).toContainText('13,501')
  await expect(stage('Unique content')).toContainText('Unavailable')
  await expect(stage('Unique content')).toContainText('duplicate relationship rows are not committed')
  await expect(stage('Route counts')).toContainText('Verified zero')
  await expect(stage('Candidate states')).toContainText('6')
  await expect(stage('Candidate states')).toContainText('One target plus 5 regional competitor hypotheses')
  await expect(stage('Decision states')).toContainText('Verified zero')
  await expect(stage('Review queue state')).toContainText('no materialized or ranked review-queue artifact')
  await expect(page.locator('.evidence-funnel')).not.toContainText('%')

  await stage('Query hits').getByText('Inspect provenance for Query hits').click()
  await expect(stage('Query hits').getByText('stage-metrics', { exact: true })).toBeVisible()
  await expect(stage('Query hits')).toContainText(
    '04f083e24f9aa994aa549d4312dc4a1c4acf59c65d6244fd772fff9b92e0dd2d',
  )
  await page.getByText('Read complete textual alternative').click()
  await expect(page.getByText(/These counts have unlike units/u)).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('maps verified candidate workload without claiming occurrences or review density', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  await expect(page.getByRole('heading', { name: 'Geographic workload map' })).toBeVisible()
  await expect(page.getByText('Candidate distribution only', { exact: true })).toBeVisible()
  await expect(page.getByText('Cluster payload not yet queried', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Load verified workload map' }).click()

  await expect(page.getByText('Candidate workload plotted locally', { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  const metrics = page.locator('.geographic-workload__metrics')
  await expect(metrics.getByText('Candidate clusters').locator('..')).toContainText('76')
  await expect(metrics.getByText('No-geo').locator('..')).toContainText('0')
  await expect(metrics.getByText('Unassigned geotags').locator('..')).toContainText('792')
  await expect(metrics.getByText('Outliers').locator('..')).toContainText('707')
  await expect(metrics.getByText('Reference shortfalls').locator('..')).toContainText(
    '247 source · 490 review',
  )
  await expect(metrics.getByText('Review density').locator('..')).toContainText('Unavailable')

  const map = page.getByRole('img', {
    name: '76 candidate workload cluster centroids on an equirectangular coordinate plane',
  })
  await expect(map).toBeVisible()
  await expect(map.locator('circle[data-cluster="candidate-workload"]')).toHaveCount(76)
  await expect(map.locator('circle[data-selected="true"]')).toHaveCount(1)
  const selector = page.getByLabel('Inspect candidate cluster')
  await expect(selector.locator('option')).toHaveCount(76)
  await selector.selectOption('geo:be72642ae1a67685c5a68725')
  const inspection = page.getByRole('heading', { name: 'Selected workload cluster' }).locator('..')
  await expect(inspection).toContainText('geo:be72642ae1a67685c5a68725')
  await expect(inspection).toContainText('59.369775, 17.159598')
  await expect(inspection).toContainText('437 records')
  await expect(inspection).toContainText('52.120 km · not uncertainty')
  await expect(inspection).toContainText('Unavailable — no H3 output committed')
  await expect(inspection).toContainText('No materialized review queue')

  await page.getByText('Read all 76 candidate clusters as a table').click()
  await expect(
    page.locator('.geographic-workload').getByRole('table').locator('tbody tr'),
  ).toHaveCount(76)
  await page.getByText('Inspect workload-map provenance').click()
  const provenance = page.locator('.geographic-workload__provenance')
  await expect(
    provenance.getByText('biominer-flickr-geo-assignments-parquet', { exact: true }),
  ).toBeVisible()
  await expect(
    provenance.getByText('biominer-flickr-geo-clusters-parquet', { exact: true }),
  ).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('prioritizes the committed review work without fabricating a score or comparative rank', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  const worklist = page.locator('.review-priority')
  await expect(worklist.getByRole('heading', { name: 'Review work priority' })).toBeVisible()
  await expect(worklist.getByText('One committed work item · priority unavailable')).toBeVisible()
  await expect(worklist.getByText('Position 1 of 1', { exact: true })).toBeVisible()
  await expect(worklist.getByText('papilio-demoleus-pilot-awaiting-review')).toBeVisible()
  await expect(worklist.getByText('Priority score').locator('..')).toContainText(
    'Unavailable — no materialized review queue',
  )
  await expect(worklist.getByText('Blocked gates').locator('..')).toContainText('5 of 5')
  await expect(worklist.getByText('Position basis').locator('..')).toContainText(
    'not score-derived',
  )

  const factors = worklist.getByRole('list', { name: 'Priority factor audit' })
  const factor = (name: string) =>
    factors.getByRole('heading', { name }).locator('xpath=ancestor::article[1]')
  await expect(factors.locator(':scope > li')).toHaveCount(7)
  await expect(factor('Competitor margin')).toContainText('Unavailable')
  await expect(factor('Missing calibration')).toContainText('Evidence blocker')
  await expect(factor('Reference shortfall')).toContainText('247 source · 490 human-review')
  await expect(factor('Comment conflict')).toContainText('0 committed comments')
  await expect(factors.getByText('Priority effect: not scored')).toHaveCount(7)

  await worklist.getByText('Read the complete priority audit as a table').click()
  await expect(worklist.getByRole('table').locator('tbody tr')).toHaveCount(7)
  await worklist.getByText('Inspect review-work provenance').click()
  await expect(
    worklist.getByText('selective-decision-metadata', { exact: true }),
  ).toBeVisible()
  await expect(worklist.getByText('reference-shortfalls', { exact: true })).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('measures discovery yield without inventing request counts or marginal API cost', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  const analysis = page.locator('.query-yield')
  const metrics = analysis.locator('.query-yield__summary')
  await expect(analysis.getByRole('heading', { name: 'Query yield by taxonomic tier' })).toBeVisible()
  await expect(analysis.getByText('Partial rank attribution · no occurrence claim')).toBeVisible()
  await expect(metrics.getByText('Query hits').locator('..')).toContainText('76,485')
  await expect(metrics.getByText('Unique source photos').locator('..')).toContainText('13,501')
  await expect(metrics.getByText('Physical requests').locator('..')).toContainText('Unavailable')
  await expect(metrics.getByText('Marginal API cost').locator('..')).toContainText('Unavailable')
  await expect(analysis.getByText('Rank slices not yet queried')).toBeVisible()

  await analysis.getByRole('button', { name: 'Measure verified discovery yield' }).click()
  await expect(analysis.getByText('Measured rank slices ready')).toBeVisible({ timeout: 60_000 })
  const table = analysis.getByRole('table')
  await expect(table.locator('tbody tr')).toHaveCount(7)
  await expect(table.locator('tr[data-rank-status="unavailable"]')).toHaveCount(4)
  await expect(table.locator('tr[data-rank="family"]')).toContainText('16,636')
  await expect(table.locator('tr[data-rank="family"]')).toContainText('5,658')
  await expect(table.locator('tr[data-rank="family"]')).toContainText('2 represented terms · 68 represented hashes')
  await expect(table.locator('tr[data-rank="genus"]')).toContainText('41,243')
  await expect(table.locator('tr[data-rank="genus"]')).toContainText('6,773')
  await expect(table.locator('tr[data-rank="species"]')).toContainText('3,458')
  await expect(table.locator('tr[data-rank="species"]')).toContainText('1,063')
  await expect(table.locator('tr[data-rank="kingdom"]')).toContainText('No direct BioMiner tier')
  await expect(table.locator('tr[data-rank="family"]')).toContainText('0 globally')

  const context = analysis
    .getByRole('heading', { name: 'Unassigned context tiers' })
    .locator('..')
    .locator('..')
  await expect(context).toContainText('15,148')
  await expect(context).toContainText('3,681')
  await expect(context).toContainText('145')
  await expect(context).toContainText('304')
  await expect(context).toContainText('7')
  await analysis.getByText('Read the complete rank-yield interpretation').click()
  await expect(analysis.locator('.query-yield__alternative li')).toHaveCount(7)
  await analysis.getByText('Inspect query-yield provenance').click()
  await expect(
    analysis.getByText('biominer-flickr-query-hits-parquet', { exact: true }),
  ).toBeVisible()
  await expect(analysis).toContainText(
    '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
  )

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('reports only measured workflow efficiency without inferring avoided work', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  const report = page.locator('.workflow-efficiency')
  await expect(report.getByRole('heading', { name: 'Workflow efficiency' })).toBeVisible()
  await expect(
    report.getByText('One measured state ledger · five savings claims withheld'),
  ).toBeVisible()
  await expect(report.getByText('1of 6 measured')).toBeVisible()
  const metrics = report.getByRole('list', { name: 'Workflow efficiency measurements' })
  const metric = (name: string) =>
    metrics.getByRole('heading', { name }).locator('xpath=ancestor::article[1]')
  await expect(metrics.locator(':scope > li')).toHaveCount(6)
  await expect(metrics.locator('li[data-efficiency-status="unavailable"]')).toHaveCount(5)
  await expect(metric('API calls avoided')).toContainText('Unavailable')
  await expect(metric('API calls avoided')).toContainText('Observed requests314')
  await expect(metric('API calls avoided')).toContainText('Retries0')
  await expect(metric('Duplicate downloads avoided')).toContainText(
    'Media-candidate rows deduplicated5',
  )
  await expect(metric('Duplicate downloads avoided')).toContainText('Images downloaded0')
  await expect(metric('Repeated inference avoided')).toContainText('YOLOE images processed0')
  await expect(metric('Embedding reuse')).toContainText('No embedding artifact')
  await expect(metric('Restart efficiency')).toContainText('Complete checkpoints22 of 22')
  await expect(metric('Restart efficiency')).toContainText('Checkpoint pages314')
  await expect(metric('Evidence completeness')).toContainText('30 of 30 artifacts verified')
  await expect(metric('Evidence completeness')).toContainText('Available sections8')
  await expect(metric('Evidence completeness')).toContainText('Partial sections9')
  await expect(metric('Evidence completeness')).toContainText('Unavailable sections8')

  const guardrail = report.getByRole('heading', { name: 'Integrity is not scientific completeness' })
    .locator('..')
    .locator('..')
  await expect(guardrail).toContainText('8 are available, 9 partial, and 8 unavailable')
  await expect(guardrail).toContainText('No accuracy, readiness, or performance percentage')
  await report.getByText('Read the complete efficiency ledger as a table').click()
  await expect(report.getByRole('table').locator('tbody tr')).toHaveCount(6)
  await report.getByText('Inspect workflow-efficiency provenance').click()
  await expect(report.getByText('reference-readiness', { exact: true })).toBeVisible()
  await expect(report.getByText('duplicate-summaries', { exact: true })).toBeVisible()
  await expect(report.getByText('run-summary', { exact: true })).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('shows the reviewed evaluation state without fabricating precision or accuracy', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  const evaluation = page.locator('.reviewed-evaluation')
  await expect(
    evaluation.getByRole('heading', { name: 'Current reviewed evaluation state' }),
  ).toBeVisible()
  await expect(
    evaluation.getByText('Evaluation unavailable · reference review blocked'),
  ).toBeVisible()
  await expect(evaluation.getByText('0committed reviewed metrics')).toBeVisible()

  const phase13 = evaluation
    .getByRole('heading', { name: 'Reviewed result boundary' })
    .locator('xpath=ancestor::article[1]')
  await expect(phase13).toContainText('No Phase 13 result artifact is supplied to this fixture.')
  await expect(phase13).toContainText('Result artifacts0')
  await expect(phase13).toContainText('Valid metrics0')

  const phase14 = evaluation
    .getByRole('heading', { name: 'Reference-review gate' })
    .locator('xpath=ancestor::article[1]')
  await expect(phase14).toContainText('Blocked before evaluation')
  await expect(phase14).toContainText('Human-verified media0')
  await expect(phase14).toContainText('Review shortfall490')
  await expect(phase14).toContainText('Groups awaiting review1')
  await expect(phase14).toContainText('Unresolved groups2')

  const table = evaluation.getByRole('table', {
    name: 'Reviewed metric availability and the denominator required for each claim',
  })
  await expect(table.locator('tbody tr')).toHaveCount(7)
  await expect(table.locator('tr[data-metric-state="unavailable"]')).toHaveCount(7)
  await expect(table.getByText('Unavailable', { exact: true })).toHaveCount(7)
  await expect(table.getByText('Precision').locator('..')).toContainText('TP / (TP + FP)')
  await expect(table.getByText('Accuracy').locator('..')).toContainText('(TP + TN) / N')

  const guardrail = evaluation
    .getByRole('heading', { name: 'No fake precision or accuracy' })
    .locator('..')
    .locator('..')
  await expect(guardrail).toContainText(
    'No precision, recall, PR-AUC, accuracy, calibration, or coverage value is calculated.',
  )
  await evaluation.getByText('Inspect evaluation-state provenance').click()
  const provenance = evaluation.locator('.reviewed-evaluation__provenance')
  await expect(provenance.getByText('evaluation_summaries', { exact: true })).toBeVisible()
  await expect(provenance.getByText('reference-readiness', { exact: true })).toBeVisible()
  await expect(provenance.getByText('reference-shortfalls', { exact: true })).toBeVisible()
  await expect(
    provenance.getByText('selective-decision-metadata', { exact: true }),
  ).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})

test('exports six deterministic research outputs without promoting blocked evidence', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./#dashboard')

  const panel = page.locator('.research-outputs')
  await expect(panel.getByRole('heading', { name: 'Export research outputs' })).toBeVisible()
  await expect(
    panel.getByText('Deterministic local export · unsigned manifest', { exact: true }),
  ).toBeVisible()
  const files = panel.getByRole('list', { name: 'Research output files' })
  await expect(files.locator(':scope > li')).toHaveCount(6)
  await expect(files.locator('li[data-output-state="planned"]')).toHaveCount(6)
  for (const label of [
    'Review queue',
    'Evidence summary',
    'Prototype boundary',
    'Manifest',
    'Provenance',
    'Evaluation report',
  ]) {
    await expect(files.getByRole('heading', { name: label })).toBeVisible()
  }
  await expect(
    panel.getByRole('heading', { name: 'Portable does not mean promoted' }).locator('..').locator('..'),
  ).toContainText('unranked worklist snapshot')

  await panel.getByRole('button', { name: 'Prepare six research outputs' }).click()
  await expect(panel.getByText('Six research outputs prepared locally', { exact: true })).toBeVisible()
  await expect(files.locator('li[data-output-state="ready"]')).toHaveCount(6)
  for (const label of [
    'Review queue',
    'Evidence summary',
    'Prototype boundary',
    'Manifest',
    'Provenance',
    'Evaluation report',
  ]) {
    await expect(files.getByRole('button', { name: `Download ${label}` })).toBeVisible()
  }
  await expect(files.locator('.research-outputs__receipt > small')).toHaveCount(6)

  const downloadPromise = page.waitForEvent('download')
  await files.getByRole('button', { name: 'Download Evaluation report' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    'taxalens-papilio-demoleus-awaiting-human-review.evaluation-report.json',
  )
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const report = JSON.parse(await readFile(downloadedPath!, 'utf8')) as {
    committedReviewedMetricCount: number
    phase14: { status: string; humanVerifiedShortfall: number }
    metrics: readonly { status: string; value: string }[]
    scientificClaimAllowed: boolean
  }
  expect(report.committedReviewedMetricCount).toBe(0)
  expect(report.phase14).toEqual(expect.objectContaining({
    status: 'blocked',
    humanVerifiedShortfall: 490,
  }))
  expect(report.metrics).toHaveLength(7)
  expect(report.metrics.every(({ status, value }) => status === 'unavailable' && value === 'Unavailable')).toBe(true)
  expect(report.scientificClaimAllowed).toBe(false)

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
})
