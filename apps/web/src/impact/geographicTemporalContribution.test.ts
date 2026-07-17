import { describe, expect, it } from 'vitest'

import {
  calculateTemporalContribution,
  describeTemporalContribution,
} from './geographicTemporalContribution'

describe('geographic temporal contribution', () => {
  it('returns an exact signed interval without turning recency into novelty', () => {
    const contribution = calculateTemporalContribution({
      latestBaselineEventDate: '2020-01-01',
      flickrObservationDate: '2024-01-02',
      maturity: 'candidate',
    })

    expect(contribution).toEqual({
      status: 'available',
      maturity: 'candidate',
      latestBaselineEventDate: '2020-01-01',
      flickrObservationDate: '2024-01-02',
      signedIntervalDays: 1_462,
      relation: 'later',
      datePrecision: 'day',
      reason: 'dates_comparable',
      scientificClaimAllowed: false,
    })
    expect(describeTemporalContribution(contribution)).toMatch(
      /does not by itself establish novelty or biological change/u,
    )
  })

  it('preserves earlier and same-date relations', () => {
    expect(
      calculateTemporalContribution({
        latestBaselineEventDate: '2024-01-02',
        flickrObservationDate: '2024-01-01',
        maturity: 'human_supported',
      }),
    ).toMatchObject({ signedIntervalDays: -1, relation: 'earlier' })
    expect(
      calculateTemporalContribution({
        latestBaselineEventDate: '2024-01-02',
        flickrObservationDate: '2024-01-02',
        maturity: 'release_ready',
      }),
    ).toMatchObject({ signedIntervalDays: 0, relation: 'same' })
  })

  it('distinguishes missing Flickr dates from a data-deficient baseline', () => {
    expect(
      calculateTemporalContribution({
        latestBaselineEventDate: '2024-01-02',
        flickrObservationDate: null,
        maturity: 'candidate',
      }),
    ).toMatchObject({
      status: 'unavailable',
      reason: 'flickr_observation_date_unavailable',
    })
    expect(
      calculateTemporalContribution({
        latestBaselineEventDate: null,
        flickrObservationDate: '2024-01-02',
        maturity: 'candidate',
      }),
    ).toMatchObject({
      status: 'data_deficient',
      reason: 'credible_baseline_date_unavailable',
    })
  })

  it('rejects partial and invalid dates rather than coercing them', () => {
    for (const invalid of ['2024-01', '2024-02-31', 'not-a-date']) {
      expect(() =>
        calculateTemporalContribution({
          latestBaselineEventDate: '2024-01-01',
          flickrObservationDate: invalid,
          maturity: 'candidate',
        }),
      ).toThrow(/date/u)
    }
  })
})
