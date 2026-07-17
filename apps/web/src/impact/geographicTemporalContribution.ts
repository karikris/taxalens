export type TemporalEvidenceMaturity =
  | 'candidate'
  | 'human_supported'
  | 'release_ready'

export type TemporalContributionStatus =
  | 'available'
  | 'data_deficient'
  | 'unavailable'

export interface TemporalContributionResult {
  readonly status: TemporalContributionStatus
  readonly maturity: TemporalEvidenceMaturity
  readonly latestBaselineEventDate: string | null
  readonly flickrObservationDate: string | null
  readonly signedIntervalDays: number | null
  readonly relation: 'later' | 'same' | 'earlier' | null
  readonly datePrecision: 'day' | null
  readonly reason:
    | 'dates_comparable'
    | 'credible_baseline_date_unavailable'
    | 'flickr_observation_date_unavailable'
  readonly scientificClaimAllowed: false
}

export function calculateTemporalContribution(input: {
  readonly latestBaselineEventDate: string | null
  readonly flickrObservationDate: string | null
  readonly maturity: TemporalEvidenceMaturity
}): TemporalContributionResult {
  const flickrTime = exactUtcDay(input.flickrObservationDate, 'Flickr observation date')
  const baselineTime = exactUtcDay(
    input.latestBaselineEventDate,
    'latest credible baseline date',
  )
  if (flickrTime === null) {
    return result(input, 'unavailable', null, null, null, 'flickr_observation_date_unavailable')
  }
  if (baselineTime === null) {
    return result(
      input,
      'data_deficient',
      null,
      null,
      null,
      'credible_baseline_date_unavailable',
    )
  }
  const signedIntervalDays = (flickrTime - baselineTime) / 86_400_000
  return result(
    input,
    'available',
    signedIntervalDays,
    signedIntervalDays > 0 ? 'later' : signedIntervalDays < 0 ? 'earlier' : 'same',
    'day',
    'dates_comparable',
  )
}

export function describeTemporalContribution(
  contribution: TemporalContributionResult,
): string {
  if (contribution.status === 'unavailable') {
    return 'Temporal contribution is unavailable because this selection has no dated Flickr observation evidence.'
  }
  if (contribution.status === 'data_deficient') {
    return 'The selected baseline has no credible latest date; temporal contribution is data-deficient and no novelty is inferred.'
  }
  const days = contribution.signedIntervalDays
  if (days === null) throw new Error('available temporal contribution lacks an interval')
  if (days > 0) {
    const maturity =
      contribution.maturity === 'release_ready'
        ? 'Release-ready candidate temporal contribution'
        : contribution.maturity === 'human_supported'
          ? 'Human-supported temporal contribution'
          : 'Potential temporal contribution'
    return `${maturity}: the Flickr observation date is ${new Intl.NumberFormat('en-AU').format(days)} days later than the latest credible baseline date. A later date does not by itself establish novelty or biological change.`
  }
  if (days === 0) {
    return 'The Flickr observation date is the same as the latest credible baseline date; no later temporal contribution is shown.'
  }
  return `The Flickr observation date is ${new Intl.NumberFormat('en-AU').format(Math.abs(days))} days earlier than the latest credible baseline date; no later temporal contribution is shown.`
}

function exactUtcDay(value: string | null, field: string): number | null {
  if (value === null) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) throw new Error(`${field} must be an exact YYYY-MM-DD date`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${field} is not a valid calendar date`)
  }
  return time
}

function result(
  input: Parameters<typeof calculateTemporalContribution>[0],
  status: TemporalContributionStatus,
  signedIntervalDays: number | null,
  relation: TemporalContributionResult['relation'],
  datePrecision: TemporalContributionResult['datePrecision'],
  reason: TemporalContributionResult['reason'],
): TemporalContributionResult {
  return Object.freeze({
    status,
    maturity: input.maturity,
    latestBaselineEventDate: input.latestBaselineEventDate,
    flickrObservationDate: input.flickrObservationDate,
    signedIntervalDays,
    relation,
    datePrecision,
    reason,
    scientificClaimAllowed: false as const,
  })
}
