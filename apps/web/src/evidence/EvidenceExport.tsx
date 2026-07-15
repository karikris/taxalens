import { useState } from 'react'

import type { EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import {
  downloadEvidenceFile,
  prepareEvidenceExport,
  type EvidenceExportBundle,
} from './evidenceExport'

export type EvidenceExportPreparer = typeof prepareEvidenceExport

type ExportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly bundle: EvidenceExportBundle }

export function EvidenceExport({
  facade,
  prepare = prepareEvidenceExport,
  replay,
}: {
  readonly facade: EvidenceFacade
  readonly prepare?: EvidenceExportPreparer
  readonly replay: ReplayEvidence
}) {
  const [state, setState] = useState<ExportState>({ kind: 'idle' })

  const prepareBundle = () => {
    setState({ kind: 'preparing' })
    void (async () => {
      try {
        const source = facade
          .loadAnalyticsReplayInput()
          .artifacts.find(({ artifactId }) => artifactId === 'biominer-flickr-query-hits-parquet')
        if (source === undefined) {
          throw new Error('Verified BioMiner query-hit Parquet is unavailable')
        }
        setState({ kind: 'ready', bundle: await prepare(replay, source) })
      } catch (reason: unknown) {
        setState({
          kind: 'error',
          message:
            reason instanceof Error ? reason.message : 'The local audit export could not be prepared.',
        })
      }
    })()
  }

  return (
    <section className="evidence-export" aria-labelledby="evidence-export-title">
      <div className="evidence-export__heading">
        <div>
          <p className="eyebrow">Portable audit boundary</p>
          <h3 id="evidence-export-title">Export evidence</h3>
          <p>
            Prepare canonical JSON, a CSV ledger summary, one preserved BioMiner Parquet source,
            a checksum manifest, and a provenance report entirely in this browser.
          </p>
        </div>
        <button
          type="button"
          disabled={state.kind === 'preparing'}
          onClick={prepareBundle}
        >
          {state.kind === 'preparing'
            ? 'Preparing checksums…'
            : state.kind === 'ready'
              ? 'Prepare again'
              : 'Prepare local audit bundle'}
        </button>
      </div>

      <EvidenceState state="review" title="Unsigned manifest">
        No signing key is committed in the verified replay. SHA-256 checksums are included, but no
        signer or signature is invented.
      </EvidenceState>

      {state.kind === 'idle' ? (
        <p className="evidence-export__status">
          No export has been prepared. The action performs no network request and records no new
          scientific evidence.
        </p>
      ) : state.kind === 'preparing' ? (
        <EvidenceState state="loading" title="Hashing verified local artifacts">
          The existing BioMiner query-hit Parquet is being copied byte-for-byte.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="failure" title="Evidence export stopped">
          {state.message}
        </EvidenceState>
      ) : (
        <div className="evidence-export__ready" aria-live="polite">
          <EvidenceState state="available" title="Five audit files prepared locally">
            Select each file to download it. Preparation is deterministic and adds no scientific
            claim.
          </EvidenceState>
          <ul aria-label="Prepared evidence export files">
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
          <p className="evidence-export__boundary">
            The Parquet file is the verified BioMiner Flickr query-hit source, not a serialization
            of the evidence ledger. Its committed checksum is preserved.
          </p>
        </div>
      )}
    </section>
  )
}

function fileLabel(role: EvidenceExportBundle['files'][number]['role']): string {
  switch (role) {
    case 'evidence_json':
      return 'JSON evidence'
    case 'csv_summary':
      return 'CSV summary'
    case 'source_parquet':
      return 'Source Parquet'
    case 'manifest':
      return 'Checksum manifest'
    case 'provenance_report':
      return 'Provenance report'
  }
}

function formatBytes(value: number): string {
  if (value < 1_000) {
    return `${value} B`
  }
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} kB`
}
