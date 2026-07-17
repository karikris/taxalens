import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

import {
  createGeographicToolEvidence,
  GEOGRAPHIC_ARTIFACT_CITATION_VERSION,
  GEOGRAPHIC_ARTIFACT_KINDS,
  GEOGRAPHIC_TOOL_DEFINITIONS,
  GEOGRAPHIC_TOOL_NAMES,
} from './geographicTools'

describe('geographic tool contracts', () => {
  it('declares the six exact strict read-only geographic tools', () => {
    expect(GEOGRAPHIC_TOOL_DEFINITIONS.map(({ name }) => name)).toEqual(
      GEOGRAPHIC_TOOL_NAMES,
    )
    for (const definition of GEOGRAPHIC_TOOL_DEFINITIONS) {
      expect(definition).toMatchObject({
        type: 'function',
        strict: true,
        read_only: true,
        allowed_callers: ['direct', 'programmatic'],
      })
      expect(definition.parameters.additionalProperties).toBe(false)
      expect(definition.output_schema.additionalProperties).toBe(false)
      expect(Object.isFrozen(definition)).toBe(true)
    }
  })

  it('requires a complete immutable citation chain and exact snapshots', () => {
    const citations = GEOGRAPHIC_ARTIFACT_KINDS.map((artifactKind, index) => ({
      schemaVersion: GEOGRAPHIC_ARTIFACT_CITATION_VERSION,
      artifactKind,
      artifactId: `artifact:${artifactKind}`,
      availability: artifactKind === 'quality_snapshot' ? 'unavailable' as const : 'available' as const,
      snapshotId:
        artifactKind === 'baseline_provider_union'
          ? 'baseline:a'
          : artifactKind === 'flickr_geography' ? 'flickr:a' : null,
      sha256: artifactKind === 'quality_snapshot' ? null : String(index + 1).repeat(64),
      sourceRepository: artifactKind === 'quality_snapshot' ? null : 'karikris/taxalens',
      sourceCommit: artifactKind === 'quality_snapshot' ? null : String(index + 1).repeat(40),
      sourcePath: artifactKind === 'quality_snapshot' ? null : `demo/${artifactKind}`,
      unavailableReason: artifactKind === 'quality_snapshot' ? 'No retained quality snapshot.' : null,
    }))
    const input = {
      evidenceId: 'geographic:evidence:a',
      evidenceScope: {
        projectId: 'project:a',
        runId: 'run:a',
        acceptedTaxonKey: 'gbif:1938069',
        baselineSnapshotId: 'baseline:a',
        flickrSnapshotId: 'flickr:a',
      },
      artifactCitations: citations,
    }

    const evidence = createGeographicToolEvidence(input)
    expect(evidence.artifactCitations).toHaveLength(GEOGRAPHIC_ARTIFACT_KINDS.length)
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(() => createGeographicToolEvidence({ ...input, artifactCitations: citations.slice(1) }))
      .toThrow('artifact citation kind is missing: baseline_provider_union')
    expect(() => createGeographicToolEvidence({
      ...input,
      evidenceScope: { ...input.evidenceScope, flickrSnapshotId: 'flickr:wrong' },
    })).toThrow('Flickr citation snapshot differs')
  })

  it('requires complete evidence scope and compiles every closed schema', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const common = [
      'project_id',
      'run_id',
      'accepted_taxon_key',
      'baseline_snapshot_id',
      'flickr_snapshot_id',
      'spatial_resolution',
    ]
    for (const definition of GEOGRAPHIC_TOOL_DEFINITIONS) {
      expect(definition.parameters.required).toEqual(expect.arrayContaining(common))
      expect(() => ajv.compile(definition.parameters)).not.toThrow()
      expect(() => ajv.compile(definition.output_schema)).not.toThrow()
    }
  })

  it('rejects unscoped, extra, and unbounded arguments', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    const definition = GEOGRAPHIC_TOOL_DEFINITIONS.find(
      ({ name }) => name === 'list_candidate_gap_cells',
    )!
    const validate = ajv.compile(definition.parameters)
    const valid = {
      project_id: 'project:a',
      run_id: 'run:a',
      accepted_taxon_key: 'gbif:1938069',
      baseline_snapshot_id: 'baseline:a',
      flickr_snapshot_id: 'flickr:a',
      spatial_resolution: 7,
      scope_level: 'country',
      scope_id: 'country:SE',
      contribution_state: 'potential',
      limit: 25,
    }

    expect(validate(valid)).toBe(true)
    expect(validate({ ...valid, project_id: undefined })).toBe(false)
    expect(validate({ ...valid, limit: 101 })).toBe(false)
    expect(validate({ ...valid, surprise: true })).toBe(false)
  })
})
