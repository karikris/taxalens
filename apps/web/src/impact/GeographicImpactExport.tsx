import { useEffect, useState } from 'react'

import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import { EvidenceState } from '../design-system'
import { downloadEvidenceFile } from '../evidence/evidenceExport'
import {
  prepareGeographicImpactExportBundle,
  type GeographicImpactExportBundle,
} from './geographicImpactExport'
import {
  loadVerifiedGeographicImpactParquetBytes,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

export type GeographicImpactExportPreparer = (
  data: PublicGeographicImpactMapData,
  scope: CountryHierarchyNode,
) => Promise<GeographicImpactExportBundle>

type ExportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly bundle: GeographicImpactExportBundle }

export function GeographicImpactExport({
  data,
  prepare = prepareGeographicImpactExportForDownload,
  scope,
}: {
  readonly data: PublicGeographicImpactMapData
  readonly prepare?: GeographicImpactExportPreparer
  readonly scope: CountryHierarchyNode
}) {
  const [state, setState] = useState<ExportState>({ kind: 'idle' })
  useEffect(() => setState({ kind: 'idle' }), [data, scope.scope_id])

  const prepareBundle = () => {
    setState({ kind: 'preparing' })
    void prepare(data, scope).then(
      (bundle) => setState({ kind: 'ready', bundle }),
      (error: unknown) =>
        setState({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The local Geographic Impact export could not be prepared.',
        }),
    )
  }

  return (
    <section className="geographic-impact-export" aria-labelledby="geographic-impact-export-title">
      <div className="geographic-impact-export__heading">
        <div>
          <p className="eyebrow">Portable geographic evidence</p>
          <h4 id="geographic-impact-export-title">Export Geographic Impact</h4>
          <p>
            Prepare selected-scope JSON and CSV, the verified source cells Parquet, methodology,
            and a SHA-256 manifest entirely in this browser.
          </p>
        </div>
        <button type="button" disabled={state.kind === 'preparing'} onClick={prepareBundle}>
          {state.kind === 'preparing'
            ? 'Preparing checksums…'
            : state.kind === 'ready'
              ? 'Prepare again'
              : 'Prepare geographic export'}
        </button>
      </div>
      {state.kind === 'idle' ? (
        <p>
          No export has been prepared. The action uploads nothing and does not create a scientific
          release.
        </p>
      ) : state.kind === 'preparing' ? (
        <EvidenceState state="loading" title="Hashing local geographic evidence">
          TaxaLens is verifying the source Parquet and hashing deterministic scope payloads.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="failure" title="Geographic export stopped">
          {state.message}
        </EvidenceState>
      ) : (
        <div className="geographic-impact-export__ready" aria-live="polite">
          <EvidenceState state="available" title="Seven geographic export files prepared">
            Scope <code>{scope.scope_id}</code> is ready with unsigned SHA-256 checksums. No signer
            is invented.
          </EvidenceState>
          <ul aria-label="Prepared Geographic Impact export files">
            {state.bundle.files.map((file) => (
              <li key={file.role}>
                <div>
                  <strong>{fileLabel(file.role)}</strong>
                  <code>{file.filename}</code>
                  <small>
                    {formatBytes(file.bytes.byteLength)} · SHA-256 <code>{file.sha256}</code>
                  </small>
                </div>
                <button type="button" onClick={() => downloadEvidenceFile(file)}>
                  Download {fileLabel(file.role)}
                </button>
              </li>
            ))}
          </ul>
          <p>
            The source Parquet covers the full target at all supported resolutions. The JSON and
            CSV files contain the selected scope. Flickr evidence remains candidate evidence.
          </p>
        </div>
      )}
    </section>
  )
}

export async function prepareGeographicImpactExportForDownload(
  data: PublicGeographicImpactMapData,
  scope: CountryHierarchyNode,
): Promise<GeographicImpactExportBundle> {
  const sourceParquetBytes = await loadVerifiedGeographicImpactParquetBytes()
  return prepareGeographicImpactExportBundle(data, scope, sourceParquetBytes)
}

function fileLabel(role: GeographicImpactExportBundle['files'][number]['role']): string {
  switch (role) {
    case 'cells_json':
      return 'Scoped cells JSON'
    case 'cells_csv':
      return 'Scoped cells CSV'
    case 'source_cells_parquet':
      return 'Source cells Parquet'
    case 'scope_summary_json':
      return 'Scope summary JSON'
    case 'scope_summary_csv':
      return 'Scope summary CSV'
    case 'methodology_json':
      return 'Methodology and provenance'
    case 'manifest_json':
      return 'Checksum manifest'
  }
}

function formatBytes(value: number): string {
  if (value < 1_000) return `${value} B`
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} kB`
}
