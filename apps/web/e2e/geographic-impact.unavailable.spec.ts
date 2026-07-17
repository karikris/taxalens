import { expect, test } from '@playwright/test'

test('shows zero baseline and review evidence without fabricating provider availability', async ({
  page,
}) => {
  await page.goto(
    './#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=lens',
  )
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })

  const details = page.locator('.selected-geography-details')
  await expect(details.getByRole('heading', { name: '87088660cffffff' })).toBeVisible()
  await expect(details.getByText('Baseline union').locator('..')).toContainText('0')
  await expect(details.getByText('Direct iNaturalist delta').locator('..')).toContainText(
    'Unavailable',
  )
  await expect(
    details.getByText('Human-reviewed target positive').locator('..'),
  ).toContainText('0')
  await expect(
    details.getByText('Release-ready occurrence candidates').locator('..'),
  ).toContainText('0')
  await expect(details).toContainText(
    'Missing baseline evidence is unknown, not proof of biological absence.',
  )
  await expect(
    page.getByText(/This is a candidate-only spatial cell, not a biological absence claim/u),
  ).toBeVisible()
})

test('stops geographic evidence when the committed Parquet bytes are corrupted', async ({
  page,
}) => {
  await page.route('**/geographic_impact_cells*.parquet', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.apache.parquet',
      body: 'corrupt geographic artifact',
    })
  })
  await page.goto('./#dashboard')

  const stopped = page.getByText('Geographic evidence map stopped', { exact: true })
  await expect(stopped).toBeVisible({ timeout: 60_000 })
  await expect(stopped.locator('..')).toContainText(
    'Geographic Impact map artifact byte count differs from its manifest',
  )
  await expect(
    page.getByRole('table', { name: /exact preaggregated cells in the selected scope/u }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prepare geographic export' })).toHaveCount(0)
})

test('shows an explicit unavailable state when the local analytical worker cannot start', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('./#dashboard')

  const unavailable = page.getByText('Geographic evidence map unavailable', { exact: true })
  await expect(unavailable).toBeVisible()
  await expect(unavailable.locator('..')).toContainText(
    'cannot start the local map-data worker',
  )
  await expect(
    page.getByRole('table', { name: /exact preaggregated cells in the selected scope/u }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prepare geographic export' })).toHaveCount(0)
})
