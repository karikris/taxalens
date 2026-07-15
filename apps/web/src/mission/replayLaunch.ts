import type { ReplayEvidence } from '../data/evidenceFacade'
import type { EvidencePlan } from './missionPlan'

export const REPLAY_LAUNCH_RECEIPT_VERSION = 'taxalens-replay-launch-receipt-v1.0.0' as const

export interface ReplayPlanReadyState {
  readonly status: 'plan_ready'
  readonly plan: EvidencePlan
  readonly planFingerprint: `sha256:${string}`
}

export interface ReplayLaunchReceipt {
  readonly receiptVersion: typeof REPLAY_LAUNCH_RECEIPT_VERSION
  readonly status: 'replay_launched'
  readonly mode: 'submitted_fixture_replay'
  readonly planVersion: EvidencePlan['planVersion']
  readonly planFingerprint: `sha256:${string}`
  readonly bundle: {
    readonly bundleId: string
    readonly schemaVersion: string
    readonly verifiedArtifactCount: number
    readonly artifactCount: number
    readonly inventoryChecksumVerified: true
    readonly payloadRootChecksumVerified: true
    readonly artifactChecksumsVerified: true
  }
  readonly sourceRegistry: EvidencePlan['sourceRegistry']
  readonly sourceRevisions: {
    readonly taxalensSha: string
    readonly biominerSha: string
  }
  readonly liveApproval: {
    readonly required: true
    readonly status: 'not_approved'
    readonly approvedPlanFingerprint: null
  }
  readonly capabilities: {
    readonly fixtureReplay: true
    readonly liveActions: false
    readonly remoteRequests: false
  }
}

export class ReplayLaunchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReplayLaunchError'
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ReplayLaunchError('Plan fingerprint input contains a non-finite number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new ReplayLaunchError('Plan fingerprint input is not JSON-compatible')
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

export async function fingerprintEvidencePlan(
  plan: EvidencePlan,
): Promise<`sha256:${string}`> {
  return `sha256:${await sha256Hex(canonicalJson(plan))}`
}

export async function prepareReplayPlan(plan: EvidencePlan): Promise<ReplayPlanReadyState> {
  return deepFreeze({
    status: 'plan_ready',
    plan,
    planFingerprint: await fingerprintEvidencePlan(plan),
  })
}

export function launchSubmittedReplay(
  ready: ReplayPlanReadyState,
  replay: ReplayEvidence,
): ReplayLaunchReceipt {
  if (ready.status !== 'plan_ready') {
    throw new ReplayLaunchError('Only a fingerprinted plan can launch the submitted replay')
  }
  if (
    ready.plan.execution.requestedMode !== 'replay' ||
    ready.plan.execution.launchesWork ||
    ready.plan.execution.usesOpenAI
  ) {
    throw new ReplayLaunchError('The plan requests an unsupported execution capability')
  }
  if (
    ready.plan.target.acceptedTaxonKey !== replay.target.acceptedTaxonKey ||
    ready.plan.target.scientificName !== replay.target.scientificName
  ) {
    throw new ReplayLaunchError('The plan target differs from the submitted replay')
  }
  if (
    ready.plan.sourceRegistry.version !== replay.mission.sourceRegistry.version ||
    ready.plan.sourceRegistry.sourceSnapshotVersion !==
      replay.mission.sourceRegistry.sourceSnapshotVersion
  ) {
    throw new ReplayLaunchError('The plan source registry differs from the submitted replay')
  }
  if (
    replay.verifiedArtifactCount !== replay.artifactCount ||
    !replay.verification.inventoryChecksumVerified ||
    !replay.verification.payloadRootChecksumVerified ||
    !replay.verification.artifactChecksumsVerified
  ) {
    throw new ReplayLaunchError('The submitted replay has not passed complete verification')
  }

  return deepFreeze<ReplayLaunchReceipt>({
    receiptVersion: REPLAY_LAUNCH_RECEIPT_VERSION,
    status: 'replay_launched',
    mode: 'submitted_fixture_replay',
    planVersion: ready.plan.planVersion,
    planFingerprint: ready.planFingerprint,
    bundle: {
      bundleId: replay.bundleId,
      schemaVersion: replay.schemaVersion,
      verifiedArtifactCount: replay.verifiedArtifactCount,
      artifactCount: replay.artifactCount,
      inventoryChecksumVerified: true,
      payloadRootChecksumVerified: true,
      artifactChecksumsVerified: true,
    },
    sourceRegistry: { ...ready.plan.sourceRegistry },
    sourceRevisions: { ...replay.sourceRevisions },
    liveApproval: {
      required: true,
      status: 'not_approved',
      approvedPlanFingerprint: null,
    },
    capabilities: {
      fixtureReplay: true,
      liveActions: false,
      remoteRequests: false,
    },
  })
}
