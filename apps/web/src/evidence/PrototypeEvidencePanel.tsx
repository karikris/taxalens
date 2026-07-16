import type { PrototypeEvidenceBoundary } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import './evidence.css'

export function PrototypeEvidencePanel({
  prototype,
}: {
  readonly prototype: PrototypeEvidenceBoundary
}) {
  return (
    <section className="prototype-evidence" aria-labelledby="prototype-evidence-title">
      <div className="prototype-evidence__heading">
        <div>
          <p className="eyebrow">BioMiner Phase 14/15 handoff</p>
          <h3 id="prototype-evidence-title">Aggregate prototype evidence</h3>
        </div>
        <strong>Prototype only</strong>
      </div>

      <EvidenceState state="review" title="Available with explicit limitations">
        This checksum-verified snapshot demonstrates the retrieval workflow. It does not provide
        per-record scores, detections, images, classification accuracy, calibration, or a
        scientific release.
      </EvidenceState>

      <dl className="prototype-evidence__facts">
        <Fact label="Frozen support" value="81 provider-supported · 0 human-verified" />
        <Fact label="Licence policy" value="2 allowed · 79 research-only" />
        <Fact label="Reference routes" value="80 adult · 1 larval · 0 pinned specimen" />
        <Fact
          label="Frozen splits"
          value="26 support · 30 selection · 13 calibration audit · 12 final test"
        />
        <Fact
          label="BioCLIP runtime"
          value={`1,024 dimensions · ${prototype.runtime.frozenSupportEmbeddings} embeddings`}
        />
        <Fact label="YOLOE authority" value="Gate and router only — not classification" />
      </dl>

      <div className="prototype-evidence__comparison">
        <article>
          <span>Retrieval scoreability</span>
          <strong>
            B0 {(prototype.benchmark.b0TargetScoreability * 100).toFixed(0)}% → B13{' '}
            {(prototype.benchmark.b13TargetScoreability * 100).toFixed(0)}%
          </strong>
          <p>Provider-supported retrieval consistency, not classification accuracy.</p>
        </article>
        <article>
          <span>Two distinct thresholds</span>
          <strong>
            {prototype.staged.stagedDiagnosticThreshold.toFixed(2)} staged diagnostic ·{' '}
            {prototype.policy.rawMarginThreshold.toFixed(2)} selected policy
          </strong>
          <p>Raw similarity margins are not probabilities; no calibrator was fitted.</p>
        </article>
      </div>

      <dl className="prototype-evidence__run">
        <Fact
          label="Staged records"
          value={`${prototype.staged.classifiedCount.toLocaleString('en-US')} / ${prototype.staged.plannedCount.toLocaleString('en-US')}`}
        />
        <Fact
          label="Candidate-score rows"
          value={prototype.staged.candidateScoreRowCount.toLocaleString('en-US')}
        />
        <Fact
          label="Diagnostic abstentions"
          value={`${prototype.staged.stagedAbstainedCount.toLocaleString('en-US')} (${(
            prototype.staged.stagedAbstentionRate * 100
          ).toFixed(4)}%)`}
        />
        <Fact
          label="Retryable failures"
          value={prototype.staged.retryableFailureCount.toLocaleString('en-US')}
        />
      </dl>

      <p className="prototype-evidence__boundary">
        These distributions are neither accuracy nor prevalence. Public reference-image display,
        production-default changes, and scientific claims remain unauthorized.
      </p>

      <details className="prototype-evidence__provenance">
        <summary>Inspect prototype snapshot provenance</summary>
        <dl>
          <Fact label="BioMiner origin" value={prototype.provenance.originCommit} code />
          <Fact label="TaxaLens producer" value={prototype.provenance.producerSha} code />
          <Fact label="Snapshot SHA-256" value={prototype.provenance.snapshotSha256} code />
          <Fact
            label="Imported source artifacts"
            value={prototype.provenance.importedArtifactCount.toLocaleString('en-US')}
          />
        </dl>
      </details>
    </section>
  )
}

function Fact({
  code = false,
  label,
  value,
}: {
  readonly code?: boolean
  readonly label: string
  readonly value: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{code ? <code>{value}</code> : value}</dd>
    </div>
  )
}
