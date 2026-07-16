import { expect, test, type Page } from '@playwright/test'

const FIXED_ACCESSIBLE_TIME = new Date('2026-07-16T10:00:00.000Z')

test.use({
  colorScheme: 'light',
  contextOptions: { reducedMotion: 'reduce' },
  deviceScaleFactor: 1,
  locale: 'en-AU',
  viewport: { width: 1280, height: 720 },
})

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_ACCESSIBLE_TIME)
})

test('protects guided-tour states with reduced motion', async ({ page }) => {
  await page.goto('./#mission')
  await expect(
    page.getByRole('heading', { name: 'Papilio demoleus' }),
  ).toBeVisible()
  await expectReducedMotion(page)

  await page.getByRole('button', { name: 'Start 90-second judge tour' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Research Mission' }),
  ).toBeVisible()
  await expectAccessibleScreenshot(page, 'guided-tour-reduced-motion.png')

  await dialog.getByRole('button', { name: 'Next: Observatory' }).click()
  await dialog.getByRole('button', { name: 'Next: Evidence Lens' }).click()
  await dialog.getByRole('button', { name: 'Next: Verification' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Verification' }),
  ).toBeVisible()
  await expectAccessibleScreenshot(
    page,
    'verification-tour-step-reduced-motion.png',
  )
})

test('protects selected lineage with reduced motion', async ({ page }) => {
  await page.goto('./#observatory')
  await expect(
    page.getByRole('heading', { name: 'Submitted fixture ready' }),
  ).toBeVisible()
  await expectReducedMotion(page)

  const record = page.getByRole('button', {
    name: /Final replay record awaiting review/u,
  })
  await record.click()
  await expect(record).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText(
      /13 contributing stages and 12 contributing artifacts highlighted/u,
    ),
  ).toBeVisible()
  await expectAccessibleScreenshot(
    page,
    'lineage-selected-reduced-motion.png',
  )
})

async function expectReducedMotion(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true)
  const transitionSeconds = await page
    .getByRole('link', { name: 'Mission' })
    .evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map((duration) => Number.parseFloat(duration)),
    )
  expect(
    transitionSeconds.every(
      (duration) => Number.isFinite(duration) && duration <= 0.00001,
    ),
  ).toBe(true)
}

async function expectAccessibleScreenshot(
  page: Page,
  snapshot: string,
): Promise<void> {
  await expect(page).toHaveScreenshot(snapshot, {
    animations: 'disabled',
    caret: 'hide',
    mask: [
      page.locator('time'),
      page.locator('.geographic-workload__map-layout svg'),
    ],
    maskColor: '#d9d5ca',
    scale: 'css',
  })
}
