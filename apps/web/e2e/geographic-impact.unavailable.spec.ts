import { expect, test } from '@playwright/test'

test('shows global review evidence without fabricating provider availability', async ({
  page,
}) => {
  await page.goto('./#dashboard')
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })

  const details = page.locator('.selected-geography-details')
  await expect(details.getByRole('heading', { name: 'Global' })).toBeVisible()
  await expect(details.getByText('Baseline union').locator('..')).toContainText('19,201')
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
  const summary = page.getByRole('region', { name: 'Geographic evidence at a glance' })
  await expect(summary).toContainText(
    'No spatial cell is selected. Use the map or exact evidence table to inspect one cell.',
  )
  await expect(summary).toBeVisible()
})

test('stops the verified replay when committed Geographic Impact bytes are corrupted', async ({
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

  const stopped = page.getByRole('alert', {
    name: 'The static evidence bundle could not be opened',
  })
  await expect(stopped).toBeVisible()
  await expect(stopped).toContainText(
    'geographic-geographic-impact-cells byte count is 27; expected 639681',
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
    'cannot start the local analytical worker',
  )
  await expect(
    page.getByRole('table', { name: /exact preaggregated cells in the selected scope/u }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prepare geographic export' })).toHaveCount(0)
})
