import { expect, test } from '@playwright/test'

test('synchronizes exact table selection with map details', async ({ page }) => {
  await page.goto('./#dashboard')
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true }))
    .toBeVisible({ timeout: 30_000 })

  const table = page.getByRole('table', {
    name: /exact preaggregated cells in the selected scope/u,
  })
  const firstRow = table.locator('tbody tr').first()
  const spatialCellId = (await firstRow.getByRole('rowheader').textContent())?.trim()
  if (spatialCellId === undefined || spatialCellId === '') {
    throw new Error('Geographic Impact table did not expose a spatial cell identity')
  }

  await firstRow.getByRole('button', { name: `Select ${spatialCellId}` }).click()
  await expect(firstRow.getByRole('button', { name: `Selected ${spatialCellId}` }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: spatialCellId,
    }),
  ).toBeVisible()
  await expect(page.locator('.taxalens-impact-popup')).toBeVisible()
})

test('keeps the evidence table available without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => null,
    })
  })
  await page.goto('./#dashboard')

  await expect(page.getByText('World map rendering unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true }))
    .toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole('table', { name: /exact preaggregated cells in the selected scope/u }),
  ).toBeVisible()
})
