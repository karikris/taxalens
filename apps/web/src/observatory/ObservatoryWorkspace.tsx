import { useState } from 'react'
import { Label, Meter, Tab, TabList, TabPanel, Tabs } from 'react-aria-components'

import type { AnalyticsReplayInput, EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import type { ReplayLaunchReceipt } from '../mission'
import type { AnalyticsReplayResult } from './analyticsReplay'
import { buildPipelineStages, type PipelineStageStatus } from './pipelineModel'
import {
  buildRecordLineage,
  traceRecordLineage,
  type RecordLineageModel,
  type RecordLineageSelection,
} from './recordLineage'
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
  const lineage = buildRecordLineage(replay, stages)
  const [selectedLineageRecordId, setSelectedLineageRecordId] = useState<string | null>(null)
  const lineageSelection =
    selectedLineageRecordId === null
      ? null
      : traceRecordLineage(lineage, selectedLineageRecordId)
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

      <RecordLineageInspector
        lineage={lineage}
        selection={lineageSelection}
        onToggle={() =>
          setSelectedLineageRecordId((current) =>
            current === lineage.record.recordId ? null : lineage.record.recordId,
          )
        }
      />

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
            const lineageHighlighted = lineageSelection?.stageIds.has(stage.stageId) ?? false
            const lineageStage = lineage.stages.find(({ stageId }) => stageId === stage.stageId)
            return (
              <li
                key={stage.stageId}
                data-stage-status={stage.status}
                data-lineage-highlighted={lineageHighlighted}
              >
                <span className="pipeline-flow__sequence" aria-hidden="true">
                  {String(stage.sequence).padStart(2, '0')}
                </span>
                <div className="pipeline-flow__identity">
                  <h3>{stage.label}</h3>
                  <span className="pipeline-flow__status">
                    <span aria-hidden="true">{presentation.marker}</span>
                    {presentation.label}
                  </span>
                  {lineageHighlighted && lineageStage !== undefined ? (
                    <span className="pipeline-flow__lineage-marker">
                      Lineage · {lineageStage.contributionKind.replaceAll('_', ' ')}
                    </span>
                  ) : null}
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
      <WorkAvoided result={result.workAvoided} />
      <Tabs className="analytics-inspection" defaultSelectedKey="research">
        <TabList className="analytics-inspection__tabs" aria-label="Analytics inspection mode">
          <Tab id="research">Research mode</Tab>
          <Tab id="engineering">Engineering mode</Tab>
        </TabList>
        <TabPanel id="research" className="analytics-inspection__panel">
          <p className="analytics-inspection__introduction">
            Plain-language consequences of the measured replay. Counts below are the records
            observed entering and leaving each operation.
          </p>
          <ol
            className="analytics-results__operations analytics-results__operations--research"
            aria-label="Research operation explanations"
          >
            {result.operations.map((operation) => (
              <li key={operation.operationId}>
                <div className="analytics-results__operation-heading">
                  <div>
                    <code>{operation.operationId}</code>
                    <h3>{operation.label}</h3>
                  </div>
                </div>
                <dl className="analytics-operation__inspection">
                  <div>
                    <dt>What occurred</dt>
                    <dd>{operation.whatOccurred}</dd>
                  </div>
                  <div>
                    <dt>Why</dt>
                    <dd>{operation.why}</dd>
                  </div>
                  <div>
                    <dt>Records entering</dt>
                    <dd>
                      {operation.inputRows.toLocaleString('en-US')} from{' '}
                      <code>{operation.inputRelation}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Records leaving</dt>
                    <dd>
                      {operation.outputRows.toLocaleString('en-US')} in{' '}
                      <code>{operation.outputRelation}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>User consequence</dt>
                    <dd>{operation.userConsequence}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </TabPanel>
        <TabPanel id="engineering" className="analytics-inspection__panel">
          <p className="analytics-inspection__introduction">
            Runtime measurements and provenance for the exact verified source artifacts available
            to each operation. Byte totals are artifact sizes, not claimed scan-byte measurements.
          </p>
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
                <dl className="analytics-operation__inspection">
                  <div>
                    <dt>Operation</dt>
                    <dd>
                      <code>{operation.inputRelation}</code> →{' '}
                      <code>{operation.outputRelation}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Keys</dt>
                    <dd>{operation.keys.join(' · ')}</dd>
                  </div>
                  <div>
                    <dt>Cardinality</dt>
                    <dd>{operation.cardinality}</dd>
                  </div>
                  <div>
                    <dt>Rows</dt>
                    <dd>
                      {operation.inputRows.toLocaleString('en-US')} entering →{' '}
                      {operation.outputRows.toLocaleString('en-US')} leaving
                    </dd>
                  </div>
                  <div>
                    <dt>Nulls</dt>
                    <dd>{operation.nullRows.toLocaleString('en-US')} output rows on inspection keys</dd>
                  </div>
                  <div>
                    <dt>Elapsed time</dt>
                    <dd>{operation.elapsedMilliseconds.toFixed(2)} ms measured</dd>
                  </div>
                  <div>
                    <dt>Bytes</dt>
                    <dd>
                      {operation.sourceArtifactBytes.toLocaleString('en-US')} verified source
                      artifact bytes
                    </dd>
                  </div>
                  <div>
                    <dt>Partitions</dt>
                    <dd>
                      {operation.parquetRowGroups.toLocaleString('en-US')} measured Parquet row
                      groups
                      {operation.artifacts.some(({ parquetRowGroups }) => parquetRowGroups === null)
                        ? '; JSON source is not Parquet-partitioned'
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Cache</dt>
                    <dd>{operation.cache}</dd>
                  </div>
                </dl>
                <ul className="analytics-operation__artifacts" aria-label="Source artifacts">
                  {operation.artifacts.map((artifact) => (
                    <li key={artifact.artifactId}>
                      <dl>
                        <div>
                          <dt>Artifact</dt>
                          <dd>
                            <code>{artifact.artifactId}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Checksum</dt>
                          <dd>
                            <code>{artifact.sha256}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Producer SHA</dt>
                          <dd>
                            <code>{artifact.producerSha}</code>
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div
                  className="analytics-results__operators"
                  aria-label="Observed query-plan operators"
                >
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
        </TabPanel>
      </Tabs>
    </div>
  )
}

function RecordLineageInspector({
  lineage,
  selection,
  onToggle,
}: {
  readonly lineage: RecordLineageModel
  readonly selection: RecordLineageSelection | null
  readonly onToggle: () => void
}) {
  const selected = selection !== null
  return (
    <section className="record-lineage" aria-labelledby="record-lineage-title">
      <div className="record-lineage__heading">
        <div>
          <p className="eyebrow">Interactive upstream closure</p>
          <h2 id="record-lineage-title">Record lineage</h2>
          <p>
            Select the final replay record to highlight every stage state and verified artifact
            that contributes to its awaiting-review boundary.
          </p>
        </div>
        <div className="record-lineage__boundary">
          <strong>Diagnostic replay state</strong>
          <span>No scientific evidence record exists yet</span>
        </div>
      </div>

      <button
        className="record-lineage__record"
        type="button"
        aria-pressed={selected}
        aria-describedby="record-lineage-help"
        onClick={onToggle}
      >
        <span>{lineage.record.label}</span>
        <code>{lineage.record.recordId}</code>
        <strong>{selected ? 'Lineage highlighted' : 'Trace this record'}</strong>
      </button>
      <p id="record-lineage-help" className="record-lineage__help">
        Unavailable stages contribute an explicit missing-evidence state. They do not imply a
        hidden artifact or completed scientific work.
      </p>
      <p className="record-lineage__status" role="status" aria-live="polite">
        {selected
          ? `${selection.stageIds.size} contributing stages and ${selection.artifactIds.size} contributing artifacts highlighted for ${lineage.record.recordId}.`
          : 'No final replay record selected; lineage highlighting is off.'}
      </p>

      <ol className="record-lineage__artifacts" aria-label="Contributing lineage artifacts">
        {lineage.artifacts.map((artifact) => {
          const highlighted = selection?.artifactIds.has(artifact.artifactId) ?? false
          const relatedStages = artifact.stageIds.map((stageId) => {
            const stage = lineage.stages.find((candidate) => candidate.stageId === stageId)
            if (stage === undefined) {
              throw new Error(`Lineage artifact references unknown stage ${stageId}`)
            }
            return stage
          })
          return (
            <li key={artifact.artifactId} data-lineage-highlighted={highlighted}>
              <div className="record-lineage__artifact-heading">
                <div>
                  <code>{artifact.artifactId}</code>
                  <h3>{artifact.path}</h3>
                </div>
                <span>{highlighted ? 'Highlighted contributor' : 'Contributor'}</span>
              </div>
              <p>
                {artifact.contributionKind === 'record_frame'
                  ? 'Establishes the record identity, ordered pipeline frame, or verified count frame.'
                  : `Feeds ${relatedStages.map(({ label }) => label).join(' · ')}.`}
              </p>
              <details>
                <summary>Inspect artifact identity</summary>
                <dl>
                  <div>
                    <dt>Checksum</dt>
                    <dd>
                      <code>{artifact.sha256}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Producer SHA</dt>
                    <dd>
                      <code>{artifact.producerSha}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Verification</dt>
                    <dd>{artifact.verified ? 'Checksum verified' : 'Unavailable'}</dd>
                  </div>
                </dl>
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function WorkAvoided({ result }: { readonly result: AnalyticsReplayResult['workAvoided'] }) {
  return (
    <section className="work-avoided" aria-labelledby="work-avoided-title">
      <div className="work-avoided__heading">
        <div>
          <p className="eyebrow">Measured efficiency · no estimates</p>
          <h3 id="work-avoided-title">Work avoided</h3>
          <p>
            Two counters are reproducible from the verified query-hit artifact. Five remain visible
            as not instrumented because this pilot contains no execution or cache-reuse ledger for
            them.
          </p>
        </div>
        <strong>
          {result.measuredMetricCount} measured · {result.notInstrumentedMetricCount} not instrumented
        </strong>
      </div>
      <ul className="work-avoided__metrics" aria-label="Work avoided measurements">
        {result.metrics.map((metric) => (
          <li key={metric.metricId} data-measurement-status={metric.status}>
            {metric.status === 'measured' &&
            metric.value !== null &&
            metric.baselineRows !== null ? (
              <Meter
                className="work-avoided__meter"
                minValue={0}
                maxValue={metric.baselineRows}
                value={metric.value}
                valueLabel={`${metric.value.toLocaleString('en-US')} ${metric.unit}`}
                formatOptions={{ maximumFractionDigits: 0 }}
              >
                {({ percentage }) => (
                  <>
                    <div className="work-avoided__metric-heading">
                      <Label>{metric.label}</Label>
                      <span>Measured</span>
                    </div>
                    <strong className="work-avoided__value">
                      {metric.value!.toLocaleString('en-US')}
                    </strong>
                    <span className="work-avoided__unit">{metric.unit}</span>
                    <div className="work-avoided__track" aria-hidden="true">
                      <div style={{ width: `${percentage}%` }} />
                    </div>
                    <p>
                      {metric.baselineRows!.toLocaleString('en-US')} verified query-hit associations
                      → {metric.retainedRows?.toLocaleString('en-US')} canonical source photos.
                    </p>
                  </>
                )}
              </Meter>
            ) : (
              <div className="work-avoided__unavailable">
                <div className="work-avoided__metric-heading">
                  <h4>{metric.label}</h4>
                  <span>Not instrumented</span>
                </div>
                <strong className="work-avoided__value">—</strong>
                <span className="work-avoided__unit">No measured counter</span>
              </div>
            )}
            <details>
              <summary>Measurement basis</summary>
              <p>{metric.method}</p>
              {metric.sourceArtifacts.map((artifact) => (
                <dl key={artifact.artifactId}>
                  <div>
                    <dt>Artifact</dt>
                    <dd>
                      <code>{artifact.artifactId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Checksum</dt>
                    <dd>
                      <code>{artifact.sha256}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Producer SHA</dt>
                    <dd>
                      <code>{artifact.producerSha}</code>
                    </dd>
                  </div>
                </dl>
              ))}
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
