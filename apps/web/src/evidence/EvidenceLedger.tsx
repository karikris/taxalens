import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { buildEvidenceLedger, type LedgerEventStatus } from './evidenceLedgerModel'

const STATUS_LABELS: Readonly<Record<LedgerEventStatus, string>> = {
  available: 'Available',
  metadata: 'Metadata only',
  unavailable: 'Unavailable',
  pending: 'Pending',
}

export function EvidenceLedger({ replay }: { readonly replay: ReplayEvidence }) {
  const ledger = buildEvidenceLedger(replay)

  return (
    <section className="evidence-ledger" aria-labelledby="evidence-ledger-title">
      <div className="evidence-ledger__heading">
        <div>
          <p className="eyebrow">Truthful evidence audit</p>
          <h3 id="evidence-ledger-title">Evidence ledger</h3>
          <p>
            Sequence records the evidence lifecycle, not wall-clock chronology. Per-event times are
            withheld unless an artifact supplies one.
          </p>
        </div>
        <strong>{ledger.events.length} states</strong>
      </div>

      <EvidenceState state="review" title="No comment-driven promotion">
        <span>{ledger.commentEnrichment}</span>. Zero comments exist, so the record remains awaiting
        human review.
      </EvidenceState>

      <ol className="evidence-ledger__timeline" aria-label="Evidence lifecycle ledger">
        {ledger.events.map((event) => (
          <li key={event.id} data-status={event.status}>
            <div className="evidence-ledger__marker" aria-hidden="true">
              {event.sequence}
            </div>
            <article>
              <div className="evidence-ledger__event-heading">
                <div>
                  <p>Step {event.sequence}</p>
                  <h4>{event.label}</h4>
                </div>
                <span>{STATUS_LABELS[event.status]}</span>
              </div>
              <p>{event.detail}</p>
              <dl>
                <div>
                  <dt>Event time</dt>
                  <dd>
                    {event.recordedAt === null ? (
                      'Unavailable — no per-event timestamp committed'
                    ) : (
                      <time dateTime={event.recordedAt}>{formatTimestamp(event.recordedAt)}</time>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>{event.verification.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                  <dt>Artifacts</dt>
                  <dd>{event.artifactIds.join(' · ')}</dd>
                </div>
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value))
}
