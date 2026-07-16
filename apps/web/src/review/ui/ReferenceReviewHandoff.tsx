import { useState } from 'react'

import { downloadEvidenceFile } from '../../evidence/evidenceExport'
import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import type { VerificationEvent } from '../domain/verificationEvents'
import {
  prepareReferenceReviewDecisionImport,
  type ReferenceDecisionImportFile,
} from '../exports/referenceDecisionImport'

type HandoffState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'preparing' }
  | {
      readonly phase: 'success'
      readonly rowCount: number
      readonly sha256: string
    }
  | { readonly phase: 'error'; readonly message: string }

export function ReferenceReviewHandoff({
  campaign,
  download = downloadEvidenceFile,
  events,
  items,
  prepare = prepareReferenceReviewDecisionImport,
}: {
  readonly campaign: VerificationCampaign
  readonly download?: (file: ReferenceDecisionImportFile) => void
  readonly events: readonly VerificationEvent[]
  readonly items: readonly VerificationItem[]
  readonly prepare?: (
    campaign: VerificationCampaign,
    items: readonly VerificationItem[],
    events: readonly VerificationEvent[],
  ) => Promise<ReferenceDecisionImportFile>
}) {
  const [state, setState] = useState<HandoffState>({ phase: 'idle' })
  const unavailableReason = referenceReviewHandoffUnavailableReason(
    campaign,
    items,
    events,
  )

  const exportHandoff = async () => {
    setState({ phase: 'preparing' })
    try {
      const file = await prepare(campaign, items, events)
      download(file)
      setState({
        phase: 'success',
        rowCount: file.rowCount,
        sha256: file.sha256,
      })
    } catch (error) {
      setState({
        phase: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The reference review handoff could not be prepared.',
      })
    }
  }

  return (
    <section
      className="reference-review-handoff"
      aria-labelledby="reference-review-handoff-title"
    >
      <div>
        <p className="eyebrow">BioMiner handoff</p>
        <h3 id="reference-review-handoff-title">Reference decision import</h3>
        <p>
          Prepared for BioMiner import; not imported in the public replay.
        </p>
        {unavailableReason !== null && (
          <p className="reference-review-handoff__reason">
            {unavailableReason}
          </p>
        )}
        {state.phase === 'success' && (
          <p role="status">
            Downloaded {state.rowCount} decision row
            {state.rowCount === 1 ? '' : 's'} · SHA-256{' '}
            <code>{state.sha256}</code>
          </p>
        )}
        {state.phase === 'error' && (
          <p role="alert" className="reference-review-handoff__error">
            {state.message}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={unavailableReason !== null || state.phase === 'preparing'}
        aria-busy={state.phase === 'preparing'}
        onClick={() => void exportHandoff()}
      >
        {state.phase === 'preparing'
          ? 'Preparing Parquet handoff…'
          : 'Export BioMiner handoff'}
      </button>
    </section>
  )
}

export function referenceReviewHandoffUnavailableReason(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
): string | null {
  if (campaign.biominerSha === null) {
    return 'This credential-free Commons campaign is separate from a BioMiner review queue.'
  }
  if (
    campaign.kind !== 'reference_identity_verification' ||
    items.length === 0 ||
    items.some(
      (item) =>
        item.campaignId !== campaign.campaignId ||
        !/^reference-review-request:[0-9a-f]{64}$/.test(item.itemId) ||
        !/^reference-media:[0-9a-f]{64}$/.test(item.sourceMediaId),
    )
  ) {
    return 'This campaign does not contain a complete BioMiner reference queue binding.'
  }
  if (
    !events.some(
      ({ outcome }) =>
        outcome === 'yes' || outcome === 'no' || outcome === 'cant_tell',
    )
  ) {
    return 'Record at least one scientific reference decision before exporting the handoff.'
  }
  return null
}
