import { expect, test, type Page } from '@playwright/test'

const FIXED_ACCESSIBLE_TIME = new Date('2026-07-16T10:00:00.000Z')

test.use({
  colorScheme: 'light',
  deviceScaleFactor: 1,
  locale: 'en-AU',
  viewport: { width: 1280, height: 720 },
})

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_ACCESSIBLE_TIME)
})

test('protects the Geographic Impact map with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#dashboard')
  await expectGeographicMapReady(page)

  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true)
  const transitionDurations = await page
    .locator('.taxalens-world-map .maplibregl-ctrl-zoom-in')
    .evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map((duration) => Number.parseFloat(duration)),
    )
  expect(
    transitionDurations.every(
      (duration) => Number.isFinite(duration) && duration <= 0.00001,
    ),
  ).toBe(true)

  await expectAccessibleScreenshot(
    page,
    '.taxalens-world-map',
    'geographic-impact-reduced-motion-1280x720.png',
  )
})

test('protects Geographic Impact evidence encodings in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('./#dashboard')
  await expectGeographicMapReady(page)

  expect(
    await page.evaluate(() => window.matchMedia('(forced-colors: active)').matches),
  ).toBe(true)
  const legend = page.locator('.geographic-impact-legend')
  await expect(legend).toContainText('Baseline occurrence evidence')
  await expect(legend).toContainText('Unreviewed Flickr candidate')
  await expect(legend).toContainText('Human-reviewed non-target')
  await expect(legend).toContainText('Release-ready occurrence candidate')

  await expectAccessibleScreenshot(
    page,
    '.geographic-impact-legend',
    'geographic-impact-forced-colors-1280x720.png',
  )
})

async function expectGeographicMapReady(page: Page): Promise<void> {
  await expect(
    page.getByText('Baseline and Flickr evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  const canvas = page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
  await expect(canvas).toHaveAttribute('data-camera-scope', 'global', { timeout: 60_000 })
  await expect(canvas).toHaveAttribute('data-baseline-evidence', 'true')
  await expect(canvas).toHaveAttribute('data-flickr-evidence', 'true')
}

async function expectAccessibleScreenshot(
  page: Page,
  anchorSelector: string,
  snapshot: string,
): Promise<void> {
  await page.evaluate(async (selector) => {
    await document.fonts.ready
    document.documentElement.style.overflowAnchor = 'none'
    const anchor = document.querySelector(selector)
    if (anchor) {
      const top = anchor.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ behavior: 'instant', top: Math.max(0, top - 16) })
    }
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
  }, anchorSelector)
  await expect(page.locator(anchorSelector)).toBeInViewport()
  await expect(page).toHaveScreenshot(snapshot, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  })
}
