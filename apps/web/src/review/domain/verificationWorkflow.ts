export type VerificationWorkflowPhase =
  | 'loading_campaign'
  | 'preparing_media'
  | 'ready'
  | 'recording'
  | 'saved'
  | 'conflict'
  | 'error'
  | 'complete'

export interface VerificationWorkflowState {
  readonly phase: VerificationWorkflowPhase
  readonly error: string | null
}

export type VerificationWorkflowAction =
  | { readonly type: 'load_campaign' }
  | { readonly type: 'campaign_ready'; readonly complete: boolean }
  | { readonly type: 'prepare_media' }
  | { readonly type: 'media_ready' }
  | { readonly type: 'record' }
  | { readonly type: 'saved'; readonly complete: boolean }
  | { readonly type: 'conflict' }
  | { readonly type: 'fail'; readonly error: string }
  | { readonly type: 'clear' }

export const INITIAL_VERIFICATION_WORKFLOW_STATE: VerificationWorkflowState =
  Object.freeze({
    phase: 'loading_campaign',
    error: null,
  })

export function verificationWorkflowReducer(
  _state: VerificationWorkflowState,
  action: VerificationWorkflowAction,
): VerificationWorkflowState {
  switch (action.type) {
    case 'load_campaign':
      return workflowState('loading_campaign')
    case 'campaign_ready':
      return workflowState(action.complete ? 'complete' : 'ready')
    case 'prepare_media':
      return workflowState('preparing_media')
    case 'media_ready':
      return workflowState('ready')
    case 'record':
      return workflowState('recording')
    case 'saved':
      return workflowState(action.complete ? 'complete' : 'saved')
    case 'conflict':
      return workflowState('conflict')
    case 'fail':
      return workflowState('error', action.error)
    case 'clear':
      return workflowState('ready')
  }
}

export function verificationWorkflowAllowsReview(
  state: VerificationWorkflowState,
): boolean {
  return (
    state.phase === 'ready' ||
    state.phase === 'saved' ||
    state.phase === 'conflict' ||
    state.phase === 'complete'
  )
}

function workflowState(
  phase: VerificationWorkflowPhase,
  error: string | null = null,
): VerificationWorkflowState {
  return Object.freeze({ phase, error })
}
