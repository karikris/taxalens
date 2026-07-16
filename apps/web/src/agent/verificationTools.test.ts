import { describe, expect, it, vi } from 'vitest'

import {
  REVIEWER_RELIABILITY_SCHEMA_VERSION,
  TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
  VERIFICATION_COVERAGE_SCHEMA_VERSION,
  VERIFICATION_EVENT_SCHEMA_VERSION,
  VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
  VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
  calculateReviewerNominalAlpha,
  calculateReviewerPercentAgreement,
  calculateVerificationCoverage,
  createVerificationQualitySnapshot,
  estimateSimpleRandomTargetPrecision,
  projectVerificationConsensus,
  type HumanReviewInspection,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
  type VerificationQualitySnapshot,
  type VerificationQualitySnapshotInput,
} from '../review/domain'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'
import {
  createVerificationToolEvidence,
  executeVerificationTool,
  VERIFICATION_ARTIFACT_CITATION_VERSION,
  VERIFICATION_ARTIFACT_KINDS,
  VERIFICATION_TOOL_DEFINITIONS,
  VERIFICATION_TOOL_NAMES,
  VerificationToolError,
  type VerificationArtifactCitation,
  type VerificationToolEvidence,
  type VerificationToolName,
  type VerificationToolResult,
} from './verificationTools'

const TAXALENS_SHA = '439695e901271bb82c6ff97b41849d7233422d24'
const BIOMINER_SHA = '94fa1f634ee3c63917c05d78181dd3cf9ceff940'
const BIOMINER_ROLE_ARTIFACT_SHA =
  'fc96f8ecce5353629d601235aa43221df3e844ebdfa85e1efa49fe10dd52059c'

describe('verification evidence tool registry', () => {
  it('publishes the eight required strict read-only tool definitions', () => {
    expect(VERIFICATION_TOOL_DEFINITIONS.map(({ name }) => name)).toEqual(
      VERIFICATION_TOOL_NAMES,
    )
    expect(VERIFICATION_TOOL_DEFINITIONS).toHaveLength(8)

    for (const definition of VERIFICATION_TOOL_DEFINITIONS) {
      expect(definition).toMatchObject({
        type: 'function',
        strict: true,
        allowed_callers: ['direct', 'programmatic'],
        parameters: {
          type: 'object',
          additionalProperties: false,
        },
        output_schema: {
          type: 'object',
          additionalProperties: false,
        },
      })
      expect(definition.parameters.required).toEqual(
        Object.keys(definition.parameters.properties),
      )
      expect(definition.output_schema.required).toEqual(
        Object.keys(definition.output_schema.properties),
      )
      expect(definition.output_schema.properties.tool).toEqual({
        type: 'string',
        const: definition.name,
      })
      expect(JSON.stringify(definition.parameters)).not.toContain('taxon')
      expect(Object.isFrozen(definition)).toBe(true)
    }
  })

  it('executes every tool with complete immutable artifact citations', async () => {
    const packet = await evidencePacket()
    const results = executeAllTools(packet.evidence)

    expect(results.map(({ tool }) => tool)).toEqual(VERIFICATION_TOOL_NAMES)
    for (const result of results) {
      expect(result.scientificClaimAllowed).toBe(false)
      expect(result.artifactIds).toEqual(
        result.artifactCitations.map(({ artifactId }) => artifactId),
      )
      expect(new Set(result.artifactCitations.map(({ artifactKind }) => artifactKind)))
        .toEqual(new Set(VERIFICATION_ARTIFACT_KINDS))
      expect(
        result.artifactCitations.every(
          ({ sha256, sourceCommit }) =>
            /^[a-f0-9]{64}$/u.test(sha256) &&
            /^[a-f0-9]{40}$/u.test(sourceCommit),
        ),
      ).toBe(true)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.artifactCitations)).toBe(true)
      expect(Object.isFrozen(result.facts)).toBe(true)
      expect(Object.isFrozen(result.records)).toBe(true)
    }
  })

  it('reports exact review state and ranks only committed item IDs', async () => {
    const { evidence, afterSnapshot, items } = await evidencePacket()
    const campaign = executeVerificationTool(
      'inspect_verification_campaign',
      { campaign_id: evidence.campaign.campaignId },
      evidence,
    )
    const coverage = executeVerificationTool(
      'inspect_review_coverage',
      { campaign_id: evidence.campaign.campaignId },
      evidence,
    )
    const conflicts = executeVerificationTool(
      'inspect_review_conflicts',
      { campaign_id: evidence.campaign.campaignId },
      evidence,
    )
    const sampling = executeVerificationTool(
      'inspect_sampling_plan',
      { campaign_id: evidence.campaign.campaignId },
      evidence,
    )
    const nextBatch = executeVerificationTool(
      'recommend_next_review_batch',
      {
        campaign_id: evidence.campaign.campaignId,
        batch_size: 2,
      },
      evidence,
    )
    const quality = executeVerificationTool(
      'inspect_quality_snapshot',
      {
        campaign_id: evidence.campaign.campaignId,
        snapshot_sha256: afterSnapshot.snapshotSha256,
      },
      evidence,
    )
    const references = executeVerificationTool(
      'inspect_reference_readiness',
      {
        campaign_id: evidence.campaign.campaignId,
        snapshot_sha256: afterSnapshot.snapshotSha256,
      },
      evidence,
    )

    expect(factValues(campaign)).toMatchObject({
      campaign_kind: 'quality_control',
      item_count: 3,
      event_count: 4,
      required_independent_reviewers: 2,
      target_accepted_taxon_key:
        evidence.campaign.targetTaxon?.acceptedTaxonKey,
    })
    expect(factValues(coverage)).toMatchObject({
      eligible_items: 3,
      attempted_items: 2,
      unattempted_items: 1,
      decisively_reviewed_items: 1,
      uncertain_items: 1,
      pending_items: 1,
      effective_review_count: 4,
    })
    expect(conflicts.status).toBe('blocked')
    expect(factValues(conflicts)).toMatchObject({
      unresolved_conflict_items: 1,
      adjudicated_items: 0,
      conflicted_items: 1,
      conflict_rate: 0.5,
    })
    expect(factValues(sampling)).toMatchObject({
      sampling_purpose: 'quality_estimation',
      sampling_design: 'simple_random',
      representative: true,
      quality_estimation_allowed: true,
    })
    expect(nextBatch.records.map(({ id }) => id)).toEqual([
      items[0]!.itemId,
      items[2]!.itemId,
    ])
    expect(
      nextBatch.records.every(({ id }) =>
        items.some(({ itemId }) => itemId === id),
      ),
    ).toBe(true)
    expect(factValues(nextBatch)).toMatchObject({
      preserves_manifest_identity: true,
      creates_taxon_identity: false,
    })
    expect(quality.status).toBe('partial')
    expect(factValues(quality)).toMatchObject({
      precision_availability: 'unavailable',
      unresolved_conflict_items: 1,
      release_status: 'not_evaluated',
    })
    expect(references.status).toBe('blocked')
    expect(factValues(references)).toMatchObject({
      reference_readiness_status: 'not_ready',
      prototype_support_count: 81,
      verified_support_count: 0,
      attested_role_suitable_count: 81,
      independent_human_taxonomic_verification_claimed: false,
    })
  })

  it('describes snapshot deltas without claiming individual causality', async () => {
    const { evidence, beforeSnapshot, afterSnapshot } =
      await evidencePacket()
    const change = executeVerificationTool(
      'explain_quality_change',
      {
        campaign_id: evidence.campaign.campaignId,
        before_snapshot_sha256: beforeSnapshot.snapshotSha256,
        after_snapshot_sha256: afterSnapshot.snapshotSha256,
      },
      evidence,
    )

    expect(factValues(change)).toMatchObject({
      attempted_items_delta: 1,
      decisive_sample_delta: 0,
      precision_point_delta: null,
      unresolved_conflicts_delta: 1,
      reference_readiness_change: 'unchanged',
    })
    expect(change.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'attempted_items_delta',
          detail: 'Changed from 1 to 2.',
        }),
        expect.objectContaining({
          id: 'unresolved_conflicts_delta',
          detail: 'Changed from 0 to 1.',
        }),
      ]),
    )
    expect(change.limitations.join(' ')).toContain('does not infer a causal effect')
  })

  it('fails closed on invalid evidence, tool names, and arguments', async () => {
    const packet = await packetInput()
    const evidence = await createVerificationToolEvidence(packet.input)

    expect(() =>
      executeVerificationTool('delete_reviews', {}, evidence),
    ).toThrow(VerificationToolError)
    expect(() =>
      executeVerificationTool(
        'inspect_review_coverage',
        { campaign_id: 'another-campaign' },
        evidence,
      ),
    ).toThrow(/exact committed campaign ID/u)
    expect(() =>
      executeVerificationTool(
        'recommend_next_review_batch',
        {
          campaign_id: evidence.campaign.campaignId,
          batch_size: 51,
        },
        evidence,
      ),
    ).toThrow(/integer from 1 through 50/u)
    expect(() =>
      executeVerificationTool(
        'inspect_quality_snapshot',
        {
          campaign_id: evidence.campaign.campaignId,
          snapshot_sha256: 'not-a-digest',
        },
        evidence,
      ),
    ).toThrow(/lowercase SHA-256/u)

    await expect(
      createVerificationToolEvidence({
        ...packet.input,
        consensus: packet.input.consensus.slice(0, 2),
      }),
    ).rejects.toMatchObject({ code: 'invalid_evidence' })
    await expect(
      createVerificationToolEvidence({
        ...packet.input,
        artifactCitations: packet.input.artifactCitations.filter(
          ({ artifactKind }) => artifactKind !== 'biominer_source',
        ),
      }),
    ).rejects.toThrow(/artifact citation kind is missing: biominer_source/u)
    await expect(
      createVerificationToolEvidence({
        ...packet.input,
        qualitySnapshots: packet.input.qualitySnapshots.map(
          (snapshot, index) =>
            index === 0
              ? {
                  ...snapshot,
                  capturedAt: '2026-07-16T18:59:00.000Z',
                }
              : snapshot,
        ),
      }),
    ).rejects.toThrow(/fingerprint is invalid/u)
  })

  it('returns cited unavailable snapshot results without fabricating evidence', async () => {
    const { evidence } = await evidencePacket()
    const missingDigest = '0'.repeat(64)
    const unavailable = executeVerificationTool(
      'inspect_quality_snapshot',
      {
        campaign_id: evidence.campaign.campaignId,
        snapshot_sha256: missingDigest,
      },
      evidence,
    )

    expect(unavailable.status).toBe('unavailable')
    expect(factValues(unavailable)).toEqual({ snapshot_available: false })
    expect(unavailable.records[0]).toMatchObject({
      id: missingDigest,
      status: 'unavailable',
    })
    expect(new Set(unavailable.artifactCitations.map(({ artifactKind }) => artifactKind)))
      .toEqual(new Set(VERIFICATION_ARTIFACT_KINDS))
  })

  it('is deterministic, performs no external writes, and does not mutate inputs', async () => {
    const packet = await packetInput()
    expect(Object.isFrozen(packet.input.campaign)).toBe(false)
    const before = JSON.stringify(packet.input)
    const evidence = await createVerificationToolEvidence(packet.input)
    expect(JSON.stringify(packet.input)).toBe(before)
    expect(Object.isFrozen(packet.input.campaign)).toBe(false)

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const nowSpy = vi.spyOn(Date, 'now')
    const randomSpy = vi.spyOn(Math, 'random')
    const first = executeAllTools(evidence)
    const second = executeAllTools(evidence)

    expect(second).toEqual(first)
    expect(JSON.stringify(packet.input)).toBe(before)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    nowSpy.mockRestore()
    randomSpy.mockRestore()
  })
})

interface EvidencePacket {
  readonly evidence: VerificationToolEvidence
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events: readonly VerificationEvent[]
  readonly beforeSnapshot: VerificationQualitySnapshot
  readonly afterSnapshot: VerificationQualitySnapshot
}

interface PacketInput {
  readonly input: Parameters<typeof createVerificationToolEvidence>[0]
}

async function evidencePacket(): Promise<EvidencePacket> {
  const packet = await packetInput()
  return {
    evidence: await createVerificationToolEvidence(packet.input),
    campaign: packet.input.campaign,
    items: packet.input.items,
    events: packet.input.events,
    beforeSnapshot: packet.input.qualitySnapshots[0]!,
    afterSnapshot: packet.input.qualitySnapshots[1]!,
  }
}

async function packetInput(): Promise<PacketInput> {
  const campaign = campaignFixture()
  const items = itemFixtures(campaign)
  const beforeEvents = [
    event(campaign, items[1]!, {
      eventId: 'event-before-item-2-a',
      reviewerId: 'reviewer-a',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:00:00.000Z',
    }),
    event(campaign, items[1]!, {
      eventId: 'event-before-item-2-b',
      reviewerId: 'reviewer-b',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:01:00.000Z',
    }),
  ]
  const events = [
    event(campaign, items[0]!, {
      eventId: 'event-after-item-1-a',
      reviewerId: 'reviewer-a',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:10:00.000Z',
    }),
    event(campaign, items[0]!, {
      eventId: 'event-after-item-1-b',
      reviewerId: 'reviewer-b',
      outcome: 'no',
      reviewedAt: '2026-07-16T19:11:00.000Z',
    }),
    ...beforeEvents,
  ]
  const consensus = projectVerificationConsensus(campaign, items, events)
  const inspections = inspectionFixtures(items)
  const beforeSnapshot = await qualitySnapshot(
    campaign,
    items,
    beforeEvents,
    inspections,
    '2026-07-16T19:05:00.000Z',
    'a',
  )
  const afterSnapshot = await qualitySnapshot(
    campaign,
    items,
    events,
    inspections,
    '2026-07-16T19:20:00.000Z',
    'b',
  )
  return {
    input: {
      evidenceId: 'verification-agent-evidence-v1',
      campaign,
      items,
      events,
      consensus,
      inspections,
      qualitySnapshots: [beforeSnapshot, afterSnapshot],
      artifactCitations: artifactCitations(
        campaign,
        beforeSnapshot,
        afterSnapshot,
      ),
    },
  }
}

function campaignFixture(): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: 'verification-agent-quality-campaign-v1',
    title: 'Verification analyst quality campaign',
    kind: 'quality_control',
    status: 'active',
    sourceProviders: ['wikimedia_commons'],
    reviewRequirement: {
      requiredIndependentReviewers: 2,
      secondReviewPolicy: 'on_conflict_or_uncertain',
      adjudicationRequiredOnConflict: true,
      decisiveOutcomes: ['yes', 'no'],
      mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
      nonScientificOutcomes: ['cant_view', 'skipped'],
    },
    samplingPlan: {
      planId: 'verification-agent-simple-random-v1',
      purpose: 'quality_estimation',
      design: 'simple_random',
      representative: true,
      blindReview: true,
      selectionSeed: 'verification-agent-seed-v1',
      targetSampleSize: 3,
      inclusionProbabilityRequired: true,
      independentUnit: 'media',
      groupingKeys: [],
      leakagePolicy: 'final_test_only',
      strata: [
        {
          stratumId: 'adult',
          label: 'Adult',
          populationCount: 2,
          targetSampleCount: 2,
          populationWeight: 2 / 3,
          selectionNotes: null,
        },
        {
          stratumId: 'larva',
          label: 'Larva',
          populationCount: 1,
          targetSampleCount: 1,
          populationWeight: 1 / 3,
          selectionNotes: null,
        },
      ],
      qualityEstimationAllowed: true,
      qualityEstimationBlockedReason: null,
    },
    disclosurePolicy: {
      mode: 'blind',
      revealAfterDecision: true,
      hiddenBeforeDecision: ['model_scores'],
    },
    manifestSha256: '1'.repeat(64),
    taxalensSha: TAXALENS_SHA,
    biominerSha: BIOMINER_SHA,
    publicReplay: false,
    scientificClaimAllowed: false,
  }
}

function itemFixtures(
  campaign: VerificationCampaign,
): readonly VerificationItem[] {
  if (HUMAN_REVIEW_ITEMS.length !== 3) {
    throw new Error('Verification tool tests require the three-item fixture.')
  }
  return HUMAN_REVIEW_ITEMS.map((item, index) => ({
    ...item,
    campaignId: campaign.campaignId,
    targetTaxon: campaign.targetTaxon!,
    samplingStratumId: index === 2 ? 'larva' : 'adult',
    inclusionProbability: 1,
    questionFingerprint: campaign.questionFingerprint,
  }))
}

function event(
  campaign: VerificationCampaign,
  item: VerificationItem,
  values: {
    readonly eventId: string
    readonly reviewerId: string
    readonly outcome: 'yes' | 'no'
    readonly reviewedAt: string
  },
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: values.eventId,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    reviewerId: values.reviewerId,
    reviewRound: 1,
    outcome: values.outcome,
    comment: null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: 'high',
    reviewedAt: values.reviewedAt,
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}

function inspectionFixtures(
  items: readonly VerificationItem[],
): Readonly<Record<string, HumanReviewInspection>> {
  return Object.fromEntries(
    items.slice(0, 2).map((item) => [
      item.itemId,
      {
        itemId: item.itemId,
        imageOpened: true,
        imageVerified: true,
        imageOpenedAt: '2026-07-16T19:00:00.000Z',
        imageFailureReason: null,
      },
    ]),
  )
}

async function qualitySnapshot(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
  inspections: Readonly<Record<string, HumanReviewInspection>>,
  capturedAt: string,
  digestSeed: string,
): Promise<VerificationQualitySnapshot> {
  const consensus = projectVerificationConsensus(campaign, items, events)
  const coverage = calculateVerificationCoverage(
    items,
    consensus,
    inspections,
  )
  const precision = estimateSimpleRandomTargetPrecision(
    campaign,
    items,
    consensus,
  )
  const input: VerificationQualitySnapshotInput = {
    capturedAt,
    campaign,
    coverage,
    precisionEstimate: precision,
    precisionInterval: null,
    strata: campaign.samplingPlan.strata.map((stratum, index) => {
      const decisiveSampleCount =
        index === 0 ? precision.decisiveSampleCount : 0
      return {
        stratumId: stratum.stratumId,
        label: stratum.label,
        decisiveSampleCount,
        populationWeight: stratum.populationWeight,
        estimate:
          precision.availability === 'available' &&
          decisiveSampleCount > 0
            ? precision.estimate
            : null,
      }
    }),
    reviewerAgreement: calculateReviewerPercentAgreement(consensus),
    reviewerNominalAlpha: calculateReviewerNominalAlpha(consensus),
    unresolvedConflictItems: consensus.filter(
      ({ status }) => status === 'unresolved_disagreement',
    ).length,
    adjudicatedItems: consensus.filter(
      ({ status }) => status === 'adjudicated',
    ).length,
    referenceReadiness: {
      status: 'not_ready',
      fingerprintSha256: digestSeed.repeat(64),
      blockers: ['independent_taxonomic_verification_missing'],
    },
    reviewedLabelLeakage: {
      status: 'passed',
      fingerprintSha256: incrementHexSeed(digestSeed).repeat(64),
      blockers: [],
    },
    referenceBank: referenceBankQuality(),
    releasePolicy: {
      schemaVersion: VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
      policyId: 'verification-agent-release-policy-v1',
      minimumDecisiveSample: 1,
      requiredStrata: ['adult'],
      minimumReviewerAgreement: 0,
      maximumConflictRate: 0.1,
      requireReferenceReadiness: true,
      minimumPrecisionLowerBound: 0,
      requireReviewedLabelLeakageGate: true,
    },
    milestonePlan: {
      schemaVersion: VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
      milestonePlanId: 'verification-agent-milestones-v1',
      milestones: [1, 2, 3],
    },
    evaluatedMilestones: [],
    decisionLedgerSha256: incrementHexSeed(
      incrementHexSeed(digestSeed),
    ).repeat(64),
    reviewedLabelsSha256: incrementHexSeed(
      incrementHexSeed(incrementHexSeed(digestSeed)),
    ).repeat(64),
  }
  expect(precision.schemaVersion).toBe(
    TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
  )
  expect(coverage.schemaVersion).toBe(VERIFICATION_COVERAGE_SCHEMA_VERSION)
  expect(input.reviewerAgreement.schemaVersion).toBe(
    REVIEWER_RELIABILITY_SCHEMA_VERSION,
  )
  return createVerificationQualitySnapshot(input)
}

function referenceBankQuality() {
  return {
    prototypeRoleAttestations: {
      status: 'verified_complete' as const,
      providerSupportedRecordCount: 81,
      attestedRecordCount: 81,
      suitableRecordCount: 81,
      independentHumanTaxonomicVerificationClaimed: false,
    },
    taxonomicIdentityReviews: {
      reviewedRecordCount: 0,
      independentlyVerifiedRecordCount: 0,
    },
    prototypeSupportCount: 81,
    verifiedSupportCount: 0,
    excludedSupportCount: 0,
    conflicts: {
      availability: 'unavailable' as const,
      conflictCount: null,
      unavailableReason:
        'No independently reviewed reference conflict ledger is attached.',
    },
    providerDistribution: {
      availability: 'unavailable' as const,
      entries: [],
      unavailableReason:
        'The role-suitability artifact does not publish provider counts.',
    },
    routeDistribution: {
      availability: 'available' as const,
      entries: [
        { key: 'adult_field', label: 'Adult field', count: 80 },
        { key: 'larval', label: 'Larval', count: 1 },
      ],
      unavailableReason: null,
    },
    readiness: {
      status: 'not_ready' as const,
      blockers: [
        'independent_taxonomic_verification_missing',
        'reference_support_shortfall',
      ],
    },
    sourceSnapshotSha256: BIOMINER_ROLE_ARTIFACT_SHA,
  }
}

function artifactCitations(
  campaign: VerificationCampaign,
  beforeSnapshot: VerificationQualitySnapshot,
  afterSnapshot: VerificationQualitySnapshot,
): readonly VerificationArtifactCitation[] {
  const taxalensCitation = (
    artifactKind: VerificationArtifactCitation['artifactKind'],
    artifactId: string,
    sha256: string,
    sourcePath: string,
  ): VerificationArtifactCitation => ({
    schemaVersion: VERIFICATION_ARTIFACT_CITATION_VERSION,
    artifactKind,
    artifactId,
    sha256,
    sourceRepository: 'karikris/taxalens',
    sourceCommit: TAXALENS_SHA,
    sourcePath,
  })
  return [
    taxalensCitation(
      'campaign_manifest',
      'verification-campaign-manifest',
      campaign.manifestSha256,
      'demo/source/verification/verification-agent.campaign.json',
    ),
    taxalensCitation(
      'item_manifest',
      'verification-item-manifest',
      '2'.repeat(64),
      'demo/source/verification/verification-agent.items.json',
    ),
    taxalensCitation(
      'event_ledger',
      'verification-event-ledger',
      '3'.repeat(64),
      'demo/source/verification/verification-agent.events.jsonl',
    ),
    taxalensCitation(
      'consensus',
      'verification-consensus',
      '4'.repeat(64),
      'demo/source/verification/verification-agent.consensus.json',
    ),
    taxalensCitation(
      'quality_snapshot',
      'verification-quality-before',
      beforeSnapshot.snapshotSha256,
      'demo/source/verification/verification-agent.quality.before.json',
    ),
    taxalensCitation(
      'quality_snapshot',
      'verification-quality-after',
      afterSnapshot.snapshotSha256,
      'demo/source/verification/verification-agent.quality.after.json',
    ),
    {
      schemaVersion: VERIFICATION_ARTIFACT_CITATION_VERSION,
      artifactKind: 'biominer_source',
      artifactId: 'provider-support-goal-verification',
      sha256: BIOMINER_ROLE_ARTIFACT_SHA,
      sourceRepository: 'karikris/BioMiner',
      sourceCommit: BIOMINER_SHA,
      sourcePath:
        'examples/species/papilio_demoleus/pilot_provider_support_goal_verification.json',
    },
  ]
}

function executeAllTools(
  evidence: VerificationToolEvidence,
): readonly VerificationToolResult[] {
  const snapshots = evidence.qualitySnapshots
  const before = snapshots[0]!
  const after = snapshots[1]!
  const calls: Readonly<
    Record<VerificationToolName, Readonly<Record<string, unknown>>>
  > = {
    inspect_verification_campaign: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_review_coverage: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_quality_snapshot: {
      campaign_id: evidence.campaign.campaignId,
      snapshot_sha256: after.snapshotSha256,
    },
    inspect_review_conflicts: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_reference_readiness: {
      campaign_id: evidence.campaign.campaignId,
      snapshot_sha256: after.snapshotSha256,
    },
    inspect_sampling_plan: {
      campaign_id: evidence.campaign.campaignId,
    },
    recommend_next_review_batch: {
      campaign_id: evidence.campaign.campaignId,
      batch_size: 2,
    },
    explain_quality_change: {
      campaign_id: evidence.campaign.campaignId,
      before_snapshot_sha256: before.snapshotSha256,
      after_snapshot_sha256: after.snapshotSha256,
    },
  }
  return VERIFICATION_TOOL_NAMES.map((name) =>
    executeVerificationTool(name, calls[name], evidence),
  )
}

function factValues(
  result: VerificationToolResult,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(result.facts.map(({ id, value }) => [id, value]))
}

function incrementHexSeed(value: string): string {
  return ((Number.parseInt(value, 16) + 1) % 16).toString(16)
}
