import { EvidenceState } from '../../design-system'

export function QualityPanel() {
  return (
    <section aria-labelledby="verification-quality-title">
      <h3 id="verification-quality-title">Verification quality</h3>
      <EvidenceState state="blocked" title="Quality estimates are not available">
        Accuracy, uncertainty, and exclusion-adjusted estimates remain withheld
        until a leakage-safe sampling design and quality estimator are present.
      </EvidenceState>
    </section>
  )
}
