import { useEffect, useMemo, useState } from 'react'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import {
  SHELL_VIEWS,
  shellHashForRoute,
  shellRouteForView,
  type VerificationRouteParams,
} from '../shell'
import { exportHumanReviewReceipt } from './exports'
import type { ReviewMediaCache } from './media'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_PACKET,
} from './reviewPacket'
import type { ReviewRepository } from './repositories'
import { resolveVerificationRoute } from './routing'
import {
  BlindFlickrReviewBoundary,
  CampaignSelector,
  ConflictQueue,
  filterReferenceReviewItems,
  ReferenceReviewFilters,
  ReferenceReviewHandoff,
  ReferenceSourceContextPanel,
  StructuredReferenceReviewControls,
  VerificationControls,
  VerificationItemViewer,
  VerificationProgress,
  VerificationSections,
  VerificationSummary,
  VerificationWorkflowStatus,
  type ReferenceReviewFilter,
} from './ui'
import { useVerificationWorkspaceController } from './ui/useVerificationWorkspaceController'
import './review.css'

export function VerificationWorkspace({
  cache,
  legacyStorage,
  now,
  replay,
  repository,
  route,
}: {
  readonly cache?: ReviewMediaCache
  readonly legacyStorage?: Pick<Storage, 'getItem' | 'removeItem'>
  readonly now?: () => Date
  readonly replay: ReplayEvidence
  readonly repository?: ReviewRepository
  readonly route?: VerificationRouteParams
}) {
  const resolvedRoute = resolveVerificationRoute(route)
  const controller = useVerificationWorkspaceController({
    ...(cache === undefined ? {} : { cache }),
    ...(resolvedRoute.itemId === null
      ? {}
      : { initialItemId: resolvedRoute.itemId }),
    ...(legacyStorage === undefined ? {} : { legacyStorage }),
    ...(now === undefined ? {} : { now }),
    ...(repository === undefined ? {} : { repository }),
  })
  const [referenceFilter, setReferenceFilter] =
    useState<ReferenceReviewFilter>('all')
  const referenceFilterContext = useMemo(
    () => ({
      targetAcceptedTaxonKey:
        HUMAN_REVIEW_CAMPAIGN.targetTaxon?.acceptedTaxonKey ?? null,
      currentOutcomes: Object.fromEntries(
        Object.entries(controller.currentDecisions).map(
          ([itemId, decision]) => [itemId, decision.outcome],
        ),
      ),
      conflictItemIds: new Set(
        controller.consensus
          .filter(
            ({ status }) => status === 'unresolved_disagreement',
          )
          .map(({ itemId }) => itemId),
      ),
    }),
    [controller.consensus, controller.currentDecisions],
  )
  const filteredReferenceItems = useMemo(
    () =>
      filterReferenceReviewItems(
        HUMAN_REVIEW_PACKET.items,
        referenceFilter,
        referenceFilterContext,
      ),
    [referenceFilter, referenceFilterContext],
  )
  const filteredReferenceIndices = useMemo(
    () =>
      filteredReferenceItems.map((item) =>
        HUMAN_REVIEW_PACKET.items.findIndex(
          ({ itemId }) => itemId === item.itemId,
        ),
      ),
    [filteredReferenceItems],
  )
  const filteredReferenceIndex = filteredReferenceIndices.indexOf(
    controller.index,
  )

  useEffect(() => {
    if (
      filteredReferenceIndices.length > 0 &&
      !filteredReferenceIndices.includes(controller.index)
    ) {
      controller.openIndex(filteredReferenceIndices[0]!)
    }
  }, [controller, filteredReferenceIndices])

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

      {resolvedRoute.errors.length > 0 && (
        <EvidenceState
          state="failure"
          title="Verification deep link was rejected"
        >
          {resolvedRoute.errors.join('; ')}. The committed default campaign is
          shown instead.
        </EvidenceState>
      )}

      {resolvedRoute.returnView !== null && (
        <a
          className="verification-return-link"
          href={shellHashForRoute(
            shellRouteForView(resolvedRoute.returnView),
          )}
        >
          Return to {shellViewLabel(resolvedRoute.returnView)}
        </a>
      )}

      <VerificationSections
        defaultSection={resolvedRoute.section}
        conflicts={
          <ConflictQueue
            adjudicationReadyItemIds={
              controller.adjudicationReadyItemIds
            }
            consensus={controller.consensus}
            defaultAdjudicatorId={controller.session.reviewerId}
            items={HUMAN_REVIEW_PACKET.items}
            onAdjudicate={controller.adjudicate}
            onOpenItem={(itemId) => {
              const itemIndex = HUMAN_REVIEW_PACKET.items.findIndex(
                (candidate) => candidate.itemId === itemId,
              )
              if (itemIndex !== -1) {
                controller.openIndex(itemIndex)
              }
            }}
          />
        }
        flickrResults={
          resolvedRoute.flickrCandidate === null ? undefined : (
            <FlickrCandidateRouteNotice
              candidate={resolvedRoute.flickrCandidate}
              mediaReason={replay.discovery.media.reason}
            />
          )
        }
        referenceImages={
          <>
            <CampaignSelector
              campaigns={[HUMAN_REVIEW_CAMPAIGN]}
              selectedCampaignId={HUMAN_REVIEW_CAMPAIGN.campaignId}
              onSelect={() => undefined}
            />

            <ReferenceReviewFilters
              context={referenceFilterContext}
              items={HUMAN_REVIEW_PACKET.items}
              value={referenceFilter}
              onChange={setReferenceFilter}
            />

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

      {filteredReferenceItems.length === 0 ? (
        <EvidenceState state="review" title="No reference images match">
          This campaign has no items in the selected {referenceFilter.replaceAll(
            '_',
            ' ',
          )}{' '}
          route. Choose another filter to continue.
        </EvidenceState>
      ) : filteredReferenceIndex === -1 ? (
        <EvidenceState state="review" title="Opening filtered reference item">
          Moving to the first image in the selected reference route.
        </EvidenceState>
      ) : (
        <>
      <ReferenceSourceContextPanel
        campaignTargetAcceptedTaxonKey={
          HUMAN_REVIEW_CAMPAIGN.targetTaxon?.acceptedTaxonKey ?? null
        }
        item={controller.item}
      />
      <div className="human-review__workspace">
        <VerificationItemViewer
          currentOutcome={controller.decision?.outcome}
          imageUrl={controller.imageUrl}
          index={filteredReferenceIndex}
          item={controller.item}
          scientificName={replay.target.scientificName}
          totalItems={filteredReferenceItems.length}
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
          decisionValidationError={controller.decisionValidationError}
          imageFailureReason={
            controller.inspection?.imageFailureReason ?? null
          }
          repositoryReady={controller.repositoryState === 'ready'}
          reviewerId={controller.session.reviewerId}
          scientificDecisionReady={controller.scientificDecisionReady}
          structuredControls={
            <StructuredReferenceReviewControls
              draft={controller.referenceAnnotations}
              onChange={controller.setReferenceAnnotations}
            />
          }
          onCommentChange={controller.setComment}
          onReviewerIdChange={controller.updateReviewerId}
          onSelectOutcome={controller.record}
        />
      </div>

      <VerificationProgress
        currentDecisions={controller.currentDecisions}
        index={filteredReferenceIndex}
        items={filteredReferenceItems}
        onOpenIndex={(nextIndex) =>
          controller.openIndex(filteredReferenceIndices[nextIndex]!)
        }
      />
        </>
      )}
            <VerificationSummary
              clearState={controller.clearState}
              counts={controller.counts}
              onClear={() => void controller.clearReview()}
              onExport={() => exportHumanReviewReceipt(controller.session)}
            />
            <ReferenceReviewHandoff
              campaign={HUMAN_REVIEW_CAMPAIGN}
              events={controller.session.events}
              items={HUMAN_REVIEW_PACKET.items}
            />
          </>
        }
      />
    </section>
  )
}

function shellViewLabel(view: string): string {
  return SHELL_VIEWS.find(({ id }) => id === view)?.label ?? view
}

function FlickrCandidateRouteNotice({
  candidate,
  mediaReason,
}: {
  readonly candidate: {
    readonly campaignId: string
    readonly itemId: string
    readonly recordId: string
    readonly sourceId: string
    readonly title: string
  }
  readonly mediaReason: string
}) {
  return (
    <section
      className="flickr-candidate-route"
      aria-labelledby="flickr-candidate-route-title"
    >
      <div>
        <p className="eyebrow">Routed candidate context</p>
        <h3 id="flickr-candidate-route-title">{candidate.title}</h3>
        <p>
          Evidence Lens selected this exact Flickr source for verification. The
          route is retained while its review media and sampling manifest remain
          unavailable.
        </p>
      </div>
      <dl>
        <div>
          <dt>Campaign route</dt>
          <dd>
            <code>{candidate.campaignId}</code>
          </dd>
        </div>
        <div>
          <dt>Candidate item</dt>
          <dd>
            <code>{candidate.itemId}</code>
          </dd>
        </div>
        <div>
          <dt>Source record</dt>
          <dd>
            <code>{candidate.sourceId}</code>
          </dd>
        </div>
        <div>
          <dt>Evidence record</dt>
          <dd>
            <code>{candidate.recordId}</code>
          </dd>
        </div>
      </dl>
      <EvidenceState
        state="blocked"
        title="Flickr candidate review media is unavailable"
      >
        {mediaReason} A scientific Yes, No, or Can’t tell decision cannot be
        recorded until checksum-verified media is committed. This candidate
        remains a search hypothesis.
      </EvidenceState>
      <BlindFlickrReviewBoundary />
    </section>
  )
}
