import { expect, test, type BrowserContext, type Page } from '@playwright/test'

test('starts the Geographic Impact map without an external request', async ({
  baseURL,
  context,
  page,
}) => {
  if (baseURL === undefined) {
    throw new Error('The map network guard requires the configured preview origin')
  }
  const expectedOrigin = new URL(baseURL).origin
  const audit = await installOriginGuard(context, page, expectedOrigin)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('./#dashboard')
  await expect(
    page.getByRole('heading', { name: 'TaxaLens Geographic Impact Lens' }),
  ).toBeVisible()
  await expect(
    page.locator('.taxalens-world-map__canvas[data-map-loaded="true"]'),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByText('Baseline occurrence evidence mapped', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
  const evidenceCanvas = page.locator(
    '.taxalens-world-map__canvas[data-baseline-evidence="true"]',
  )
  await expect(evidenceCanvas).toBeVisible()
  expect(
    Number(await evidenceCanvas.getAttribute('data-impact-feature-count')),
  ).toBeGreaterThan(0)
  await expect(page.locator('.taxalens-world-map canvas.maplibregl-canvas')).toHaveCount(1)
  await expect(page.getByText(/no external tiles, fonts, sprites, telemetry or analytics/u))
    .toBeVisible()

  const browserResources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming
      return { initiatorType: resource.initiatorType, name: resource.name }
    }),
  )
  for (const { initiatorType, name } of browserResources) {
    audit.observe(name, `performance:${initiatorType}`)
  }

  expect(audit.httpRequestCount()).toBeGreaterThan(2)
  expect(audit.violations()).toEqual([])
  expect(pageErrors).toEqual([])
})

async function installOriginGuard(
  context: BrowserContext,
  page: Page,
  expectedOrigin: string,
) {
  const externalUrls: string[] = []
  let observedHttpRequests = 0

  const observe = (rawUrl: string, kind: string) => {
    const url = new URL(rawUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      observedHttpRequests += 1
      if (url.origin !== expectedOrigin) externalUrls.push(`${kind}: ${rawUrl}`)
      return
    }
    if (url.protocol === 'blob:' && url.origin !== expectedOrigin) {
      externalUrls.push(`${kind}: ${rawUrl}`)
    }
  }

  context.on('request', (request) => observe(request.url(), request.resourceType()))
  context.on('serviceworker', (worker) => observe(worker.url(), 'serviceworker'))
  page.on('worker', (worker) => observe(worker.url(), 'worker'))
  page.on('websocket', (socket) => observe(socket.url(), 'websocket'))

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin !== expectedOrigin
    ) {
      externalUrls.push(`blocked:${route.request().resourceType()}: ${url.href}`)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  return {
    httpRequestCount: () => observedHttpRequests,
    observe,
    violations: () => externalUrls,
  }
}
