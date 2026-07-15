import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import { buildCandidateComparison, type CandidateComparisonEntry } from './candidateComparisonModel'

export function CandidateSpeciesComparison({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildCandidateComparison(replay)

  return (
    <section className="candidate-comparison" aria-labelledby="candidate-comparison-title">
      <div className="candidate-comparison__heading">
        <div>
          <p className="eyebrow">Target-versus-competitor comparison</p>
          <h3 id="candidate-comparison-title">Candidate species</h3>
          <p>
            Planning hypotheses are inspectable before scoring, but plan order is not similarity
            rank and source-taxon metadata is not a verified image label.
          </p>
        </div>
        <strong>{model.scoredCandidateCount} scored</strong>
      </div>

      <div className="candidate-comparison__assertion" data-status={model.rankingStatementStatus}>
        <q>{model.rankingStatement}</q>
        <strong>Unavailable assertion</strong>
        <span>{model.rankingReason}</span>
      </div>

      <dl className="candidate-comparison__summary">
        <div>
          <dt>Target</dt>
          <dd>
            <strong>{model.target.scientificName}</strong>
            <code>{model.target.acceptedTaxonKey}</code>
          </dd>
        </div>
        <div>
          <dt>Total candidate count</dt>
          <dd>{model.totalCandidateCount}</dd>
        </div>
        <div>
          <dt>Candidate visual scores</dt>
          <dd>{model.scoredCandidateCount}</dd>
        </div>
        <div data-availability="unavailable">
          <dt>Target rank</dt>
          <dd>
            <strong>Unavailable</strong>
            <span>{model.targetRank.reason}</span>
          </dd>
        </div>
      </dl>

      <section className="candidate-comparison__alternatives" aria-labelledby="candidate-alternatives-title">
        <div>
          <h4 id="candidate-alternatives-title">Four displayed planning alternatives</h4>
          <p>
            These are the first four verified plan entries, not the strongest four. No score-derived
            ordering exists.
          </p>
        </div>
        <ol aria-label="Displayed candidate alternatives">
          {model.displayedAlternatives.map((candidate) => (
            <CandidateCard candidate={candidate} key={candidate.recordId} />
          ))}
        </ol>
        {model.undisplayedAlternatives.length > 0 ? (
          <details>
            <summary>
              Inspect {model.undisplayedAlternatives.length} remaining planning alternative
            </summary>
            <ul aria-label="Remaining candidate alternatives">
              {model.undisplayedAlternatives.map((candidate) => (
                <li key={candidate.recordId}>
                  <strong>{candidate.scientificName}</strong>
                  <code>{candidate.acceptedTaxonKey}</code>
                  <span>{candidate.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="candidate-comparison__outcomes" aria-label="Best candidate outcomes">
        {model.outcomes.map((outcome) => (
          <EvidenceState key={outcome.id} state="review" title={outcome.label}>
            <strong>Unavailable.</strong> {outcome.reason}
          </EvidenceState>
        ))}
      </div>

      <section className="candidate-comparison__coverage" aria-labelledby="reference-coverage-title">
        <div>
          <p className="eyebrow">Decision gate</p>
          <h4 id="reference-coverage-title">Reference coverage</h4>
          <p>
            Media-candidate counts are verified metadata, not score-ready support. Human-verified
            coverage remains zero.
          </p>
        </div>
        <dl>
          <div>
            <dt>Eligible source media candidates</dt>
            <dd>{model.referenceCoverage.eligibleSourceMediaCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Human-verified source media</dt>
            <dd>{model.referenceCoverage.humanVerifiedSourceMediaCount}</dd>
          </div>
          <div>
            <dt>Source-candidate shortfall</dt>
            <dd>{model.referenceCoverage.sourceCandidateShortfall}</dd>
          </div>
          <div>
            <dt>Human-verified shortfall</dt>
            <dd>{model.referenceCoverage.humanVerifiedShortfall}</dd>
          </div>
        </dl>
      </section>
    </section>
  )
}

function CandidateCard({ candidate }: { readonly candidate: CandidateComparisonEntry }) {
  return (
    <li>
      <div className="candidate-comparison__candidate-heading">
        <span>Plan position {candidate.planPosition} · not score rank</span>
        <strong>Score unavailable</strong>
      </div>
      <h5>{candidate.scientificName}</h5>
      <code>{candidate.acceptedTaxonKey}</code>
      <dl>
        <div>
          <dt>Candidate reason</dt>
          <dd>{candidate.reason}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{candidate.verificationStatus.replaceAll('_', ' ')}</dd>
        </div>
      </dl>
    </li>
  )
}
