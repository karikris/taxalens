import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HUMAN_REVIEW_ITEMS } from '../reviewPacket'
import {
  referenceRouteExpectation,
  ReferenceSourceContextPanel,
} from './ReferenceSourceContextPanel'

const [baseItem] = HUMAN_REVIEW_ITEMS
if (baseItem === undefined) {
  throw new Error('Source context tests require a committed review item')
}

describe('ReferenceSourceContextPanel', () => {
  it('shows provider, rights, observer, geography, date, fallback, and route context', () => {
    const item = {
      ...baseItem,
      source: 'gbif' as const,
      sourceObservationId: '300000001',
      sourceProvenance: {
        provider: 'gbif' as const,
        providerLabel: 'GBIF' as const,
        originalProvider: 'Atlas of Living Australia',
        referenceObservationId: 'reference-observation:fixture',
        sourceObservationId: '300000001',
        providerMediaId: 'provider-photo-1',
        occurrenceLicense: 'CC0-1.0',
        mediaLicense: {
          name: baseItem.rights.licenseName,
          uri: baseItem.rights.licenseUri,
          policyStatus: baseItem.rights.policyStatus,
        },
        observerId: 'observer-1',
        observedAt: '2025-01-02T03:04:00.000Z',
        fallbackLevel: 0,
        geography: {
          locality: 'Sydney',
          country: 'Australia',
          countryCode: 'AU',
          latitude: -33.87,
          longitude: 151.21,
          coordinateUncertaintyMeters: 10,
          coordinatesObscured: false,
          geographicClusterId: 'geo-cluster-1',
        },
        providerVerificationStatus: 'accepted',
      },
    }

    render(
      <ReferenceSourceContextPanel
        campaignTargetAcceptedTaxonKey="gbif:1938069"
        item={item}
      />,
    )

    expect(screen.getByText(/GBIF · original Atlas of Living Australia/u))
      .toBeInTheDocument()
    expect(screen.getByText('300000001')).toBeInTheDocument()
    expect(screen.getByText('provider-photo-1')).toBeInTheDocument()
    expect(screen.getByText('CC0-1.0')).toBeInTheDocument()
    expect(screen.getByText('observer-1')).toBeInTheDocument()
    expect(
      screen.getByText('Sydney, Australia · -33.8700, 151.2100'),
    ).toBeInTheDocument()
    expect(screen.getByText('2025-01-02')).toBeInTheDocument()
    expect(screen.getByText('0 · direct provider route')).toBeInTheDocument()
    expect(
      screen.getByText('Target · live-field identity review'),
    ).toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })

  it('keeps unavailable Commons source fields explicit', () => {
    render(
      <ReferenceSourceContextPanel
        campaignTargetAcceptedTaxonKey="gbif:1938069"
        item={baseItem}
      />,
    )

    expect(screen.getByText('Wikimedia Commons')).toBeInTheDocument()
    expect(
      screen.getByText('Unavailable in campaign manifest'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(
      referenceRouteExpectation(baseItem, 'gbif:999999'),
    ).toBe('Competitor · live-field identity review')
  })
})
