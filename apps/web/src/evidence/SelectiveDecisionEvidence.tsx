import { EvidenceState, ScoreSemantics, UncertaintyNote } from '../design-system'
import type { ReplayEvidence } from '../data/evidenceFacade'
import {
  buildSelectiveDecisionModel,
  type UnavailableEvidenceField,
} from './selectiveDecisionModel'

export function SelectiveDecisionEvidence({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildSelectiveDecisionModel(replay)

  return (
    <section className="selective-decision" aria-labelledby="selective-decision-title">
      <div className="selective-decision__heading">
        <div>
          <p className="eyebrow">Raw and calibrated evidence</p>
          <h3 id="selective-decision-title">Explain selective decision</h3>
          <p>
            Raw similarities are not probabilities. Calibration, thresholds, margins, and
            abstention require their own produced evidence and policy identity.
          </p>
        </div>
        <strong>{model.displayLabel}</strong>
      </div>

      <EvidenceState state="review" title="Awaiting human review is not model abstention">
        The decision payload is null. No selective policy was evaluated and no abstention outcome
        was produced.
      </EvidenceState>

      <div className="selective-decision__split">
        <EvidenceColumn
          description="Uncalibrated model inputs. A raw similarity may be negative or positive and is never displayed as confidence."
          fields={model.rawEvidence}
          kind="raw"
          title="Raw evidence"
        />
        <EvidenceColumn
          description="Policy-facing outputs. None exists until a fitted calibrator and selective decision policy are applied."
          fields={model.decisionEvidence}
          kind="calibrated"
          title="Decision evidence"
        />
      </div>

      <div
        className="selective-decision__flow"
        role="img"
        aria-label="Raw score artifact unavailable, calibration not run, selective decision unavailable"
      >
        <DecisionStep label="Raw score artifact" status="Unavailable" />
        <span aria-hidden="true">→</span>
        <DecisionStep label="Calibration" status="Not run" />
        <span aria-hidden="true">→</span>
        <DecisionStep label="Selective decision" status="Unavailable" />
      </div>

      <dl className="selective-decision__record">
        <div>
          <dt>Evidence record</dt>
          <dd><code>{model.recordId}</code></dd>
        </div>
        <div>
          <dt>Decision gates</dt>
          <dd>{model.satisfiedGateCount} / {model.gateCount} satisfied</dd>
        </div>
        <div>
          <dt>Required transition</dt>
          <dd>{model.transitionRequired.replaceAll('_', ' ')}</dd>
        </div>
      </dl>

      <UncertaintyNote>
        No probability bar, threshold line, or margin distance is drawn: an empty visual scale
        could still imply that zero was measured. Every absent value remains textual and explicit.
      </UncertaintyNote>
    </section>
  )
}

function EvidenceColumn({
  description,
  fields,
  kind,
  title,
}: {
  readonly description: string
  readonly fields: readonly UnavailableEvidenceField[]
  readonly kind: 'raw' | 'calibrated'
  readonly title: string
}) {
  return (
    <article className="selective-decision__column" data-kind={kind}>
      <div>
        <h4>{title}</h4>
        {kind === 'raw' ? (
          <ScoreSemantics kind="raw" />
        ) : (
          <ScoreSemantics
            kind="calibrated"
            calibrationEvidence="Unavailable — no calibrator artifact is committed"
            label="Calibrated output unavailable"
          />
        )}
        <p>{description}</p>
      </div>
      <ul aria-label={`${title} fields`}>
        {fields.map((field) => (
          <li key={field.id}>
            <div>
              <strong>{field.label}</strong>
              <span>Unavailable</span>
            </div>
            <code>{field.sourceFields.join(' · ')}</code>
            <p>{field.reason}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}

function DecisionStep({ label, status }: { readonly label: string; readonly status: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  )
}
