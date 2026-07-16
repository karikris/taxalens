import { expect, test, type Page } from '@playwright/test'

test('uses an explicit temporary media fallback without Cache Storage', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: undefined,
    })
  })
  await openVerification(page)

  await expect(
    page.getByText('Persistent media cache is unavailable', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/temporary in-memory fallback/u).first()).toBeVisible()

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await expect(
    page.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()
})

test('uses an explicit temporary ledger without IndexedDB persistence', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    })
  })
  await openVerification(page)

  await expect(
    page.getByText('IndexedDB is unavailable', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText('Review event saved locally')).toBeVisible()
  await expect(page.locator('.human-review__progress')).toContainText('1 attempted')

  await page.reload()
  await expect(
    page.getByText('IndexedDB is unavailable', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.human-review__progress')).toContainText('0 attempted')
})

test('shows a stopped inspection instead of hiding a missing WebAssembly runtime', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'WebAssembly', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('./#evidence-lens')

  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  const stopped = page.getByText('Discovery inspection stopped', { exact: true })
  await expect(stopped).toBeVisible({ timeout: 60_000 })
  await expect(stopped.locator('..')).toContainText(
    'WebAssembly is unavailable; DuckDB-Wasm inspection cannot start.',
  )
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()
})

test('reports one missing review image and keeps scientific controls disabled', async ({
  page,
}) => {
  await page.route('**/papilio-demoleus-closed-wing-*.jpg', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'fixture intentionally missing',
    })
  })
  await openVerification(page)

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(
    page.getByText('The review cache could not be prepared', { exact: true }),
  ).toBeVisible()
  const issues = page.locator('.review-cache__failures')
  await expect(issues).toContainText('commons-papilio-demoleus-closed-wing')
  await expect(issues).toContainText('HTTP 404')
  await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Can’t view' })).toBeEnabled()
})

test('reports a checksum failure and does not display corrupted review media', async ({
  page,
}) => {
  await page.route('**/papilio-demoleus-open-wing-*.jpg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: 'not the checksum-bound review image',
    })
  })
  await openVerification(page)

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(
    page.getByText('The review cache could not be prepared', { exact: true }),
  ).toBeVisible()
  const issues = page.locator('.review-cache__failures')
  await expect(issues).toContainText('commons-papilio-demoleus-open-wing')
  await expect(issues).toContainText('failed media integrity verification')
  await expect(page.getByRole('img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled()
})

test('reports offline media preparation without silently enabling a decision', async ({
  context,
  page,
}) => {
  await openVerification(page)
  await context.setOffline(true)

  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(
    page.getByText('The review cache could not be prepared', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.review-cache__failures')).toContainText(
    'commons-papilio-demoleus-open-wing',
  )
  await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Can’t view' })).toBeEnabled()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
})

async function openVerification(page: Page): Promise<void> {
  await page.goto('./#verification')
  await expect(
    page.getByRole('heading', { name: 'Review the label, one image at a time' }),
  ).toBeVisible()
}
