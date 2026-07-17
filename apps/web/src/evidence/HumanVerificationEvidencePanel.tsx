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

      {evidence !== null && (
        <dl className="human-verification-evidence__summary">
          <div>
            <dt>Current human consensus</dt>
            <dd>
              {evidence.state === 'unavailable'
                ? 'Unavailable'
                : `${evidence.decisiveConsensusCount} of ${evidence.totalItemCount} decisive`}
            </dd>
            <small>
              {evidence.reviewerCount}{' '}
              {evidence.reviewerCount === 1
                ? 'recorded reviewer label'
                : 'recorded reviewer labels'}{' '}
              · {evidence.unresolvedConsensusCount} unresolved conflicts
            </small>
          </div>
          <div>
            <dt>Quality contribution</dt>
            <dd>Workflow only</dd>
            <small>
              {evidence.qualityContribution.eligibleWeightedAuditOutcomeCount}{' '}
              weighted Flickr audit outcomes
            </small>
          </div>
          <div data-state="blocked">
            <dt>Reference review state</dt>
            <dd>Blocked</dd>
            <small>
              {evidence.referenceReviewState.independentlyReviewedItemCount} /{' '}
              {evidence.referenceReviewState.campaignItemCount} independently
              reviewed ·{' '}
              {evidence.referenceReviewState.providerRoleSuitableRecordCount}{' '}
              provider-role suitable only
            </small>
          </div>
          <div>
            <dt>Event lineage</dt>
            <dd>
              {evidence.state === 'unavailable'
                ? 'Unavailable'
                : `${evidence.totalEventCount} retained`}
            </dd>
            <small>Append-only local event IDs</small>
          </div>
        </dl>
      )}

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
            <dt>Current consensus</dt>
            <dd>
              {consensusLabel(item.consensusStatus)}
              {item.consensusOutcome === null
                ? ''
                : ` · ${outcomeLabel(item.consensusOutcome)}`}
            </dd>
          </div>
          <div>
            <dt>Quality contribution</dt>
            <dd>Workflow only · excluded from weighted audit</dd>
          </div>
          <div>
            <dt>Effective reviews</dt>
            <dd>
              {item.effectiveReviewCount} · {item.decisiveReviewCount} decisive
            </dd>
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

function consensusLabel(status: HumanVerificationItemEvidence['consensusStatus']): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'complete_agreement':
      return 'Complete agreement'
    case 'unresolved_disagreement':
      return 'Unresolved disagreement'
    case 'uncertain_only':
      return 'Uncertain only'
    case 'media_failure':
      return 'Media failure'
    case 'deferred':
      return 'Deferred'
    case 'adjudicated':
      return 'Adjudicated'
  }
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
