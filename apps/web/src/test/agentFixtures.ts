import type { ReplayEvidence } from '../data/evidenceFacade'
import {
  RESEARCH_ANALYST_MODEL,
  RESEARCH_ANALYST_OUTPUT_VERSION,
  RESEARCH_ANALYST_RUN_VERSION,
  type ResearchAnalystRun,
} from '../agent/researchAnalystContract'
import { RESEARCH_TOOL_RESULT_VERSION } from '../agent/researchTools'

export function createAnalystRunFixture(replay: ReplayEvidence): ResearchAnalystRun {
  const artifactIds = ['query-definitions']
  const toolResult = {
    schemaVersion: RESEARCH_TOOL_RESULT_VERSION,
    tool: 'resolve_taxon' as const,
    status: 'available' as const,
    bundleId: replay.bundleId,
    summary: `${replay.target.scientificName} resolves to ${replay.target.acceptedTaxonKey}.`,
    facts: [
      {
        id: 'accepted_taxon_key',
        label: 'Accepted taxon key',
        value: replay.target.acceptedTaxonKey,
        status: 'verified' as const,
      },
    ],
    records: [],
    artifactIds,
    limitations: ['Resolution is limited to the committed replay target.'],
    scientificClaimAllowed: false as const,
  }
  const output = {
    schemaVersion: RESEARCH_ANALYST_OUTPUT_VERSION,
    requestKind: 'evidence_explanation' as const,
    target: {
      acceptedTaxonKey: replay.target.acceptedTaxonKey,
      scientificName: replay.target.scientificName,
      resolutionStatus: 'verified_replay_target' as const,
    },
    plan: [
      {
        sequence: 1,
        action: 'Resolve the checksum-verified replay target.',
        tool: 'resolve_taxon' as const,
        status: 'complete' as const,
        approvalRequired: false,
        artifactIds,
      },
    ],
    evidenceBackedClaims: [
      {
        id: 'resolved-target',
        claim: `${replay.target.scientificName} is the verified replay target.`,
        claimType: 'provenance_fact' as const,
        artifactIds,
      },
    ],
    unavailableEvidence: [],
    approvalBoundary: {
      liveWorkApproved: false as const,
      externalActionsExecuted: false as const,
      approvalRequired: false,
      items: [],
    },
    answer: `${replay.target.scientificName} is the target declared by the verified replay.`,
    limitations: ['This trace establishes replay identity, not a biological occurrence.'],
    artifactIds,
    unsupportedClaimsRejected: true as const,
    scientificClaimAllowed: false as const,
  }
  return {
    schemaVersion: RESEARCH_ANALYST_RUN_VERSION,
    model: RESEARCH_ANALYST_MODEL,
    reasoningEffort: 'medium',
    responseStatus: 'completed',
    output,
    budget: {
      maxToolCalls: 4,
      usedToolCalls: 1,
      maxResponseTurns: 3,
      usedResponseTurns: 2,
      exhausted: false,
    },
    toolReceipts: [
      {
        sequence: 1,
        callId: 'call-resolve-target',
        tool: 'resolve_taxon',
        arguments: { query: replay.target.scientificName },
        resultStatus: 'available',
        artifactIds,
      },
    ],
    toolResults: [toolResult],
    responseIds: ['resp-resolve-target', 'resp-final-answer'],
  }
}
