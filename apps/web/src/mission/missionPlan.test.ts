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
    ).toHaveLength(10)
    expect(first.approvalRequirement).toMatchObject({
      required: true,
      status: 'not_approved',
      liveWorkApproved: false,
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
})
