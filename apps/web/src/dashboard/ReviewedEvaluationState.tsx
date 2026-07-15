import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { buildReviewedEvaluationModel } from './reviewedEvaluationModel'

export function ReviewedEvaluationState({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildReviewedEvaluationModel(replay)

  return (
    <section className="reviewed-evaluation" aria-labelledby="reviewed-evaluation-title">
      <div className="reviewed-evaluation__heading">
        <div>
          <p className="eyebrow">Scientific evaluation</p>
          <h3 id="reviewed-evaluation-title">Current reviewed evaluation state</h3>
          <p>
            Show a metric only when a committed result artifact supplies reviewed outcomes and its
            exact denominator. Planning metadata and test fixtures are not scientific results.
          </p>
        </div>
        <span className="reviewed-evaluation__count">
          <strong>{model.committedReviewedMetricCount}</strong>
          <span>committed reviewed metrics</span>
        </span>
      </div>

      <EvidenceState state="blocked" title="Evaluation unavailable · reference review blocked">
        Phase 13 has no result artifact in this bundle. Phase 14 has metadata only and cannot begin
        valid calibration or final evaluation until reviewed reference evidence exists.
      </EvidenceState>

      <div className="reviewed-evaluation__states">
        <article data-evaluation-state="unavailable">
          <span>Phase 13</span>
          <h4>Reviewed result boundary</h4>
          <strong>Unavailable</strong>
          <p>{model.phase13.reason}</p>
          <dl>
            <div>
              <dt>Result artifacts</dt>
              <dd>{model.phase13.resultArtifactCount}</dd>
            </div>
            <div>
              <dt>Valid metrics</dt>
              <dd>{model.phase13.reviewedMetricCount}</dd>
            </div>
            <div>
              <dt>Bundle section</dt>
              <dd>{model.phase13.sourceSection}</dd>
            </div>
          </dl>
        </article>

        <article data-evaluation-state="blocked">
          <span>Phase 14</span>
          <h4>Reference-review gate</h4>
          <strong>Blocked before evaluation</strong>
          <p>
            Candidate source metadata is not a reviewed image label or verified reference support.
          </p>
          <dl>
            <div>
              <dt>Human-verified media</dt>
              <dd>{model.phase14.humanVerifiedSourceMediaCount}</dd>
            </div>
            <div>
              <dt>Review shortfall</dt>
              <dd>{model.phase14.humanVerifiedShortfall.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Groups awaiting review</dt>
              <dd>{model.phase14.groupsAwaitingHumanReview}</dd>
            </div>
            <div>
              <dt>Unresolved groups</dt>
              <dd>{model.phase14.unresolvedGroupCount}</dd>
            </div>
          </dl>
        </article>

        <article data-evaluation-state="blocked">
          <span>Decision boundary</span>
          <h4>No evaluated decision set</h4>
          <strong>{model.phase14.reviewState.replaceAll('_', ' ')}</strong>
          <p>
            With no visual scores or calibrated decisions, there is no population from which to
            report model performance.
          </p>
          <dl>
            <div>
              <dt>Candidate visual scores</dt>
              <dd>{model.phase14.candidateVisualScoreCount}</dd>
            </div>
            <div>
              <dt>Calibrated decisions</dt>
              <dd>{model.phase14.calibratedDecisionCount}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="reviewed-evaluation__ledger">
        <table>
          <caption>Reviewed metric availability and the denominator required for each claim</caption>
          <thead>
            <tr>
              <th scope="col">Phase</th>
              <th scope="col">Metric</th>
              <th scope="col">State</th>
              <th scope="col">Required denominator or artifact</th>
              <th scope="col">Why it is unavailable</th>
            </tr>
          </thead>
          <tbody>
            {model.metrics.map((metric) => (
              <tr key={metric.id} data-metric-state={metric.status}>
                <td>{metric.phase}</td>
                <th scope="row">{metric.label}</th>
                <td>
                  <strong>{metric.value}</strong>
                </td>
                <td>{metric.denominator}</td>
                <td>{metric.missingEvidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="reviewed-evaluation__guardrail" aria-labelledby="evaluation-guardrail-title">
        <div>
          <p className="eyebrow">Scientific guardrail</p>
          <h4 id="evaluation-guardrail-title">No fake precision or accuracy</h4>
        </div>
        <p>
          Workload counts, candidate metadata, and zero executed decisions cannot be substituted
          for reviewed confusion outcomes. No precision, recall, PR-AUC, accuracy, calibration, or
          coverage value is calculated.
        </p>
      </aside>

      <details className="reviewed-evaluation__provenance">
        <summary>Inspect evaluation-state provenance</summary>
        <p>
          Bundle <code>{replay.bundleId}</code> · section <code>evaluation_summaries</code> · producer{' '}
          <code>{replay.sourceRevisions.biominerSha}</code>
        </p>
        <ul>
          {model.provenance.map((artifact) => (
            <li key={artifact.artifactId}>
              <strong>{artifact.artifactId}</strong>
              <span>{artifact.path}</span>
              <code>{artifact.sha256}</code>
              <small>Producer {artifact.producerSha}</small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
