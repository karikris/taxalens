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
  VERIFICATION_ARTIFACT_CITATION_VERSION,
  type VerificationArtifactCitation,
  type VerificationToolEvidence,
} from './verificationTools'

export const VERIFICATION_AGENT_FIXTURE_TAXALENS_SHA =
  'bd2cb30a51a1f2e21b08e05060eccc24f238a905' as const
export const VERIFICATION_AGENT_FIXTURE_BIOMINER_SHA =
  '94fa1f634ee3c63917c05d78181dd3cf9ceff940' as const
export const VERIFICATION_AGENT_FIXTURE_BIOMINER_ROLE_SHA =
  'fc96f8ecce5353629d601235aa43221df3e844ebdfa85e1efa49fe10dd52059c' as const

export interface VerificationAgentEvidenceFixture {
  readonly evidence: VerificationToolEvidence
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events: readonly VerificationEvent[]
  readonly beforeSnapshot: VerificationQualitySnapshot
  readonly afterSnapshot: VerificationQualitySnapshot
}

let fixturePromise: Promise<VerificationAgentEvidenceFixture> | undefined

export function createVerificationAgentEvidenceFixture(): Promise<VerificationAgentEvidenceFixture> {
  fixturePromise ??= buildFixture()
  return fixturePromise
}

async function buildFixture(): Promise<VerificationAgentEvidenceFixture> {
  const campaign = campaignFixture()
  const items = itemFixtures(campaign)
  const beforeEvents = [
    reviewEvent(campaign, items[1]!, {
      eventId: 'event-before-item-2-a',
      reviewerId: 'reviewer-a',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:00:00.000Z',
    }),
    reviewEvent(campaign, items[1]!, {
      eventId: 'event-before-item-2-b',
      reviewerId: 'reviewer-b',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:01:00.000Z',
    }),
  ]
  const events = [
    reviewEvent(campaign, items[0]!, {
      eventId: 'event-after-item-1-a',
      reviewerId: 'reviewer-a',
      outcome: 'yes',
      reviewedAt: '2026-07-16T19:10:00.000Z',
    }),
    reviewEvent(campaign, items[0]!, {
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
  const evidence = await createVerificationToolEvidence({
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
  })
  return Object.freeze({
    evidence,
    campaign,
    items: Object.freeze([...items]),
    events: Object.freeze([...events]),
    beforeSnapshot,
    afterSnapshot,
  })
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
    taxalensSha: VERIFICATION_AGENT_FIXTURE_TAXALENS_SHA,
    biominerSha: VERIFICATION_AGENT_FIXTURE_BIOMINER_SHA,
    publicReplay: false,
    scientificClaimAllowed: false,
  }
}

function itemFixtures(
  campaign: VerificationCampaign,
): readonly VerificationItem[] {
  if (HUMAN_REVIEW_ITEMS.length !== 3) {
    throw new Error('Verification agent fixture requires three review items')
  }
  return HUMAN_REVIEW_ITEMS.map((item, index) => {
    const { imageUrl, verificationLabel, ...domainItem } = item
    if (imageUrl.length === 0 || verificationLabel.length === 0) {
      throw new Error('Verification agent fixture UI metadata is incomplete')
    }
    return {
      ...domainItem,
      campaignId: campaign.campaignId,
      targetTaxon: campaign.targetTaxon!,
      samplingStratumId: index === 2 ? 'larva' : 'adult',
      inclusionProbability: 1,
      questionFingerprint: campaign.questionFingerprint,
    }
  })
}

function reviewEvent(
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
  if (
    precision.schemaVersion !== TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION ||
    coverage.schemaVersion !== VERIFICATION_COVERAGE_SCHEMA_VERSION
  ) {
    throw new Error('Verification fixture estimator versions changed')
  }
  const reviewerAgreement = calculateReviewerPercentAgreement(consensus)
  if (
    reviewerAgreement.schemaVersion !==
    REVIEWER_RELIABILITY_SCHEMA_VERSION
  ) {
    throw new Error('Verification fixture reliability version changed')
  }
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
    reviewerAgreement,
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
    sourceSnapshotSha256:
      VERIFICATION_AGENT_FIXTURE_BIOMINER_ROLE_SHA,
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
  ): VerificationArtifactCitation => ({
    schemaVersion: VERIFICATION_ARTIFACT_CITATION_VERSION,
    artifactKind,
    artifactId,
    sha256,
    sourceRepository: 'karikris/taxalens',
    sourceCommit: VERIFICATION_AGENT_FIXTURE_TAXALENS_SHA,
    sourcePath: 'apps/web/src/test/verificationAgentEvidence.ts',
  })
  return [
    taxalensCitation(
      'campaign_manifest',
      'verification-campaign-manifest',
      campaign.manifestSha256,
    ),
    taxalensCitation(
      'item_manifest',
      'verification-item-manifest',
      '2'.repeat(64),
    ),
    taxalensCitation(
      'event_ledger',
      'verification-event-ledger',
      '3'.repeat(64),
    ),
    taxalensCitation(
      'consensus',
      'verification-consensus',
      '4'.repeat(64),
    ),
    taxalensCitation(
      'quality_snapshot',
      'verification-quality-before',
      beforeSnapshot.snapshotSha256,
    ),
    taxalensCitation(
      'quality_snapshot',
      'verification-quality-after',
      afterSnapshot.snapshotSha256,
    ),
    {
      schemaVersion: VERIFICATION_ARTIFACT_CITATION_VERSION,
      artifactKind: 'biominer_source',
      artifactId: 'provider-support-goal-verification',
      sha256: VERIFICATION_AGENT_FIXTURE_BIOMINER_ROLE_SHA,
      sourceRepository: 'karikris/BioMiner',
      sourceCommit: VERIFICATION_AGENT_FIXTURE_BIOMINER_SHA,
      sourcePath:
        'examples/species/papilio_demoleus/pilot_provider_support_goal_verification.json',
    },
  ]
}

function incrementHexSeed(value: string): string {
  return ((Number.parseInt(value, 16) + 1) % 16).toString(16)
}
