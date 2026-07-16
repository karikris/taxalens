import { describe, expect, it } from 'vitest'

import {
  canonicalShellHashForLegacyHash,
  shellHashForRoute,
  shellRouteFromHash,
  shellViewFromHash,
  verificationShellRoute,
} from './shellTypes'

describe('shell hash routing', () => {
  it('uses Verification as the canonical view and accepts the old hash', () => {
    expect(shellViewFromHash('#verification')).toBe('verification')
    expect(shellViewFromHash('#verification?campaign=fixture')).toBe(
      'verification',
    )
    expect(shellViewFromHash('#human-review')).toBe('verification')
    expect(canonicalShellHashForLegacyHash('#human-review')).toBe(
      '#verification',
    )
    expect(
      canonicalShellHashForLegacyHash('#human-review?campaign=fixture'),
    ).toBe('#verification?campaign=fixture')
  })

  it('keeps unknown fragments on the mission fallback', () => {
    expect(shellViewFromHash('#unknown')).toBe('mission')
    expect(canonicalShellHashForLegacyHash('#unknown')).toBeNull()
  })

  it('parses and serializes validated Verification route state', () => {
    const route = shellRouteFromHash(
      '#verification?campaign=campaign-1&item=item:2&return=evidence-lens',
    )
    expect(route).toEqual({
      view: 'verification',
      verification: {
        campaignId: 'campaign-1',
        itemId: 'item:2',
        returnView: 'evidence-lens',
        errors: [],
      },
    })
    expect(shellHashForRoute(route)).toBe(
      '#verification?campaign=campaign-1&item=item%3A2&return=evidence-lens',
    )
    expect(
      shellHashForRoute(
        verificationShellRoute({
          campaignId: 'campaign-1',
          itemId: 'item:2',
          returnView: 'dashboard',
        }),
      ),
    ).toBe(
      '#verification?campaign=campaign-1&item=item%3A2&return=dashboard',
    )
  })

  it('rejects duplicates, unknown parameters, invalid IDs, and recursive returns', () => {
    const route = shellRouteFromHash(
      '#verification?campaign=bad%20id&campaign=second&item=item-1&return=verification&extra=1',
    )
    expect(route).toEqual({
      view: 'verification',
      verification: {
        campaignId: null,
        itemId: null,
        returnView: null,
        errors: [
          'unknown verification route parameter: extra',
          'campaign is repeated',
          'return is not a valid non-Verification view',
          'item requires campaign',
        ],
      },
    })
  })
})
