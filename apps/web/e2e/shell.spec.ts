import { expect, test } from '@playwright/test'

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

  const tourTrigger = page.getByRole('button', { name: 'Guided tour' })
  await tourTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Mission' })).toBeVisible()
  await expect(page.getByText('Guided tour · Step 1 of 4')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(tourTrigger).toBeFocused()

  const evidenceLens = page.getByRole('link', { name: 'Evidence Lens' })
  await evidenceLens.focus()
  await page.keyboard.press('Enter')
  await expect(evidenceLens).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()

  const reset = page.getByRole('button', { name: 'Reset replay' })
  await reset.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Mission' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
})

test('shows only checksum-verified evidence with explicit analytics and unavailable states', async ({
  page,
}) => {
  await page.goto('./#observatory')

  await expect(page.getByText('22 / 22 verified')).toBeVisible()
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
  await expect(page.locator('.unavailable-evidence-list > li')).toHaveCount(6)

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
  await expect(page.getByText('22 / 22 verified')).toBeVisible()
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

test('traces every discovery association without inventing source rights or duplicates', async ({
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
