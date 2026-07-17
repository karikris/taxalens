import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'

import geographicFixtures from '../../../../packages/contracts/fixtures/geographic_contract_cases.json'
import baselineSchema from '../../../../packages/contracts/schema/baseline_occurrence_union.schema.json'
import hierarchySchema from '../../../../packages/contracts/schema/country_hierarchy.schema.json'
import impactCellSchema from '../../../../packages/contracts/schema/geographic_impact_cell.schema.json'
import impactManifestSchema from '../../../../packages/contracts/schema/geographic_impact_manifest.schema.json'
import impactSummarySchema from '../../../../packages/contracts/schema/geographic_impact_summary.schema.json'
import {
  BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  BASELINE_PROVIDER_UNION_POLICY_VERSION,
  GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
  type BaselineOccurrenceUnionRow,
  type GeographicImpactCellRow,
  type GeographicImpactSummaryRow,
} from '../../../../packages/contracts/src/geographic_impact_contract'

type GeographicFixtureContract = keyof typeof geographicFixtures.positive

interface NegativeFixtureCase {
  readonly fixture_id: string
  readonly contract: GeographicFixtureContract
  readonly operation: 'remove' | 'replace'
  readonly path: string
  readonly value?: unknown
  readonly expected_keyword: string
}

const schemas: Readonly<Record<GeographicFixtureContract, object>> = {
  baseline_occurrence_union: baselineSchema,
  geographic_impact_cell: impactCellSchema,
  geographic_impact_summary: impactSummarySchema,
  country_hierarchy: hierarchySchema,
  geographic_impact_manifest: impactManifestSchema,
}

const typedBaselineFixture = {
  ...geographicFixtures.positive.baseline_occurrence_union,
  schema_version: BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  provider_union_policy_version: BASELINE_PROVIDER_UNION_POLICY_VERSION,
  provider_source: 'gbif',
  delivery_provider: 'gbif',
  continent: 'Asia',
  known_range_role: 'native',
  provider_relationship_kind: 'canonical_source',
  match_method: 'singleton',
} as const satisfies BaselineOccurrenceUnionRow

const typedImpactCellFixture = {
  ...geographicFixtures.positive.geographic_impact_cell,
  schema_version: GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  provider_union_policy_version: BASELINE_PROVIDER_UNION_POLICY_VERSION,
  continent: 'Asia',
  baseline_evidence_status: 'available',
  direct_inaturalist_delta_status: 'unavailable',
  nearest_baseline_distance_status: 'not_applicable',
  data_deficient_state: 'sufficient',
} as const satisfies GeographicImpactCellRow

const typedImpactSummaryFixture = {
  ...geographicFixtures.positive.geographic_impact_summary,
  schema_version: GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
  provider_union_policy_version: BASELINE_PROVIDER_UNION_POLICY_VERSION,
  scope_level: 'global',
  baseline_evidence_status: 'available',
  direct_inaturalist_delta_status: 'unavailable',
  nearest_baseline_distance_status: 'available',
  data_deficient_state: 'sufficient',
} as const satisfies GeographicImpactSummaryRow

describe('geographic contract cross-language fixtures', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const validators = Object.fromEntries(
    Object.entries(schemas).map(([contract, schema]) => [
      contract,
      ajv.compile(schema),
    ]),
  ) as Record<GeographicFixtureContract, ValidateFunction>

  it('validates every shared positive fixture with AJV', () => {
    for (const contract of Object.keys(schemas) as GeographicFixtureContract[]) {
      const validate = validators[contract]
      expect(validate(geographicFixtures.positive[contract]), contract).toBe(
        true,
      )
    }
  })

  it('fails closed on the same shared negative fixtures as Python', () => {
    for (const fixture of geographicFixtures.negative as NegativeFixtureCase[]) {
      const document = structuredClone(
        geographicFixtures.positive[fixture.contract],
      ) as Record<string, unknown>
      mutate(document, fixture)
      const validate = validators[fixture.contract]

      expect(validate(document), fixture.fixture_id).toBe(false)
      expect(
        new Set((validate.errors ?? []).map((error) => error.keyword)),
        fixture.fixture_id,
      ).toContain(fixture.expected_keyword)
    }
  })

  it('keeps representative TypeScript satisfies fixtures byte-equivalent', () => {
    expect(typedBaselineFixture).toEqual(
      geographicFixtures.positive.baseline_occurrence_union,
    )
    expect(typedImpactCellFixture).toEqual(
      geographicFixtures.positive.geographic_impact_cell,
    )
    expect(typedImpactSummaryFixture).toEqual(
      geographicFixtures.positive.geographic_impact_summary,
    )
  })
})

function mutate(
  document: Record<string, unknown>,
  fixture: NegativeFixtureCase,
): void {
  const parts = fixture.path.split('.')
  const leaf = parts.pop()
  if (leaf === undefined) {
    throw new Error(`Invalid parity fixture path: ${fixture.path}`)
  }
  let target: unknown = document
  for (const part of parts) {
    target = Array.isArray(target)
      ? target[Number(part)]
      : objectValue(target)[part]
  }
  const container = objectValue(target)
  if (fixture.operation === 'remove') {
    delete container[leaf]
    return
  }
  container[leaf] = fixture.value
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Parity fixture path did not resolve to an object')
  }
  return value as Record<string, unknown>
}
