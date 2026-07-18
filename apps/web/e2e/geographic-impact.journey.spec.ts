import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

test('completes the globally framed Geographic Impact research journey', async ({
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
  await expect(page).toHaveURL(/#dashboard$/u)
  const summary = page.getByRole('region', { name: 'Geographic evidence at a glance' })
  await expect(summary).toContainText('Global contains')
  await expect(summary.getByText('Human-supported additional cells').locator('..')).toContainText('0')
  await expect(summary.getByText('Release-ready additional cells').locator('..')).toContainText('0')
  await expect(page.getByText(/0 local append-only review events are projected/u)).toBeVisible()
  await expect(
    page.getByText(/local outcomes cannot create a scientific release/u),
  ).toBeVisible()

  await page.getByRole('radio', { name: 'Flickr candidates' }).check()
  await expect(page.locator('.geographic-evidence-filter [role="status"]')).toContainText(
    'match Flickr candidates',
  )
  await page.getByRole('radio', { name: 'All evidence' }).check()

  await page.getByRole('button', { name: 'Prepare geographic export' }).click()
  await expect(
    page.getByText('Seven geographic export files prepared', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Checksum manifest' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^taxalens-papilio-demoleus-global-r3\.manifest\.json$/u,
  )
  const path = await download.path()
  expect(path).not.toBeNull()
  const manifest = JSON.parse(await readFile(path!, 'utf8')) as {
    readonly scopeId: string
    readonly signature: { readonly status: string }
    readonly scientificClaimAllowed: boolean
  }
  expect(manifest).toMatchObject({
    scopeId: 'global',
    signature: { status: 'unavailable' },
    scientificClaimAllowed: false,
  })
})
