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

test('preserves hierarchy at a narrow viewport and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
  await expect(page.getByText('Metadata only', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Awaiting human review')

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }))
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth)
  expect(viewport.scrollBehavior).toBe('auto')
})

test('navigates the evidence views and guided tour from the keyboard', async ({ page }) => {
  await page.goto('./')

  const tourTrigger = page.getByRole('button', { name: 'Guided tour' })
  await tourTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Mission' })).toBeVisible()
  await expect(page.getByText('Guided tour · Step 1 of 4')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(tourTrigger).toBeFocused()

  const evidenceLens = page.getByRole('link', { name: 'Evidence Lens' })
  await evidenceLens.focus()
  await page.keyboard.press('Enter')
  await expect(evidenceLens).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('heading', { name: 'No scientific result is promoted' }),
  ).toBeVisible()

  const reset = page.getByRole('button', { name: 'Reset replay' })
  await reset.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Mission' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'Papilio demoleus' })).toBeVisible()
})

test('shows only checksum-verified evidence with explicit fallback and unavailable states', async ({
  page,
}) => {
  await page.goto('./#observatory')

  await expect(page.getByText('17 / 17 verified')).toBeVisible()
  await expect(page.getByText('Inventory and payload verified')).toBeVisible()

  await page.getByRole('link', { name: 'Evidence Lens' }).click()
  await expect(page.getByRole('heading', { name: 'Explicitly unavailable evidence' })).toBeVisible()
  await expect(page.locator('.unavailable-evidence-list > li')).toHaveCount(6)

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Verified JSON fallback' })).toBeVisible()
  await expect(page.getByText('parquet unavailable')).toBeVisible()
  await expect(page.getByText(/DuckDB-Wasm was not started/u)).toBeVisible()
})

test('configures a bounded mission without enabling unsupported live work', async ({ page }) => {
  await page.goto('./#mission')

  const target = page.getByRole('textbox', { name: 'Target species' })
  await expect(target).toHaveValue('Papilio demoleus')
  await expect(page.getByRole('textbox', { name: 'Maximum API calls' })).toHaveValue('314')
  await expect(page.getByRole('textbox', { name: 'Candidate limit' })).toHaveValue('5')
  await expect(page.getByRole('radio', { name: 'Replay committed evidence' })).toBeChecked()
  await expect(
    page.getByRole('radio', { name: 'Live work unavailable in the submitted build' }),
  ).toBeDisabled()
  await expect(page.getByText('22 committed definitions')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live scientific work is not ready' })).toBeVisible()

  await target.fill('Papilio polytes')
  await expect(page.getByText('No matching verified fixture')).toBeVisible()
  await page.getByRole('textbox', { name: 'Optional device' }).fill('external GPU computer')

  await page.getByRole('button', { name: 'Restore replay baseline' }).click()
  await expect(target).toHaveValue('Papilio demoleus')
  await expect(page.getByRole('textbox', { name: 'Optional device' })).toHaveValue('')
  await expect(page.getByText('No matching verified fixture')).toBeHidden()
})
