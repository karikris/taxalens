import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import judgeBundleVerificationSectionsSchema from '../../../../../packages/contracts/schema/judge_bundle_verification_sections.schema.json'
import verificationSchema from '../../../../../packages/contracts/schema/verification.schema.json'
import verificationCampaignSchema from '../../../../../packages/contracts/schema/verification_campaign.schema.json'
import verificationConsensusSchema from '../../../../../packages/contracts/schema/verification_consensus.schema.json'
import verificationEventSchema from '../../../../../packages/contracts/schema/verification_event.schema.json'
import verificationItemSchema from '../../../../../packages/contracts/schema/verification_item.schema.json'
import verificationQualitySnapshotSchema from '../../../../../packages/contracts/schema/verification_quality_snapshot.schema.json'

export const VERIFICATION_SCHEMA_CONTRACTS = Object.freeze([
  'campaign',
  'item',
  'event',
  'consensus',
  'quality_snapshot',
  'judge_bundle_verification_sections',
] as const)

export type VerificationSchemaContract =
  (typeof VERIFICATION_SCHEMA_CONTRACTS)[number]

export interface VerificationSchemaFailure {
  readonly instancePath: string
  readonly keyword: string
}

export interface VerificationSchemaValidation {
  readonly contract: VerificationSchemaContract
  readonly valid: boolean
  readonly failures: readonly VerificationSchemaFailure[]
}

export class VerificationSchemaError extends Error {
  readonly validation: VerificationSchemaValidation

  constructor(validation: VerificationSchemaValidation) {
    super(
      `${validation.contract} failed verification schema validation: ${validation.failures
        .map(({ instancePath, keyword }) =>
          `${instancePath || '/'}:${keyword}`,
        )
        .join(', ')}`,
    )
    this.name = 'VerificationSchemaError'
    this.validation = validation
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
})
addFormats(ajv)
ajv.addSchema(verificationSchema)

const validators: Readonly<
  Record<VerificationSchemaContract, ValidateFunction>
> = Object.freeze({
  campaign: ajv.compile(verificationCampaignSchema),
  item: ajv.compile(verificationItemSchema),
  event: ajv.compile(verificationEventSchema),
  consensus: ajv.compile(verificationConsensusSchema),
  quality_snapshot: ajv.compile(verificationQualitySnapshotSchema),
  judge_bundle_verification_sections: ajv.compile(
    judgeBundleVerificationSectionsSchema,
  ),
})

export function validateVerificationSchema(
  contract: VerificationSchemaContract,
  value: unknown,
): VerificationSchemaValidation {
  const validator = validators[contract]
  const valid = validator(value)
  return Object.freeze({
    contract,
    valid,
    failures: valid ? Object.freeze([]) : normalizeErrors(validator.errors),
  })
}

export function assertVerificationSchema(
  contract: VerificationSchemaContract,
  value: unknown,
): void {
  const validation = validateVerificationSchema(contract, value)
  if (!validation.valid) {
    throw new VerificationSchemaError(validation)
  }
}

function normalizeErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly VerificationSchemaFailure[] {
  const failures = (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
  }))
  const unique = new Map(
    failures.map((failure) => [
      `${failure.instancePath}\u0000${failure.keyword}`,
      failure,
    ]),
  )
  return Object.freeze(
    [...unique.values()]
      .sort(
        (left, right) =>
          left.instancePath.localeCompare(right.instancePath) ||
          left.keyword.localeCompare(right.keyword),
      )
      .map((failure) => Object.freeze(failure)),
  )
}
