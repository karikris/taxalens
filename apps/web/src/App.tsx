import { lazy, Suspense, useEffect, useState } from 'react'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type ReplayEvidence,
} from './data/evidenceFacade'
import { EvidenceState } from './design-system'
import { EvidenceLensWorkspace } from './evidence'
import type { ReplayLaunchReceipt } from './mission'
import { ObservatoryWorkspace } from './observatory'
import { AppShell, type ShellView } from './shell'

const MissionWorkspace = lazy(async () => {
  const module = await import('./mission')
  return { default: module.MissionWorkspace }
})

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly facade: EvidenceFacade }
  | { readonly kind: 'error'; readonly message: string }

export function App() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [replayLaunch, setReplayLaunch] = useState<ReplayLaunchReceipt | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    void loadEvidenceFacade(controller.signal)
      .then((facade) => {
        setState({ kind: 'ready', facade })
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        setState({
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The static replay bundle could not be loaded.',
        })
      })
    return () => {
      controller.abort()
    }
  }, [attempt])

  const resetReplay = () => {
    setReplayLaunch(null)
    setAttempt((value) => value + 1)
  }

  return (
    <AppShell
      replay={state.kind === 'ready' ? state.facade.replay : undefined}
      globalError={
        state.kind === 'error'
          ? {
              title: 'The static evidence bundle could not be opened',
              message: state.message,
              onRetry: resetReplay,
            }
          : undefined
      }
      onReset={resetReplay}
      renderView={(view) => (
        <ReplayContent
          state={state}
          view={view}
          replayLaunch={replayLaunch}
          onReplayLaunch={setReplayLaunch}
        />
      )}
    />
  )
}

function ReplayContent({
  onReplayLaunch,
  replayLaunch,
  state,
  view,
}: {
  readonly onReplayLaunch: (receipt: ReplayLaunchReceipt) => void
  readonly replayLaunch: ReplayLaunchReceipt | null
  readonly state: LoadState
  readonly view: ShellView
}) {
  if (state.kind === 'loading') {
    return (
      <section className="state-panel" aria-labelledby="loading-title">
        <p className="eyebrow">Local artifact loading</p>
        <h2 id="loading-title">Opening the verified judge bundle…</h2>
        <EvidenceState state="loading" title="Reading committed artifacts">
          No credential, model request, or remote scientific API is used.
        </EvidenceState>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className="state-panel state-panel--error" aria-labelledby="error-view-title">
        <p className="eyebrow">Replay unavailable</p>
        <h2 id="error-view-title">Scientific display is paused</h2>
        <p>The shell remains available, but no artifact value is displayed until verification passes.</p>
      </section>
    )
  }

  return (
    <ReplayView
      facade={state.facade}
      view={view}
      replayLaunch={replayLaunch}
      onReplayLaunch={onReplayLaunch}
    />
  )
}

function ReplayView({
  facade,
  onReplayLaunch,
  replayLaunch,
  view,
}: {
  readonly facade: EvidenceFacade
  readonly onReplayLaunch: (receipt: ReplayLaunchReceipt) => void
  readonly replayLaunch: ReplayLaunchReceipt | null
  readonly view: ShellView
}) {
  const replay = facade.replay
  switch (view) {
    case 'mission':
      return (
        <Suspense
          fallback={
            <EvidenceState state="loading" title="Opening mission controls">
              The verified evidence bundle is already loaded; only the local interface module is
              pending.
            </EvidenceState>
          }
        >
          <MissionWorkspace replay={replay} onReplayLaunch={onReplayLaunch} />
        </Suspense>
      )
    case 'observatory':
      return (
        <ObservatoryWorkspace facade={facade} replay={replay} replayLaunch={replayLaunch} />
      )
    case 'evidence-lens':
      return <EvidenceLensWorkspace facade={facade} replay={replay} />
    case 'dashboard':
      return <DashboardView replay={replay} />
  }
}

function DashboardView({ replay }: { readonly replay: ReplayEvidence }) {
  return (
    <section className="detail-panel" aria-labelledby="dashboard-title">
      <p className="eyebrow">Client runtime</p>
      <h2 id="dashboard-title">Verified local data boundary</h2>
      <p className="lede">
        Checksum-verified JSON opens the shell. Four pinned Parquet artifacts are available for an
        explicit, on-demand DuckDB-Wasm replay in the Observatory; no worker starts at bootstrap.
      </p>
      <EvidenceState state="available" title="Credential-free replay">
        This view uses only same-origin static assets and does not contact a live backend.
      </EvidenceState>
      <dl className="evidence-facts">
        <div>
          <dt>Data mode</dt>
          <dd>{replay.verification.dataMode.replaceAll('-', ' ')}</dd>
        </div>
        <div>
          <dt>Fallback reason</dt>
          <dd>{replay.verification.fallbackReason.replaceAll('_', ' ')}</dd>
        </div>
      </dl>
    </section>
  )
}
