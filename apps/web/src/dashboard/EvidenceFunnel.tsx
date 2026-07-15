import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { buildEvidenceFunnel, type EvidenceFunnelStatus } from './evidenceFunnelModel'

const STATUS_LABELS: Readonly<Record<EvidenceFunnelStatus, string>> = {
  verified: 'Verified',
  partial: 'Metadata only',
  unavailable: 'Unavailable output',
  review: 'Review pending',
}

export function EvidenceFunnel({ replay }: { readonly replay: ReplayEvidence }) {
  const funnel = buildEvidenceFunnel(replay)

  return (
    <section className="evidence-funnel" aria-labelledby="evidence-funnel-title">
      <div className="evidence-funnel__heading">
        <div>
          <p className="eyebrow">Operational evidence flow</p>
          <h3 id="evidence-funnel-title">Evidence funnel</h3>
          <p>
            Seven evidence states are ordered by workflow, not scaled as one conserved population.
            Every value retains its own unit and source.
          </p>
        </div>
        <strong>{funnel.stages.length} stages</strong>
      </div>

      <EvidenceState state="review" title="Workflow counts, not confirmed occurrences">
        Candidates, decisions, and the awaiting-review record are operational states. Adjacent stages
        use unlike units, so no percentage conversion or retention rate is shown.
      </EvidenceState>

      <ol className="evidence-funnel__stages" aria-label="Evidence funnel stages">
        {funnel.stages.map((stage) => (
          <li key={stage.id} data-status={stage.status}>
            <article>
              <div className="evidence-funnel__stage-heading">
                <div>
                  <span>Stage {stage.sequence}</span>
                  <h4>{stage.label}</h4>
                </div>
                <div className="evidence-funnel__value">
                  <strong>
                    {stage.value === null ? 'Unavailable' : stage.value.toLocaleString('en-US')}
                  </strong>
                  <span>{stage.unit}</span>
                </div>
              </div>
              <p>{stage.detail}</p>
              <div className="evidence-funnel__status">
                <span>{STATUS_LABELS[stage.status]}</span>
                <code>{stage.measurementBasis}</code>
              </div>
              <details>
                <summary>Inspect provenance for {stage.label}</summary>
                <ul>
                  {stage.artifacts.map((artifact) => (
                    <li key={artifact.artifactId}>
                      <strong>{artifact.artifactId}</strong>
                      <span>{artifact.path}</span>
                      <code>{artifact.sha256}</code>
                      <small>Producer {artifact.producerSha}</small>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
            {stage.transitionToNext === null ? null : (
              <p className="evidence-funnel__transition">
                <span aria-hidden="true">↓</span>
                {stage.transitionToNext}
              </p>
            )}
          </li>
        ))}
      </ol>

      <details className="evidence-funnel__alternative">
        <summary>Read complete textual alternative</summary>
        <ol>
          {funnel.stages.map((stage) => (
            <li key={stage.id}>
              {stage.label}:{' '}
              {stage.value === null ? 'unavailable' : stage.value.toLocaleString('en-US')}{' '}
              {stage.unit}. {stage.detail}
            </li>
          ))}
        </ol>
        <p>
          These counts have unlike units. They must not be added, compared as equivalent
          populations, or read as confirmation. The final item is one replay record awaiting work,
          not a materialized ranked queue or scientific result.
        </p>
      </details>
    </section>
  )
}
