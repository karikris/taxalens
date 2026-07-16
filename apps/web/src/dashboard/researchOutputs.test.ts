import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { prepareResearchOutputs } from './researchOutputs'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('prepareResearchOutputs', () => {
  it('prepares six deterministic local research outputs in a stable order', async () => {
    const first = await prepareResearchOutputs(replay)
    const second = await prepareResearchOutputs(replay)

    expect(first.files.map(({ role }) => role)).toEqual([
      'review_queue',
      'evidence_summary',
      'prototype_boundary',
      'manifest',
      'provenance',
      'evaluation_report',
    ])
    expect(first.manifestSignatureStatus).toBe('unavailable')
    expect(first.scientificClaimAllowed).toBe(false)
    expect(second.files.map(({ filename, sha256 }) => ({ filename, sha256 }))).toEqual(
      first.files.map(({ filename, sha256 }) => ({ filename, sha256 })),
    )
    expect(first.files.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256))).toBe(true)
  })

  it('exports an explicitly unranked review snapshot, prototype boundary, and blocked evaluation report', async () => {
    const files = await decodedOutputs(replay)
    const review = files.review_queue as {
      queueMaterialized: boolean
      comparativeRankingAvailable: boolean
      itemCount: number
      item: { priorityScore: null; state: string }
    }
    const evaluation = files.evaluation_report as {
      committedReviewedMetricCount: number
      phase14: { status: string; humanVerifiedShortfall: number }
      metrics: readonly { status: string; value: string }[]
      scientificClaimAllowed: boolean
    }
    const prototype = files.prototype_boundary as {
      prototype: {
        releaseGate: {
          decision: string
          requestedMode: string
          scientificReleaseAuthorized: boolean
        }
        semantics: {
          classificationAccuracy: null
          calibrationError: null
        }
      }
      interpretation: string
      scientificClaimAllowed: boolean
    }

    expect(review).toMatchObject({
      queueMaterialized: false,
      comparativeRankingAvailable: false,
      itemCount: 1,
      item: { priorityScore: null, state: 'awaiting_human_review' },
    })
    expect(evaluation.committedReviewedMetricCount).toBe(0)
    expect(evaluation.phase14).toMatchObject({ status: 'blocked', humanVerifiedShortfall: 490 })
    expect(evaluation.metrics).toHaveLength(7)
    expect(evaluation.metrics.every(({ status, value }) => status === 'unavailable' && value === 'Unavailable')).toBe(true)
    expect(evaluation.scientificClaimAllowed).toBe(false)
    expect(prototype.prototype.releaseGate).toMatchObject({
      decision: 'GO_PROTOTYPE_ONLY',
      requestedMode: 'explicit_prototype',
      scientificReleaseAuthorized: false,
    })
    expect(prototype.prototype.semantics).toEqual(expect.objectContaining({
      classificationAccuracy: null,
      calibrationError: null,
    }))
    expect(prototype.interpretation).toContain('not a per-record classification')
    expect(prototype.scientificClaimAllowed).toBe(false)
  })

  it('manifests five payloads and exports all verified artifact provenance without a timestamp', async () => {
    const files = await decodedOutputs(replay)
    const manifest = files.manifest as {
      files: readonly { role: string; sha256: string }[]
      signature: { status: string; signer: null; value: null }
      verification: { manifestSelfDigestIncluded: boolean; payloadFileCount: number }
    }
    const provenance = files.provenance as {
      exportTimestamp: null
      artifacts: readonly unknown[]
      generation: { networkRequestsRequired: number; scientificClaimsAdded: boolean }
    }
    const summary = files.evidence_summary as {
      bundleVerification: { artifactCount: number; verifiedArtifactCount: number }
      evidenceFunnel: { stages: readonly unknown[] }
      scientificClaimAllowed: boolean
    }

    expect(manifest.files).toHaveLength(5)
    expect(manifest.files.map(({ role }) => role)).not.toContain('manifest')
    expect(manifest.signature).toEqual({
      status: 'unavailable',
      algorithm: null,
      signer: null,
      value: null,
      reason: 'No signing key is committed in the verified replay boundary.',
    })
    expect(manifest.verification).toMatchObject({
      manifestSelfDigestIncluded: false,
      payloadFileCount: 5,
    })
    expect(provenance.exportTimestamp).toBeNull()
    expect(provenance.artifacts).toHaveLength(25)
    expect(provenance.generation).toEqual(expect.objectContaining({
      networkRequestsRequired: 0,
      scientificClaimsAdded: false,
    }))
    expect(summary.bundleVerification).toEqual(expect.objectContaining({
      artifactCount: 25,
      verifiedArtifactCount: 25,
    }))
    expect(summary.evidenceFunnel.stages).toHaveLength(7)
    expect(summary.scientificClaimAllowed).toBe(false)
  })
})

async function decodedOutputs(replayEvidence: ReplayEvidence): Promise<Record<string, unknown>> {
  const bundle = await prepareResearchOutputs(replayEvidence)
  const decoder = new TextDecoder()
  return Object.fromEntries(
    bundle.files.map((file) => [file.role, JSON.parse(decoder.decode(file.bytes)) as unknown]),
  )
}
