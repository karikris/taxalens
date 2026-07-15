import { useEffect, useState } from 'react'
import { Button, Link } from 'react-aria-components'

import { DUCKDB_RUNTIME_MODE } from './data/duckdbRuntime'
import {
  loadReplayBootstrap,
  type ReplayBootstrap,
} from './data/replayBootstrap'
import { EvidenceState, EvidenceTier } from './design-system'

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly replay: ReplayBootstrap }
  | { readonly kind: 'error'; readonly message: string }

function compactSha(sha: string): string {
  return `${sha.slice(0, 8)}…${sha.slice(-6)}`
}

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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to evidence summary
      </a>

      <header className="app-header">
        <div>
          <p className="eyebrow">Deterministic biodiversity evidence</p>
          <h1>TaxaLens Judge Replay</h1>
        </div>
        <span className="replay-indicator">Static replay · no live backend</span>
      </header>

      <nav className="journey-nav" aria-label="Replay scaffold">
        <Link href="#mission">Mission</Link>
        <Link href="#verification">Verification</Link>
        <Link href="#runtime">Runtime</Link>
      </nav>

      <main id="main-content" tabIndex={-1}>
        {state.kind === 'loading' && (
          <section className="state-panel" aria-labelledby="loading-title">
            <p className="eyebrow">Local artifact loading</p>
            <h2 id="loading-title">Opening the verified judge bundle…</h2>
            <EvidenceState state="loading" title="Reading committed artifacts">
              No credential, model request, or remote scientific API is used.
            </EvidenceState>
          </section>
        )}

        {state.kind === 'error' && (
          <section className="state-panel state-panel--error" aria-labelledby="error-title">
            <p className="eyebrow">Replay unavailable</p>
            <h2 id="error-title">The static evidence bundle could not be opened</h2>
            <EvidenceState state="failure" title="Verification stopped">
              {state.message}
            </EvidenceState>
            <Button onPress={() => setAttempt((value) => value + 1)}>Retry local load</Button>
          </section>
        )}

        {state.kind === 'ready' && <ReplayReady replay={state.replay} />}
      </main>

      <footer>
        <p>Credential-free client replay. Scientific results remain artifact-bound.</p>
      </footer>
    </div>
  )
}

function ReplayReady({ replay }: { readonly replay: ReplayBootstrap }) {
  return (
    <>
      <section id="mission" className="mission-panel" aria-labelledby="target-title">
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

      <section id="verification" className="detail-panel" aria-labelledby="verification-title">
        <p className="eyebrow">Verified bootstrap</p>
        <h2 id="verification-title">Bundle identity</h2>
        <dl>
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
            <dd title={replay.sourceRevisions.taxalensSha}>
              <code>{compactSha(replay.sourceRevisions.taxalensSha)}</code>
            </dd>
          </div>
          <div>
            <dt>BioMiner SHA</dt>
            <dd title={replay.sourceRevisions.biominerSha}>
              <code>{compactSha(replay.sourceRevisions.biominerSha)}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section id="runtime" className="detail-panel" aria-labelledby="runtime-title">
        <p className="eyebrow">Client runtime</p>
        <h2 id="runtime-title">Static by construction</h2>
        <p>
          The replay starts from committed JSON. DuckDB-Wasm is {DUCKDB_RUNTIME_MODE.replaceAll(
            '-',
            ' ',
          )} and is not started by this shell.
        </p>
      </section>
    </>
  )
}
