import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { exportHumanReviewReceipt } from './exports'
import type { ReviewMediaCache } from './media'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_PACKET,
} from './reviewPacket'
import type { ReviewRepository } from './repositories'
import {
  CampaignSelector,
  VerificationControls,
  VerificationItemViewer,
  VerificationProgress,
  VerificationSections,
  VerificationSummary,
  VerificationWorkflowStatus,
} from './ui'
import { useVerificationWorkspaceController } from './ui/useVerificationWorkspaceController'
import './review.css'

export function VerificationWorkspace({
  cache,
  legacyStorage,
  now,
  replay,
  repository,
}: {
  readonly cache?: ReviewMediaCache
  readonly legacyStorage?: Pick<Storage, 'getItem' | 'removeItem'>
  readonly now?: () => Date
  readonly replay: ReplayEvidence
  readonly repository?: ReviewRepository
}) {
  const controller = useVerificationWorkspaceController({
    ...(cache === undefined ? {} : { cache }),
    ...(legacyStorage === undefined ? {} : { legacyStorage }),
    ...(now === undefined ? {} : { now }),
    ...(repository === undefined ? {} : { repository }),
  })

  return (
    <section
      className="detail-panel human-review"
      aria-labelledby="human-review-title"
      data-workflow-phase={controller.workflow.phase}
    >
      <div className="human-review__heading">
        <div>
          <p className="eyebrow">Local human verification</p>
          <h2 id="human-review-title">Review the label, one image at a time</h2>
          <p className="lede">
            Prepare a checksum-verified three-image browser cache, inspect the
            displayed label, then choose Yes, No, Can’t tell, Can’t view, or
            Skip. Comments are optional.
          </p>
        </div>
        <div className="human-review__progress" aria-live="polite">
          <strong>
            {controller.counts.recorded} / {HUMAN_REVIEW_PACKET.items.length}
          </strong>
          <span>recorded locally</span>
        </div>
      </div>

      <CampaignSelector
        campaigns={[HUMAN_REVIEW_CAMPAIGN]}
        selectedCampaignId={HUMAN_REVIEW_CAMPAIGN.campaignId}
        onSelect={() => undefined}
      />

      <VerificationSections
        referenceImages={
          <>
            <EvidenceState
              state="available"
              title="BioMiner suitability confirmation acknowledged"
            >
              The pinned BioMiner update records 81 / 81 provider-supported
              items as human-confirmed suitable for their assigned prototype
              roles. It still records 0 independently taxonomically verified
              labels.
            </EvidenceState>

            <aside className="human-review__boundary">
              <strong>Separate review campaign</strong>
              <span>
                These CC-licensed Commons images are not the frozen BioMiner
                reference bank. Decisions remain in this browser’s append-only
                IndexedDB ledger until you export a receipt; no result is sent
                to a server.
              </span>
            </aside>

            <VerificationWorkflowStatus state={controller.workflow} />

            {controller.persistenceError !== null && (
              <EvidenceState
                state="failure"
                title="Review repository persistence failed"
              >
                {controller.persistenceError}
              </EvidenceState>
            )}

      {typeof window.indexedDB === 'undefined' && (
        <EvidenceState state="review" title="IndexedDB is unavailable">
          The append-only ledger is using temporary memory. Existing legacy
          review data remains untouched so a durable migration can be retried in
          a browser with IndexedDB.
        </EvidenceState>
      )}

      {controller.repositoryState === 'loading' && (
        <EvidenceState state="review" title="Opening offline review ledger">
          Loading the campaign and migrating any legacy local review evidence
          before decisions are enabled.
        </EvidenceState>
      )}

      {controller.cacheState !== 'checking' &&
        !controller.cacheStatus.persistentBrowserCache && (
          <EvidenceState
            state="review"
            title="Persistent media cache is unavailable"
          >
            Cache Storage is unavailable or restricted. Verified images use a
            temporary in-memory fallback and will need to be prepared again
            after reload.
          </EvidenceState>
        )}

      <section className="review-cache" aria-labelledby="review-cache-title">
        <div>
          <p className="eyebrow">Step 1 · prepare media</p>
          <h3 id="review-cache-title">Small local image cache</h3>
          <p>
            {controller.cacheStatus.cachedCount} of{' '}
            {controller.cacheStatus.totalCount} images verified ·{' '}
            {controller.cacheStatus.persistentBrowserCache
              ? 'browser Cache Storage'
              : 'temporary in-memory fallback'}
          </p>
        </div>
        <div className="review-cache__actions">
          <button
            type="button"
            disabled={
              controller.cacheState === 'preparing' ||
              controller.cacheStatus.ready
            }
            onClick={controller.prepareCache}
          >
            {controller.cacheState === 'preparing'
              ? `Downloading ${controller.cacheStatus.cachedCount} / ${controller.cacheStatus.totalCount}…`
              : controller.cacheStatus.ready
                ? 'Cache ready'
                : 'Prepare review cache'}
          </button>
          {controller.cacheState === 'preparing' && (
            <button
              type="button"
              className="review-button--quiet"
              onClick={controller.cancelPreparation}
            >
              Cancel media preparation
            </button>
          )}
        </div>
      </section>

      {Object.keys(controller.cacheStatus.itemFailures).length > 0 && (
        <aside className="review-cache__failures" aria-live="polite">
          <strong>Media cache issues</strong>
          <ul>
            {Object.entries(controller.cacheStatus.itemFailures).map(
              ([itemId, reason]) => (
                <li key={itemId}>
                  <code>{itemId}</code>: {reason}
                </li>
              ),
            )}
          </ul>
        </aside>
      )}

      {controller.cacheState === 'error' && (
        <EvidenceState
          state="failure"
          title="The review cache could not be prepared"
        >
          {controller.cacheError}
        </EvidenceState>
      )}

      {controller.clearState === 'success' && (
        <EvidenceState state="available" title="Local review state cleared">
          The media cache and IndexedDB campaign state were cleared after the
          browser operations completed.
        </EvidenceState>
      )}

      {controller.clearState === 'error' && (
        <EvidenceState
          state="failure"
          title="Local review state could not be cleared"
        >
          {controller.clearError} The current in-memory review state was
          preserved.
        </EvidenceState>
      )}

      <div className="human-review__workspace">
        <VerificationItemViewer
          currentOutcome={controller.decision?.outcome}
          imageUrl={controller.imageUrl}
          index={controller.index}
          item={controller.item}
          scientificName={replay.target.scientificName}
          totalItems={HUMAN_REVIEW_PACKET.items.length}
          onImageLoad={() =>
            controller.recordImageOpened(controller.item)
          }
          onImageError={() => {
            if (controller.imageUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(controller.imageUrl)
            }
            controller.recordImageFailure(
              controller.item,
              'The verified review image could not be displayed.',
            )
          }}
        />
        <VerificationControls
          cacheState={controller.cacheState}
          comment={controller.comment}
          currentOutcome={controller.decision?.outcome}
          imageFailureReason={
            controller.inspection?.imageFailureReason ?? null
          }
          repositoryReady={controller.repositoryState === 'ready'}
          reviewerId={controller.session.reviewerId}
          scientificDecisionReady={controller.scientificDecisionReady}
          onCommentChange={controller.setComment}
          onReviewerIdChange={controller.updateReviewerId}
          onSelectOutcome={controller.record}
        />
      </div>

      <VerificationProgress
        currentDecisions={controller.currentDecisions}
        index={controller.index}
        items={HUMAN_REVIEW_PACKET.items}
        onOpenIndex={controller.openIndex}
      />
            <VerificationSummary
              clearState={controller.clearState}
              counts={controller.counts}
              onClear={() => void controller.clearReview()}
              onExport={() => exportHumanReviewReceipt(controller.session)}
            />
          </>
        }
      />
    </section>
  )
}
