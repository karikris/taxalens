import { describe, expect, it } from 'vitest'

import {
  canonicalShellHashForLegacyHash,
  shellViewFromHash,
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
})
