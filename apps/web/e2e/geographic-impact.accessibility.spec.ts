import { expect, test } from '@playwright/test'

const EVIDENCE_ENCODINGS = [
  ['Baseline occurrence evidence', 'Blue filled bubble'],
  ['Unreviewed Flickr candidate', 'Hollow amber ring'],
  ['Human-reviewed target positive', 'Solid amber fill'],
  ['Human-reviewed non-target', 'Amber ring with exclusion cross'],
  ['Uncertain Flickr candidate', 'Dashed amber ring'],
  ['Release-ready occurrence candidate', 'Solid amber fill with dark external stroke'],
] as const

test('keeps Geographic Impact meaning available without color or pointer input', async ({ page }) => {
  await page.goto('./#dashboard')
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })

  const map = page.getByRole('region', { name: 'TaxaLens Geographic Impact world map' })
  await expect(map).toBeVisible()

  const legend = page.locator('.geographic-impact-legend')
  const stateRows = legend.locator('.geographic-impact-legend__states li')
  await expect(stateRows).toHaveCount(EVIDENCE_ENCODINGS.length)
  for (const [index, [label, encoding]] of EVIDENCE_ENCODINGS.entries()) {
    const row = stateRows.nth(index)
    await expect(row.getByText(label, { exact: true })).toBeVisible()
    await expect(row.locator('small')).toContainText(encoding)
    await expect(row.locator('.geographic-impact-legend__swatch')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  }
  await expect(legend).toContainText(
    'Bubble radius uses a square-root count scale; exact counts appear in the tooltip.',
  )
  await expect(legend).toContainText(
    'Skip and Can’t view total 0 and do not count as human-supported contribution.',
  )

  const summary = page.locator('.geographic-impact-accessible-summary')
  await expect(summary).toContainText('Blue filled bubbles mean baseline occurrence evidence.')
  await expect(summary).toContainText(
    'Amber color is always paired with a ring, fill, excluded mark, dash or dark external stroke.',
  )

  const table = page.getByRole('table', {
    name: /exact preaggregated cells in the selected scope/u,
  })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Baseline eligible' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Flickr candidates' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Reviewed non-target' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Uncertain' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Release-ready' })).toBeVisible()

  const firstRow = table.locator('tbody tr').first()
  const spatialCellId = (await firstRow.getByRole('rowheader').textContent())?.trim()
  if (spatialCellId === undefined || spatialCellId === '') {
    throw new Error('Geographic Impact table did not expose a spatial cell identity')
  }
  const selectButton = firstRow.getByRole('button', { name: `Select ${spatialCellId}` })
  await selectButton.focus()
  await page.keyboard.press('Enter')

  await expect(
    firstRow.getByRole('button', { name: `Selected ${spatialCellId}` }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(summary.getByRole('status')).toContainText(`Selected cell ${spatialCellId}`)
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: spatialCellId,
    }),
  ).toBeVisible()
})
