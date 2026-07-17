import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import {
  createMissionDraft,
  EVIDENCE_PLAN_VERSION,
  generateEvidencePlan,
  MissionPlanValidationError,
  type MissionDraft,
} from './missionPlan'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

afterEach(() => vi.restoreAllMocks())

describe('generateEvidencePlan', () => {
  it('produces an identical frozen structured plan without network or model access', () => {
    const draft = createMissionDraft(replay)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'))
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const first = generateEvidencePlan(draft, replay)
    const second = generateEvidencePlan({ ...draft }, replay)

    expect(first).toEqual(second)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()
    expect(first.planVersion).toBe(EVIDENCE_PLAN_VERSION)
    expect(first.sourceRegistry).toEqual({
      name: 'BioMiner butterflies registry',
      version: 'butterflies-v2-20260712',
      sourceSnapshotVersion: 'gbif-reference-search-20260715',
      acceptedIdentityNamespace: 'gbif',
    })
    expect(first.target).toEqual({
      scientificName: 'Papilio demoleus',
      acceptedTaxonKey: 'gbif:1938069',
    })
    expect(first.region).toMatchObject({
      selection: 'global',
      regionCount: 8,
      countryCount: 40,
      evidenceQualifier: 'planning_hypothesis',
    })
    expect(first.queryStrategy).toMatchObject({
      committedDefinitionCount: 22,
      registryLinkedSpeciesCount: 22,
      targetAlwaysScoreable: true,
      scoreAllEligibleCandidates: true,
      eligibleCandidateCount: 5,
      geographyEvidenceMode: 'soft_structured_evidence',
      missingGeographyMeans: 'unknown',
    })
    expect(first.expectedStages).toHaveLength(8)
    expect(first.expectedStages.map((stage) => stage.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(first.unavailableStages.map((stage) => stage.stageId)).toEqual([
      'licensed-media-selection',
      'yoloe-detection',
      'full-frame-transformation',
      'target-aware-scoring',
    ])
    expect(first.artifactExpectations).toHaveLength(25)
    expect(
      first.artifactExpectations.filter(
        (expectation) => expectation.purpose === 'future_evidence_required',
      ),
    ).toHaveLength(8)
    expect(first.approvalRequirement).toMatchObject({
      required: true,
      status: 'not_approved',
      liveWorkApproved: false,
    })
    expect(first.verificationWork).toEqual({
      reviewBudget: 80,
      auditSampleSize: 40,
      auditCampaignPopulationSize: 49,
      independentReviewerCount: 2,
      plannedReviewAssignments: 80,
      unallocatedReviewBudget: 0,
      qualityPrecisionObjective: {
        metric: '95_percent_wilson_half_width',
        maximumHalfWidth: 0.2,
        requestedPercent: 20,
        approximateMinimumDecisiveOutcomes: 25,
        auditSampleSatisfiesApproximation: true,
        currentDecisiveWeightedOutcomeCount: 0,
        intervalAvailability: 'unavailable',
      },
      referenceReview: {
        requirement: 'human_review_before_support_use',
        campaignItemCount: 24,
        requiredIndependentReviewers: 2,
        currentIndependentOutcomeCount: 0,
        providerRoleSuitableRecordCount: 81,
        status: 'blocked',
      },
    })
    expect(first.execution).toEqual({
      requestedMode: 'replay',
      capability: 'plan_only',
      launchesWork: false,
      usesOpenAI: false,
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.expectedStages)).toBe(true)
    expect(Object.isFrozen(first.expectedStages[0])).toBe(true)
  })

  it('selects a declared region without promoting it beyond a planning hypothesis', () => {
    const plan = generateEvidencePlan(
      { ...createMissionDraft(replay), region: 'Caribbean introduced range' },
      replay,
    )

    expect(plan.region).toEqual({
      selection: 'Caribbean introduced range',
      regionCount: 1,
      countryCount: 5,
      rangeStatus: 'introduced_established',
      requiresOccurrenceSupport: true,
      taxonomicCaution: false,
      evidenceQualifier: 'planning_hypothesis',
    })
  })

  it('collects every deterministic validation failure before refusing a plan', () => {
    const invalid = {
      ...createMissionDraft(replay),
      targetSpecies: 'Papilio polytes',
      region: 'Atlantis',
      maximumApiCalls: 12,
      candidateLimit: 4,
      mode: 'live',
      device: 'x'.repeat(121),
    } as MissionDraft

    try {
      generateEvidencePlan(invalid, replay)
      throw new Error('Expected plan validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(MissionPlanValidationError)
      expect((error as MissionPlanValidationError).issues.map((issue) => issue.code)).toEqual([
        'target_not_verified',
        'region_unknown',
        'api_budget_below_replay',
        'candidate_budget_incomplete',
        'live_mode_unavailable',
        'device_annotation_too_long',
      ])
    }
  })

  it('rejects review capacity that cannot meet its sample and precision objective', () => {
    const invalid = {
      ...createMissionDraft(replay),
      reviewBudget: 20,
      auditSampleSize: 20,
      independentReviewerCount: 2,
      qualityPrecisionObjectivePercent: 15,
    }

    expect(() => generateEvidencePlan(invalid, replay)).toThrow(
      MissionPlanValidationError,
    )
    try {
      generateEvidencePlan(invalid, replay)
    } catch (error) {
      expect(
        (error as MissionPlanValidationError).issues.map(
          ({ code }) => code,
        ),
      ).toEqual([
        'audit_sample_precision_insufficient',
        'review_budget_insufficient',
      ])
    }
  })

  it('pins verification planning bounds to the committed campaign and BioMiner import', () => {
    const flickr = readJson<{ readonly items: readonly unknown[] }>(
      'demo/source/verification/papilio-demoleus-flickr-audit.campaign.json',
    )
    const reference = readJson<{ readonly items: readonly unknown[] }>(
      'demo/source/verification/papilio-demoleus-reference-audit.campaign.json',
    )
    const provider = readJson<{
      readonly records_meeting_goal_count: number
      readonly semantics: {
        readonly independent_human_taxonomic_verification_claimed: boolean
      }
    }>(
      'demo/source/biominer_phase15/artifacts/manifests/pilot_provider_support_goal_verification.json',
    )
    const work = generateEvidencePlan(
      createMissionDraft(replay),
      replay,
    ).verificationWork

    expect(work.auditCampaignPopulationSize).toBe(flickr.items.length)
    expect(work.referenceReview.campaignItemCount).toBe(
      reference.items.length,
    )
    expect(work.referenceReview.providerRoleSuitableRecordCount).toBe(
      provider.records_meeting_goal_count,
    )
    expect(
      provider.semantics.independent_human_taxonomic_verification_claimed,
    ).toBe(false)
    expect(work.referenceReview.currentIndependentOutcomeCount).toBe(0)
  })
})

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '..', '..', relativePath), 'utf8'),
  ) as T
}
