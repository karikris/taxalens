import type { RecordPrecisionCell } from './recordGeographicContext'

export type RecordPrecisionDecision<T extends RecordPrecisionCell = RecordPrecisionCell> =
  | {
      readonly status: 'available'
      readonly cell: T & { readonly spatialCellId: string; readonly supported: true }
    }
  | {
      readonly status: 'blocked'
      readonly requestedResolution: number
      readonly reason: string
      readonly supportStatus: string
    }

export function selectFinestSupportedPrecisionCell<T extends RecordPrecisionCell>(
  cells: readonly T[],
): T | null {
  const supported = cells
    .filter((cell) => cell.supported && cell.spatialCellId !== null)
    .sort((left, right) => right.spatialResolution - left.spatialResolution)
  return supported[0] ?? null
}

export function resolveRecordPrecisionCell<T extends RecordPrecisionCell>(
  cells: readonly T[],
  requestedResolution: number,
): RecordPrecisionDecision<T> {
  if (!Number.isInteger(requestedResolution) || requestedResolution < 0 || requestedResolution > 15) {
    throw new Error('Requested record comparison resolution is invalid')
  }
  const row = cells.find(({ spatialResolution }) => spatialResolution === requestedResolution)
  if (row === undefined) {
    return Object.freeze({
      status: 'blocked',
      requestedResolution,
      supportStatus: 'not_configured',
      reason: `H3 resolution ${requestedResolution} is not declared by the record geography artifact.`,
    })
  }
  if (!row.supported || row.spatialCellId === null) {
    return Object.freeze({
      status: 'blocked',
      requestedResolution,
      supportStatus: row.supportStatus,
      reason: `H3 resolution ${requestedResolution} is blocked: ${humanize(row.supportStatus)}.`,
    })
  }
  return Object.freeze({
    status: 'available',
    cell: Object.freeze({ ...row, spatialCellId: row.spatialCellId, supported: true as const }),
  })
}

export function blockedFinerRecordResolutions(
  cells: readonly RecordPrecisionCell[],
  selectedResolution: number,
): readonly RecordPrecisionCell[] {
  return Object.freeze(
    cells
      .filter(
        ({ spatialResolution, supported }) =>
          spatialResolution > selectedResolution && !supported,
      )
      .sort((left, right) => left.spatialResolution - right.spatialResolution),
  )
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}
