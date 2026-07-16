import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXED_REVIEW_TIME = new Date('2026-07-16T10:00:00.000Z')
const FLICKR_REVIEW_ROUTE =
  './#verification?campaign=papilio-demoleus-flickr-candidate-intake-v1&item=flickr%3A55081300254&return=evidence-lens'

test.use({
  colorScheme: 'light',
  contextOptions: { reducedMotion: 'no-preference' },
  deviceScaleFactor: 1,
  locale: 'en-AU',
  viewport: { width: 1440, height: 1000 },
})

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_REVIEW_TIME)
})

test('protects the blocked Flickr review boundary', async ({ page }) => {
  await page.goto(FLICKR_REVIEW_ROUTE)
  const review = page.locator('.flickr-candidate-route')
  await expect(
    review.getByText('Flickr candidate review media is unavailable'),
  ).toBeVisible()

  await expectStableScreenshot(review, 'flickr-review.png')
})

test('protects the checksum-verified reference review workspace', async ({
  page,
}) => {
  await openReferenceReview(page)
  await prepareReviewCache(page)
  const workspace = page.locator('.human-review__workspace')
  await expect(
    workspace.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()
  await expect(workspace.getByRole('button', { name: 'Yes' })).toBeEnabled()

  await expectStableScreenshot(workspace, 'reference-review.png')
})

test('protects the append-only conflict queue', async ({ page }) => {
  await openReferenceReview(page)
  await prepareReviewCache(page)
  await recordDecision(page, 'reviewer-alpha', 'Yes')

  await page.getByRole('button', { name: 'Open review image 1' }).click()
  await expect(page.getByRole('button', { name: 'No' })).toBeEnabled()
  await recordDecision(page, 'reviewer-beta', 'No')

  await page.getByRole('tab', { name: 'Conflicts' }).click()
  const conflictQueue = page.locator('.verification-conflict-queue')
  await expect(conflictQueue).toContainText('1 item need')
  const conflictImage = conflictQueue.getByRole('img')
  await expect(conflictImage).toBeVisible()
  await expect
    .poll(() =>
      conflictImage.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0)

  await expectStableScreenshot(conflictQueue, 'conflict-queue.png')
})

test('protects the truthful unavailable quality panel', async ({ page }) => {
  await openReferenceReview(page)
  await page.getByRole('tab', { name: 'Quality' }).click()
  const quality = page.locator('.verification-quality')
  await expect(quality).toContainText('Quality estimates are not available')

  await expectStableScreenshot(quality, 'quality-panel.png')
})

test('protects disabled scientific controls before media display', async ({
  page,
}) => {
  await openReferenceReview(page)
  const controls = page.locator('.review-decision-panel')
  await expect(controls.getByRole('button', { name: 'Yes' })).toBeDisabled()
  await expect(controls.getByRole('button', { name: 'No' })).toBeDisabled()
  await expect(
    controls.getByRole('button', { name: 'Can’t view' }),
  ).toBeEnabled()
  await expect(controls.getByRole('button', { name: 'Skip' })).toBeEnabled()

  await expectStableScreenshot(controls, 'disabled-scientific-controls.png')
})

test('protects a checksum-bound media failure', async ({ page }) => {
  await page.route('**/papilio-demoleus-open-wing-*.jpg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: 'intentionally corrupted visual-regression fixture',
    })
  })
  await openReferenceReview(page)
  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(
    page.getByText('The review cache could not be prepared', { exact: true }),
  ).toBeVisible()
  const failure = page.locator('.review-cache__failures')
  await expect(failure).toContainText(
    'failed media integrity verification',
  )
  await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Can’t view' })).toBeEnabled()

  await expectStableScreenshot(failure, 'media-failure.png')
})

test('protects a completed three-image review', async ({ page }) => {
  await openReferenceReview(page)
  await prepareReviewCache(page)
  for (let index = 0; index < 3; index += 1) {
    await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()
    await recordDecision(page, 'visual-reviewer', 'Yes')
  }
  await expect(page.locator('.human-review__progress')).toContainText('3 / 3')
  const summary = page.locator('.review-summary')
  await expect(summary).toContainText('Decisively reviewed 3')
  await expect(summary).toContainText('Pending 0')

  await expectStableScreenshot(summary, 'completed-review.png')
})

async function openReferenceReview(page: Page): Promise<void> {
  await page.goto('./#verification')
  await expect(
    page.getByRole('heading', {
      name: 'Review the label, one image at a time',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Reference Images' }),
  ).toHaveAttribute('aria-selected', 'true')
}

async function prepareReviewCache(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  await expect(
    page.getByRole('img', {
      name: /Does this image show an adult Papilio demoleus/u,
    }),
  ).toBeVisible()
}

async function recordDecision(
  page: Page,
  reviewerId: string,
  outcome: 'Yes' | 'No',
): Promise<void> {
  await page.getByLabel(/Reviewer ID/u).fill(reviewerId)
  await page.getByRole('button', { name: outcome, exact: true }).click()
  await expect(
    page
      .getByText('Review event saved locally')
      .or(page.getByText('Local review queue complete')),
  ).toBeVisible()
}

async function expectStableScreenshot(
  locator: Locator,
  name: string,
): Promise<void> {
  await expect(locator).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  })
}
