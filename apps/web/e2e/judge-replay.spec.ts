import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

test('completes the deterministic judge replay from tour to parsed export', async ({
  baseURL,
  page,
}) => {
  test.setTimeout(60_000)
  if (baseURL === undefined) {
    throw new Error('The judge replay test requires the configured static base URL')
  }
  const expectedOrigin = new URL(baseURL).origin
  const blockedRequests: string[] = []
  const observedRequests: string[] = []
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    observedRequests.push(url)
    const parsed = new URL(url)
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin !== expectedOrigin
    ) {
      blockedRequests.push(url)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'TaxaLens Judge Replay' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()

  await page.getByRole('button', { name: 'Start 90-second judge tour' }).click()
  await expect(page.getByRole('dialog', { name: 'Research Mission' })).toBeVisible()
  await page.getByRole('button', { name: 'Next: Observatory' }).click()
  await page.getByRole('button', { name: 'Visit Observatory' }).click()

  await expect(page.getByText('25 / 25 verified')).toBeVisible()
  const pipeline = page.getByRole('list', { name: 'Evidence pipeline stages' })
  await expect(pipeline.locator(':scope > li')).toHaveCount(13)
  await expect(pipeline.getByRole('heading', { name: 'Final Evidence' })).toBeVisible()
  const lineageRecord = page.getByRole('button', {
    name: /Final replay record awaiting review/u,
  })
  await lineageRecord.click()
  await expect(lineageRecord).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText(/13 contributing stages and 12 contributing artifacts highlighted/u),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Resume 90-second judge tour' }).click()
  await page.getByRole('button', { name: 'Next: Evidence Lens' }).click()
  await page.getByRole('button', { name: 'Visit Evidence Lens' }).click()
  await expect(page.getByRole('heading', { name: 'No scientific result is promoted' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Aggregate prototype evidence' }),
  ).toBeVisible()
  await expect(page.getByText('B0 10% → B13 100%')).toBeVisible()
  await expect(page.getByText('0.02 staged diagnostic · 0.10 selected policy')).toBeVisible()

  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  await expect(page.getByRole('heading', { name: 'Source flickr:55081300254' })).toBeVisible({
    timeout: 60_000,
  })
  const modes = page.getByRole('tablist', { name: 'Full-frame visual-input mode' })
  await modes.getByRole('tab', { name: 'Masked full frame' }).click()
  await expect(modes.getByRole('tab', { name: 'Masked full frame' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('tabpanel', { name: 'Masked full frame' })).toContainText(
    'Crossfade unavailable',
  )

  const competitors = page.getByRole('list', { name: 'Displayed candidate alternatives' })
  await expect(competitors.getByText('Papilio memnon', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Best candidate outcomes')).toContainText(
    'Best regional competitor',
  )
  const geography = page.locator('.geography-reference')
  await expect(geography.getByText('Uncertainty', { exact: true }).locator('..')).toContainText(
    'Unavailable in metres',
  )
  await expect(page.getByText('Calibrated output unavailable')).toBeVisible()

  await page.getByRole('button', { name: 'Resume 90-second judge tour' }).click()
  await page.getByRole('button', { name: 'Next: Dashboard' }).click()
  await page.getByRole('button', { name: 'Visit Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Verified local data boundary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Evidence funnel' })).toBeVisible()

  await page.getByRole('button', { name: 'Resume 90-second judge tour' }).click()
  await page.getByRole('button', { name: 'Next: Export' }).click()
  await page.getByRole('button', { name: 'Visit Export' }).click()
  const exportPanel = page.locator('#research-outputs')
  await expect(exportPanel).toBeFocused()
  await expect(exportPanel.getByRole('heading', { name: 'Export research outputs' })).toBeVisible()
  await exportPanel.getByRole('button', { name: 'Prepare six research outputs' }).click()
  await expect(
    exportPanel.getByText('Six research outputs prepared locally', { exact: true }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await exportPanel.getByRole('button', { name: 'Download Evaluation report' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    'taxalens-papilio-demoleus-awaiting-human-review.evaluation-report.json',
  )
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const report = JSON.parse(await readFile(downloadedPath!, 'utf8')) as {
    readonly committedReviewedMetricCount: number
    readonly phase14: { readonly status: string; readonly humanVerifiedShortfall: number }
    readonly metrics: readonly { readonly status: string; readonly value: string }[]
    readonly scientificClaimAllowed: boolean
  }
  expect(report.committedReviewedMetricCount).toBe(0)
  expect(report.phase14).toEqual(
    expect.objectContaining({ status: 'blocked', humanVerifiedShortfall: 490 }),
  )
  expect(report.metrics).toHaveLength(7)
  expect(
    report.metrics.every(
      ({ status, value }) => status === 'unavailable' && value === 'Unavailable',
    ),
  ).toBe(true)
  expect(report.scientificClaimAllowed).toBe(false)
  await expect(
    page.getByRole('button', { name: 'Replay 90-second judge tour' }),
  ).toBeVisible()

  expect(observedRequests.length).toBeGreaterThan(2)
  expect(blockedRequests).toEqual([])
})
