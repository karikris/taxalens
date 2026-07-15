import { describe, expect, it } from 'vitest'

import {
  INITIAL_JUDGE_TOUR_STATE,
  JUDGE_TOUR_STEPS,
  judgeTourReducer,
} from './GuidedTour'

describe('90-second judge tour contract', () => {
  it('keeps the five required steps in order and budgets exactly 90 seconds', () => {
    expect(JUDGE_TOUR_STEPS.map(({ title }) => title)).toEqual([
      'Research Mission',
      'Observatory',
      'Evidence Lens',
      'Dashboard',
      'Export',
    ])
    expect(
      JUDGE_TOUR_STEPS.reduce((total, { suggestedSeconds }) => total + suggestedSeconds, 0),
    ).toBe(90)
    expect(JUDGE_TOUR_STEPS.at(-1)).toMatchObject({
      view: 'dashboard',
      targetId: 'research-outputs',
    })
  })

  it('applies bounded deterministic reset, skip, replay, visit, and finish transitions', () => {
    const started = judgeTourReducer(INITIAL_JUDGE_TOUR_STATE, { type: 'start' })
    const atSecond = judgeTourReducer(started, { type: 'next' })
    const reset = judgeTourReducer(atSecond, { type: 'reset' })
    const skipped = judgeTourReducer(reset, { type: 'skip' })
    const replayed = judgeTourReducer(skipped, { type: 'replay' })
    const cannotGoBeforeFirst = judgeTourReducer(replayed, { type: 'previous' })
    const paused = judgeTourReducer(cannotGoBeforeFirst, {
      type: 'visit',
      completesTour: false,
    })
    const resumed = judgeTourReducer(paused, { type: 'resume' })
    const finished = judgeTourReducer(resumed, { type: 'finish' })

    expect(atSecond.stepIndex).toBe(1)
    expect(reset).toEqual({ isOpen: true, stepIndex: 0, status: 'in_progress' })
    expect(skipped.status).toBe('skipped')
    expect(replayed).toEqual({ isOpen: true, stepIndex: 0, status: 'in_progress' })
    expect(cannotGoBeforeFirst.stepIndex).toBe(0)
    expect(paused).toEqual({ isOpen: false, stepIndex: 0, status: 'in_progress' })
    expect(resumed.isOpen).toBe(true)
    expect(finished).toEqual({
      isOpen: false,
      stepIndex: JUDGE_TOUR_STEPS.length - 1,
      status: 'completed',
    })
  })
})
