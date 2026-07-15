import { useEffect, useState } from 'react'

import { DUCKDB_RUNTIME_MODE } from './data/duckdbRuntime'
import {
  loadReplayBootstrap,
  type ReplayBootstrap,
} from './data/replayBootstrap'
import { EvidenceDesignation, EvidenceState, EvidenceTier } from './design-system'
import { AppShell, type ShellView } from './shell'

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly replay: ReplayBootstrap }
  | { readonly kind: 'error'; readonly message: string }

export function App() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    void loadReplayBootstrap(controller.signal)
      .then((replay) => {
        setState({ kind: 'ready', replay })
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

  const retry = () => setAttempt((value) => value + 1)

  return (
    <AppShell
      replay={state.kind === 'ready' ? state.replay : undefined}
      globalError={
        state.kind === 'error'
          ? {
              title: 'The static evidence bundle could not be opened',
              message: state.message,
              onRetry: retry,
            }
          : undefined
      }
      onReset={retry}
      renderView={(view) => <ReplayContent state={state} view={view} />}
    />
  )
}

function ReplayContent({ state, view }: { readonly state: LoadState; readonly view: ShellView }) {
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

  return <ReplayView replay={state.replay} view={view} />
}

function ReplayView({ replay, view }: { readonly replay: ReplayBootstrap; readonly view: ShellView }) {
  switch (view) {
    case 'mission':
      return <MissionView replay={replay} />
    case 'observatory':
      return <ObservatoryView replay={replay} />
    case 'evidence-lens':
      return <EvidenceLensView replay={replay} />
    case 'dashboard':
      return <DashboardView />
  }
}

function MissionView({ replay }: { readonly replay: ReplayBootstrap }) {
  return (
    <section className="mission-panel" aria-labelledby="target-title">
      <div>
        <EvidenceTier tier="metadata" />
        <p className="eyebrow mission-panel__kicker">Research target</p>
        <h2 id="target-title">
          <i>{replay.target.scientificName}</i>
        </h2>
        <p className="lede">
          The target identifies the pilot mission. It is not a classification of an image.
        </p>
      </div>
      <EvidenceState state="review" title="Awaiting human review" compact />
    </section>
  )
}

function ObservatoryView({ replay }: { readonly replay: ReplayBootstrap }) {
  return (
    <section className="detail-panel" aria-labelledby="observatory-title">
      <p className="eyebrow">Verified observatory</p>
      <h2 id="observatory-title">Bundle identity</h2>
      <p className="lede">
        These values come from the exact static manifest loaded by the shell.
      </p>
      <dl className="evidence-facts">
        <div>
          <dt>Bundle</dt>
          <dd>{replay.bundleId}</dd>
        </div>
        <div>
          <dt>Artifacts</dt>
          <dd>{replay.artifactCount}</dd>
        </div>
        <div>
          <dt>Unavailable sections</dt>
          <dd>{replay.unavailableSectionCount}</dd>
        </div>
        <div>
          <dt>Rights</dt>
          <dd>{replay.rightsStatus.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>TaxaLens SHA</dt>
          <dd>
            <code>{replay.sourceRevisions.taxalensSha}</code>
          </dd>
        </div>
        <div>
          <dt>BioMiner SHA</dt>
          <dd>
            <code>{replay.sourceRevisions.biominerSha}</code>
          </dd>
        </div>
      </dl>
    </section>
  )
}

function EvidenceLensView({ replay }: { readonly replay: ReplayBootstrap }) {
  return (
    <section className="detail-panel" aria-labelledby="evidence-title">
      <p className="eyebrow">Evidence boundary</p>
      <h2 id="evidence-title">No scientific result is promoted</h2>
      <EvidenceState state="review" title="Human decision required">
        The hero remains {replay.heroState.replaceAll('_', ' ')} and scientific claims are not allowed.
      </EvidenceState>
      <div className="evidence-boundary">
        <EvidenceDesignation kind="candidate" />
        <EvidenceTier tier="unavailable" />
      </div>
      <dl className="evidence-facts">
        <div>
          <dt>Hero record</dt>
          <dd>{replay.heroRecordId}</dd>
        </div>
        <div>
          <dt>Scientific claim</dt>
          <dd>{replay.scientificClaimAllowed ? 'Allowed' : 'Not allowed'}</dd>
        </div>
        <div>
          <dt>Unavailable sections</dt>
          <dd>{replay.unavailableSectionCount}</dd>
        </div>
      </dl>
    </section>
  )
}

function DashboardView() {
  return (
    <section className="detail-panel" aria-labelledby="dashboard-title">
      <p className="eyebrow">Client runtime</p>
      <h2 id="dashboard-title">Static by construction</h2>
      <p className="lede">
        The replay starts from committed JSON. DuckDB-Wasm is{' '}
        {DUCKDB_RUNTIME_MODE.replaceAll('-', ' ')} and is not started by this shell.
      </p>
      <EvidenceState state="available" title="Credential-free replay">
        This view uses only same-origin static assets and does not contact a live backend.
      </EvidenceState>
    </section>
  )
}
