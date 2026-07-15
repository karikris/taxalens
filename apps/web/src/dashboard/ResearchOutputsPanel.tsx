import { useState } from 'react'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { downloadEvidenceFile } from '../evidence/evidenceExport'
import {
  prepareResearchOutputs,
  type ResearchOutputBundle,
  type ResearchOutputRole,
} from './researchOutputs'

export type ResearchOutputPreparer = typeof prepareResearchOutputs

type PreparationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly bundle: ResearchOutputBundle }

const OUTPUTS = Object.freeze([
  {
    role: 'review_queue',
    label: 'Review queue',
    format: 'JSON',
    description: 'One unranked awaiting-review item plus the complete seven-factor audit.',
  },
  {
    role: 'evidence_summary',
    label: 'Evidence summary',
    format: 'JSON',
    description: 'Verified bundle state, evidence funnel, section states, and workflow counts.',
  },
  {
    role: 'manifest',
    label: 'Manifest',
    format: 'JSON + SHA-256',
    description: 'Checksums and media types for the four payload outputs; signature unavailable.',
  },
  {
    role: 'provenance',
    label: 'Provenance',
    format: 'JSON',
    description: 'All 22 artifact receipts, pinned source revisions, and local generation method.',
  },
  {
    role: 'evaluation_report',
    label: 'Evaluation report',
    format: 'JSON',
    description: 'Phase 13 absence, Phase 14 review block, and seven unavailable metric states.',
  },
] satisfies readonly {
  readonly role: ResearchOutputRole
  readonly label: string
  readonly format: string
  readonly description: string
}[])

export function ResearchOutputsPanel({
  replay,
  prepare = prepareResearchOutputs,
}: {
  readonly replay: ReplayEvidence
  readonly prepare?: ResearchOutputPreparer
}) {
  const [state, setState] = useState<PreparationState>({ kind: 'idle' })

  const prepareOutputs = () => {
    setState({ kind: 'preparing' })
    void prepare(replay)
      .then((bundle) => setState({ kind: 'ready', bundle }))
      .catch((reason: unknown) => {
        setState({
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The local research outputs could not be prepared.',
        })
      })
  }

  return (
    <section className="research-outputs" aria-labelledby="research-outputs-title">
      <div className="research-outputs__heading">
        <div>
          <p className="eyebrow">Portable research handoff</p>
          <h3 id="research-outputs-title">Export research outputs</h3>
          <p>
            Prepare five deterministic, lightweight reports from the checksum-verified replay.
            Generation stays in this browser and records no new evidence.
          </p>
        </div>
        <button
          type="button"
          disabled={state.kind === 'preparing'}
          onClick={prepareOutputs}
        >
          {state.kind === 'preparing'
            ? 'Preparing checksums…'
            : state.kind === 'ready'
              ? 'Prepare again'
              : 'Prepare five research outputs'}
        </button>
      </div>

      <EvidenceState state="review" title="Deterministic local export · unsigned manifest">
        Each output preserves blocked and unavailable states. No signer, ranked queue, evaluated
        metric, preparation time, or scientific claim is invented.
      </EvidenceState>

      {state.kind === 'preparing' ? (
        <EvidenceState state="loading" title="Hashing five local reports">
          Canonical JSON and SHA-256 digests are being prepared without a network request.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="failure" title="Research export stopped">
          {state.message}
        </EvidenceState>
      ) : state.kind === 'ready' ? (
        <EvidenceState state="available" title="Five research outputs prepared locally">
          Download each independently. Preparing the same replay again produces the same bytes and
          checksums.
        </EvidenceState>
      ) : (
        <p className="research-outputs__idle">
          Nothing has been generated yet. Review the five output boundaries before preparing them.
        </p>
      )}

      <ul className="research-outputs__files" aria-label="Research output files">
        {OUTPUTS.map((output) => {
          const file = state.kind === 'ready'
            ? state.bundle.files.find(({ role }) => role === output.role)
            : undefined
          return (
            <li key={output.role} data-output-state={file === undefined ? 'planned' : 'ready'}>
              <article>
                <div className="research-outputs__file-heading">
                  <span>{output.format}</span>
                  <strong>{file === undefined ? 'Local preparation' : 'Ready'}</strong>
                </div>
                <h4>{output.label}</h4>
                <p>{output.description}</p>
                {file === undefined ? (
                  <small>Filename and checksum appear after preparation.</small>
                ) : (
                  <div className="research-outputs__receipt">
                    <code>{file.filename}</code>
                    <small>
                      {formatBytes(file.bytes.byteLength)} · SHA-256 <code>{file.sha256}</code>
                    </small>
                    <button type="button" onClick={() => downloadEvidenceFile(file)}>
                      Download {output.label}
                    </button>
                  </div>
                )}
              </article>
            </li>
          )
        })}
      </ul>

      <aside className="research-outputs__boundary" aria-labelledby="research-output-boundary-title">
        <div>
          <p className="eyebrow">Export boundary</p>
          <h4 id="research-output-boundary-title">Portable does not mean promoted</h4>
        </div>
        <p>
          The review file is an unranked worklist snapshot. The evaluation file contains no
          precision or accuracy value. The manifest covers four payloads and excludes its own
          digest; its downloaded file still receives a displayed SHA-256 checksum.
        </p>
      </aside>
    </section>
  )
}

function formatBytes(value: number): string {
  if (value < 1_000) {
    return `${value} B`
  }
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} kB`
}
