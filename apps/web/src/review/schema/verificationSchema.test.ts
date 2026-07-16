import { describe, expect, it } from 'vitest'

import judgeBundle from '../../../../../demo/fixture/papilio_pilot/judge_bundle.json'
import { createVerificationAgentEvidenceFixture } from '../../test/verificationAgentEvidence'
import {
  VERIFICATION_SCHEMA_CONTRACTS,
  VerificationSchemaError,
  assertVerificationSchema,
  validateVerificationSchema,
  type VerificationSchemaContract,
} from './verificationSchema'

describe('authoritative verification schemas', () => {
  it('accepts production-valid campaign, item, event, consensus and quality evidence', async () => {
    const fixture = await createVerificationAgentEvidenceFixture()
    const evidence = fixture.evidence
    const cases: Readonly<
      Record<Exclude<VerificationSchemaContract, 'judge_bundle_verification_sections'>, readonly unknown[]>
    > = {
      campaign: [fixture.campaign],
      item: fixture.items,
      event: fixture.events,
      consensus: evidence.consensus,
      quality_snapshot: evidence.qualitySnapshots,
    }

    for (const [contract, values] of Object.entries(cases) as [
      Exclude<
        VerificationSchemaContract,
        'judge_bundle_verification_sections'
      >,
      readonly unknown[],
    ][]) {
      for (const value of values) {
        expect(validateVerificationSchema(contract, value)).toEqual({
          contract,
          valid: true,
          failures: [],
        })
      }
    }
  })

  it('accepts the current judge-bundle verification section projection', () => {
    const sections = Object.fromEntries(
      VERIFICATION_SCHEMA_CONTRACTS.filter((contract) =>
        contract.startsWith('judge_bundle'),
      ).flatMap(() =>
        [
          'verification_campaigns',
          'verification_items',
          'verification_media',
          'verification_decisions',
          'verification_quality',
        ].map((name) => [
          name,
          judgeBundle.sections[
            name as keyof typeof judgeBundle.sections
          ],
        ]),
      ),
    )

    expect(
      validateVerificationSchema(
        'judge_bundle_verification_sections',
        sections,
      ),
    ).toEqual({
      contract: 'judge_bundle_verification_sections',
      valid: true,
      failures: [],
    })
  })

  it('normalizes fail-closed schema errors and exposes an asserting boundary', async () => {
    const { campaign } = await createVerificationAgentEvidenceFixture()
    const invalid = {
      ...campaign,
      campaignId: '',
      unexpected: true,
    }

    expect(validateVerificationSchema('campaign', invalid)).toEqual({
      contract: 'campaign',
      valid: false,
      failures: [
        { instancePath: '', keyword: 'additionalProperties' },
        { instancePath: '/campaignId', keyword: 'minLength' },
      ],
    })
    expect(() => assertVerificationSchema('campaign', invalid)).toThrow(
      VerificationSchemaError,
    )
  })
})
