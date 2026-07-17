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

  const selectButton = firstRow.getByRole('button', { name: `Select ${spatialCellId}` })
  await selectButton.focus()
  await page.keyboard.press('Enter')
  await expect(firstRow.getByRole('button', { name: `Selected ${spatialCellId}` }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: spatialCellId,
    }),
  ).toBeVisible()
  await expect(page.locator('.taxalens-impact-popup')).toBeVisible()
  await expect(
    page.locator('.geographic-impact-accessible-summary [role="status"]'),
  ).toContainText(`Selected cell ${spatialCellId}`)
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

test('prepares the checksum-bound geographic export locally', async ({ page }) => {
  await page.goto('./#dashboard')
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true }))
    .toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Prepare geographic export' }).click()
  await expect(page.getByText('Seven geographic export files prepared', { exact: true }))
    .toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole('list', { name: 'Prepared Geographic Impact export files' }).getByRole('listitem'),
  ).toHaveCount(7)
  await expect(page.getByText(/No signer is invented/u)).toBeVisible()
  await expect(page.getByText(/full target at all supported resolutions/u)).toBeVisible()
})
