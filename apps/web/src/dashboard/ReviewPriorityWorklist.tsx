import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { flickrCandidateRouteForRecord } from '../review/routing/flickrCandidateRoute'
import { shellHashForRoute, verificationShellRoute } from '../shell'
import { buildReviewPriorityModel, type ReviewPriorityFactor } from './reviewPriorityModel'

const STATUS_COPY: Readonly<Record<ReviewPriorityFactor['status'], string>> = {
  attention: 'Evidence-backed blocker',
  'aggregate-only': 'Context only',
  'verified-zero': 'Verified absence',
  unavailable: 'Not evaluated',
}

export function ReviewPriorityWorklist({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildReviewPriorityModel(replay)
  const { item } = model
  const verificationTarget = flickrCandidateRouteForRecord(item.recordId)

  return (
    <section className="review-priority" aria-labelledby="review-priority-title">
      <div className="review-priority__heading">
        <div>
          <p className="eyebrow">Human-review operations</p>
          <h3 id="review-priority-title">Review work priority</h3>
          <p>
            Audit the requested priority factors against committed evidence. Queue membership is
            real; a score-derived rank is not available.
          </p>
        </div>
        <span className="review-priority__count" aria-label="One awaiting-review work item">
          <strong>1</strong>
          <span>work item</span>
        </span>
      </div>

      <EvidenceState state="review" title="One committed work item · priority unavailable">
        Position 1 of 1 means this is the only awaiting-review record. It is not a numeric rank,
        confidence score, or scientific conclusion.
      </EvidenceState>

      <article className="review-priority__item" aria-labelledby="review-item-title">
        <div className="review-priority__item-heading">
          <div>
            <span className="review-priority__position">Position {item.positionLabel}</span>
            <h4 id="review-item-title">{item.displayLabel}</h4>
            <code>{item.recordId}</code>
          </div>
          <span className="review-priority__state">Human review pending</span>
        </div>
        <p>{item.reason}</p>
        <dl className="review-priority__item-facts">
          <div>
            <dt>Priority score</dt>
            <dd>{item.priorityLabel}</dd>
          </div>
          <div>
            <dt>Blocked gates</dt>
            <dd>
              {item.blockedGateCount} of {item.gateCount}
            </dd>
          </div>
          <div>
            <dt>Position basis</dt>
            <dd>{item.positionBasis}</dd>
          </div>
          <div>
            <dt>Allowed transition</dt>
            <dd>
              <code>{item.allowedTransition}</code>
            </dd>
          </div>
        </dl>
        {verificationTarget !== null && (
          <a
            className="review-priority__open-queue"
            href={shellHashForRoute(
              verificationShellRoute({
                campaignId: verificationTarget.campaignId,
                itemId: verificationTarget.itemId,
                returnView: 'dashboard',
              }),
            )}
          >
            Open review queue
          </a>
        )}
      </article>

      <div className="review-priority__factor-heading">
        <div>
          <p className="eyebrow">Seven requested dimensions</p>
          <h4 id="priority-factor-title">Priority factor audit</h4>
        </div>
        <span>No factor is converted to points</span>
      </div>
      <ol className="review-priority__factors" aria-labelledby="priority-factor-title">
        {model.factors.map((factor) => (
          <li key={factor.id} data-factor-status={factor.status}>
            <article>
              <div>
                <span>{STATUS_COPY[factor.status]}</span>
                <h5>{factor.label}</h5>
              </div>
              <strong>{factor.statusLabel}</strong>
              <p className="review-priority__factor-value">{factor.value}</p>
              <p>{factor.detail}</p>
              <small>Priority effect: not scored</small>
              <code>{factor.sourceFields.join(' · ')}</code>
            </article>
          </li>
        ))}
      </ol>

      <details className="review-priority__table">
        <summary>Read the complete priority audit as a table</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Requested factor</th>
                <th scope="col">Evidence state</th>
                <th scope="col">Verified value</th>
                <th scope="col">Priority effect</th>
                <th scope="col">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {model.factors.map((factor) => (
                <tr key={factor.id}>
                  <th scope="row">{factor.label}</th>
                  <td>{factor.statusLabel}</td>
                  <td>{factor.value}</td>
                  <td>Not scored</td>
                  <td>{factor.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="review-priority__provenance">
        <summary>Inspect review-work provenance</summary>
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
