import { describe, expect, it } from 'vitest'

import {
  INITIAL_VERIFICATION_WORKFLOW_STATE,
  verificationWorkflowAllowsReview,
  verificationWorkflowReducer,
} from './verificationWorkflow'

describe('verification workflow reducer', () => {
  it('models loading, media preparation, recording, save, and completion', () => {
    let state = INITIAL_VERIFICATION_WORKFLOW_STATE
    state = verificationWorkflowReducer(state, {
      type: 'campaign_ready',
      complete: false,
    })
    expect(state).toEqual({ phase: 'ready', error: null })
    expect(verificationWorkflowAllowsReview(state)).toBe(true)

    state = verificationWorkflowReducer(state, { type: 'prepare_media' })
    expect(state.phase).toBe('preparing_media')
    expect(verificationWorkflowAllowsReview(state)).toBe(false)

    state = verificationWorkflowReducer(state, { type: 'media_ready' })
    state = verificationWorkflowReducer(state, { type: 'record' })
    expect(state.phase).toBe('recording')

    state = verificationWorkflowReducer(state, {
      type: 'saved',
      complete: false,
    })
    expect(state.phase).toBe('saved')
    state = verificationWorkflowReducer(state, { type: 'record' })
    state = verificationWorkflowReducer(state, {
      type: 'saved',
      complete: true,
    })
    expect(state.phase).toBe('complete')
    expect(verificationWorkflowAllowsReview(state)).toBe(true)
  })

  it('represents conflict, failure recovery, and clear explicitly', () => {
    let state = verificationWorkflowReducer(
      INITIAL_VERIFICATION_WORKFLOW_STATE,
      { type: 'conflict' },
    )
    expect(state.phase).toBe('conflict')
    expect(verificationWorkflowAllowsReview(state)).toBe(true)

    state = verificationWorkflowReducer(state, {
      type: 'fail',
      error: 'IndexedDB transaction failed',
    })
    expect(state).toEqual({
      phase: 'error',
      error: 'IndexedDB transaction failed',
    })
    expect(verificationWorkflowAllowsReview(state)).toBe(false)

    state = verificationWorkflowReducer(state, { type: 'load_campaign' })
    expect(state.phase).toBe('loading_campaign')
    state = verificationWorkflowReducer(state, { type: 'clear' })
    expect(state).toEqual({ phase: 'ready', error: null })
  })
})
