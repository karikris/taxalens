import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { buildWorkflowEfficiencyModel } from './workflowEfficiencyModel'

export function WorkflowEfficiencyReport({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildWorkflowEfficiencyModel(replay)

  return (
    <section className="workflow-efficiency" aria-labelledby="workflow-efficiency-title">
      <div className="workflow-efficiency__heading">
        <div>
          <p className="eyebrow">Engineering operations</p>
          <h3 id="workflow-efficiency-title">Workflow efficiency</h3>
          <p>
            Separate directly observed execution measurements from counterfactual savings. Missing
            saved-work counters stay unavailable even when checkpoint or deduplication diagnostics
            exist.
          </p>
        </div>
        <span className="workflow-efficiency__count">
          <strong>{model.measuredMetricCount}</strong>
          <span>of 6 measured</span>
        </span>
      </div>

      <EvidenceState state="review" title="One measured state ledger · five savings claims withheld">
        The fixture measures artifact and section completeness. It does not measure avoided API
        calls, downloads, inference, embedding work, or restart speedup.
      </EvidenceState>

      <ul className="workflow-efficiency__metrics" aria-label="Workflow efficiency measurements">
        {model.metrics.map((metric) => (
          <li key={metric.id} data-efficiency-status={metric.status}>
            <article>
              <div className="workflow-efficiency__metric-heading">
                <div>
                  <span>{metric.status === 'measured' ? 'Measured' : 'Unavailable'}</span>
                  <h4>{metric.label}</h4>
                </div>
                <strong>{metric.statusLabel}</strong>
              </div>
              <p className="workflow-efficiency__value">{metric.value}</p>
              <p>{metric.interpretation}</p>
              <dl>
                {metric.diagnostics.map((diagnostic) => (
                  <div key={diagnostic.label}>
                    <dt>{diagnostic.label}</dt>
                    <dd>{diagnostic.value}</dd>
                    <code>{diagnostic.sourceField}</code>
                  </div>
                ))}
              </dl>
            </article>
          </li>
        ))}
      </ul>

      <aside className="workflow-efficiency__guardrail" aria-labelledby="efficiency-guardrail-title">
        <div>
          <p className="eyebrow">Interpretation guardrail</p>
          <h4 id="efficiency-guardrail-title">Integrity is not scientific completeness</h4>
        </div>
        <p>
          {model.bundleVerification.verifiedArtifactCount} of{' '}
          {model.bundleVerification.artifactCount} artifacts passed checksum verification. Across{' '}
          {model.sectionStates.total} evidence sections, {model.sectionStates.available} are
          available, {model.sectionStates.partial} partial, and {model.sectionStates.unavailable}{' '}
          unavailable. No accuracy, readiness, or performance percentage is inferred.
        </p>
      </aside>

      <details className="workflow-efficiency__table">
        <summary>Read the complete efficiency ledger as a table</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Requested metric</th>
                <th scope="col">Measurement state</th>
                <th scope="col">Reported value</th>
                <th scope="col">Measured context</th>
                <th scope="col">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {model.metrics.map((metric) => (
                <tr key={metric.id}>
                  <th scope="row">{metric.label}</th>
                  <td>{metric.statusLabel}</td>
                  <td>{metric.value}</td>
                  <td>
                    {metric.diagnostics
                      .map((diagnostic) => `${diagnostic.label}: ${diagnostic.value}`)
                      .join(' · ')}
                  </td>
                  <td>{metric.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="workflow-efficiency__provenance">
        <summary>Inspect workflow-efficiency provenance</summary>
        <ul>
          {model.provenance.map((artifact) => (
            <li key={artifact.artifactId}>
              <strong>{artifact.artifactId}</strong>
              <span>
                {artifact.path} · {artifact.recordCount?.toLocaleString('en-US')} record
              </span>
              <code>{artifact.sha256}</code>
              <small>Producer {artifact.producerSha}</small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
