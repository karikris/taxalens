import { useEffect, useState } from 'react'

import type { EvidenceFacade } from '../data/evidenceFacade'
import { AgentWorkspace } from './AgentWorkspace'
import type { PublicAgentTrace } from './agentTraceModel'
import { loadStoredAnalystReplay } from './storedAnalystReplay'

type StoredTraceState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly trace: PublicAgentTrace | undefined }
  | { readonly kind: 'error'; readonly message: string }

export function AgentReplayWorkspace({ facade }: { readonly facade: EvidenceFacade }) {
  const [state, setState] = useState<StoredTraceState>({ kind: 'loading' })

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

  if (state.kind === 'loading') {
    return <AgentWorkspace replay={facade.replay} traceState={{ kind: 'loading' }} />
  }
  if (state.kind === 'error') {
    return (
      <AgentWorkspace
        replay={facade.replay}
        traceState={{ kind: 'error', message: state.message }}
      />
    )
  }
  return state.trace === undefined ? (
    <AgentWorkspace replay={facade.replay} />
  ) : (
    <AgentWorkspace replay={facade.replay} trace={state.trace} />
  )
}
