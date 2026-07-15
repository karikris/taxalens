import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { EvidenceFunnel } from './EvidenceFunnel'
import './dashboard.css'

export function DashboardWorkspace({ replay }: { readonly replay: ReplayEvidence }) {
  return (
    <section className="detail-panel dashboard-workspace" aria-labelledby="dashboard-title">
      <p className="eyebrow">First butterfly dashboard</p>
      <h2 id="dashboard-title">Verified local data boundary</h2>
      <p className="lede">
        Checksum-verified JSON opens the shell; four pinned Parquets remain available for on-demand
        analytics in Observatory, and no worker starts at bootstrap. Operational views use verified
        fixture counts and state boundaries. No dashboard number is a species occurrence, image
        label, or unsupported scientific metric.
      </p>
      <EvidenceState state="available" title="Credential-free replay">
        This view uses only same-origin static assets and does not contact a live backend.
      </EvidenceState>
      <dl className="evidence-facts">
        <div>
          <dt>Data mode</dt>
          <dd>{replay.verification.dataMode.replaceAll('-', ' ')}</dd>
        </div>
        <div>
          <dt>Fallback reason</dt>
          <dd>{replay.verification.fallbackReason.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>Scientific claims</dt>
          <dd>{replay.scientificClaimAllowed ? 'Allowed' : 'Not allowed'}</dd>
        </div>
      </dl>

      <EvidenceFunnel replay={replay} />
    </section>
  )
}
