import { flickrCandidateRouteForSource } from '../review/routing/flickrCandidateRoute'
import { shellHashForRoute, verificationShellRoute } from '../shell'
import {
  geographicImpactRecordHash,
  type GeographicImpactRecordRouteTarget,
} from '../impact/geographicImpactRecordRoute'
import { geographicMapResolutionForScope } from '../impact/publicGeographicImpactMapData'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from '../impact/geographicScope'
import type { RecordGeographicContext } from './recordGeographicContext'

export function RecordGeographicActions({
  context,
}: {
  readonly context: RecordGeographicContext
}) {
  const mapTarget = recordGeographicMapTarget(context)
  const verificationTarget = flickrCandidateRouteForSource(context.sourceId)
  return (
    <section className="record-geographic-actions" aria-labelledby="record-geographic-actions-title">
      <div>
        <p className="eyebrow">Record actions</p>
        <h4 id="record-geographic-actions-title">Continue with this evidence identity</h4>
      </div>
      <div className="record-geographic-actions__links">
        {mapTarget === null ? (
          <span aria-disabled="true">Geographic Impact link unavailable</span>
        ) : (
          <>
            <a href={geographicImpactRecordHash({ ...mapTarget, focus: 'lens' })}>
              Open Geographic Impact
            </a>
            <a href={geographicImpactRecordHash({ ...mapTarget, focus: 'table' })}>
              View records in this cell
            </a>
          </>
        )}
        {verificationTarget === null ? (
          <span aria-disabled="true">Verification route unavailable</span>
        ) : (
          <a
            href={shellHashForRoute(
              verificationShellRoute({
                campaignId: verificationTarget.campaignId,
                itemId: verificationTarget.itemId,
                returnView: 'evidence-lens',
              }),
            )}
          >
            Verify this result
          </a>
        )}
      </div>
      <details className="record-geographic-actions__provenance">
        <summary>Inspect baseline provenance</summary>
        <dl>
          <div>
            <dt>Baseline snapshot</dt>
            <dd><code>{context.sources.baselineSnapshotId}</code></dd>
          </div>
          <div>
            <dt>Geographic Impact cells SHA-256</dt>
            <dd><code>{context.sources.geographicImpactCellsSha256}</code></dd>
          </div>
          <div>
            <dt>Selected baseline cell evidence</dt>
            <dd>
              {context.impact.baselineUnionCount.toLocaleString('en-US')} union rows ·{' '}
              {context.impact.baselineRangeInferenceEligibleCount.toLocaleString('en-US')}{' '}
              range-inference eligible
            </dd>
          </div>
          <div>
            <dt>Nearest baseline cell</dt>
            <dd><code>{context.impact.nearestBaselineCellId ?? 'Unavailable'}</code></dd>
          </div>
        </dl>
        <p>
          The digest verifies the committed analytical artifact bytes. It does not prove biological
          absence, provider independence, or taxonomic correctness.
        </p>
      </details>
    </section>
  )
}

function recordGeographicMapTarget(
  context: RecordGeographicContext,
): Omit<GeographicImpactRecordRouteTarget, 'focus'> | null {
  const countryScope =
    context.selectedCell.countryCode === null
      ? undefined
      : TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country.find(
          ({ country_code }) => country_code === context.selectedCell.countryCode,
        )
  const scope = countryScope ?? TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root
  const spatialResolution = geographicMapResolutionForScope(scope)
  const precisionCell = context.precisionCells.find(
    (cell) => cell.spatialResolution === spatialResolution && cell.supported,
  )
  if (precisionCell?.spatialCellId === null || precisionCell?.spatialCellId === undefined) return null
  return Object.freeze({
    scopeId: scope.scope_id,
    spatialCellId: precisionCell.spatialCellId,
    spatialResolution,
  })
}
