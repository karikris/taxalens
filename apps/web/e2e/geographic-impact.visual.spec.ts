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

  await expectGeographicScreenshot(page, 'geographic-impact-global-1280x720.png')
})

async function expectGeographicScreenshot(page: Page, snapshot: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    document.documentElement.style.overflowAnchor = 'none'
    const map = document.querySelector('.taxalens-world-map')
    if (map) {
      const top = map.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ behavior: 'instant', top: Math.max(0, top - 16) })
    }
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
  })
  await expect
    .poll(() => page.locator('.taxalens-world-map').evaluate((element) => element.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(0)
  await expect(page).toHaveScreenshot(snapshot, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  })
}

async function expectGeographicMapReady(
  page: Page,
  scopeId: string,
  baselineEvidence = true,
): Promise<void> {
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const canvas = page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
  await expect(canvas).toHaveAttribute('data-camera-scope', scopeId, { timeout: 60_000 })
  await expect(canvas).toHaveAttribute(
    'data-baseline-evidence',
    baselineEvidence ? 'true' : 'false',
  )
  await expect(canvas).toHaveAttribute('data-flickr-evidence', 'true')
}
