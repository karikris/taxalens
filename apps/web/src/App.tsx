import { lazy, Suspense, useEffect, useState } from 'react'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type ReplayEvidence,
} from './data/evidenceFacade'
import { EvidenceDesignation, EvidenceState, EvidenceTier } from './design-system'
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

  const retry = () => setAttempt((value) => value + 1)

  return (
    <AppShell
      replay={state.kind === 'ready' ? state.facade.replay : undefined}
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

  return <ReplayView replay={state.facade.replay} view={view} />
}

function ReplayView({ replay, view }: { readonly replay: ReplayEvidence; readonly view: ShellView }) {
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
          <MissionWorkspace evidence={replay.mission} target={replay.target} />
        </Suspense>
      )
    case 'observatory':
      return <ObservatoryView replay={replay} />
    case 'evidence-lens':
      return <EvidenceLensView replay={replay} />
    case 'dashboard':
      return <DashboardView replay={replay} />
  }
}

function ObservatoryView({ replay }: { readonly replay: ReplayEvidence }) {
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
          <dt>Artifact checksums</dt>
          <dd>
            {replay.verifiedArtifactCount} / {replay.artifactCount} verified
          </dd>
        </div>
        <div>
          <dt>Bundle roots</dt>
          <dd>
            {replay.verification.inventoryChecksumVerified &&
            replay.verification.payloadRootChecksumVerified
              ? 'Inventory and payload verified'
              : 'Verification unavailable'}
          </dd>
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

function EvidenceLensView({ replay }: { readonly replay: ReplayEvidence }) {
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
      <h3>Explicitly unavailable evidence</h3>
      <ul className="unavailable-evidence-list">
        {replay.unavailableSections.map((section) => (
          <li key={section.name}>
            <strong>{section.name.replaceAll('_', ' ')}</strong>
            <span>{section.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DashboardView({ replay }: { readonly replay: ReplayEvidence }) {
  return (
    <section className="detail-panel" aria-labelledby="dashboard-title">
      <p className="eyebrow">Client runtime</p>
      <h2 id="dashboard-title">Verified JSON fallback</h2>
      <p className="lede">
        Parquet is unavailable in this bundle, so the facade deterministically uses checksum-verified
        JSON. DuckDB-Wasm was not started.
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
