import { expect, test, type Page } from '@playwright/test'

const FIXED_JUDGE_TIME = new Date('2026-07-16T10:00:00.000Z')
const JUDGE_VIEWPORT = { width: 1280, height: 720 }

const JUDGE_ROUTES = [
  {
    id: 'mission',
    heading: 'Papilio demoleus',
    snapshot: 'mission-1280x720.png',
  },
  {
    id: 'observatory',
    heading: 'Submitted fixture ready',
    snapshot: 'observatory-1280x720.png',
  },
  {
    id: 'evidence-lens',
    heading: 'No scientific result is promoted',
    snapshot: 'evidence-lens-1280x720.png',
  },
  {
    id: 'verification',
    heading: 'Review the label, one image at a time',
    snapshot: 'verification-1280x720.png',
  },
  {
    id: 'dashboard',
    heading: 'Verified local data boundary',
    snapshot: 'dashboard-1280x720.png',
  },
  {
    id: 'agent',
    heading: 'Configured model Sol research analyst',
    snapshot: 'agent-trace-1280x720.png',
  },
] as const

test.use({
  colorScheme: 'light',
  contextOptions: { reducedMotion: 'no-preference' },
  deviceScaleFactor: 1,
  locale: 'en-AU',
  viewport: JUDGE_VIEWPORT,
})

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_JUDGE_TIME)
})

for (const route of JUDGE_ROUTES) {
  test(`protects the ${route.id} judge layout at 1280 by 720`, async ({
    page,
  }) => {
    await page.goto(`./#${route.id}`)
    await expect(
      page.getByRole('heading', { name: route.heading, exact: true }),
    ).toBeVisible()
    if (route.id === 'agent') {
      await expect(
        page.getByRole('heading', { name: 'Replayed analyst session' }),
      ).toBeVisible()
    }

    await expectJudgeScreenshot(page, route.snapshot)
  })
}

async function expectJudgeScreenshot(
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
