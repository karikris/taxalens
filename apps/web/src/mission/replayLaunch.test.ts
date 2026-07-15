import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { createMissionDraft, generateEvidencePlan } from './missionPlan'
import {
  fingerprintEvidencePlan,
  launchSubmittedReplay,
  prepareReplayPlan,
  ReplayLaunchError,
  type ReplayPlanReadyState,
} from './replayLaunch'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('provenance-bound replay launch', () => {
  it('fingerprints identical plans identically and changes with plan content', async () => {
    const draft = createMissionDraft(replay)
    const plan = generateEvidencePlan(draft, replay)
    const clone = structuredClone(plan)
    const changed = generateEvidencePlan({ ...draft, maximumApiCalls: 315 }, replay)

    const fingerprint = await fingerprintEvidencePlan(plan)
    expect(fingerprint).toBe(
      'sha256:f983de321a83c728f3a75dd08c9ff0d4504b96422aaa96e16d30d22e5b518133',
    )
    expect(await fingerprintEvidencePlan(clone)).toBe(fingerprint)
    expect(await fingerprintEvidencePlan(changed)).not.toBe(fingerprint)
  })

  it('launches only the fully verified submitted fixture and emits a frozen receipt', async () => {
    const ready = await prepareReplayPlan(
      generateEvidencePlan(createMissionDraft(replay), replay),
    )
    const receipt = launchSubmittedReplay(ready, replay)

    expect(ready.status).toBe('plan_ready')
    expect(receipt).toMatchObject({
      receiptVersion: 'taxalens-replay-launch-receipt-v1.0.0',
      status: 'replay_launched',
      mode: 'submitted_fixture_replay',
      planFingerprint: ready.planFingerprint,
      bundle: {
        bundleId: 'papilio-demoleus-pilot-75461d9c-v1',
        verifiedArtifactCount: 24,
        artifactCount: 24,
      },
      sourceRegistry: {
        version: 'butterflies-v2-20260712',
        sourceSnapshotVersion: 'gbif-reference-search-20260715',
      },
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
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.bundle)).toBe(true)
  })

  it('rejects unsupported work capability and incomplete verification', async () => {
    const ready = await prepareReplayPlan(
      generateEvidencePlan(createMissionDraft(replay), replay),
    )
    const unsupported = {
      ...ready,
      plan: {
        ...ready.plan,
        execution: { ...ready.plan.execution, launchesWork: true },
      },
    } as unknown as ReplayPlanReadyState
    const unverified = {
      ...replay,
      verifiedArtifactCount: replay.artifactCount - 1,
      verification: { ...replay.verification, artifactChecksumsVerified: false },
    } as unknown as ReplayEvidence

    expect(() => launchSubmittedReplay(unsupported, replay)).toThrowError(
      new ReplayLaunchError('The plan requests an unsupported execution capability'),
    )
    expect(() => launchSubmittedReplay(ready, unverified)).toThrowError(
      new ReplayLaunchError('The submitted replay has not passed complete verification'),
    )
  })
})
