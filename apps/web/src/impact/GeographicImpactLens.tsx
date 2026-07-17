import { EvidenceState } from '../design-system'
import { OfflineWorldMap } from './OfflineWorldMap'

export function GeographicImpactLens({
  webGlSupported,
}: {
  readonly webGlSupported?: boolean
}) {
  return (
    <section
      id="geographic-impact-lens"
      className="geographic-impact-lens"
      aria-labelledby="geographic-impact-lens-title"
      tabIndex={-1}
      data-map-purpose="geographic-evidence-comparison"
      data-scientific-claim-allowed="false"
    >
      <div className="geographic-impact-lens__heading">
        <p className="eyebrow">Baseline and candidate evidence</p>
        <h3 id="geographic-impact-lens-title">TaxaLens Geographic Impact Lens</h3>
        <p>
          This scientific view asks where baseline occurrence evidence exists and where Flickr
          candidate evidence could add potential coverage after human review and release-gate
          validation. The map below is the local cartographic foundation; it does not yet display
          an impact claim.
        </p>
      </div>
      <EvidenceState state="review" title="Geographic evidence layers remain quality-gated">
        The current hosted v1 replay does not publish the v2 Geographic Impact sections. Countries
        are visible for orientation, but blue baseline and amber Flickr layers remain unavailable
        here until their verified bundle inputs are connected.
      </EvidenceState>
      <OfflineWorldMap {...(webGlSupported === undefined ? {} : { webGlSupported })} />
    </section>
  )
}
