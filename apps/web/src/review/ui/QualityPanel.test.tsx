import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QualityPanel } from './QualityPanel'
import { qualitySnapshotFixture } from './qualitySnapshotTestSupport'

describe('Flickr verification quality panel', () => {
  it('shows every metric from the persisted QualitySnapshot', () => {
    render(<QualityPanel snapshot={qualitySnapshotFixture()} />)

    expect(
      screen.getByRole('heading', {
        name: 'Flickr verification quality',
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/coverage describes workflow completion/iu),
    ).toBeVisible()
    expect(metric('Review coverage')).toHaveTextContent('80%80 / 100')
    expect(metric('Inspection coverage')).toHaveTextContent('76%76 / 100')
    expect(metric('Viewability rate')).toHaveTextContent('94.7%72 / 76')
    expect(metric('Estimated target precision')).toHaveTextContent(
      '95%Stratified Hájek',
    )
    expect(metric('95% interval')).toHaveTextContent(
      '91% – 98%Grouped percentile bootstrap',
    )
    expect(metric('Effective sample size')).toHaveTextContent(
      '54.460 decisive sampled items',
    )

    const strata = screen.getByRole('table', {
      name: 'Persisted sampling-stratum quality',
    })
    expect(within(strata).getByText('Adult')).toBeVisible()
    expect(within(strata).getByText('Larva')).toBeVisible()
    expect(within(strata).getByText('96%')).toBeVisible()
    expect(within(strata).getByText('90%')).toBeVisible()
    expect(screen.getByText('Release quality gate passed')).toBeVisible()
    expect(screen.getByText('60 · Evaluation due')).toBeVisible()
    expect(screen.getByText('aaaaaaaaaaaa…aaaaaaaa')).toBeVisible()
  })

  it('shows unavailable states without leaking unsupported numbers', () => {
    const snapshot = qualitySnapshotFixture()
    render(
      <QualityPanel
        snapshot={{
          ...snapshot,
          precision: {
            ...snapshot.precision,
            availability: 'unavailable',
            pointEstimate: null,
            estimateBlockers: ['sampling_strata_missing'],
            intervalAvailability: 'unavailable',
            interval: null,
            intervalBlockers: ['bootstrap_groups_insufficient'],
            effectiveSampleSize: null,
          },
          release: {
            status: 'blocked',
            evaluatedAtMilestone: 60,
            blockers: [
              'precision_estimate_unavailable',
              'precision_interval_unavailable',
            ],
            missingRequiredStrata: [],
          },
        }}
      />,
    )

    expect(metric('Estimated target precision')).toHaveTextContent(
      'Not available',
    )
    expect(metric('95% interval')).toHaveTextContent('Not available')
    expect(metric('Effective sample size')).toHaveTextContent(
      'Not available',
    )
    expect(screen.getByText('Release quality gate blocked')).toBeVisible()
    expect(screen.queryByText('95% – 98%')).not.toBeInTheDocument()
  })

  it('withholds every quality value when no snapshot is attached', () => {
    render(<QualityPanel />)

    expect(screen.getByText('Quality estimates are not available')).toBeVisible()
    expect(
      screen.getByText(/no fingerprinted QualitySnapshot is attached/iu),
    ).toBeVisible()
    expect(screen.queryByText('Review coverage')).not.toBeInTheDocument()
  })
})

function metric(label: string): HTMLElement {
  const article = screen.getByText(label).closest('article')
  expect(article).not.toBeNull()
  return article!
}
