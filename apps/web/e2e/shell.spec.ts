import { expect, test } from '@playwright/test'

test('serves the truthful shell entirely from the static origin', async ({ page }) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))

  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'TaxaLens Judge Replay' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Awaiting human review')
  await expect(page.getByText('Static replay · no live backend')).toBeVisible()

  const expectedOrigin = new URL(page.url()).origin
  expect(requestUrls.length).toBeGreaterThan(2)
  expect(requestUrls.every((url) => new URL(url).origin === expectedOrigin)).toBe(true)
})
