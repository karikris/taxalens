import { useEffect, useState } from 'react'

import type { EvidenceFacade } from '../data/evidenceFacade'
import { AgentWorkspace } from './AgentWorkspace'
import {
  VerificationRecommendationPanel,
  type VerificationRecommendationState,
} from './VerificationRecommendationPanel'
import type { PublicAgentTrace } from './agentTraceModel'
import { loadStoredAnalystReplay } from './storedAnalystReplay'
import { loadStoredVerificationAnalystReplay } from './storedVerificationAnalystReplay'
import { createVerificationAgentEvidenceFixture } from './verificationAgentEvidenceFixture'

type StoredTraceState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly trace: PublicAgentTrace | undefined }
  | { readonly kind: 'error'; readonly message: string }

export function AgentReplayWorkspace({ facade }: { readonly facade: EvidenceFacade }) {
  const [state, setState] = useState<StoredTraceState>({ kind: 'loading' })
  const [verificationState, setVerificationState] =
    useState<VerificationRecommendationState>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    void loadStoredAnalystReplay(facade)
      .then((trace) => {
        if (active) {
          setState({ kind: 'ready', trace })
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setState({
            kind: 'error',
            message:
              reason instanceof Error
                ? reason.message
                : 'The stored analyst trace could not be validated.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [facade])

  useEffect(() => {
    let active = true
    setVerificationState({ kind: 'loading' })
    void createVerificationAgentEvidenceFixture()
      .then(({ evidence }) => loadStoredVerificationAnalystReplay(evidence))
      .then((run) => {
        if (active) {
          setVerificationState({ kind: 'ready', run })
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setVerificationState({
            kind: 'error',
            message:
              reason instanceof Error
                ? reason.message
                : 'The stored verification recommendation could not be validated.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  const workspace =
    state.kind === 'loading' ? (
      <AgentWorkspace replay={facade.replay} traceState={{ kind: 'loading' }} />
    ) : state.kind === 'error' ? (
      <AgentWorkspace
        replay={facade.replay}
        traceState={{ kind: 'error', message: state.message }}
      />
    ) : state.trace === undefined ? (
      <AgentWorkspace replay={facade.replay} />
    ) : (
      <AgentWorkspace replay={facade.replay} trace={state.trace} />
    )

  return (
    <div className="agent-replay-workspaces">
      {workspace}
      <VerificationRecommendationPanel state={verificationState} />
    </div>
  )
}
