import { EvidenceState } from '../design-system'
import type { VerificationAnalystRun } from './verificationAnalystContract'

export type VerificationRecommendationState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly run: VerificationAnalystRun }

export function VerificationRecommendationPanel({
  state,
}: {
  readonly state: VerificationRecommendationState
}) {
  const recommendation =
    state.kind === 'ready' ? state.run.output.recommendation : null
  return (
    <section
      className="detail-panel agent-verification-recommendation"
      aria-labelledby="verification-recommendation-title"
    >
      <p className="eyebrow">Stored GPT-5.6 verification replay</p>
      <h2 id="verification-recommendation-title">
        GPT-5.6 next review action
      </h2>
      <p>
        The verification analyst calls five bounded evidence tools and returns
        one cited action. This public path replays stored responses and makes no
        live model request.
      </p>

      {state.kind === 'loading' ? (
        <EvidenceState
          state="loading"
          title="Replaying the stored verification analyst"
        >
          Re-executing every recorded read-only tool call against the pinned
          synthetic evaluation evidence.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState
          state="blocked"
          title="Verification recommendation unavailable"
        >
          {state.message}
        </EvidenceState>
      ) : recommendation === null ? (
        <EvidenceState state="blocked" title="No next action returned">
          The validated structured output contains no recommendation.
        </EvidenceState>
      ) : (
        <>
          <EvidenceState
            state="available"
            title="Stored recommendation · no live call"
          >
            Five tool calls and six stored response turns were replayed locally.
            Unsupported claims were rejected and no external action was
            executed.
          </EvidenceState>
          <dl className="agent-inline-facts">
            <div>
              <dt>Model</dt>
              <dd>
                <code>{state.run.model}</code>
              </dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>{recommendation.action.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Basis</dt>
              <dd>{recommendation.basis.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Tool budget</dt>
              <dd>
                {state.run.budget.usedToolCalls} /{' '}
                {state.run.budget.maxToolCalls}
              </dd>
            </div>
          </dl>
          <article className="agent-verification-recommendation__answer">
            <h3>{state.run.output.answer}</h3>
            <p>{recommendation.why}</p>
            <dl>
              <div>
                <dt>Next item</dt>
                <dd>
                  <code>{recommendation.nextItemIds.join(' · ')}</code>
                </dd>
              </div>
              <div>
                <dt>Evidence citations</dt>
                <dd>{recommendation.artifactIds.length} artifact IDs</dd>
              </div>
            </dl>
            <details>
              <summary>Inspect recommendation artifact IDs</summary>
              <ul>
                {recommendation.artifactIds.map((artifactId) => (
                  <li key={artifactId}>
                    <code>{artifactId}</code>
                  </li>
                ))}
              </ul>
            </details>
          </article>
          <EvidenceState
            state="review"
            title="Synthetic evaluation evidence · not current browser state"
          >
            This stored scenario contains an intentionally unresolved control
            conflict. It demonstrates bounded next-action reasoning; it is not
            a human outcome, a live instruction, a taxonomic result, or a
            prediction that quality will improve.
          </EvidenceState>
        </>
      )}
    </section>
  )
}
