import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HUMAN_REVIEW_CAMPAIGN } from '../reviewPacket'
import { CampaignSelector } from './CampaignSelector'
import { ConflictQueue } from './ConflictQueue'
import { QualityPanel } from './QualityPanel'
import { VerificationControls } from './VerificationControls'

describe('verification UI components', () => {
  it('keeps campaign selection native and explicit', () => {
    const onSelect = vi.fn()
    render(
      <CampaignSelector
        campaigns={[HUMAN_REVIEW_CAMPAIGN]}
        selectedCampaignId={HUMAN_REVIEW_CAMPAIGN.campaignId}
        onSelect={onSelect}
      />,
    )

    const selector = screen.getByRole('combobox', {
      name: 'Verification campaign',
    })
    expect(selector).toHaveValue(HUMAN_REVIEW_CAMPAIGN.campaignId)
    fireEvent.change(selector, {
      target: { value: HUMAN_REVIEW_CAMPAIGN.campaignId },
    })
    expect(onSelect).toHaveBeenCalledWith(HUMAN_REVIEW_CAMPAIGN.campaignId)
  })

  it('keeps non-scientific outcomes available before media is displayed', () => {
    const onSelectOutcome = vi.fn()
    render(
      <VerificationControls
        cacheState="idle"
        comment=""
        currentOutcome={undefined}
        imageFailureReason={null}
        repositoryReady
        reviewerId=""
        scientificDecisionReady={false}
        onCommentChange={vi.fn()}
        onReviewerIdChange={vi.fn()}
        onSelectOutcome={onSelectOutcome}
      />,
    )

    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Can’t tell' })).toBeDisabled()
    const cantView = screen.getByRole('button', { name: 'Can’t view' })
    const skip = screen.getByRole('button', { name: 'Skip' })
    expect(cantView).toBeEnabled()
    expect(skip).toBeEnabled()
    fireEvent.click(cantView)
    fireEvent.click(skip)
    expect(onSelectOutcome).toHaveBeenNthCalledWith(1, 'cant_view')
    expect(onSelectOutcome).toHaveBeenNthCalledWith(2, 'skipped')
  })

  it('withholds conflict and quality claims until their policies exist', () => {
    render(
      <>
        <ConflictQueue />
        <QualityPanel />
      </>,
    )

    expect(
      screen.getByText('Consensus is not calculated yet'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Quality estimates are not available'),
    ).toBeInTheDocument()
  })
})
