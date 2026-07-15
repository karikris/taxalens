import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Link } from 'react-aria-components'

import type { ReplayIdentity } from '../data/evidenceFacade'
import { GuidedTour } from './GuidedTour'
import { SHELL_VIEWS, shellViewFromHash, type ShellView } from './shellTypes'

interface GlobalError {
  readonly title: string
  readonly message: string
  readonly onRetry: () => void
}

interface AppShellProps {
  readonly replay: ReplayIdentity | undefined
  readonly globalError: GlobalError | undefined
  readonly onReset: () => void
  readonly renderView: (view: ShellView) => ReactNode
}

function compactSha(sha: string): string {
  return `${sha.slice(0, 8)}…${sha.slice(-6)}`
}

export function AppShell({ replay, globalError, onReset, renderView }: AppShellProps) {
  const [activeView, setActiveView] = useState<ShellView>(() =>
    shellViewFromHash(window.location.hash),
  )
  const mainRef = useRef<HTMLElement>(null)
  const [pendingTourTarget, setPendingTourTarget] = useState<string | null>(null)
  const [tourRevision, setTourRevision] = useState(0)

  useEffect(() => {
    function handleHashChange() {
      setActiveView(shellViewFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (pendingTourTarget === null || mainRef.current === null) {
      return
    }
    const main = mainRef.current
    const focusTarget = () => {
      const target = document.getElementById(pendingTourTarget)
      if (!(target instanceof HTMLElement)) {
        return false
      }
      target.focus()
      target.scrollIntoView?.({ block: 'start' })
      setPendingTourTarget(null)
      return true
    }
    if (focusTarget()) {
      return
    }
    const observer = new MutationObserver(() => {
      if (focusTarget()) {
        observer.disconnect()
      }
    })
    observer.observe(main, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      main.focus()
      setPendingTourTarget(null)
    }, 2_000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [activeView, pendingTourTarget])

  function visitView(view: ShellView, targetId?: string) {
    if (window.location.hash !== `#${view}`) {
      window.history.pushState(null, '', `#${view}`)
    }
    setActiveView(view)
    if (targetId === undefined) {
      window.requestAnimationFrame(() => mainRef.current?.focus())
    } else {
      setPendingTourTarget(targetId)
    }
  }

  function resetShell() {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
    setActiveView('mission')
    setPendingTourTarget(null)
    setTourRevision((value) => value + 1)
    onReset()
    window.requestAnimationFrame(() => mainRef.current?.focus())
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to current view
      </a>

      <header className="app-header">
        <div>
          <p className="eyebrow">Deterministic biodiversity evidence</p>
          <h1>TaxaLens Judge Replay</h1>
        </div>
        <div className="shell-header__actions">
          <span className="replay-indicator" data-mode="replay">
            Static replay · no live backend
          </span>
          <GuidedTour key={tourRevision} onVisit={visitView} />
          <Button className="shell-action" onPress={resetShell}>
            Reset replay
          </Button>
        </div>
      </header>

      <section className="shell-context" aria-label="Replay identity and lineage">
        <dl className="shell-context__facts">
          <div className="shell-context__target">
            <dt>Target identity</dt>
            <dd>
              {replay === undefined ? (
                'Awaiting verified bundle'
              ) : (
                <>
                  <i>{replay.target.scientificName}</i>
                  <small>{replay.target.acceptedTaxonKey}</small>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Demo bundle</dt>
            <dd title={replay?.bundleId}>{replay?.bundleId ?? 'Not loaded'}</dd>
          </div>
          <div>
            <dt>TaxaLens SHA</dt>
            <dd title={replay?.sourceRevisions.taxalensSha}>
              <code>
                {replay === undefined ? 'Not loaded' : compactSha(replay.sourceRevisions.taxalensSha)}
              </code>
            </dd>
          </div>
          <div>
            <dt>BioMiner SHA</dt>
            <dd title={replay?.sourceRevisions.biominerSha}>
              <code>
                {replay === undefined ? 'Not loaded' : compactSha(replay.sourceRevisions.biominerSha)}
              </code>
            </dd>
          </div>
        </dl>
      </section>

      <nav className="journey-nav" aria-label="Primary">
        {SHELL_VIEWS.map((view) => (
          <Link
            key={view.id}
            href={`#${view.id}`}
            aria-current={activeView === view.id ? 'page' : undefined}
            onPress={() => visitView(view.id)}
          >
            <span aria-hidden="true">{view.index}</span>
            {view.label}
          </Link>
        ))}
      </nav>

      {globalError !== undefined && (
        <section className="shell-global-error" role="alert" aria-labelledby="global-error-title">
          <div>
            <p className="tl-kicker">Global replay error</p>
            <h2 id="global-error-title">{globalError.title}</h2>
            <p>{globalError.message}</p>
          </div>
          <Button onPress={globalError.onRetry}>Retry local load</Button>
        </section>
      )}

      <main id="main-content" className="shell-main" tabIndex={-1} ref={mainRef}>
        {renderView(activeView)}
      </main>

      <footer>
        <p>Credential-free client replay. Scientific results remain artifact-bound.</p>
      </footer>
    </div>
  )
}
