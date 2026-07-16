import { EvidenceState } from '../../design-system'
import {
  isVerificationAdjudicationEvent,
  type VerificationEvent,
  type VerificationItem,
} from '../domain'

export function DecisionHistory({
  events = [],
  items = [],
}: {
  readonly events?: readonly VerificationEvent[]
  readonly items?: readonly VerificationItem[]
}) {
  const itemById = new Map(items.map((item) => [item.itemId, item]))
  const supersededEventIds = new Set(
    events
      .map(({ supersedesEventId }) => supersedesEventId)
      .filter((eventId): eventId is string => eventId !== null),
  )
  const groups = [...new Set(events.map(({ itemId }) => itemId))]
    .sort()
    .map((itemId) => ({
      itemId,
      item: itemById.get(itemId),
      events: events
        .filter((event) => event.itemId === itemId)
        .sort(compareEvents),
    }))

  return (
    <section
      className="verification-decision-history"
      aria-labelledby="verification-decision-history-title"
    >
      <h3 id="verification-decision-history-title">
        Immutable decision history
      </h3>
      {groups.length === 0 ? (
        <EvidenceState state="review" title="No review events yet">
          Reviewer decisions, revisions, media failures, skips, and
          adjudications will appear here in chronological order.
        </EvidenceState>
      ) : (
        <>
          <p>
            {events.length} append-only event
            {events.length === 1 ? '' : 's'} across {groups.length} item
            {groups.length === 1 ? '' : 's'}. Superseded decisions remain
            visible.
          </p>
          <div className="verification-decision-history__items">
            {groups.map(({ events: itemEvents, item, itemId }) => (
              <article
                className="verification-decision-history__item"
                key={itemId}
              >
                <header>
                  <p className="eyebrow">
                    {item === undefined
                      ? 'Unavailable item manifest'
                      : providerLabel(item.source)}
                  </p>
                  <h4>
                    {item === undefined ? (
                      <code>{itemId}</code>
                    ) : (
                      <i>{item.targetTaxon.scientificName}</i>
                    )}
                  </h4>
                  {item !== undefined && (
                    <p>
                      Source observation{' '}
                      <code>{item.sourceObservationId}</code> · media{' '}
                      <code>{item.sourceMediaId}</code>
                    </p>
                  )}
                </header>
                <ol>
                  {itemEvents.map((event) => (
                    <li key={event.eventId}>
                      <HistoryEvent
                        event={event}
                        superseded={supersededEventIds.has(event.eventId)}
                      />
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function HistoryEvent({
  event,
  superseded,
}: {
  readonly event: VerificationEvent
  readonly superseded: boolean
}) {
  const adjudication = isVerificationAdjudicationEvent(event)
  return (
    <article
      className="verification-history-event"
      data-adjudication={adjudication}
      data-superseded={superseded}
    >
      <div className="verification-history-event__heading">
        <div>
          <strong>{event.reviewerId.trim() || 'anonymous'}</strong>
          <span>
            {outcomeLabel(event.outcome)} · {formatInstant(event.reviewedAt)}
          </span>
        </div>
        <div
          className="verification-history-event__badges"
          aria-label="Event state"
        >
          {adjudication && <span>Adjudication</span>}
          {event.reviewRound > 1 && (
            <span>Revision round {event.reviewRound}</span>
          )}
          {superseded && <span>Superseded</span>}
          {!superseded && <span>Effective</span>}
        </div>
      </div>
      {event.comment !== null && <q>{event.comment}</q>}
      <dl>
        <div>
          <dt>Event ID</dt>
          <dd>
            <code>{event.eventId}</code>
          </dd>
        </div>
        {event.supersedesEventId !== null && (
          <div>
            <dt>Supersedes</dt>
            <dd>
              <code>{event.supersedesEventId}</code>
            </dd>
          </div>
        )}
        {event.conflictsWithDecisionId !== null && (
          <div>
            <dt>BioMiner conflict pointer</dt>
            <dd>
              <code>{event.conflictsWithDecisionId}</code>
            </dd>
          </div>
        )}
        {adjudication && (
          <>
            <div>
              <dt>Source conflict events</dt>
              <dd>
                {event.adjudication.sourceConflictEventIds.map((eventId) => (
                  <code key={eventId}>{eventId}</code>
                ))}
              </dd>
            </div>
            <div>
              <dt>Source conflict fields</dt>
              <dd>
                {event.adjudication.sourceConflictFields
                  .map(fieldLabel)
                  .join(', ')}
              </dd>
            </div>
            <div>
              <dt>Source reviewers</dt>
              <dd>{event.adjudication.sourceReviewerIds.join(', ')}</dd>
            </div>
          </>
        )}
      </dl>
    </article>
  )
}

function compareEvents(
  left: VerificationEvent,
  right: VerificationEvent,
): number {
  return (
    left.reviewedAt.localeCompare(right.reviewedAt) ||
    left.reviewRound - right.reviewRound ||
    left.eventId.localeCompare(right.eventId)
  )
}

function providerLabel(source: VerificationItem['source']): string {
  switch (source) {
    case 'flickr':
      return 'Flickr review history'
    case 'gbif':
      return 'GBIF review history'
    case 'inaturalist':
      return 'iNaturalist review history'
    case 'wikimedia_commons':
      return 'Wikimedia Commons review history'
    case 'taxalens_fixture':
      return 'TaxaLens fixture review history'
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
