import { expect, test } from '@playwright/test'

test('loads, verifies media, records a decision, and exports in each browser', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))

  await page.goto('./#verification')
  await expect(
    page.getByRole('heading', { name: 'Review the label, one image at a time' }),
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Reference Images' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await expect(
    page.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()

  await page.getByLabel(/Reviewer ID/u).fill('cross-browser-smoke')
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText('Review event saved locally')).toBeVisible()
  await expect(page.locator('.human-review__progress')).toContainText('1 / 3')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export review receipt' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    'papilio-demoleus-commons-review-v1.review-receipt.json',
  )

  const expectedOrigin = new URL(page.url()).origin
  expect(
    requestUrls.filter((url) => {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin !== expectedOrigin
    }),
  ).toEqual([])
})
