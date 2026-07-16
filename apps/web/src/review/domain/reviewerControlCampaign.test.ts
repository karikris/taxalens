import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { VerificationConsensus } from './verificationConsensus'
import type {
  VerificationCampaign,
  VerificationItem,
} from './verificationContracts'
import {
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
} from './verificationContracts'
import {
  evaluateReviewerControlPerformance,
  type ReviewerControlSet,
} from './reviewerReliability'

interface ControlArtifact {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly controlSet: ReviewerControlSet
  readonly controlScenarios: readonly {
    readonly scenarioId: string
    readonly itemId: string
    readonly scoredByReviewerControlMetrics: boolean
    readonly expectedOutcome: string | null
    readonly prepopulatedEventIds: readonly string[]
  }[]
  readonly semantics: {
    readonly humanReviewEventsPrepopulated: boolean
    readonly scientificClaimAllowed: boolean
  }
}

const artifact = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../demo/source/verification/' +
        'papilio-demoleus-reviewer-controls.campaign.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as ControlArtifact

describe('committed reviewer control campaign', () => {
  it('validates every campaign and item invariant in TypeScript', () => {
    expect(validateReviewRequirement(artifact.campaign.reviewRequirement)).toEqual(
      [],
    )
    expect(validateSamplingPlan(artifact.campaign.samplingPlan)).toEqual([])
    for (const item of artifact.items) {
      expect(validateVerificationItem(item, artifact.campaign)).toEqual([])
    }
  })

  it('binds the exact scored truth and excludes unscored exercises', () => {
    expect(artifact.controlSet.groundTruthSha256).toBe(
      canonicalFingerprint(artifact.controlSet.controls),
    )
    expect(
      artifact.controlScenarios
        .filter(({ scoredByReviewerControlMetrics }) =>
          Boolean(scoredByReviewerControlMetrics),
        )
        .map(({ itemId }) => itemId),
    ).toEqual(
      artifact.controlSet.controls.map(({ itemId }) => itemId),
    )
    expect(
      artifact.controlScenarios
        .filter(({ scoredByReviewerControlMetrics }) =>
          !scoredByReviewerControlMetrics,
        )
        .map(({ scenarioId }) => scenarioId),
    ).toEqual(['ambiguous', 'duplicate', 'adjudication_example'])
  })

  it('is metric-compatible but contains no fabricated reviewer attempt', () => {
    const emptyConsensus = artifact.controlSet.controls.map(
      ({ itemId }): VerificationConsensus => ({
        schemaVersion: 'taxalens-verification-consensus:v1.0.0',
        campaignId: artifact.campaign.campaignId,
        itemId,
        requiredReviewCount:
          artifact.campaign.reviewRequirement.requiredIndependentReviewers,
        effectiveReviewCount: 0,
        decisiveReviewCount: 0,
        effectiveReviewerIds: [],
        latestEvents: [],
        decisiveEvents: [],
        status: 'pending',
        consensusOutcome: null,
        resolvedSignature: null,
        conflictingFields: [],
        conflictEventIds: [],
        secondReviewRequired: false,
        adjudicationRequired: false,
        supportEligibility: 'not_applicable',
        supportEligibilityBlockers: [],
        finalTestEligibility: 'not_applicable',
        finalTestEligibilityBlockers: [],
        resolvedAt: null,
      }),
    )
    expect(
      evaluateReviewerControlPerformance(
        artifact.campaign,
        emptyConsensus,
        artifact.controlSet,
      ),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: ['control_attempts_empty'],
      controlAttemptCount: 0,
      correctControlAttemptCount: 0,
      incorrectControlAttemptCount: 0,
      controlAccuracy: null,
    })
    expect(
      artifact.controlScenarios.every(
        ({ prepopulatedEventIds }) => prepopulatedEventIds.length === 0,
      ),
    ).toBe(true)
    expect(artifact.semantics).toMatchObject({
      humanReviewEventsPrepopulated: false,
      scientificClaimAllowed: false,
    })
  })
})

function canonicalFingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
      )
      .join(',')}}`
  }
  return JSON.stringify(value)
}
