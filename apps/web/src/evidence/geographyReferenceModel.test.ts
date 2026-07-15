import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'
import { buildGeographyReferenceModel } from './geographyReferenceModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

const result = {
  sourceId: 'flickr:55081300254',
  coordinateQuality: 'flickr_street',
  coordinate: {
    latitude: 59.366308,
    longitude: 18.031366,
    accuracyLevel: 16,
    source: 'flickr_search_geo',
    warning: null,
    uncertaintyMeters: null,
  },
  cluster: {
    id: 'geo:be72642ae1a67685c5a68725',
    targetAcceptedTaxonKey: 'gbif:1938069',
    distanceToMedoidKm: 43.36547427503527,
    assignmentMethod: 'coarse_cell',
    fallbackScope: null,
    outlier: false,
    memberImageCount: 437,
    memberCellCount: 7,
    centroidLatitude: 59.36977516221015,
    centroidLongitude: 17.15959829013883,
    radiusP95Km: 52.120425429532695,
    candidateDistributionOnly: true,
  },
  scientificClaimAllowed: false,
} as DiscoveryProvenanceResult

describe('buildGeographyReferenceModel', () => {
  it('withholds coordinates until the verified local join runs', () => {
    const model = buildGeographyReferenceModel(replay, null, 'idle')

    expect(model.coordinate.status).toBe('unavailable')
    expect(model.cluster.status).toBe('unavailable')
    expect(model.uncertainty.status).toBe('unavailable')
    expect(model.competitorEvidence.status).toBe('unavailable')
    expect(model.shortfalls.sourceCandidateShortfall).toBe(247)
    expect(model.rights.licensedImageCount).toBe(0)
  })

  it('projects a candidate coordinate without promoting it to occurrence evidence', () => {
    const model = buildGeographyReferenceModel(replay, result, 'ready')

    expect(model.coordinate).toMatchObject({
      status: 'metadata',
      latitude: 59.366308,
      longitude: 18.031366,
      accuracyLevel: 16,
    })
    expect(model.cluster).toMatchObject({
      status: 'metadata',
      id: 'geo:be72642ae1a67685c5a68725',
      memberImageCount: 437,
      memberCellCount: 7,
    })
    expect(model.fallback.selectedRecordStatus).toBe('not_used')
    expect(model.targetEvidence.status).toBe('metadata')
    expect(model.verification.scientificClaimAllowed).toBe(false)
  })
})
