import { useEffect, useState } from 'react'

import { EvidenceState } from '../design-system'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'
import { IndexedDbReviewRepository } from '../review/repositories'
import {
  createVerificationDashboardView,
  type LocalVerificationDashboardState,
} from './verificationDashboardModel'

const INITIAL_LOCAL_STATE: LocalVerificationDashboardState = Object.freeze({
  availability: 'loading',
  decisiveItemCount: 0,
  attemptedItemCount: 0,
  conflictItemCount: 0,
  eventCount: 0,
  reason: null,
})

export function VerificationQualityOverview({
  localState,
}: {
  readonly localState?: LocalVerificationDashboardState
}) {
  const loadedLocalState = useLocalVerificationDashboardState()
  return (
    <VerificationQualityOverviewContent
      localState={localState ?? loadedLocalState}
    />
  )
}

export function VerificationQualityOverviewContent({
  localState,
}: {
  readonly localState: LocalVerificationDashboardState
}) {
  const model = createVerificationDashboardView(
    localState,
  )
  const milestone = model.nextReviewMilestone
  return (
    <section
      className="verification-dashboard"
      aria-labelledby="verification-dashboard-title"
    >
      <header className="verification-dashboard__heading">
        <div>
          <p className="eyebrow">Human-verification quality</p>
          <h3 id="verification-dashboard-title">
            Campaigns, coverage, and the next honest gate
          </h3>
          <p>
            Local reviewer events update the Commons workflow count. Private
            audit and reference packets remain ready but contribute no result
            until reviewed evidence is imported.
          </p>
        </div>
        <a href="#verification">Open Verification</a>
      </header>

      <div className="verification-dashboard__metrics">
        <article>
          <span>Decisive coverage</span>
          <strong>
            {model.coverage.decisiveItemCount} /{' '}
            {model.coverage.assignmentCount}
          </strong>
          <small>
            {(model.coverage.percent * 100).toFixed(1)}% of campaign
            assignments · {model.coverage.attemptedItemCount} locally attempted
          </small>
        </article>
        <article data-state="blocked">
          <span>Reference readiness</span>
          <strong>Blocked</strong>
          <small>
            {model.referenceReadiness.independentlyVerifiedRecordCount}{' '}
            independently verified ·{' '}
            {model.referenceReadiness.providerRoleSuitableRecordCount}{' '}
            provider-role suitable only
          </small>
        </article>
        <article>
          <span>Conflicts</span>
          <strong>
            {model.conflicts.localAvailability === 'available'
              ? model.conflicts.localCount
              : 'Unavailable'}
          </strong>
          <small>
            Local Commons projection; other campaign consensus unavailable
          </small>
        </article>
        <article data-state="unavailable">
          <span>Quality interval</span>
          <strong>Unavailable</strong>
          <small>
            {model.qualityInterval.decisiveFlickrAuditCount} decisive weighted
            Flickr audits · first checkpoint{' '}
            {model.qualityInterval.nextMilestone}
          </small>
        </article>
      </div>

      {model.coverage.localAvailability === 'unavailable' && (
        <EvidenceState state="review" title="Local review ledger unavailable">
          {model.localReason}
        </EvidenceState>
      )}

      <div className="verification-dashboard__milestone">
        <div>
          <p className="eyebrow">Next review milestone</p>
          <h4>{milestone.label}</h4>
          <p>
            {milestone.current} / {milestone.target} complete ·{' '}
            {milestone.remaining} remaining
          </p>
        </div>
        <div
          className="verification-dashboard__meter"
          role="progressbar"
          aria-label={milestone.label}
          aria-valuemin={0}
          aria-valuemax={milestone.target}
          aria-valuenow={milestone.current}
        >
          <span
            style={{
              width: `${(milestone.current / milestone.target) * 100}%`,
            }}
          />
        </div>
        <p>
          {milestone.kind === 'local_workflow'
            ? 'This validates the local review loop but does not create a quality interval.'
            : 'The private owner-group audit must retain its inclusion weights before an interval can be estimated.'}
        </p>
      </div>

      <div className="verification-dashboard__campaigns">
        {model.campaigns.map((campaign) => (
          <article key={campaign.campaignId}>
            <div>
              <span>{campaign.sourceLabel}</span>
              <strong>{campaign.itemCount} items</strong>
            </div>
            <h4>{campaign.title}</h4>
            <p>{campaign.purpose}</p>
            <footer>
              <span>{campaign.status}</span>
              <span>
                {campaign.access === 'public_local'
                  ? 'public local fixture'
                  : 'private review packet'}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}

function useLocalVerificationDashboardState(): LocalVerificationDashboardState {
  const [state, setState] =
    useState<LocalVerificationDashboardState>(INITIAL_LOCAL_STATE)
  useEffect(() => {
    let active = true
    if (typeof globalThis.indexedDB === 'undefined') {
      setState({
        availability: 'unavailable',
        decisiveItemCount: 0,
        attemptedItemCount: 0,
        conflictItemCount: 0,
        eventCount: 0,
        reason:
          'IndexedDB is unavailable, so local verification coverage cannot be read.',
      })
      return () => {
        active = false
      }
    }
    const repository = new IndexedDbReviewRepository({
      seeds: [
        {
          campaign: HUMAN_REVIEW_CAMPAIGN,
          items: HUMAN_REVIEW_ITEMS,
        },
      ],
    })
    void Promise.all([
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
      repository.loadConsensus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ])
      .then(([events, consensus]) => {
        if (!active) return
        const attempted = consensus.filter(
          ({ status }) => status !== 'pending',
        )
        const decisive = consensus.filter(({ status }) =>
          ['complete_agreement', 'adjudicated'].includes(status),
        )
        const conflicts = consensus.filter(
          ({ status }) => status === 'unresolved_disagreement',
        )
        setState({
          availability: 'available',
          decisiveItemCount: decisive.length,
          attemptedItemCount: attempted.length,
          conflictItemCount: conflicts.length,
          eventCount: events.length,
          reason: null,
        })
      })
      .catch((reason: unknown) => {
        if (!active) return
        setState({
          availability: 'unavailable',
          decisiveItemCount: 0,
          attemptedItemCount: 0,
          conflictItemCount: 0,
          eventCount: 0,
          reason:
            reason instanceof Error
              ? `Local review ledger unavailable: ${reason.message}`
              : 'Local review ledger unavailable.',
        })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}
