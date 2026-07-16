import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { HumanReviewItem } from '../reviewPacket'
import { HUMAN_REVIEW_ITEMS } from '../reviewPacket'
import {
  filterReferenceReviewItems,
  ReferenceReviewFilters,
  type ReferenceReviewFilterContext,
} from './ReferenceReviewFilters'

const [baseItem] = HUMAN_REVIEW_ITEMS
if (baseItem === undefined) {
  throw new Error('Reference filter tests require one committed review item')
}

const items: readonly HumanReviewItem[] = [
  {
    ...baseItem,
    itemId: 'gbif-target-adult',
    source: 'gbif',
    expectedLifeStage: 'adult',
    expectedVisualDomain: 'live_field',
  },
  {
    ...baseItem,
    itemId: 'inaturalist-competitor-larva',
    source: 'inaturalist',
    targetTaxon: {
      ...baseItem.targetTaxon,
      acceptedTaxonKey: 'gbif:999999',
      scientificName: 'Papilio competitor',
    },
    expectedLifeStage: 'larva',
    expectedVisualDomain: 'live_field',
  },
  {
    ...baseItem,
    itemId: 'gbif-target-specimen',
    source: 'gbif',
    expectedLifeStage: 'adult',
    expectedVisualDomain: 'pinned_specimen',
  },
]

const context: ReferenceReviewFilterContext = {
  targetAcceptedTaxonKey: 'gbif:1938069',
  currentOutcomes: {
    'gbif-target-adult': 'yes',
    'gbif-target-specimen': 'skipped',
  },
  conflictItemIds: new Set(['inaturalist-competitor-larva']),
}

describe('ReferenceReviewFilters', () => {
  it('filters providers, routes, stages, specimens, pending work, and conflicts', () => {
    expect(filterReferenceReviewItems(items, 'all', context)).toHaveLength(3)
    expect(filterReferenceReviewItems(items, 'gbif', context)).toHaveLength(2)
    expect(
      filterReferenceReviewItems(items, 'inaturalist', context),
    ).toHaveLength(1)
    expect(filterReferenceReviewItems(items, 'target', context)).toHaveLength(2)
    expect(
      filterReferenceReviewItems(items, 'competitor', context),
    ).toHaveLength(1)
    expect(filterReferenceReviewItems(items, 'adult', context)).toHaveLength(2)
    expect(filterReferenceReviewItems(items, 'larval', context)).toHaveLength(1)
    expect(
      filterReferenceReviewItems(items, 'specimen', context),
    ).toHaveLength(1)
    expect(filterReferenceReviewItems(items, 'pending', context).map(
      ({ itemId }) => itemId,
    )).toEqual([
      'inaturalist-competitor-larva',
      'gbif-target-specimen',
    ])
    expect(
      filterReferenceReviewItems(items, 'conflict', context).map(
        ({ itemId }) => itemId,
      ),
    ).toEqual(['inaturalist-competitor-larva'])
  })

  it('shows exact route counts and exposes one pressed filter', () => {
    const onChange = vi.fn()
    render(
      <ReferenceReviewFilters
        context={context}
        items={items}
        value="all"
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'GBIF 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'iNaturalist 1' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Conflict 1' }))
    expect(onChange).toHaveBeenCalledWith('conflict')
  })
})
