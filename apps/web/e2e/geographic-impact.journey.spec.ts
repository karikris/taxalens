import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

test('completes the Geographic Impact research journey without promoting a local review', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await page.goto('./#dashboard')
  await expect(
    page.getByRole('heading', { name: 'TaxaLens Geographic Impact Lens' }),
  ).toBeVisible()
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const geographicScope = page.locator('.geographic-impact-lens__scope')
  await expect(geographicScope).toContainText('Global')

  const continent = page.getByRole('combobox', { name: 'Continent' })
  const country = page.getByRole('combobox', { name: 'Country' })
  await continent.selectOption('continent:europe')
  await expect(page).toHaveURL(/geo=continent%3Aeurope/u)
  await expect(geographicScope).toContainText('Europe')

  await country.selectOption('country:SE')
  await expect(page).toHaveURL(/geo=country%3ASE/u)
  await expect(geographicScope).toContainText('Sweden')

  const selectedCellId = '87088660cffffff'
  const selectedRow = page.getByRole('rowheader', { name: selectedCellId }).locator('..')
  await selectedRow.getByRole('button', { name: `Select ${selectedCellId}` }).click()
  await expect(
    selectedRow.getByRole('button', { name: `Selected ${selectedCellId}` }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: selectedCellId,
    }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Evidence Lens' }).click()
  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  await expect(page.getByRole('heading', { name: 'Source flickr:55081300254' })).toBeVisible({
    timeout: 60_000,
  })
  await expect(
    page.getByRole('img', { name: /Record geographic context mini-map/u }),
  ).toBeVisible()

  await page.locator('.geography-reference').getByRole('link', { name: 'Verify this result' }).click()
  await expect(page.getByText('Exact Flickr result cannot be viewed yet')).toBeVisible()
  await page.getByRole('tab', { name: 'Reference Images' }).click()
  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await page.getByLabel(/Reviewer ID/u).fill('geographic-impact-journey')
  await page.getByLabel(/Comment/u).fill(
    'Reference evidence reviewed; the selected Flickr candidate remains a hypothesis.',
  )
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText('Review event saved locally')).toBeVisible()

  await page.getByRole('link', { name: 'Return to Evidence Lens' }).click()
  await expect(
    page.getByRole('heading', { name: 'Local human verification evidence' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()

  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  await page.getByRole('combobox', { name: 'Continent' }).selectOption('continent:europe')
  await page.getByRole('combobox', { name: 'Country' }).selectOption('country:SE')
  const returnedRow = page.getByRole('rowheader', { name: selectedCellId }).locator('..')
  await returnedRow.getByRole('button', { name: `Select ${selectedCellId}` }).click()
  await expect(page.getByText(/0 local append-only review events are projected/u)).toBeVisible()
  await expect(
    page.getByText(/local outcomes cannot create a scientific release/u),
  ).toBeVisible()
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: selectedCellId,
    }),
  ).toBeVisible()
  await expect(
    page
      .locator('.selected-geography-details')
      .getByText('Release-ready occurrence candidates', { exact: true })
      .locator('..'),
  ).toContainText('0')

  await page.getByRole('button', { name: 'Prepare geographic export' }).click()
  await expect(
    page.getByText('Seven geographic export files prepared', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Checksum manifest' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^taxalens-papilio-demoleus-country-se-r7\.manifest\.json$/u,
  )
  const path = await download.path()
  expect(path).not.toBeNull()
  const manifest = JSON.parse(await readFile(path!, 'utf8')) as {
    readonly scopeId: string
    readonly signature: { readonly status: string }
    readonly scientificClaimAllowed: boolean
  }
  expect(manifest).toMatchObject({
    scopeId: 'country:SE',
    signature: { status: 'unavailable' },
    scientificClaimAllowed: false,
  })
})
