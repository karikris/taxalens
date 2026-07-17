import { EvidenceState } from '../design-system'
import type { StoredGeographicAnalystReplay } from './storedGeographicAnalystReplay'

export type GeographicAnalystReplayState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly replay: StoredGeographicAnalystReplay }
  | { readonly kind: 'error'; readonly message: string }

export function GeographicAnalystReplayPanel({ state }: { readonly state: GeographicAnalystReplayState }) {
  return (
    <section className="detail-panel" aria-labelledby="geographic-analyst-replay-title">
      <p className="eyebrow">Geographic Impact · credential-free stored replay</p>
      <h2 id="geographic-analyst-replay-title">GPT-5.6 geographic analyst</h2>
      {state.kind === 'loading' ? (
        <EvidenceState state="loading" title="Validating geographic replay">Checking source fingerprints, tool receipts and scientific terminology.</EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="blocked" title="Geographic replay rejected">{state.message} No live request was attempted.</EvidenceState>
      ) : (
        <>
          <EvidenceState state="available" title="Stored output · no live call">This replay uses committed geographic artifacts and requires no API key or browser credential.</EvidenceState>
          <dl className="agent-inline-facts">
            <div><dt>Model</dt><dd><code>{state.replay.model}</code></dd></div>
            <div><dt>Reasoning effort</dt><dd>{state.replay.reasoningEffort}</dd></div>
            <div><dt>Scope</dt><dd>{String(state.replay.scope.scopeName)}</dd></div>
            <div><dt>Tool calls</dt><dd>{state.replay.toolReceipts.length}</dd></div>
            <div><dt>Live request</dt><dd>No</dd></div>
            <div><dt>Credential</dt><dd>Not required</dd></div>
          </dl>
          <h3>Question</h3>
          <p>{state.replay.request}</p>
          <h3>Answer</h3>
          <p>{state.replay.answer}</p>
          <details className="agent-json-disclosure">
            <summary>Inspect geographic tool receipts and artifact citations</summary>
            <pre aria-label="Geographic analyst stored replay evidence">{JSON.stringify({ sources: state.replay.sources, toolReceipts: state.replay.toolReceipts }, null, 2)}</pre>
          </details>
          <ul aria-label="Geographic analyst limitations">
            {state.replay.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}
