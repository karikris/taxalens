import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { RESEARCH_ANALYST_MODEL } from './researchAnalystContract'
import type { PublicAgentTrace, PublicAgentTraceTool } from './agentTraceModel'
import './agent.css'

export function AgentWorkspace({
  replay,
  trace,
  traceState,
}: {
  readonly replay: ReplayEvidence
  readonly trace?: PublicAgentTrace
  readonly traceState?:
    | { readonly kind: 'loading' }
    | { readonly kind: 'error'; readonly message: string }
}) {
  return (
    <div className="agent-workspace">
      <section className="detail-panel agent-intro" aria-labelledby="agent-title">
        <p className="eyebrow">Responses API · auditable research tools</p>
        <h2 id="agent-title">Configured model Sol research analyst</h2>
        <p className="lede">
          Natural-language mission planning and evidence explanation stay inside the verified
          replay boundary. Every displayed claim must resolve to a checksum-verified artifact.
        </p>
        <dl className="agent-contract-facts">
          <div>
            <dt>Model</dt>
            <dd><code>{RESEARCH_ANALYST_MODEL}</code></dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>Responses</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>9 read-only</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd><i>{replay.target.scientificName}</i></dd>
          </div>
        </dl>
        <aside className="agent-privacy" aria-label="Agent trace privacy boundary">
          <strong>Public audit fields only</strong>
          <p>
            Request, public plan, validated tool exchange, structured outputs, answer, and measured
            budgets may be shown. Private reasoning and chain-of-thought are neither collected by
            this view nor rendered.
          </p>
        </aside>
      </section>

      {traceState?.kind === 'loading' ? (
        <section className="detail-panel" aria-labelledby="agent-loading-title">
          <p className="eyebrow">Stored trace verification</p>
          <h2 id="agent-loading-title">Opening analyst replay</h2>
          <EvidenceState state="loading" title="Checking stored request and output">
            Artifact checksums are already verified. TaxaLens is validating the public run and
            replaying its recorded read-only tool calls locally.
          </EvidenceState>
        </section>
      ) : traceState?.kind === 'error' ? (
        <section className="detail-panel" aria-labelledby="agent-error-title">
          <p className="eyebrow">Stored trace rejected</p>
          <h2 id="agent-error-title">Analyst replay unavailable</h2>
          <EvidenceState state="blocked" title="Stored output failed validation">
            {traceState.message} No stored answer is displayed, and no live request was attempted.
          </EvidenceState>
        </section>
      ) : trace === undefined ? (
        <NoAgentSession />
      ) : (
        <AgentTrace trace={trace} />
      )}
    </div>
  )
}

function NoAgentSession() {
  const unavailableSections = [
    'Request',
    'Public plan',
    'Tools and parameters',
    'Artifact citations',
    'Structured outputs',
    'Answer',
    'Budgets',
  ]
  return (
    <section className="detail-panel agent-empty" aria-labelledby="agent-empty-title">
      <p className="eyebrow">Trace availability</p>
      <h2 id="agent-empty-title">No analyst session loaded</h2>
      <EvidenceState state="blocked" title="No live call or stored output">
        This checksum-verified bundle does not yet contain an analyst trace. The interface does not
        simulate a live response or expose a browser credential.
      </EvidenceState>
      <ul className="agent-empty__sections" aria-label="Unavailable trace sections">
        {unavailableSections.map((section) => (
          <li key={section}>
            <span>{section}</span>
            <strong>Unavailable</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AgentTrace({ trace }: { readonly trace: PublicAgentTrace }) {
  return (
    <div className="agent-trace">
      {trace.source.kind === 'stored_replay' ? (
        <section className="detail-panel agent-replay-source" aria-labelledby="agent-replay-title">
          <p className="eyebrow">Credential-free stored replay</p>
          <h2 id="agent-replay-title">Replayed analyst session</h2>
          <EvidenceState state="available" title="Stored output · no live call">
            The public request, tool trace, and structured output were loaded from two
            checksum-verified fixture artifacts. No API request or browser credential was used.
          </EvidenceState>
          <dl className="agent-inline-facts">
            <div><dt>Trace</dt><dd><code>{trace.source.traceId}</code></dd></div>
            <div><dt>Origin</dt><dd>Stored artifacts</dd></div>
            <div><dt>Live request</dt><dd>No</dd></div>
            <div><dt>Credential</dt><dd>Not required</dd></div>
          </dl>
          <ArtifactLinks
            artifactIds={[
              trace.source.requestArtifactId,
              trace.source.responseArtifactId,
            ]}
          />
        </section>
      ) : null}
      <section className="detail-panel agent-trace__request" aria-labelledby="agent-request-title">
        <div className="agent-section-heading">
          <div>
            <p className="eyebrow">{trace.mode.replaceAll('_', ' ')}</p>
            <h2 id="agent-request-title">Request</h2>
          </div>
          <span className="agent-status">{trace.responseStatus}</span>
        </div>
        <p>{trace.request.text}</p>
        <dl className="agent-inline-facts">
          <div><dt>Kind</dt><dd>{trace.request.kind.replaceAll('_', ' ')}</dd></div>
          <div><dt>Model</dt><dd><code>{trace.model}</code></dd></div>
          <div><dt>Reasoning effort</dt><dd>{trace.reasoningEffort}</dd></div>
          <div><dt>Response turns</dt><dd>{trace.responseIds.length}</dd></div>
        </dl>
      </section>

      <section className="detail-panel" aria-labelledby="agent-plan-title">
        <p className="eyebrow">Public action summary</p>
        <h2 id="agent-plan-title">Plan</h2>
        <ol className="agent-plan">
          {trace.plan.map((step) => (
            <li key={step.sequence} data-status={step.status}>
              <span className="agent-plan__sequence" aria-hidden="true">{step.sequence}</span>
              <div>
                <strong>{step.action}</strong>
                <span>
                  {step.tool ?? 'Approval boundary'} · {step.status.replaceAll('_', ' ')}
                  {step.approvalRequired ? ' · approval required' : ''}
                </span>
                <ArtifactLinks artifactIds={step.artifactIds} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="detail-panel" aria-labelledby="agent-tools-title">
        <div className="agent-section-heading">
          <div>
            <p className="eyebrow">Validated deterministic exchange</p>
            <h2 id="agent-tools-title">Tools</h2>
          </div>
          <span>{trace.tools.length} call{trace.tools.length === 1 ? '' : 's'}</span>
        </div>
        <div className="agent-tools">
          {trace.tools.map((tool) => <ToolTrace key={tool.callId} tool={tool} />)}
        </div>
      </section>

      <section className="detail-panel" aria-labelledby="agent-artifacts-title">
        <p className="eyebrow">Checksum-verified citations</p>
        <h2 id="agent-artifacts-title">Artifacts</h2>
        <ul className="agent-artifacts">
          {trace.artifacts.map((artifact) => (
            <li key={artifact.artifactId} id={`agent-artifact-${artifact.artifactId}`}>
              <strong><code>{artifact.artifactId}</code></strong>
              <span>{artifact.path}</span>
              <small>SHA-256 {artifact.sha256} · producer {artifact.producerSha}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-panel" aria-labelledby="agent-output-title">
        <p className="eyebrow">Strict Structured Output</p>
        <h2 id="agent-output-title">Structured output</h2>
        <details className="agent-json-disclosure">
          <summary>Inspect final JSON</summary>
          <JsonBlock value={trace.structuredOutput} label="Final structured analyst output" />
        </details>
      </section>

      <section className="detail-panel agent-answer" aria-labelledby="agent-answer-title">
        <p className="eyebrow">Evidence-cited response</p>
        <h2 id="agent-answer-title">Answer</h2>
        <p>{trace.answer}</p>
        <ArtifactLinks artifactIds={trace.structuredOutput.artifactIds} />
      </section>

      <section className="detail-panel" aria-labelledby="agent-budgets-title">
        <p className="eyebrow">Measured execution limits</p>
        <h2 id="agent-budgets-title">Budgets</h2>
        <div className="agent-budgets">
          <Budget
            label="Tool calls"
            used={trace.budgets.usedToolCalls}
            maximum={trace.budgets.maxToolCalls}
          />
          <Budget
            label="Response turns"
            used={trace.budgets.usedResponseTurns}
            maximum={trace.budgets.maxResponseTurns}
          />
        </div>
        <p className="agent-budget-note">
          No token count is displayed because this public run contract does not retain aggregate
          token usage. Hidden reasoning is never inferred from a budget.
        </p>
      </section>
    </div>
  )
}

function ToolTrace({ tool }: { readonly tool: PublicAgentTraceTool }) {
  return (
    <article className="agent-tool" aria-labelledby={`agent-tool-${tool.sequence}`}>
      <header>
        <div>
          <span>Call {tool.sequence}</span>
          <h3 id={`agent-tool-${tool.sequence}`}><code>{tool.name}</code></h3>
        </div>
        <strong data-status={tool.result.status}>{tool.result.status}</strong>
      </header>
      <details className="agent-json-disclosure">
        <summary>Validated parameters</summary>
        <JsonBlock value={tool.arguments} label={`${tool.name} validated parameters`} />
      </details>
      <details className="agent-json-disclosure">
        <summary>Structured tool result</summary>
        <JsonBlock value={tool.result} label={`${tool.name} structured result`} />
      </details>
      <ArtifactLinks artifactIds={tool.artifactIds} />
    </article>
  )
}

function ArtifactLinks({ artifactIds }: { readonly artifactIds: readonly string[] }) {
  return (
    <ul className="agent-artifact-links" aria-label="Artifact citations">
      {artifactIds.map((artifactId) => (
        <li key={artifactId}>
          <a href={`#agent-artifact-${artifactId}`}><code>{artifactId}</code></a>
        </li>
      ))}
    </ul>
  )
}

function JsonBlock({ value, label }: { readonly value: unknown; readonly label: string }) {
  return <pre className="agent-json" aria-label={label}>{JSON.stringify(value, null, 2)}</pre>
}

function Budget({
  label,
  maximum,
  used,
}: {
  readonly label: string
  readonly maximum: number
  readonly used: number
}) {
  return (
    <div className="agent-budget">
      <div><strong>{label}</strong><span>{used} / {maximum}</span></div>
      <progress value={used} max={maximum} aria-label={`${label}: ${used} of ${maximum}`} />
    </div>
  )
}
