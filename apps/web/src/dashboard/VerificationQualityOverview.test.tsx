import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VerificationQualityOverviewContent } from './VerificationQualityOverview'

describe('VerificationQualityOverview', () => {
  it('shows bounded campaign outcomes and the actionable next milestone', () => {
    render(
      <VerificationQualityOverviewContent
        localState={{
          availability: 'available',
          decisiveItemCount: 2,
          attemptedItemCount: 3,
          conflictItemCount: 1,
          eventCount: 4,
          reason: null,
        }}
      />,
    )

    const section = screen
      .getByRole('heading', {
        name: 'Campaigns, coverage, and the next honest gate',
      })
      .closest('section')

    expect(section).not.toBeNull()
    expect(within(section!).getByText('2 / 82')).toBeInTheDocument()
    expect(within(section!).getByText('Reference readiness')).toBeInTheDocument()
    expect(section).toHaveTextContent('0 independently verified')
    expect(section).toHaveTextContent('81 provider-role suitable only')
    expect(section).toHaveTextContent('Quality intervalUnavailable')
    expect(section).toHaveTextContent('2 / 3 complete · 1 remaining')
    expect(
      within(section!).getByRole('link', { name: 'Open Verification' }),
    ).toHaveAttribute('href', '#verification')
    expect(
      within(section!).getAllByText(/public local fixture|private review packet/u),
    ).toHaveLength(4)
  })

  it('labels local ledger failure as unavailable', () => {
    render(
      <VerificationQualityOverviewContent
        localState={{
          availability: 'unavailable',
          decisiveItemCount: 0,
          attemptedItemCount: 0,
          conflictItemCount: 0,
          eventCount: 0,
          reason: 'IndexedDB is unavailable in this browser.',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Local review ledger unavailable',
    )
    expect(
      screen.getByText('IndexedDB is unavailable in this browser.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
  })
})
