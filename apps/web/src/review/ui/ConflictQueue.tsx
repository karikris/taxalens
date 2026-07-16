import { useState } from 'react'

import { EvidenceState } from '../../design-system'
import type {
  VerificationConsensus,
  VerificationEvent,
  VerificationItem,
} from '../domain'

export function ConflictQueue({
  consensus = [],
  defaultAdjudicatorId = '',
  items = [],
  adjudicationReadyItemIds = new Set<string>(),
  onAdjudicate,
  onOpenItem,
}: {
  readonly consensus?: readonly VerificationConsensus[]
  readonly defaultAdjudicatorId?: string
  readonly items?: readonly VerificationItem[]
  readonly adjudicationReadyItemIds?: ReadonlySet<string>
  readonly onAdjudicate?: (
    conflict: VerificationConsensus,
    outcome: 'yes' | 'no',
    adjudicatorId: string,
    comment: string,
  ) => readonly string[]
  readonly onOpenItem?: (itemId: string) => void
}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]))
  const conflicts = consensus.filter(
    ({ status }) => status === 'unresolved_disagreement',
  )
  return (
    <section
      className="verification-conflict-queue"
      aria-labelledby="verification-conflict-title"
    >
      <h3 id="verification-conflict-title">Conflict queue</h3>
      {conflicts.length === 0 ? (
        <EvidenceState state="available" title="No unresolved conflicts">
          Consensus is calculated from the append-only event ledger. New
          reviewer disagreement will appear here without overwriting either
          decision.
        </EvidenceState>
      ) : (
        <>
          <p>
            {conflicts.length} item{conflicts.length === 1 ? '' : 's'} need
            adjudication. A majority does not erase dissent.
          </p>
          <div className="verification-conflict-queue__items">
            {conflicts.map((conflict) => {
              const item = itemById.get(conflict.itemId)
              if (item === undefined) {
                return (
                  <EvidenceState
                    key={conflict.itemId}
                    state="failure"
                    title="Conflict item is missing"
                  >
                    The consensus ledger names {conflict.itemId}, but its item
                    manifest is unavailable.
                  </EvidenceState>
                )
              }
              return (
                <ConflictCard
                  key={conflict.itemId}
                  conflict={conflict}
                  item={item}
                  adjudicationReady={adjudicationReadyItemIds.has(item.itemId)}
                  defaultAdjudicatorId={defaultAdjudicatorId}
                  onAdjudicate={onAdjudicate}
                  onOpenItem={onOpenItem}
                />
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function ConflictCard({
  conflict,
  item,
  adjudicationReady,
  defaultAdjudicatorId,
  onAdjudicate,
  onOpenItem,
}: {
  readonly conflict: VerificationConsensus
  readonly item: VerificationItem
  readonly adjudicationReady: boolean
  readonly defaultAdjudicatorId: string
  readonly onAdjudicate:
    | ((
        conflict: VerificationConsensus,
        outcome: 'yes' | 'no',
        adjudicatorId: string,
        comment: string,
      ) => readonly string[])
    | undefined
  readonly onOpenItem: ((itemId: string) => void) | undefined
}) {
  return (
    <article className="verification-conflict-card">
      <div className="verification-conflict-card__media">
        <img
          src={item.previewUri}
          alt={`Conflict review candidate for ${item.targetTaxon.scientificName}`}
          loading="lazy"
        />
      </div>
      <div className="verification-conflict-card__body">
        <div>
          <p className="eyebrow">{providerLabel(item.source)} conflict</p>
          <h4>
            <i>{item.targetTaxon.scientificName}</i>
          </h4>
          <p>
            Source observation <code>{item.sourceObservationId}</code> · media{' '}
            <code>{item.sourceMediaId}</code>
          </p>
        </div>
        <dl className="verification-conflict-card__facts">
          <div>
            <dt>Conflicting fields</dt>
            <dd>{conflict.conflictingFields.map(fieldLabel).join(', ')}</dd>
          </div>
          <div>
            <dt>Effective reviewers</dt>
            <dd>{conflict.effectiveReviewerIds.join(', ')}</dd>
          </div>
          <div>
            <dt>Duplicate group</dt>
            <dd>
              <code>{item.duplicateGroupId}</code>
            </dd>
          </div>
          <div>
            <dt>Provenance</dt>
            <dd>
              <a href={item.rights.sourceUri} target="_blank" rel="noreferrer">
                {item.rights.attribution}
              </a>{' '}
              · {item.rights.licenseName}
            </dd>
          </div>
        </dl>
        <div
          className="verification-conflict-card__events"
          aria-label="Conflicting reviewer events"
        >
          {conflict.latestEvents.map((event) => (
            <ReviewerEvent key={event.eventId} event={event} />
          ))}
        </div>
        {onOpenItem !== undefined && (
          <button type="button" onClick={() => onOpenItem(item.itemId)}>
            Open item for adjudication
          </button>
        )}
        {onAdjudicate !== undefined && (
          <AdjudicationForm
            conflict={conflict}
            ready={adjudicationReady}
            defaultAdjudicatorId={defaultAdjudicatorId}
            onAdjudicate={onAdjudicate}
          />
        )}
      </div>
    </article>
  )
}

function AdjudicationForm({
  conflict,
  defaultAdjudicatorId,
  onAdjudicate,
  ready,
}: {
  readonly conflict: VerificationConsensus
  readonly defaultAdjudicatorId: string
  readonly onAdjudicate: (
    conflict: VerificationConsensus,
    outcome: 'yes' | 'no',
    adjudicatorId: string,
    comment: string,
  ) => readonly string[]
  readonly ready: boolean
}) {
  const [adjudicatorId, setAdjudicatorId] = useState(defaultAdjudicatorId)
  const [comment, setComment] = useState('')
  const [failures, setFailures] = useState<readonly string[]>([])

  function submit(outcome: 'yes' | 'no') {
    setFailures(
      onAdjudicate(conflict, outcome, adjudicatorId, comment),
    )
  }

  return (
    <section
      className="verification-adjudication"
      aria-labelledby={`adjudication-${encodeURIComponent(conflict.itemId)}`}
    >
      <h5 id={`adjudication-${encodeURIComponent(conflict.itemId)}`}>
        Independent adjudication
      </h5>
      {!ready && (
        <p className="verification-adjudication__gate">
          Open this item first. Yes and No stay disabled until the
          checksum-verified image has been displayed.
        </p>
      )}
      <label>
        Adjudicator ID
        <input
          type="text"
          value={adjudicatorId}
          onChange={(event) => setAdjudicatorId(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Optional adjudication comment
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
        />
      </label>
      {failures.length > 0 && (
        <p className="verification-adjudication__error" role="alert">
          {failures.join(' ')}
        </p>
      )}
      <div className="verification-adjudication__actions">
        <button
          type="button"
          disabled={!ready}
          onClick={() => submit('yes')}
        >
          Adjudicate Yes
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => submit('no')}
        >
          Adjudicate No
        </button>
      </div>
      <p>
        The new event links the exact conflict IDs. Neither reviewer decision
        is removed.
      </p>
    </section>
  )
}

function ReviewerEvent({ event }: { readonly event: VerificationEvent }) {
  return (
    <section className="verification-conflict-event">
      <strong>{event.reviewerId.trim() || 'anonymous'}</strong>
      <span>
        {outcomeLabel(event.outcome)} · {formatInstant(event.reviewedAt)}
      </span>
      {event.nonTargetCategory !== null && (
        <span>{fieldLabel(event.nonTargetCategory)}</span>
      )}
      {event.alternativeTaxon !== null && (
        <span>
          Alternative: <i>{event.alternativeTaxon.scientificName}</i>
        </span>
      )}
      {event.comment !== null && <q>{event.comment}</q>}
      <code>{event.eventId}</code>
    </section>
  )
}

function providerLabel(source: VerificationItem['source']): string {
  switch (source) {
    case 'flickr':
      return 'Flickr'
    case 'gbif':
      return 'GBIF'
    case 'inaturalist':
      return 'iNaturalist'
    case 'wikimedia_commons':
      return 'Wikimedia Commons'
    case 'taxalens_fixture':
      return 'TaxaLens fixture'
  }
}

function outcomeLabel(outcome: VerificationEvent['outcome']): string {
  switch (outcome) {
    case 'yes':
      return 'Yes'
    case 'no':
      return 'No'
    case 'cant_tell':
      return 'Can’t tell'
    case 'cant_view':
      return 'Can’t view'
    case 'skipped':
      return 'Skip'
  }
}

function fieldLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase())
}

function formatInstant(value: string): string {
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      })
    : value
}
