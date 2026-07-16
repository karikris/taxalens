import { EvidenceState } from '../../design-system'
import type { VerificationWorkflowState } from '../domain/verificationWorkflow'

export function VerificationWorkflowStatus({
  state,
}: {
  readonly state: VerificationWorkflowState
}) {
  switch (state.phase) {
    case 'loading_campaign':
      return (
        <EvidenceState state="loading" title="Loading verification campaign">
          Opening the append-only ledger and restoring local campaign state.
        </EvidenceState>
      )
    case 'preparing_media':
      return (
        <EvidenceState state="loading" title="Preparing verified media">
          Downloading and checksum-validating the campaign’s local image cache.
        </EvidenceState>
      )
    case 'recording':
      return (
        <EvidenceState state="loading" title="Recording review event">
          Appending the immutable event to the local review repository.
        </EvidenceState>
      )
    case 'saved':
      return (
        <EvidenceState state="available" title="Review event saved locally">
          The append-only ledger accepted the latest event.
        </EvidenceState>
      )
    case 'conflict':
      return (
        <EvidenceState state="review" title="Reviewer conflict requires adjudication">
          The item remains reviewable; no consensus claim is made.
        </EvidenceState>
      )
    case 'complete':
      return (
        <EvidenceState state="available" title="Local review queue complete">
          Every campaign item has a current local outcome. This is not a
          consensus or accuracy claim.
        </EvidenceState>
      )
    case 'ready':
    case 'error':
      return null
  }
}
