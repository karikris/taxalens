import { describe, expect, it } from 'vitest'

import {
  GEOGRAPHIC_EVIDENCE_MODES,
  GEOGRAPHIC_IMPACT_METRICS,
  GEOGRAPHIC_SCOPE_LEVELS,
  validateGeographicImpactQueryInput,
} from './geographicImpactQuery'

const queryInput = {
  evidenceScope: {
    projectId: 'project:synthetic',
    runId: 'run:synthetic',
    targetAcceptedTaxonKey: 'gbif:synthetic',
    baselineSnapshotId: 'baseline:synthetic',
    flickrSnapshotId: 'flickr:synthetic',
  },
  spatialResolution: 5,
  geographicScope: { level: 'country', id: 'country:AU' },
  evidenceMode: 'comparison',
  metric: 'record_count',
} as const

describe('geographic impact query input', () => {
  it('validates and freezes the complete project, snapshot and analytical scope', () => {
    const input = validateGeographicImpactQueryInput(queryInput)

    expect(input).toEqual(queryInput)
    expect(Object.isFrozen(input)).toBe(true)
    expect(Object.isFrozen(input.evidenceScope)).toBe(true)
    expect(Object.isFrozen(input.geographicScope)).toBe(true)
    expect(GEOGRAPHIC_SCOPE_LEVELS).toEqual(['global', 'continent', 'country', 'admin1'])
    expect(GEOGRAPHIC_EVIDENCE_MODES).toEqual([
      'comparison',
      'baseline',
      'flickr_candidates',
      'human_reviewed',
      'release_ready',
    ])
    expect(GEOGRAPHIC_IMPACT_METRICS).toEqual([
      'record_count',
      'candidate_only_cells',
      'reviewed_additional_cells',
      'release_ready_additional_cells',
      'range_edge_distance',
      'review_backlog',
    ])
  })

  it.each([
    ['evidenceScope.projectId', { evidenceScope: { ...queryInput.evidenceScope, projectId: '' } }],
    ['evidenceScope.runId', { evidenceScope: { ...queryInput.evidenceScope, runId: ' run' } }],
    [
      'evidenceScope.targetAcceptedTaxonKey',
      { evidenceScope: { ...queryInput.evidenceScope, targetAcceptedTaxonKey: null } },
    ],
    [
      'evidenceScope.baselineSnapshotId',
      { evidenceScope: { ...queryInput.evidenceScope, baselineSnapshotId: 'baseline ' } },
    ],
    [
      'evidenceScope.flickrSnapshotId',
      { evidenceScope: { ...queryInput.evidenceScope, flickrSnapshotId: undefined } },
    ],
  ])('rejects an invalid %s before analytical work starts', (field, replacement) => {
    expect(() =>
      validateGeographicImpactQueryInput({ ...queryInput, ...replacement }),
    ).toThrow(field)
  })

  it.each([-1, 1.5, 16, Number.NaN, '5'])(
    'rejects unsupported spatial resolution %s',
    (spatialResolution) => {
      expect(() =>
        validateGeographicImpactQueryInput({ ...queryInput, spatialResolution }),
      ).toThrow('spatialResolution must be an integer from 0 to 15')
    },
  )

  it.each([
    ['geographicScope.level', { geographicScope: { level: 'cell', id: 'cell:x' } }],
    ['geographicScope.id', { geographicScope: { level: 'country', id: ' country:AU' } }],
    ['evidenceMode', { evidenceMode: 'verified' }],
    ['metric', { metric: 'novelty' }],
  ])('rejects an unknown or non-canonical %s', (field, replacement) => {
    expect(() =>
      validateGeographicImpactQueryInput({ ...queryInput, ...replacement }),
    ).toThrow(field)
  })

  it('binds the global level to the canonical global scope id', () => {
    expect(
      validateGeographicImpactQueryInput({
        ...queryInput,
        geographicScope: { level: 'global', id: 'global' },
      }).geographicScope,
    ).toEqual({ level: 'global', id: 'global' })

    expect(() =>
      validateGeographicImpactQueryInput({
        ...queryInput,
        geographicScope: { level: 'global', id: 'country:AU' },
      }),
    ).toThrow('global geographic scope must use the scope id global')
    expect(() =>
      validateGeographicImpactQueryInput({
        ...queryInput,
        geographicScope: { level: 'country', id: 'global' },
      }),
    ).toThrow('global geographic scope must use the scope id global')
  })
})
