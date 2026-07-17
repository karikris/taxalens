import { beforeAll, describe, expect, it } from 'vitest'

import { buildReviewedEvaluationModel } from '../dashboard/reviewedEvaluationModel'
import { prepareResearchOutputs } from '../dashboard/researchOutputs'
import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  calculateVerificationCoverage,
  estimateSimpleRandomTargetPrecision,
  projectVerificationConsensus,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
} from '../review/domain'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'
import { createCommittedFixtureFetcher } from '../test/fixtures'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('release scientific review semantics', () => {
  it('counts Skip as deferred work and never as a decisive review', () => {
    const item = requiredItem()
    const consensus = projectVerificationConsensus(
      HUMAN_REVIEW_CAMPAIGN,
      HUMAN_REVIEW_ITEMS,
      [reviewEvent(item, 'skipped')],
    )
    const coverage = calculateVerificationCoverage(
      HUMAN_REVIEW_ITEMS,
      consensus,
      {},
    )

    expect(consensus.find(({ itemId }) => itemId === item.itemId)).toMatchObject({
      status: 'deferred',
      consensusOutcome: null,
      effectiveReviewCount: 1,
      decisiveReviewCount: 0,
    })
    expect(coverage).toMatchObject({
      attemptedItems: 1,
      decisivelyReviewedItems: 0,
      deferredItems: 1,
      pendingItems: 2,
      decisiveReviewCount: 0,
      skippedReviewCount: 1,
    })
  })

  it('blocks unweighted quality estimation for a targeted failure-discovery queue', () => {
    const item = requiredItem()
    const consensus = projectVerificationConsensus(
      HUMAN_REVIEW_CAMPAIGN,
      HUMAN_REVIEW_ITEMS,
      [reviewEvent(item, 'yes')],
    )
    const failureDiscoveryCampaign: VerificationCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      samplingPlan: {
        ...HUMAN_REVIEW_CAMPAIGN.samplingPlan,
        purpose: 'failure_discovery',
        design: 'targeted_priority',
        representative: false,
        inclusionProbabilityRequired: false,
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'Targeted failure discovery has unknown inclusion probabilities.',
      },
    }

    const estimate = estimateSimpleRandomTargetPrecision(
      failureDiscoveryCampaign,
      HUMAN_REVIEW_ITEMS,
      consensus,
    )

    expect(estimate).toMatchObject({
      availability: 'unavailable',
      estimate: null,
      interval: null,
    })
    expect(estimate.blockers).toEqual(
      expect.arrayContaining([
        'sampling_purpose_not_quality_estimation',
        'quality_estimation_not_allowed',
        'sampling_plan_not_representative',
        'sampling_design_not_simple_random',
      ]),
    )
  })

  it('keeps unavailable metrics non-numeric and reference decisions out of final evaluation', async () => {
    const baseline = buildReviewedEvaluationModel(replay)
    const withOutOfBoundaryReferenceDecision = {
      ...replay,
      referenceDecisionLedger: [
        {
          itemId: 'reference-request:synthetic-release-test',
          outcome: 'yes',
          reviewerId: 'release-test-reviewer',
        },
      ],
    } as ReplayEvidence & {
      readonly referenceDecisionLedger: readonly {
        readonly itemId: string
        readonly outcome: 'yes'
        readonly reviewerId: string
      }[]
    }

    expect(baseline.metrics).toHaveLength(7)
    expect(
      baseline.metrics.every(
        ({ status, value }) =>
          status === 'unavailable' && value === 'Unavailable',
      ),
    ).toBe(true)
    expect(
      baseline.metrics.some(({ value }) => typeof value === 'number'),
    ).toBe(false)
    expect(buildReviewedEvaluationModel(withOutOfBoundaryReferenceDecision)).toEqual(
      baseline,
    )

    const [baselineExport, injectedExport] = await Promise.all([
      prepareResearchOutputs(replay),
      prepareResearchOutputs(withOutOfBoundaryReferenceDecision),
    ])
    expect(
      injectedExport.files.find(({ role }) => role === 'evaluation_report')
        ?.sha256,
    ).toBe(
      baselineExport.files.find(({ role }) => role === 'evaluation_report')
        ?.sha256,
    )
  })
})

function requiredItem(): VerificationItem {
  const item = HUMAN_REVIEW_ITEMS[0]
  if (item === undefined) {
    throw new Error('Release semantics require the committed review fixture.')
  }
  return item
}

function reviewEvent(
  item: VerificationItem,
  outcome: 'yes' | 'skipped',
): VerificationEvent {
  const scientific = outcome === 'yes'
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: `release-semantics-${outcome}`,
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    itemId: item.itemId,
    reviewerId: 'release-test-reviewer',
    reviewRound: 1,
    outcome,
    comment: null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: scientific ? 'high' : 'unknown',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: scientific ? 'high' : 'unknown',
    reviewedAt: '2026-07-17T01:00:00.000Z',
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}
