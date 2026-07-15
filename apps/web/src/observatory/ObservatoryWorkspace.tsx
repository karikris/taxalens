import { useState } from 'react'

import type { AnalyticsReplayInput, EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import type { ReplayLaunchReceipt } from '../mission'
import type { AnalyticsReplayResult } from './analyticsReplay'
import { buildPipelineStages, type PipelineStageStatus } from './pipelineModel'
import './observatory.css'

const STATUS_PRESENTATION: Readonly<
  Record<PipelineStageStatus, { readonly label: string; readonly marker: string }>
> = {
  verified: { label: 'Verified metadata', marker: 'OK' },
  partial: { label: 'Partial metadata', marker: '~' },
  unavailable: { label: 'Unavailable', marker: '—' },
  review: { label: 'Awaiting review', marker: 'RV' },
}

export type AnalyticsReplayExecutor = (
  input: AnalyticsReplayInput,
) => Promise<AnalyticsReplayResult>

const defaultAnalyticsReplayExecutor: AnalyticsReplayExecutor = async (input) => {
  const { executeAnalyticsReplay } = await import('./analyticsReplay')
  return executeAnalyticsReplay(input)
}

function ReplayReceipt({ receipt }: { readonly receipt: ReplayLaunchReceipt }) {
  return (
    <section className="detail-panel replay-launch-receipt" aria-labelledby="replay-receipt-title">
      <p className="eyebrow">Provenance-bound replay</p>
      <h2 id="replay-receipt-title">Replay launch receipt</h2>
      <p className="lede">
        The submitted fixture is open. This receipt is bound to the exact plan, source registry,
        source revisions, and verified artifact inventory shown below.
      </p>
      <EvidenceState state="available" title="Submitted fixture opened">
        All {receipt.bundle.artifactCount} local artifact checks passed. No remote request or live
        scientific action was enabled.
      </EvidenceState>
      <dl className="evidence-facts replay-launch-receipt__facts">
        <div className="replay-launch-receipt__fingerprint">
          <dt>Plan fingerprint</dt>
          <dd>
            <code>{receipt.planFingerprint}</code>
          </dd>
        </div>
        <div>
          <dt>Registry version</dt>
          <dd>
            <code>{receipt.sourceRegistry.version}</code>
          </dd>
        </div>
        <div>
          <dt>Source snapshot</dt>
          <dd>
            <code>{receipt.sourceRegistry.sourceSnapshotVersion}</code>
          </dd>
        </div>
        <div>
          <dt>Bundle</dt>
          <dd>{receipt.bundle.bundleId}</dd>
        </div>
        <div>
          <dt>Artifact checksums</dt>
          <dd>
            {receipt.bundle.verifiedArtifactCount} / {receipt.bundle.artifactCount} verified
          </dd>
        </div>
        <div>
          <dt>Live approval</dt>
          <dd>{receipt.liveApproval.status.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>TaxaLens SHA</dt>
          <dd>
            <code>{receipt.sourceRevisions.taxalensSha}</code>
          </dd>
        </div>
        <div>
          <dt>BioMiner SHA</dt>
          <dd>
            <code>{receipt.sourceRevisions.biominerSha}</code>
          </dd>
        </div>
        <div className="replay-launch-receipt__capabilities">
          <dt>Capabilities</dt>
          <dd>Fixture replay only · no live actions · no remote requests</dd>
        </div>
      </dl>
    </section>
  )
}

export function ObservatoryWorkspace({
  facade,
  replay,
  replayLaunch,
  executeReplay = defaultAnalyticsReplayExecutor,
}: {
  readonly facade: EvidenceFacade
  readonly replay: ReplayEvidence
  readonly replayLaunch: ReplayLaunchReceipt | null
  readonly executeReplay?: AnalyticsReplayExecutor
}) {
  const stages = buildPipelineStages(replay)
  const [analytics, setAnalytics] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'running' }
    | { readonly kind: 'complete'; readonly result: AnalyticsReplayResult }
    | { readonly kind: 'error'; readonly message: string }
  >({ kind: 'idle' })

  const runAnalytics = () => {
    setAnalytics({ kind: 'running' })
    void executeReplay(facade.loadAnalyticsReplayInput())
      .then((result) => setAnalytics({ kind: 'complete', result }))
      .catch((reason: unknown) =>
        setAnalytics({
          kind: 'error',
          message: reason instanceof Error ? reason.message : 'The local analytics replay failed.',
        }),
      )
  }

  return (
    <div className="observatory-workspace">
      {replayLaunch === null ? (
        <section className="detail-panel observatory-intro" aria-labelledby="observatory-title">
          <p className="eyebrow">Verified observatory</p>
          <h2 id="observatory-title">Submitted fixture ready</h2>
          <p className="lede">
            Every value below comes from the exact static manifest and artifacts loaded by the
            evidence facade.
          </p>
          <EvidenceState state="available" title="Bundle verification complete">
            <span>
              {replay.verifiedArtifactCount} / {replay.artifactCount} verified
            </span>
            . <span>Inventory and payload verified</span>.
          </EvidenceState>
        </section>
      ) : (
        <ReplayReceipt receipt={replayLaunch} />
      )}

      <section className="analytics-replay" aria-labelledby="analytics-replay-title">
        <div className="analytics-replay__heading">
          <div>
            <p className="eyebrow">DuckDB-Wasm · verified Parquet</p>
            <h2 id="analytics-replay-title">Judge replay analytics</h2>
            <p>
              Execute eight local SQL operations over the four checksum-verified BioMiner
              artifacts. The worker starts only when requested and makes no remote data request.
            </p>
          </div>
          <button
            className="analytics-replay__run"
            type="button"
            disabled={analytics.kind === 'running'}
            onClick={runAnalytics}
          >
            {analytics.kind === 'running' ? 'Running local replay…' : 'Run verified analytics'}
          </button>
        </div>

        <div className="analytics-replay__boundary">
          <strong>Metadata analytics only</strong>
          <span>Matrix scoring is not executed or described as a hash join.</span>
          <span>Scientific claim: not allowed</span>
        </div>
        <p className="analytics-replay__count-note">
          The pipeline’s 22 registry-linked species plans are distinct from the 556 materialized
          Flickr query hashes measured by this replay.
        </p>

        <div aria-live="polite">
          {analytics.kind === 'idle' ? (
            <EvidenceState state="review" title="Analytics not yet executed">
              The verified Parquet bytes are ready; DuckDB-Wasm remains stopped.
            </EvidenceState>
          ) : analytics.kind === 'running' ? (
            <EvidenceState state="loading" title="Executing local query plans">
              Registering four in-memory Parquet files and inspecting each DuckDB plan.
            </EvidenceState>
          ) : analytics.kind === 'error' ? (
            <EvidenceState state="failure" title="Analytics replay stopped">
              {analytics.message}
            </EvidenceState>
          ) : (
            <AnalyticsResults result={analytics.result} />
          )}
        </div>
      </section>

      <figure
        className="pipeline-figure"
        aria-labelledby="pipeline-title"
        aria-describedby="pipeline-description"
      >
        <figcaption className="pipeline-figure__heading">
          <div>
            <p className="eyebrow">Artifact-backed lineage</p>
            <h2 id="pipeline-title">Evidence pipeline</h2>
            <p id="pipeline-description">
              Thirteen ordered stages from registry identity to final evidence. Counts retain their
              fixture units and are not a conserved Sankey flow.
            </p>
          </div>
          <strong>13 stages · no scientific claim</strong>
        </figcaption>

        <ul className="pipeline-legend" aria-label="Pipeline status legend">
          {Object.entries(STATUS_PRESENTATION).map(([status, presentation]) => (
            <li key={status} data-stage-status={status}>
              <span aria-hidden="true">{presentation.marker}</span>
              {presentation.label}
            </li>
          ))}
        </ul>

        <ol className="pipeline-flow" aria-label="Evidence pipeline stages">
          {stages.map((stage) => {
            const presentation = STATUS_PRESENTATION[stage.status]
            return (
              <li key={stage.stageId} data-stage-status={stage.status}>
                <span className="pipeline-flow__sequence" aria-hidden="true">
                  {String(stage.sequence).padStart(2, '0')}
                </span>
                <div className="pipeline-flow__identity">
                  <h3>{stage.label}</h3>
                  <span className="pipeline-flow__status">
                    <span aria-hidden="true">{presentation.marker}</span>
                    {presentation.label}
                  </span>
                </div>
                <p className="pipeline-flow__count">
                  <strong>{stage.count.toLocaleString('en-US')}</strong>
                  <span>{stage.unit}</span>
                </p>
                <div className="pipeline-flow__context">
                  <p>{stage.detail}</p>
                  <div aria-label="Fixture source sections">
                    {stage.sourceSections.map((section) => (
                      <code key={section}>{section}</code>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <p className="pipeline-figure__note">
          Status is repeated in text and markers; color is supplementary. Zero means the verified
          fixture records no output, while “unavailable” means the producing evidence is absent.
        </p>
      </figure>
    </div>
  )
}

function AnalyticsResults({ result }: { readonly result: AnalyticsReplayResult }) {
  return (
    <div className="analytics-results">
      <EvidenceState state="available" title="Eight analytical operations completed">
        DuckDB {result.engineVersion} read {result.registeredArtifactCount} verified Parquet files (
        {result.registeredBytes.toLocaleString('en-US')} bytes) entirely in the browser.
      </EvidenceState>
      <dl className="analytics-results__facts">
        <div>
          <dt>Backend</dt>
          <dd>{result.backend}</dd>
        </div>
        <div>
          <dt>DuckDB-Wasm package</dt>
          <dd>{result.packageVersion}</dd>
        </div>
        <div>
          <dt>Operations</dt>
          <dd>{result.operationCount} / 8 complete</dd>
        </div>
        <div>
          <dt>Matrix scoring</dt>
          <dd>{result.matrixScoringExecuted ? 'Executed' : 'Not executed'}</dd>
        </div>
      </dl>
      <ol className="analytics-results__operations" aria-label="Completed analytical operations">
        {result.operations.map((operation) => (
          <li key={operation.operationId}>
            <div className="analytics-results__operation-heading">
              <div>
                <code>{operation.operationId}</code>
                <h3>{operation.label}</h3>
              </div>
              <strong>{operation.outputRows.toLocaleString('en-US')} rows out</strong>
            </div>
            <p>
              {operation.inputRows.toLocaleString('en-US')} rows from{' '}
              <code>{operation.inputRelation}</code> → <code>{operation.outputRelation}</code>
            </p>
            <div className="analytics-results__operators" aria-label="Observed query-plan operators">
              {operation.planOperators.length === 0 ? (
                <span>No named operator surfaced</span>
              ) : (
                operation.planOperators.map((operator) => <span key={operator}>{operator}</span>)
              )}
            </div>
            <details>
              <summary>Inspect DuckDB EXPLAIN plan</summary>
              <pre>{operation.explainPlan}</pre>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}
