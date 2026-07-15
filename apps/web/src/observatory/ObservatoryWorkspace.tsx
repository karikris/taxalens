import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import type { ReplayLaunchReceipt } from '../mission'
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
  replay,
  replayLaunch,
}: {
  readonly replay: ReplayEvidence
  readonly replayLaunch: ReplayLaunchReceipt | null
}) {
  const stages = buildPipelineStages(replay)

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
