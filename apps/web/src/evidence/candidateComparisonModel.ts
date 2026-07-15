import type { ReplayEvidence } from '../data/evidenceFacade'

const REQUIRED_RANKING_STATEMENT =
  'All eligible candidates scored; four strongest alternatives displayed.' as const

export interface CandidateComparisonEntry {
  readonly recordId: string
  readonly acceptedTaxonKey: string
  readonly scientificName: string
  readonly planPosition: number
  readonly reason: string
  readonly verificationStatus: string
  readonly scoreStatus: 'unavailable'
  readonly rankStatus: 'unavailable'
}

export interface UnavailableCandidateOutcome {
  readonly id: 'best-regional' | 'best-nonregional' | 'best-domain-negative'
  readonly label: string
  readonly status: 'unavailable'
  readonly reason: string
}

export interface CandidateComparisonModel {
  readonly target: {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly role: 'target_under_study'
  }
  readonly totalCandidateCount: number
  readonly alternativeCandidateCount: number
  readonly scoredCandidateCount: 0
  readonly displayedAlternatives: readonly CandidateComparisonEntry[]
  readonly undisplayedAlternatives: readonly CandidateComparisonEntry[]
  readonly targetRank: {
    readonly status: 'unavailable'
    readonly reason: string
  }
  readonly outcomes: readonly UnavailableCandidateOutcome[]
  readonly referenceCoverage: {
    readonly eligibleSourceMediaCount: number
    readonly humanVerifiedSourceMediaCount: 0
    readonly sourceCandidateShortfall: number
    readonly humanVerifiedShortfall: number
    readonly status: 'insufficient_for_scoring'
  }
  readonly rankingStatement: typeof REQUIRED_RANKING_STATEMENT
  readonly rankingStatementStatus: 'unavailable'
  readonly rankingReason: string
  readonly scientificClaimAllowed: false
}

export function buildCandidateComparison(replay: ReplayEvidence): CandidateComparisonModel {
  if (
    replay.observatory.candidateVisualScoreCount !== 0 ||
    replay.mission.referenceRequirements.humanVerifiedSourceMediaCount !== 0 ||
    replay.sections.target_aware_score_metadata.status !== 'unavailable'
  ) {
    throw new Error('Candidate comparison requires the verified zero-score pilot boundary')
  }
  const rankingReason = replay.sections.target_aware_score_metadata.reason
  if (rankingReason === null) {
    throw new Error('Unavailable candidate scores require a reason')
  }
  const alternatives = replay.mission.candidatePolicy.candidates.map((candidate, index) =>
    Object.freeze({
      ...candidate,
      planPosition: index + 1,
      reason: candidate.candidateReason.replaceAll('_', ' '),
      scoreStatus: 'unavailable' as const,
      rankStatus: 'unavailable' as const,
    }),
  )
  const totalCandidateCount = alternatives.length + 1

  return Object.freeze({
    target: Object.freeze({
      acceptedTaxonKey: replay.target.acceptedTaxonKey,
      scientificName: replay.target.scientificName,
      role: 'target_under_study',
    }),
    totalCandidateCount,
    alternativeCandidateCount: alternatives.length,
    scoredCandidateCount: 0,
    displayedAlternatives: Object.freeze(alternatives.slice(0, 4)),
    undisplayedAlternatives: Object.freeze(alternatives.slice(4)),
    targetRank: Object.freeze({ status: 'unavailable', reason: rankingReason }),
    outcomes: Object.freeze([
      Object.freeze({
        id: 'best-regional',
        label: 'Best regional competitor',
        status: 'unavailable',
        reason: 'Five regional planning hypotheses exist, but none has a visual score.',
      }),
      Object.freeze({
        id: 'best-nonregional',
        label: 'Best non-regional competitor',
        status: 'unavailable',
        reason: 'No scored non-regional competitor set is committed.',
      }),
      Object.freeze({
        id: 'best-domain-negative',
        label: 'Best domain negative',
        status: 'unavailable',
        reason: 'No scored domain-negative evidence is committed.',
      }),
    ]),
    referenceCoverage: Object.freeze({
      eligibleSourceMediaCount:
        replay.mission.referenceRequirements.eligibleSourceMediaCount,
      humanVerifiedSourceMediaCount: 0,
      sourceCandidateShortfall: replay.mission.referenceRequirements.sourceCandidateShortfall,
      humanVerifiedShortfall: replay.mission.referenceRequirements.humanVerifiedShortfall,
      status: 'insufficient_for_scoring',
    }),
    rankingStatement: REQUIRED_RANKING_STATEMENT,
    rankingStatementStatus: 'unavailable',
    rankingReason,
    scientificClaimAllowed: false,
  })
}
