import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from '../review/domain'
import { HUMAN_REVIEW_ITEMS } from '../review/reviewPacket'
import { buildHumanVerificationEvidence } from './humanVerificationEvidence'

describe('human verification evidence', () => {
  it('projects current outcomes while retaining reviewer and event lineage', () => {
    const firstItem = HUMAN_REVIEW_ITEMS[0]!
    const secondItem = HUMAN_REVIEW_ITEMS[1]!
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: firstItem.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_200,
    })
    session = withReviewerId(session, 'reviewer-b')
    session = withDecision(session, {
      itemId: firstItem.itemId,
      outcome: 'no',
      comment: 'Corrected after a second local inspection.',
      reviewedAt: '2026-07-16T12:01:00.000Z',
      reviewDurationMs: 1_500,
    })
    session = withDecision(session, {
      itemId: secondItem.itemId,
      outcome: 'cant_view',
      comment: null,
      reviewedAt: '2026-07-16T12:02:00.000Z',
      reviewDurationMs: null,
    })

    const evidence = buildHumanVerificationEvidence(session.events)

    expect(evidence).toMatchObject({
      state: 'recorded',
      recordedItemCount: 2,
      totalItemCount: 3,
      totalEventCount: 3,
      reviewerCount: 2,
      decisiveConsensusCount: 0,
      unresolvedConsensusCount: 1,
      conflictStatus: 'unresolved',
      latestReviewedAt: '2026-07-16T12:02:00.000Z',
      scientificClaimAllowed: false,
    })
    expect(evidence.items[0]).toMatchObject({
      itemId: firstItem.itemId,
      outcome: 'no',
      consensusStatus: 'unresolved_disagreement',
      consensusOutcome: null,
      reviewerCount: 2,
      currentEventId: session.events[1]!.eventId,
      eventIds: [
        session.events[0]!.eventId,
        session.events[1]!.eventId,
      ],
    })
    expect(evidence.items[1]).toMatchObject({
      itemId: secondItem.itemId,
      outcome: 'cant_view',
      consensusStatus: 'media_failure',
      consensusOutcome: null,
      reviewerCount: 1,
    })
    expect(evidence.eventIds).toEqual(
      session.events.map(({ eventId }) => eventId),
    )
  })

  it('reports an empty projection without claiming zero conflicts', () => {
    const evidence = buildHumanVerificationEvidence([])

    expect(evidence.state).toBe('empty')
    expect(evidence.recordedItemCount).toBe(0)
    expect(evidence.reviewerCount).toBe(0)
    expect(evidence.decisiveConsensusCount).toBe(0)
    expect(evidence.conflictStatus).toBe('none')
    expect(evidence.qualityContribution).toMatchObject({
      status: 'workflow_only',
      eligibleWeightedAuditOutcomeCount: 0,
    })
    expect(evidence.referenceReviewState).toMatchObject({
      status: 'blocked',
      independentlyReviewedItemCount: 0,
      campaignItemCount: 24,
      providerRoleSuitableRecordCount: 81,
    })
  })

  it('pins the blocked reference state to the imported BioMiner evidence boundary', () => {
    const referenceCampaign = readJson<{
      readonly items: readonly unknown[]
    }>(
      'demo/source/verification/papilio-demoleus-reference-audit.campaign.json',
    )
    const providerVerification = readJson<{
      readonly records_meeting_goal_count: number
      readonly semantics: {
        readonly independent_human_taxonomic_verification_claimed: boolean
      }
    }>(
      'demo/source/biominer_phase15/artifacts/manifests/pilot_provider_support_goal_verification.json',
    )
    const state = buildHumanVerificationEvidence([]).referenceReviewState

    expect(state.campaignItemCount).toBe(referenceCampaign.items.length)
    expect(state.providerRoleSuitableRecordCount).toBe(
      providerVerification.records_meeting_goal_count,
    )
    expect(
      providerVerification.semantics
        .independent_human_taxonomic_verification_claimed,
    ).toBe(false)
    expect(state.independentlyReviewedItemCount).toBe(0)
  })
})

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '..', '..', relativePath), 'utf8'),
  ) as T
}
