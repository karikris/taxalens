import type { RecordGeographicContext } from './recordGeographicContext'
import { blockedFinerRecordResolutions } from './recordPrecisionPolicy'

export function RecordPrecisionBoundary({
  context,
}: {
  readonly context: RecordGeographicContext
}) {
  const blockedFiner = blockedFinerRecordResolutions(
    context.precisionCells,
    context.selectedCell.spatialResolution,
  )
  return (
    <aside
      className="record-precision-boundary"
      aria-labelledby="record-precision-boundary-title"
      data-precision-limited={blockedFiner.length > 0 ? 'true' : 'false'}
    >
      <div>
        <p className="eyebrow">Coordinate precision boundary</p>
        <h4 id="record-precision-boundary-title">
          {blockedFiner.length > 0
            ? 'Finer geographic comparison blocked'
            : 'Finest configured comparison supported'}
        </h4>
        <p>
          Coordinate quality <strong>{humanize(context.candidateCoordinate.quality)}</strong>{' '}
          supports comparison through H3 resolution {context.selectedCell.spatialResolution}.
          Unsupported child cells are never inferred.
        </p>
      </div>
      <ul aria-label="Record geographic resolution support">
        {[...context.precisionCells]
          .sort((left, right) => left.spatialResolution - right.spatialResolution)
          .map((cell) => (
            <li
              key={cell.spatialResolution}
              aria-disabled={cell.supported ? undefined : 'true'}
              data-current={
                cell.spatialResolution === context.selectedCell.spatialResolution
                  ? 'true'
                  : undefined
              }
            >
              <strong>H3 resolution {cell.spatialResolution}</strong>
              <span>
                {cell.spatialResolution === context.selectedCell.spatialResolution
                  ? 'Current comparison'
                  : cell.supported
                    ? 'Supported coarser comparison'
                    : `Blocked · ${humanize(cell.supportStatus)}`}
              </span>
            </li>
          ))}
      </ul>
      {blockedFiner.length === 0 ? null : (
        <p role="status">
          Blocked finer resolutions:{' '}
          {blockedFiner.map(({ spatialResolution }) => spatialResolution).join(', ')}. The record
          remains available at its supported coarser cell.
        </p>
      )}
    </aside>
  )
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}
