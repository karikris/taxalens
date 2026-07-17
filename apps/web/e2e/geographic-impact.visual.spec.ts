import { expect, test, type Page } from '@playwright/test'

const FIXED_GEOGRAPHIC_TIME = new Date('2026-07-16T10:00:00.000Z')

test.use({
  colorScheme: 'light',
  contextOptions: { reducedMotion: 'no-preference' },
  deviceScaleFactor: 1,
  locale: 'en-AU',
  viewport: { width: 1280, height: 720 },
})

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_GEOGRAPHIC_TIME)
})

test('protects the global Geographic Impact map at 1280 by 720', async ({ page }) => {
  await page.goto('./#dashboard')
  await expectGeographicMapReady(page, 'global')

  await page.locator('.taxalens-world-map').scrollIntoViewIfNeeded()
  await expect(page).toHaveScreenshot('geographic-impact-global-1280x720.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  })
})

async function expectGeographicMapReady(page: Page, scopeId: string): Promise<void> {
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const canvas = page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
  await expect(canvas).toHaveAttribute('data-camera-scope', scopeId, { timeout: 60_000 })
  await expect(canvas).toHaveAttribute('data-baseline-evidence', 'true')
  await expect(canvas).toHaveAttribute('data-flickr-evidence', 'true')
}
