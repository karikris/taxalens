import { EvidenceState, EvidenceTier } from '../design-system'
import type {
  HumanVerificationEvidence,
  HumanVerificationItemEvidence,
} from './humanVerificationEvidence'

export function HumanVerificationEvidencePanel({
  evidence,
  loadError = null,
}: {
  readonly evidence: HumanVerificationEvidence | null
  readonly loadError?: string | null
}) {
  return (
    <section
      className="human-verification-evidence"
      aria-labelledby="human-verification-evidence-title"
    >
      <div>
        <p className="eyebrow">Append-only browser evidence</p>
        <h3 id="human-verification-evidence-title">
          Local human verification evidence
        </h3>
        <p>
          Current outcomes are projections of retained local events. Reviewer
          counts identify recorded reviewer labels, not verified independence.
        </p>
      </div>

      {loadError !== null ? (
        <EvidenceState state="blocked" title="Local review lineage is unavailable">
          {loadError}
        </EvidenceState>
      ) : evidence === null ? (
        <EvidenceState state="loading" title="Reading local review lineage">
          Opening the append-only IndexedDB ledger without contacting a server.
        </EvidenceState>
      ) : evidence.state === 'unavailable' ? (
        <EvidenceState state="blocked" title="Local review lineage is unavailable">
          {evidence.unavailableReason}
        </EvidenceState>
      ) : evidence.state === 'empty' ? (
        <EvidenceState state="review" title="No local human outcomes recorded">
          The Commons judge campaign has no append-only review events in this
          browser yet.
        </EvidenceState>
      ) : (
        <>
          <div className="human-verification-evidence__boundary">
            <EvidenceTier tier="reviewed" />
            <p>
              These outcomes apply to the separate Commons reference fixture,
              not the inspected Flickr candidate. They do not promote a species
              occurrence or change the frozen BioMiner reference bank.
            </p>
          </div>
          <dl className="human-verification-evidence__summary">
            <div>
              <dt>Current human outcomes</dt>
              <dd>
                {evidence.recordedItemCount} of {evidence.totalItemCount}
              </dd>
            </div>
            <div>
              <dt>Reviewer count</dt>
              <dd>
                {evidence.reviewerCount}{' '}
                {evidence.reviewerCount === 1
                  ? 'recorded reviewer identity'
                  : 'recorded reviewer identities'}
              </dd>
            </div>
            <div>
              <dt>Conflict status</dt>
              <dd>Not calculated</dd>
            </div>
            <div>
              <dt>Retained events</dt>
              <dd>{evidence.totalEventCount}</dd>
            </div>
          </dl>
          <p className="human-verification-evidence__conflict">
            {evidence.conflictReason}
          </p>
          <ol
            className="human-verification-evidence__items"
            aria-label="Current human verification outcomes"
          >
            {evidence.items.map((item) => (
              <HumanVerificationOutcome key={item.itemId} item={item} />
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

function HumanVerificationOutcome({
  item,
}: {
  readonly item: HumanVerificationItemEvidence
}) {
  return (
    <li>
      <article>
        <div>
          <span>Current human outcome</span>
          <h4>{item.verificationLabel}</h4>
        </div>
        <strong>{outcomeLabel(item.outcome)}</strong>
        <dl>
          <div>
            <dt>Reviewer count</dt>
            <dd>{item.reviewerCount}</dd>
          </div>
          <div>
            <dt>Conflict status</dt>
            <dd>Not calculated</dd>
          </div>
          <div>
            <dt>Current event ID</dt>
            <dd>
              <code>{item.currentEventId}</code>
            </dd>
          </div>
          <div>
            <dt>Reviewed at</dt>
            <dd>
              <time dateTime={item.reviewedAt}>{item.reviewedAt}</time>
            </dd>
          </div>
        </dl>
        <details>
          <summary>Inspect {item.eventIds.length} retained event IDs</summary>
          <ol>
            {item.eventIds.map((eventId) => (
              <li key={eventId}>
                <code>{eventId}</code>
              </li>
            ))}
          </ol>
        </details>
      </article>
    </li>
  )
}

function outcomeLabel(outcome: HumanVerificationItemEvidence['outcome']): string {
  switch (outcome) {
    case 'yes':
      return 'Yes'
    case 'no':
      return 'No'
    case 'cant_tell':
      return 'Can’t tell'
    case 'cant_view':
      return 'Can’t view'
    case 'skipped':
      return 'Skipped'
  }
}
