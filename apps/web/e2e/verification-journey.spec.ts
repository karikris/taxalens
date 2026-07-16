import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

test('completes Evidence Lens verification, quality contribution, return, and export', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto('./#evidence-lens')
  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  await expect(page.getByRole('heading', { name: 'Source flickr:55081300254' })).toBeVisible({
    timeout: 60_000,
  })

  await page.getByRole('link', { name: 'Verify this result' }).click()
  await expect(page.getByRole('tab', { name: 'Flickr Results' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(
    page.getByText('Flickr candidate review media is unavailable'),
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Reference Images' }).click()
  const progress = page.locator('.human-review__progress')
  await expect(progress).toContainText('0 / 3')
  await expect(progress).toContainText('0 attempted')

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await expect(
    page.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()

  await page.getByLabel(/Reviewer ID/u).fill('chromium-journey-reviewer')
  await page.getByLabel(/Comment/u).fill('Open-wing adult features are visible.')
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText('Review event saved locally')).toBeVisible()
  await expect(progress).toContainText('1 / 3')
  await expect(progress).toContainText('1 attempted')

  await page.getByRole('link', { name: 'Return to Evidence Lens' }).click()
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()
  const humanEvidence = page.locator('.human-verification-evidence')
  await expect(
    humanEvidence.getByRole('heading', {
      name: 'Local human verification evidence',
    }),
  ).toBeVisible()
  await expect(
    humanEvidence.getByText('Current human outcomes').locator('..'),
  ).toContainText('1 of 3')
  await expect(
    humanEvidence.getByRole('list', {
      name: 'Current human verification outcomes',
    }),
  ).toContainText('Yes')

  await page.getByRole('link', { name: 'Verification', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Reference Images' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(progress).toContainText('1 / 3')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export review receipt' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    'papilio-demoleus-commons-review-v1.review-receipt.json',
  )
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const receipt = JSON.parse(await readFile(downloadedPath!, 'utf8')) as {
    readonly schemaVersion: string
    readonly currentReviewerId: string | null
    readonly events: readonly {
      readonly itemId: string
      readonly outcome: string
    }[]
    readonly counts: {
      readonly recorded: number
      readonly yes: number
    }
    readonly semantics: {
      readonly localBrowserReview: boolean
      readonly scientificClaimAllowed: boolean
    }
  }
  expect(receipt).toMatchObject({
    schemaVersion: 'taxalens-human-review-receipt:v2.0.0',
    currentReviewerId: 'chromium-journey-reviewer',
    counts: { recorded: 1, yes: 1 },
    semantics: {
      localBrowserReview: true,
      scientificClaimAllowed: false,
    },
  })
  expect(receipt.events).toEqual([
    expect.objectContaining({
      itemId: 'commons-papilio-demoleus-open-wing',
      outcome: 'yes',
    }),
  ])
})
