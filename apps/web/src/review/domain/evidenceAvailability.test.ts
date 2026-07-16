import { describe, expect, it } from 'vitest'

import migratedAvailability from '../../../../../demo/source/verification/verification-evidence-availability.json'
import { createVerificationAgentEvidenceFixture } from '../../test/verificationAgentEvidence'
import {
  EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
  EvidenceAvailabilityError,
  availableEvidence,
  blockedEvidence,
  evidenceValueOrUndefined,
  failedEvidence,
  mapAvailableEvidence,
  measuredZeroEvidence,
  notApplicableEvidence,
  unavailableEvidence,
  validateEvidenceAvailability,
} from './evidenceAvailability'
import {
  VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
  validateVerificationEvidenceAvailability,
} from './verificationEvidenceAvailability'

describe('EvidenceAvailability', () => {
  it('constructs and validates all six immutable states', () => {
    const states = [
      availableEvidence({ count: 3, nested: ['verified'] }),
      measuredZeroEvidence(),
      unavailableEvidence('No snapshot was supplied.'),
      blockedEvidence('Review is incomplete.', [
        'second_review_missing',
        'adjudication_missing',
      ]),
      notApplicableEvidence('Calibration is not used for targeted review.'),
      failedEvidence(
        'media_inspection_failed',
        'The media bytes could not be decoded.',
        true,
      ),
    ]

    expect(states.map(({ state }) => state)).toEqual([
      'available',
      'measured_zero',
      'unavailable',
      'blocked',
      'not_applicable',
      'failed',
    ])
    for (const state of states) {
      expect(state.schemaVersion).toBe(
        EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
      )
      expect(validateEvidenceAvailability(state)).toEqual([])
      expect(Object.isFrozen(state)).toBe(true)
    }
    expect(states[0]).toSatisfy((state: unknown) => {
      if (
        typeof state !== 'object' ||
        state === null ||
        !('value' in state) ||
        typeof state.value !== 'object' ||
        state.value === null
      ) {
        return false
      }
      return Object.isFrozen(state.value)
    })
    expect(states[3]).toMatchObject({
      blockers: ['adjudication_missing', 'second_review_missing'],
    })
  })

  it('keeps measured zero distinct from missing and failed evidence', () => {
    expect(evidenceValueOrUndefined(measuredZeroEvidence())).toBe(0)
    expect(
      evidenceValueOrUndefined(unavailableEvidence('Not measured.')),
    ).toBeUndefined()
    expect(
      evidenceValueOrUndefined(
        failedEvidence('read_failed', 'Read failed.', false),
      ),
    ).toBeUndefined()
    expect(
      mapAvailableEvidence(availableEvidence(2), (value) => value * 3),
    ).toEqual(availableEvidence(6))
    expect(
      mapAvailableEvidence(
        blockedEvidence('Blocked.', ['review_missing']),
        () => 1,
      ),
    ).toEqual(blockedEvidence('Blocked.', ['review_missing']))
  })

  it('rejects ambiguous values and malformed state fields', () => {
    expect(() => availableEvidence(0)).toThrow(EvidenceAvailabilityError)
    expect(() => availableEvidence(-0)).toThrow(EvidenceAvailabilityError)
    expect(() => availableEvidence(Number.NaN)).toThrow(
      EvidenceAvailabilityError,
    )
    expect(() => availableEvidence(Number.POSITIVE_INFINITY)).toThrow(
      EvidenceAvailabilityError,
    )
    expect(() => availableEvidence(null as never)).toThrow(
      EvidenceAvailabilityError,
    )
    expect(() => blockedEvidence('Blocked.', [])).toThrow(
      EvidenceAvailabilityError,
    )
    expect(() =>
      blockedEvidence('Blocked.', ['same', 'same']),
    ).toThrow(EvidenceAvailabilityError)
    expect(() =>
      failedEvidence('INVALID-CODE', 'Failed.', false),
    ).toThrow(EvidenceAvailabilityError)

    expect(
      validateEvidenceAvailability({
        ...measuredZeroEvidence(),
        value: -1,
      }),
    ).toContain('measured-zero evidence value must equal numeric zero')
    expect(
      validateEvidenceAvailability({
        ...unavailableEvidence('Missing.'),
        unexpected: true,
      }),
    ).toContain('unavailable evidence fields are invalid')
    expect(
      validateEvidenceAvailability({
        schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
        state: 'blocked',
        reason: 'Blocked.',
        blockers: ['z', 'a'],
      }),
    ).toContain(
      'blocked evidence blockers must be non-empty unique sorted strings',
    )
  })
})

describe('verification evidence availability migration', () => {
  it('matches the committed current verification evidence packet', async () => {
    const { evidence } = await createVerificationAgentEvidenceFixture()

    expect(evidence.availability).toEqual(migratedAvailability)
    expect(evidence.availability.schemaVersion).toBe(
      VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    )
    expect(
      validateVerificationEvidenceAvailability(migratedAvailability),
    ).toEqual([])
    expect(containsNull(migratedAvailability)).toBe(false)
  })

  it('fails closed on malformed aggregate evidence', () => {
    expect(validateVerificationEvidenceAvailability(null)).toEqual([
      'verification evidence availability must be an object',
    ])
    expect(
      validateVerificationEvidenceAvailability({
        ...migratedAvailability,
        campaignId: '',
        unexpected: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        'verification evidence availability fields are invalid',
        'verification evidence availability campaign ID is empty',
      ]),
    )
    expect(
      validateVerificationEvidenceAvailability({
        ...migratedAvailability,
        comments: {
          schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
          state: 'available',
          value: null,
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'comments: available evidence value must not be null or undefined',
        'comments: available evidence value is invalid',
      ]),
    )
  })
})

function containsNull(value: unknown): boolean {
  if (value === null) {
    return true
  }
  if (Array.isArray(value)) {
    return value.some(containsNull)
  }
  if (typeof value === 'object') {
    return Object.values(value).some(containsNull)
  }
  return false
}
