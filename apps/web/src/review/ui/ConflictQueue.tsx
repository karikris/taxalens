import { EvidenceState } from '../../design-system'

export function ConflictQueue() {
  return (
    <section aria-labelledby="verification-conflict-title">
      <h3 id="verification-conflict-title">Conflict queue</h3>
      <EvidenceState state="blocked" title="Consensus is not calculated yet">
        Reviewer disagreement and adjudication appear here only after the
        consensus policy is implemented from append-only events.
      </EvidenceState>
    </section>
  )
}
