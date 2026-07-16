import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VERIFICATION_REVIEW_MILESTONES,
  VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
  defineVerificationReviewMilestonePlan,
  evaluateVerificationReviewMilestone,
  type VerificationReviewMilestonePlan,
} from '.'

describe('verification review milestones', () => {
  it('uses the declared 20, 40, 60, and 100 review schedule', () => {
    const plan = defaultPlan()

    expect(plan.milestones).toEqual([20, 40, 60, 100])
    expect(evaluateVerificationReviewMilestone(plan, 20, [])).toEqual({
      schemaVersion: VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
      milestonePlanId: 'flickr-final-test-milestones-v1',
      decisiveSampleCount: 20,
      status: 'evaluation_due',
      releaseEvaluationAllowed: true,
      currentMilestone: 20,
      nextMilestone: 40,
      evaluatedMilestones: [],
      missedMilestones: [],
    })
  })

  it('blocks continuous peeking and missed-milestone backfilling', () => {
    const plan = defaultPlan()

    for (const sampleCount of [1, 19, 21, 39, 41, 59, 61, 99]) {
      expect(
        evaluateVerificationReviewMilestone(plan, sampleCount, []),
      ).toMatchObject({
        status: 'not_due',
        releaseEvaluationAllowed: false,
        currentMilestone: null,
      })
    }
    expect(
      evaluateVerificationReviewMilestone(plan, 21, []),
    ).toMatchObject({
      nextMilestone: 40,
      missedMilestones: [20],
    })
  })

  it('allows each milestone once and closes the declared schedule', () => {
    const plan = defaultPlan()

    expect(
      evaluateVerificationReviewMilestone(plan, 20, [20]),
    ).toMatchObject({
      status: 'already_evaluated',
      releaseEvaluationAllowed: false,
      currentMilestone: 20,
      nextMilestone: 40,
    })
    expect(
      evaluateVerificationReviewMilestone(plan, 100, [20, 40, 60]),
    ).toMatchObject({
      status: 'evaluation_due',
      releaseEvaluationAllowed: true,
      currentMilestone: 100,
      nextMilestone: null,
    })
    expect(
      evaluateVerificationReviewMilestone(
        plan,
        101,
        [20, 40, 60, 100],
      ),
    ).toMatchObject({
      status: 'schedule_complete',
      releaseEvaluationAllowed: false,
      currentMilestone: null,
      nextMilestone: null,
    })
  })

  it('rejects malformed plans and impossible evaluation history', () => {
    expect(() =>
      defineVerificationReviewMilestonePlan({
        ...defaultPlan(),
        milestones: [20, 20, 10],
      }),
    ).toThrow('Verification review milestone plan is invalid')
    expect(() =>
      evaluateVerificationReviewMilestone(defaultPlan(), 20, [40]),
    ).toThrow('Verification review milestone state is invalid')
  })
})

function defaultPlan(): VerificationReviewMilestonePlan {
  return defineVerificationReviewMilestonePlan({
    schemaVersion: VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
    milestonePlanId: 'flickr-final-test-milestones-v1',
    milestones: DEFAULT_VERIFICATION_REVIEW_MILESTONES,
  })
}
