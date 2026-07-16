import { useState } from 'react'

import type { RevealedFlickrReviewContext } from '../domain'
import { humanReviewOutcomeLabel } from './VerificationItemViewer'

export function FlickrPostDecisionEvidencePanel({
  context,
}: {
  readonly context: RevealedFlickrReviewContext
}) {
  const [revealed, setRevealed] = useState(false)
  const panelId = `flickr-post-decision-${safeDomId(
    context.humanDecision.eventId,
  )}`

  return (
    <section
      className="flickr-post-decision"
      aria-labelledby={`${panelId}-title`}
    >
      <div>
        <p className="eyebrow">Post-decision evidence</p>
        <h3 id={`${panelId}-title`}>
          Human outcome recorded ·{' '}
          {humanReviewOutcomeLabel(context.humanDecision.outcome)}
        </h3>
        <p>
          The append-only decision is already bound to this image and question.
          Revealing model and source context cannot change the recorded event.
        </p>
      </div>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={revealed}
        onClick={() => setRevealed((current) => !current)}
      >
        {revealed ? 'Hide model and source evidence' : 'Reveal model and source evidence'}
      </button>
      {revealed && (
        <div id={panelId} className="flickr-post-decision__evidence">
          <dl>
            <EvidenceFact label="Target score band">
              {formatValue(context.modelResult.targetScoreBand)}
            </EvidenceFact>
            <EvidenceFact label="Model decision">
              {formatValue(context.modelResult.decisionState)}
            </EvidenceFact>
            <EvidenceFact label="Competitor margin band">
              {formatValue(context.modelResult.competitorMarginBand)}
            </EvidenceFact>
            <EvidenceFact label="Decision reason">
              {context.decisionReason ?? 'Unavailable'}
            </EvidenceFact>
            <EvidenceFact label="Geographic cluster">
              {context.geography.geographicClusterId ?? 'Unavailable'}
            </EvidenceFact>
            <EvidenceFact label="Coordinates">
              {coordinateLabel(context)}
            </EvidenceFact>
            <EvidenceFact label="Source query">
              {context.sourceContext.queryTerm} ·{' '}
              {context.sourceContext.queryTrustTier} trust
            </EvidenceFact>
            <EvidenceFact label="Flickr source">
              <a
                href={context.sourceContext.sourceUri}
                target="_blank"
                rel="noreferrer"
              >
                Open source after decision
              </a>
            </EvidenceFact>
          </dl>
          <p className="flickr-post-decision__caveat">
            Score and margin bands are model diagnostics, not probabilities or
            independently verified species labels.
          </p>
          <EvidenceList
            empty="No strongest-competitor evidence is available."
            label="Strongest competitors"
            values={context.strongestCompetitors.map(
              (competitor) =>
                `${competitor.scientificName} · ${formatValue(
                  competitor.scoreBand,
                )} score band`,
            )}
          />
          <EvidenceList
            empty="No reference evidence is available."
            label="Reference evidence"
            values={context.references.map(
              (reference) =>
                `${reference.scientificName} · ${reference.provider} · ${formatValue(
                  reference.reviewState,
                )}`,
            )}
          />
          <EvidenceList
            empty="No Flickr comments are available."
            label="Flickr comments"
            values={context.comments.map(({ text }) => text)}
          />
        </div>
      )}
    </section>
  )
}

function EvidenceFact({
  children,
  label,
}: {
  readonly children: React.ReactNode
  readonly label: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function EvidenceList({
  empty,
  label,
  values,
}: {
  readonly empty: string
  readonly label: string
  readonly values: readonly string[]
}) {
  return (
    <section>
      <h4>{label}</h4>
      {values.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul aria-label={label}>
          {values.map((value, index) => (
            <li key={`${label}-${index}`}>{value}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function coordinateLabel(context: RevealedFlickrReviewContext): string {
  const { latitude, longitude, outlier } = context.geography
  if (latitude === null || longitude === null) {
    return 'Unavailable'
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}${
    outlier === true ? ' · flagged geographic anomaly' : ''
  }`
}

function formatValue(value: string): string {
  return value.replaceAll('_', ' ')
}

function safeDomId(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
}
