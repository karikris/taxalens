import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import {
  completeManualVerificationBaseline,
  createManualVerificationBaseline,
  recordManualBaselineAction,
  type ManualVerificationBaselineSession,
} from '../src/impact/manualVerificationBaseline'
import {
  completeTaxaLensAssistedTiming,
  createTaxaLensAssistedTiming,
  recordAssistedDecision,
  recordAssistedFieldCompletion,
  recordAssistedOtherAction,
  recordAssistedPageOpen,
} from '../src/impact/taxaLensAssistedTiming'

const RUN_STUDY = process.env.TAXALENS_RUN_IMPACT_STUDY === '1'
const OUTPUT_PATH = process.env.TAXALENS_IMPACT_OUTPUT
const MANUAL_BASELINE_HTML = readFileSync(
  new URL('./fixtures/manual-verification-baseline.html', import.meta.url),
  'utf8',
)
const TAXALENS_SHA = 'f62ac135e9222ea4c39933f420b2e96aa73ce742'
const CAMPAIGN_ID = 'papilio-demoleus-commons-review-v1'
const TASK_SET_ID =
  'commons-campaign:00087bce738f5098893eea7b8fce238d3c88f85a7ee643eceddfb22466d6087d'
const PARTICIPANT_ID_HASH = createHash('sha256')
  .update('taxalens-scripted-impact-harness-v1')
  .digest('hex')
const ITEMS = [
  {
    itemId: 'commons-papilio-demoleus-open-wing',
    duplicateGroupId:
      'sha256:47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
    view: 'dorsal',
  },
  {
    itemId: 'commons-papilio-demoleus-closed-wing',
    duplicateGroupId:
      'sha256:3bd3248347c3b82a977b0890f192f2f0c93253eff13d38b4b54dedb08b39627b',
    view: 'ventral',
  },
  {
    itemId: 'commons-papilio-demoleus-lime-swallowtail',
    duplicateGroupId:
      'sha256:9ceb5c0e354627441ba7be5a8e75a8eed7c278948e606e4892ae47387ee1bbea',
    view: 'ventral',
  },
] as const

test.describe('explicit scripted impact measurement', () => {
  test.skip(
    !RUN_STUDY,
    'Set TAXALENS_RUN_IMPACT_STUDY=1 to collect a raw scripted run.',
  )

  test('records matched manual and assisted raw sessions', async ({
    browser,
    browserName,
  }) => {
    test.setTimeout(120_000)
    if (OUTPUT_PATH === undefined || OUTPUT_PATH.trim() === '') {
      throw new Error('TAXALENS_IMPACT_OUTPUT is required for study collection')
    }
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()
    const manual = await collectManualSession(page)
    const assisted = await collectAssistedSession(page)
    const collectedAt = now()
    const artifact = {
      schemaVersion: 'taxalens-verification-impact-study-raw:v1.0.0',
      studyId: 'taxalens-scripted-interaction-pilot-v1',
      measurementRunId: `scripted-${collectedAt.replaceAll(/[:.]/gu, '-')}`,
      collectedAt,
      measurementKind: 'scripted_browser_protocol',
      taskSet: {
        taskSetId: TASK_SET_ID,
        campaignId: CAMPAIGN_ID,
        itemIds: ITEMS.map(({ itemId }) => itemId),
        decisionCount: ITEMS.length,
      },
      environment: {
        automation: 'Playwright',
        browserName,
        browserVersion: browser.version(),
        platform: process.platform,
        architecture: process.arch,
        viewport: {
          width: 1280,
          height: 720,
        },
        timingSource:
          'UTC wall clock sampled immediately after awaited visible interactions',
        taxalensSha: TAXALENS_SHA,
      },
      sessions: [
        {
          scriptedRun: true,
          rawSession: manual,
        },
        {
          scriptedRun: true,
          rawSession: assisted,
        },
      ],
      claims: {
        humanParticipants: 0,
        humanProductivityMeasured: false,
        humanTimeSavingsAllowed: false,
        populationSavingsAllowed: false,
        scientificQualityMeasured: false,
      },
      limitations: [
        'This is one scripted Chromium protocol run, not a human study.',
        'Timing includes local browser rendering and awaited UI work on one machine.',
        'Action counts describe only the frozen three-item protocol.',
        'The scripted Yes interactions are disposable workflow inputs, not human labels.',
      ],
    }
    const output = resolve(process.cwd(), OUTPUT_PATH)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    await context.close()

    expect(manual.completedAt).not.toBeNull()
    expect(assisted.completedAt).not.toBeNull()
    expect(manual.taskSetId).toBe(assisted.taskSetId)
    expect(manual.events.filter(({ eventType }) => eventType === 'action')).toHaveLength(
      20,
    )
    expect(
      assisted.events.filter(({ eventType }) => eventType === 'action'),
    ).toHaveLength(10)
  })
})

async function collectManualSession(
  page: Page,
): Promise<ManualVerificationBaselineSession> {
  let session = createManualVerificationBaseline({
    studyId: 'taxalens-scripted-interaction-pilot-v1',
    sessionId: 'scripted-manual-baseline-001',
    participantIdHash: PARTICIPANT_ID_HASH,
    taskSetId: TASK_SET_ID,
    startedAt: now(),
  })
  await page.goto('./')
  await page.setContent(MANUAL_BASELINE_HTML)
  await expect(
    page.getByRole('heading', { name: 'Manual verification baseline' }),
  ).toBeVisible()
  session = recordManualBaselineAction(session, {
    actionKind: 'page_opened',
    actionId: 'open-manual-baseline',
    pageId: 'manual-baseline',
    recordedAt: now(),
  })
  await page.getByLabel('Reviewer alias').fill('scripted-harness')
  session = recordManualBaselineAction(session, {
    actionKind: 'field_completed',
    actionId: 'complete-reviewer-alias',
    fieldId: 'reviewer-alias',
    recordedAt: now(),
  })
  for (const [index, item] of ITEMS.entries()) {
    const card = page.locator(`[data-impact-item="${item.itemId}"]`)
    const popupPromise = page.waitForEvent('popup')
    await card.getByRole('link', { name: `Open source image ${index + 1}` }).click()
    const popup = await popupPromise
    await popup.waitForLoadState('load')
    session = recordManualBaselineAction(session, {
      actionKind: 'page_opened',
      actionId: `open-source-${index + 1}`,
      pageId: `source-image:${item.itemId}`,
      recordedAt: now(),
    })
    await popup.close()

    await card.locator('[data-duplicate]').check()
    session = recordManualBaselineAction(session, {
      actionKind: 'duplicate_inspected',
      actionId: `inspect-duplicate-${index + 1}`,
      duplicateGroupId: item.duplicateGroupId,
      recordedAt: now(),
    })
    await card.locator('[data-field="scientific-name"]').fill('Papilio demoleus')
    session = recordManualBaselineAction(session, {
      actionKind: 'field_completed',
      actionId: `complete-scientific-name-${index + 1}`,
      fieldId: `${item.itemId}:scientific-name`,
      recordedAt: now(),
    })
    await card.locator('[data-field="life-stage"]').selectOption('adult')
    session = recordManualBaselineAction(session, {
      actionKind: 'field_completed',
      actionId: `complete-life-stage-${index + 1}`,
      fieldId: `${item.itemId}:life-stage`,
      recordedAt: now(),
    })
    await card.locator('[data-field="view"]').selectOption(item.view)
    session = recordManualBaselineAction(session, {
      actionKind: 'field_completed',
      actionId: `complete-view-${index + 1}`,
      fieldId: `${item.itemId}:view`,
      recordedAt: now(),
    })
    await card.getByRole('radio', { name: 'Yes' }).check()
    session = recordManualBaselineAction(session, {
      actionKind: 'decision_recorded',
      actionId: `record-decision-${index + 1}`,
      itemId: item.itemId,
      outcome: 'yes',
      recordedAt: now(),
    })
  }
  return completeManualVerificationBaseline(session, now())
}

async function collectAssistedSession(page: Page) {
  let session = createTaxaLensAssistedTiming({
    studyId: 'taxalens-scripted-interaction-pilot-v1',
    sessionId: 'scripted-taxalens-assisted-001',
    participantIdHash: PARTICIPANT_ID_HASH,
    taskSetId: TASK_SET_ID,
    startedAt: now(),
    taxalensSha: TAXALENS_SHA,
    campaignId: CAMPAIGN_ID,
  })
  await page.goto('./?impact-complete=1#verification')
  await expect(
    page.getByRole('heading', { name: 'Review the label, one image at a time' }),
  ).toBeVisible()
  session = recordAssistedPageOpen(session, {
    actionId: 'open-taxalens-verification',
    pageId: 'verification/reference-images',
    recordedAt: now(),
  })
  await page.getByRole('button', { name: 'Prepare review cache' }).click()
  await expect(page.getByRole('button', { name: 'Cache ready' })).toBeDisabled()
  session = recordAssistedOtherAction(session, {
    actionId: 'prepare-review-cache',
    recordedAt: now(),
  })
  await page.getByLabel(/Reviewer ID/u).fill('scripted-harness')
  session = recordAssistedFieldCompletion(session, {
    actionId: 'complete-reviewer-id',
    fieldId: 'reviewer-id',
    recordedAt: now(),
  })
  for (const [index, item] of ITEMS.entries()) {
    await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()
    await page
      .getByLabel(/Comment/u)
      .fill('Scripted interaction measurement; not a human label.')
    session = recordAssistedFieldCompletion(session, {
      actionId: `complete-comment-${index + 1}`,
      fieldId: `${item.itemId}:optional-comment`,
      recordedAt: now(),
    })
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(
      page
        .getByText('Review event saved locally')
        .or(page.getByText('Local review queue complete')),
    ).toBeVisible()
    session = recordAssistedDecision(session, {
      actionId: `record-decision-${index + 1}`,
      itemId: item.itemId,
      outcome: 'yes',
      recordedAt: now(),
    })
  }
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export review receipt' }).click()
  await downloadPromise
  session = recordAssistedOtherAction(session, {
    actionId: 'export-review-receipt',
    recordedAt: now(),
  })
  return completeTaxaLensAssistedTiming(session, now())
}

function now(): string {
  return new Date().toISOString()
}
