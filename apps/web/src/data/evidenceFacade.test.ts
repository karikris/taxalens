import { describe, expect, it, vi } from 'vitest'

import type { JudgeBundleContract } from '../../../../packages/contracts/src/judge_bundle_contract'
import {
  committedFixtureFiles,
  committedJudgeBundle,
  createCommittedFixtureFetcher,
} from '../test/fixtures'
import {
  EvidenceFacadeError,
  loadEvidenceFacade,
  replayEvidenceContract,
} from './evidenceFacade'

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new Error('Test fixture is not JSON-compatible')
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

async function parquetFixtureOverrides(): Promise<
  Readonly<Record<string, string | Uint8Array<ArrayBuffer>>>
> {
  const manifest = structuredClone(committedJudgeBundle) as unknown as JudgeBundleContract
  const parquetBytes = new TextEncoder().encode('PAR1-taxalens-testPAR1')
  const artifactId = 'run-summary-parquet'
  manifest.artifact_inventory.push({
    artifact_id: artifactId,
    path: 'data/run_summary.parquet',
    media_type: 'application/vnd.apache.parquet',
    role: 'run_summary',
    sha256: await sha256Hex(parquetBytes),
    bytes: parquetBytes.byteLength,
    record_count: 0,
    schema_version: null,
    source_repository: 'karikris/TaxaLens',
    source_commit: replayEvidenceContract.taxalensSha,
    required: false,
  })
  manifest.sections.run_summary.artifact_ids.push(artifactId)
  const rightsItem = manifest.rights.items[0]
  const attributionEntry = manifest.attribution.entries[0]
  if (rightsItem === undefined || attributionEntry === undefined) {
    throw new Error('Committed fixture needs rights and attribution entries')
  }
  rightsItem.artifact_ids.push(artifactId)
  attributionEntry.artifact_ids.push(artifactId)
  manifest.expected_ui_counts.artifact_count = manifest.artifact_inventory.length
  manifest.checksums.inventory_sha256 = await sha256Hex(
    new TextEncoder().encode(canonicalJson(manifest.artifact_inventory)),
  )
  const files = [...manifest.artifact_inventory]
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    .map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 }))
  manifest.checksums.payload_root_sha256 = await sha256Hex(
    new TextEncoder().encode(canonicalJson({ files })),
  )
  return {
    'judge_bundle.json': JSON.stringify(manifest),
    'data/run_summary.parquet': parquetBytes,
  }
}

describe('loadEvidenceFacade', () => {
  it('validates the committed contract and verifies every artifact in deterministic order', async () => {
    const fetcher = vi.fn(createCommittedFixtureFetcher())

    const facade = await loadEvidenceFacade(new AbortController().signal, fetcher)

    expect(facade.replay.bundleId).toBe(replayEvidenceContract.bundleId)
    expect(facade.replay.bundleCreatedAt).toBe('2026-07-16T09:44:16Z')
    expect(facade.replay.target.scientificName).toBe('Papilio demoleus')
    expect(facade.replay.artifactCount).toBe(25)
    expect(facade.replay.verifiedArtifactCount).toBe(25)
    expect(facade.replay.unavailableSections).toHaveLength(6)
    expect(facade.replay.sections.yoloe_evidence.status).toBe('unavailable')
    expect(facade.replay.artifactInventory).toHaveLength(25)
    expect(facade.replay.artifactInventory.every(({ verified }) => verified)).toBe(true)
    expect(facade.loadStoredOpenAIReplay()).toMatchObject([
      {
        traceId: 'papilio-target-resolution-stored-replay',
        sequence: 1,
        model: 'gpt-5.6-sol',
        occurredAt: null,
        storedOutputOnly: true,
        credentialsRequired: false,
        liveRequestsAllowed: false,
        requestArtifact: {
          artifactId: 'stored-analyst-request',
          path: 'agent/stored_analyst_request.json',
        },
        responseArtifact: {
          artifactId: 'stored-analyst-run',
          path: 'agent/stored_analyst_run.json',
        },
      },
    ])
    expect(
      facade.replay.artifactInventory.find(
        ({ artifactId }) => artifactId === 'biominer-flickr-query-hits-parquet',
      ),
    ).toMatchObject({
      path: 'analytics/flickr_query_hits.parquet',
      sha256: '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
      verified: true,
    })
    expect(facade.replay.mission).toMatchObject({
      sourceRegistry: {
        name: 'BioMiner butterflies registry',
        version: 'butterflies-v2-20260712',
        sourceSnapshotVersion: 'gbif-reference-search-20260715',
        acceptedIdentityNamespace: 'gbif',
      },
      queryPolicy: {
        queryCount: 22,
        queriedSpeciesCount: 22,
        defaultRetrievalPolicy: 'global_then_assign_to_flickr_clusters',
        occurrenceSearchCeiling: 100000,
      },
      candidatePolicy: {
        candidateCount: 5,
        minimumPerSpecies: 20,
        maximumPerSpecies: 50,
      },
      referenceRequirements: {
        eligibleSourceMediaCount: 838,
        humanVerifiedSourceMediaCount: 0,
        sourceCandidateShortfall: 247,
        humanVerifiedShortfall: 490,
      },
      budgets: {
        materializedRequestCount: 314,
        localBuildVerificationMaxImages: 5,
      },
    })
    expect(facade.replay.mission.regions).toHaveLength(8)
    expect(facade.replay.mission.candidatePolicy.candidates[0]).toEqual({
      recordId: 'regional-competitor-1',
      acceptedTaxonKey: 'gbif:1937892',
      scientificName: 'Papilio memnon',
      candidateReason: 'source_taxon_match_not_human_verified_image_label',
      verificationStatus: 'candidate_plan_verified_not_reference_verified',
    })
    expect(facade.replay.mission.prerequisiteGates).toHaveLength(4)
    expect(facade.replay.mission.pipelineStages).toHaveLength(8)
    expect(facade.replay.mission.pipelineStages[4]).toMatchObject({
      stageId: 'yoloe-detection',
      status: 'unavailable',
      recordCount: 0,
      scientificClaimAllowed: false,
    })
    expect(facade.replay.observatory).toEqual({
      registryTaxonCount: 22,
      physicalQueryCount: 22,
      flickrQueryHitCount: 76_485,
      canonicalPhotoCount: 13_501,
      locatedClusterCount: 76,
      regionalCandidateCount: 5,
      eligibleReferenceCandidateCount: 838,
      yoloeImageCount: 0,
      fullFrameTransformationCount: 0,
      candidateVisualScoreCount: 0,
      calibratedDecisionCount: 0,
      humanCommentCount: 0,
      finalEvidenceCount: 0,
    })
    expect(facade.replay.discovery).toEqual({
      media: {
        status: 'unavailable',
        includedImageCount: 0,
        licensedImageCount: 0,
        reason: 'No committed image has both a human-verified label and a fixture rights record.',
      },
      duplicateRelationships: {
        available: false,
        reason:
          'The verified duplicate summary contains counts only; duplicate relationship rows are unavailable.',
      },
    })
    expect(facade.replay.geographyReference).toEqual({
      geography: {
        recordId: 'geographic-cluster-summary',
        candidateSemantics: 'flickr_search_candidate_not_taxonomic_label',
        verificationStatus: 'summary_verified_payload_not_imported',
        locatedClusterCount: 76,
        eligibleReferenceClusterCount: 76,
        fallbackClusterCount: 1,
        outlierRecordCount: 707,
        unassignedGeotaggedRecordCount: 792,
        payloadRowsAvailable: false,
      },
      reference: {
        readinessVerificationStatus: 'committed_metadata_counts_verified',
        shortfallVerificationStatus: 'shortfall_report_verified_unresolved',
        eligibleSourceMediaCount: 838,
        humanVerifiedSourceMediaCount: 0,
        sourceCandidateShortfall: 247,
        humanVerifiedShortfall: 490,
        groupsAwaitingHumanReview: 1,
        unresolvedGroupCount: 2,
        workflowMeasurements: {
          observedRequestCount: 314,
          retryCount: 0,
          rateLimitCount: 0,
          checkpointCount: 22,
          completeCheckpointCount: 22,
          checkpointPageCount: 314,
          checkpointObservationRowCount: 91_180,
          observationCount: 91_176,
          deduplicatedObservationCount: 4,
          checkpointMediaCandidateRowCount: 142_878,
          mediaCandidateCount: 142_873,
          deduplicatedMediaCandidateCount: 5,
          imagesDownloaded: 0,
        },
      },
      sourceRights: {
        creatorOrOwner: 'Kris Kari',
        sourceUrl: 'https://github.com/karikris/BioMiner',
        licenseName: 'MIT',
        licenseUri: 'https://opensource.org/license/mit',
        attributionRequired: true,
        metadataRightsVerified: true,
        includedImageCount: 0,
        licensedImageCount: 0,
        mediaPolicy:
          'No image is admitted without a committed license, attribution, and human-review record.',
      },
    })
    expect(facade.replay.selectiveDecision).toEqual({
      recordId: 'papilio-demoleus-pilot-awaiting-review',
      state: 'awaiting_human_review',
      displayLabel: 'Awaiting human review',
      allowedTransition: 'human_review_of_rights-cleared_source_media',
      verificationStatus: 'human_review_pending',
      unavailableReason:
        'No committed human-verified target classification or admitted image exists.',
      decisionStatus: 'unavailable',
      candidateVisualScoreCount: 0,
      gates: [
        { name: 'licensed_media_in_fixture', satisfied: false },
        { name: 'real_detection_data', satisfied: false },
        { name: 'real_full_frame_transformation', satisfied: false },
        { name: 'real_candidate_visual_scores', satisfied: false },
        { name: 'human_verified_target_classification', satisfied: false },
      ],
    })
    expect(facade.replay.prototype).toMatchObject({
      status: 'prototype_only_available_with_limitations',
      prototypeIntegrationAuthorized: true,
      scientificReleaseAuthorized: false,
      publicReferenceImageDisplayAuthorized: false,
      referenceBank: {
        supportCount: 81,
        humanVerifiedCount: 0,
        allowedCount: 2,
        researchOnlyCount: 79,
      },
      runtime: {
        embeddingDimension: 1024,
        frozenSupportEmbeddings: 81,
        yoloeRole: 'gate_and_router_only',
      },
      benchmark: {
        experimentCount: 19,
        b0TargetScoreability: 0.1,
        b13TargetScoreability: 1,
        classificationAccuracyReported: false,
      },
      policy: {
        experimentId: 'B13',
        rawMarginThreshold: 0.1,
        scoresAreProbabilities: false,
      },
      staged: {
        classifiedCount: 13_496,
        candidateScoreRowCount: 634_312,
        stagedAbstainedCount: 12_296,
        stagedDiagnosticThreshold: 0.02,
      },
      semantics: {
        classificationAccuracy: null,
        calibrationError: null,
        stagedDistributionIsPrevalence: false,
      },
      provenance: {
        artifactId: 'prototype-evidence-snapshot',
        originCommit: replayEvidenceContract.biominerSha,
        producerSha: replayEvidenceContract.taxalensSha,
        importedArtifactCount: 20,
      },
    })
    expect(facade.replay.verification).toMatchObject({
      inventoryChecksumVerified: true,
      payloadRootChecksumVerified: true,
      artifactChecksumsVerified: true,
      dataMode: 'verified-json-bootstrap',
      fallbackReason: 'analytics_on_demand',
      wasmStarted: false,
    })

    const requestedArtifacts = fetcher.mock.calls.slice(1).map(([input]) => {
      const url = input instanceof Request ? input.url : input.toString()
      return new URL(url, window.location.href).pathname.replace(/^\//u, '')
    })
    const expectedArtifacts = Object.keys(committedFixtureFiles)
      .filter((path) => path !== 'judge_bundle.json')
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    expect(requestedArtifacts).toEqual(expectedArtifacts)

    const runSummary = await facade.loadSection('run_summary')
    expect(runSummary).toMatchObject({
      status: 'available',
      mode: 'json-fallback',
      fallbackReason: 'parquet_unavailable',
    })
    const unavailable = await facade.loadSection('yoloe_evidence')
    expect(unavailable).toMatchObject({ status: 'unavailable', mode: 'unavailable' })

    const analytics = facade.loadAnalyticsReplayInput()
    expect(analytics.artifacts.map(({ artifactId }) => artifactId)).toEqual([
      'biominer-flickr-query-hits-parquet',
      'biominer-flickr-geography-parquet',
      'biominer-flickr-geo-assignments-parquet',
      'biominer-flickr-geo-clusters-parquet',
    ])
    expect(analytics.artifacts.reduce((total, artifact) => total + artifact.bytes.byteLength, 0)).toBe(
      1_647_550,
    )
    expect(analytics.artifacts[0]).toMatchObject({
      sizeBytes: 222_190,
      recordCount: 76_485,
      sha256: '95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b',
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    })
    expect(analytics.candidateArtifact).toMatchObject({
      artifactId: 'candidate-sets',
      sizeBytes: 2_280,
      recordCount: 5,
      sha256: 'cd36c310150c0ca9c63e0adf690519a0afb5428b68c7eb064f8b4e6749cb0791',
      producerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    })
    expect(analytics.candidates).toHaveLength(6)
    expect(analytics.candidates[0]).toMatchObject({
      acceptedTaxonKey: 'gbif:1938069',
      evidenceRole: 'target_under_study',
      scientificClaimAllowed: false,
    })
    expect(analytics.receipt).toMatchObject({
      schemaVersion: 'taxalens-biominer-analytics-import:v1.0.0',
      originCommit: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    })
    const discovery = facade.loadDiscoveryProvenanceInput()
    expect(discovery.artifacts.map(({ artifactId }) => artifactId)).toEqual([
      'biominer-flickr-query-hits-parquet',
      'biominer-flickr-geography-parquet',
      'biominer-flickr-geo-assignments-parquet',
      'biominer-flickr-geo-clusters-parquet',
    ])
    expect(discovery.boundary).toBe(facade.replay.discovery)
    expect(discovery.receipt).toMatchObject({
      originCommit: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    })
    const firstByte = analytics.artifacts[0]?.bytes[0]
    if (analytics.artifacts[0] === undefined) {
      throw new Error('Analytics fixture has no query-hit Parquet bytes')
    }
    analytics.artifacts[0].bytes[0] = 0
    expect(facade.loadAnalyticsReplayInput().artifacts[0]?.bytes[0]).toBe(firstByte)
  })

  it('stops before display when an artifact has the right length but the wrong checksum', async () => {
    const original = committedFixtureFiles['data/run_summary.json']
    if (typeof original !== 'string') {
      throw new Error('Committed run summary fixture is missing')
    }
    const tampered = original.replace('awaiting_human_review', 'awaiting_human_rexiew')

    await expect(
      loadEvidenceFacade(
        new AbortController().signal,
        createCommittedFixtureFetcher({ 'data/run_summary.json': tampered }),
      ),
    ).rejects.toThrow('run-summary checksum verification failed')
  })

  it('rejects a stale manifest through the authoritative runtime schema', async () => {
    const stale = { ...committedJudgeBundle, schema_version: 'future-bundle:v2' }

    await expect(
      loadEvidenceFacade(
        new AbortController().signal,
        createCommittedFixtureFetcher({ 'judge_bundle.json': JSON.stringify(stale) }),
      ),
    ).rejects.toThrow('runtime schema validation')
  })

  it('uses verified JSON when Parquet or its Wasm reader is unavailable', async () => {
    const facade = await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(await parquetFixtureOverrides()),
    )

    await expect(facade.loadSection('run_summary')).resolves.toMatchObject({
      mode: 'json-fallback',
      fallbackReason: 'wasm_unavailable',
    })
    await expect(
      facade.loadSection('run_summary', async () => {
        throw new Error('Wasm worker unavailable')
      }),
    ).resolves.toMatchObject({
      mode: 'json-fallback',
      fallbackReason: 'parquet_wasm_failed',
    })
    await expect(
      facade.loadSection('run_summary', async (artifact) => ({ bytes: artifact.bytes.byteLength })),
    ).resolves.toMatchObject({
      mode: 'parquet-wasm',
      fallbackReason: null,
      value: { bytes: 22 },
    })
  })

  it('reports facade-specific errors', () => {
    expect(new EvidenceFacadeError('stopped')).toMatchObject({
      name: 'EvidenceFacadeError',
      message: 'stopped',
    })
  })
})
