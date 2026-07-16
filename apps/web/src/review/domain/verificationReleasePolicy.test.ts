import { describe, expect, it } from 'vitest'

import {
  VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
  defineVerificationReleasePolicy,
  validateVerificationReleasePolicy,
  type VerificationReleasePolicy,
} from '.'

describe('verification release policy', () => {
  it('defines every configurable scientific release threshold', () => {
    const policy = defineVerificationReleasePolicy(validPolicy())

    expect(policy).toEqual({
      schemaVersion: VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
      policyId: 'flickr-final-test-v1',
      minimumDecisiveSample: 100,
      requiredStrata: ['adult', 'larva'],
      minimumReviewerAgreement: 0.8,
      maximumConflictRate: 0.1,
      requireReferenceReadiness: true,
      minimumPrecisionLowerBound: 0.9,
      requireReviewedLabelLeakageGate: true,
    })
    expect(Object.isFrozen(policy)).toBe(true)
    expect(Object.isFrozen(policy.requiredStrata)).toBe(true)
  })

  it('rejects invalid thresholds and non-canonical strata', () => {
    const invalid = {
      ...validPolicy(),
      policyId: ' ',
      minimumDecisiveSample: 0,
      requiredStrata: ['larva', 'adult', 'adult'],
      minimumReviewerAgreement: 1.01,
      maximumConflictRate: -0.01,
      minimumPrecisionLowerBound: Number.NaN,
    }

    expect(validateVerificationReleasePolicy(invalid)).toEqual([
      'release policy ID must not be empty',
      'minimum decisive sample must be a positive integer',
      'required strata must be non-empty, sorted, and unique',
      'minimum reviewer agreement must be a proportion',
      'maximum conflict rate must be a proportion',
      'minimum precision lower bound must be a proportion',
    ])
    expect(() => defineVerificationReleasePolicy(invalid)).toThrow(
      'Verification release policy is invalid',
    )
  })
})

function validPolicy(): VerificationReleasePolicy {
  return {
    schemaVersion: VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
    policyId: 'flickr-final-test-v1',
    minimumDecisiveSample: 100,
    requiredStrata: ['adult', 'larva'],
    minimumReviewerAgreement: 0.8,
    maximumConflictRate: 0.1,
    requireReferenceReadiness: true,
    minimumPrecisionLowerBound: 0.9,
    requireReviewedLabelLeakageGate: true,
  }
}
