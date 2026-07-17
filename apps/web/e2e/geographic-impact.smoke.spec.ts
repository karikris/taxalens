import { expect, test } from '@playwright/test'

test('loads Geographic Impact evidence and its accessible alternative in every browser', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await page.goto('./#dashboard')
  await expect(
    page.getByRole('heading', { name: 'TaxaLens Geographic Impact Lens' }),
  ).toBeVisible()
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })

  const table = page.getByRole('table', {
    name: /exact preaggregated cells in the selected scope/u,
  })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: /Baseline occurrence evidence/u }))
    .toBeVisible()
  await expect(table.getByRole('columnheader', { name: /Flickr candidates/u })).toBeVisible()
  await expect(table.locator('tbody tr').first()).toBeVisible()

  const mapCanvas = page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
  const fallback = page.getByText('World map rendering unavailable', { exact: true })
  await expect
    .poll(
      async () => {
        if (await mapCanvas.isVisible().catch(() => false)) return 'map'
        if (await fallback.isVisible().catch(() => false)) return 'fallback'
        return 'pending'
      },
      { timeout: 60_000 },
    )
    .not.toBe('pending')

  if (await mapCanvas.isVisible().catch(() => false)) {
    await expect(page.locator('.taxalens-world-map canvas.maplibregl-canvas')).toHaveCount(1)
  } else {
    await expect(fallback).toBeVisible()
    await expect(table).toBeVisible()
  }

  await page.getByRole('combobox', { name: 'Continent' }).selectOption('continent:asia')
  await expect(page).toHaveURL(/geo=continent%3Aasia/u)
  await expect(page.getByText('Geographic scope').locator('..')).toContainText('Asia')
  await expect(table.locator('tbody tr').first()).toBeVisible()
})
