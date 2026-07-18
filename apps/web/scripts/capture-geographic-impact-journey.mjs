import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const baseUrl = process.env.TAXALENS_CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173/'
const outputDirectory = fileURLToPath(
  new URL('../../../docs/assets/geographic-impact-journey-frames/', import.meta.url),
)
const fixedTime = new Date('2026-07-16T10:00:00.000Z')

await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  colorScheme: 'light',
  deviceScaleFactor: 1,
  locale: 'en-AU',
  reducedMotion: 'reduce',
  viewport: { width: 1280, height: 720 },
})
const externalOrigins = new Set()
page.on('request', (request) => {
  const origin = new URL(request.url()).origin
  if (origin !== new URL(baseUrl).origin) externalOrigins.add(origin)
})

try {
  await page.clock.setFixedTime(fixedTime)
  await page.goto(new URL('#dashboard', baseUrl).href)
  await page.getByText('Baseline and Flickr evidence mapped', { exact: true }).waitFor({
    timeout: 60_000,
  })
  await expectMapScope('global')
  await captureMap('01-global.png', 'Global • baseline + Flickr candidates')

  await page.getByRole('radio', { name: 'Flickr candidates' }).check()
  await page.getByText(/cells match Flickr candidates/u).waitFor()
  await captureMap('02-flickr-candidates.png', 'Global Flickr candidate evidence • hypotheses')

  await page.getByRole('radio', { name: 'Human reviewed' }).check()
  await page.getByText(/0 of [\d,]+ cells match Human reviewed\./u).waitFor()
  await captureMap('03-human-reviewed.png', 'Global human-reviewed evidence • zero retained outcomes')

  if (externalOrigins.size > 0) {
    throw new Error(`Capture requested external origins: ${[...externalOrigins].sort().join(', ')}`)
  }
} finally {
  await browser.close()
}

async function expectMapScope(scopeId) {
  await page
    .locator('.taxalens-world-map__canvas[data-map-loaded="true"]')
    .waitFor({ timeout: 60_000 })
  await page.waitForFunction(
    (expected) =>
      document.querySelector('.taxalens-world-map__canvas')?.getAttribute('data-camera-scope') ===
      expected,
    scopeId,
  )
}

async function captureMap(filename, label) {
  await captureRegion('.taxalens-world-map', filename, label)
}

async function captureRegion(selector, filename, label) {
  await page.evaluate(
    async ({ labelText, targetSelector }) => {
      document.getElementById('taxalens-readme-capture-label')?.remove()
      const target = document.querySelector(targetSelector)
      if (!(target instanceof HTMLElement)) {
        throw new Error(`Capture target unavailable: ${targetSelector}`)
      }
      const top = target.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ behavior: 'instant', top: Math.max(0, top - 16) })
      const labelElement = document.createElement('div')
      labelElement.id = 'taxalens-readme-capture-label'
      labelElement.textContent = labelText
      Object.assign(labelElement.style, {
        background: '#10231f',
        border: '2px solid #f0c96a',
        borderRadius: '999px',
        color: '#fffdf5',
        font: '700 16px/1.2 system-ui, sans-serif',
        left: '72px',
        padding: '10px 16px',
        position: 'fixed',
        top: '24px',
        zIndex: '2147483647',
      })
      document.body.append(labelElement)
      await document.fonts.ready
      await new Promise((resolve) =>
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
      )
    },
    { labelText: label, targetSelector: selector },
  )
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: `${outputDirectory}${filename}`,
    scale: 'css',
  })
}
