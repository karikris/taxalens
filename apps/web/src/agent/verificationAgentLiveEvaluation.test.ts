// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createVerificationAgentEvidenceFixture } from '../test/verificationAgentEvidence'
import { runVerificationAnalyst } from './verificationAnalyst'
import { createServerOpenAITransport } from './serverOpenAITransport'

const LIVE_EVALUATION_ALLOWED =
  process.env.TAXALENS_ALLOW_LIVE_OPENAI_EVAL === '1'
const describeLive = LIVE_EVALUATION_ALLOWED ? describe : describe.skip

describeLive('live GPT-5.6 verification analyst evaluation', () => {
  it('runs only with explicit permission and a server-owned credential', async () => {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? ''
    if (apiKey.length === 0) {
      throw new Error(
        'OPENAI_API_KEY is required when TAXALENS_ALLOW_LIVE_OPENAI_EVAL=1',
      )
    }
    const { evidence, afterSnapshot } =
      await createVerificationAgentEvidenceFixture()
    const run = await runVerificationAnalyst(
      {
        requestKind: 'next_review_action',
        request:
          'Which review action most directly addresses the recorded verification state, and why?',
        snapshotSha256: afterSnapshot.snapshotSha256,
        batchSize: 2,
        reasoningEffort: 'medium',
      },
      evidence,
      createServerOpenAITransport({ apiKey }),
    )

    expect(run.model).toBe('gpt-5.6-sol')
    expect(run.output.recommendation).toMatchObject({
      action: 'adjudication',
      basis: 'unresolved_review_conflict',
    })
    expect(run.output.externalActionsExecuted).toBe(false)
    expect(run.output.unsupportedClaimsRejected).toBe(true)
    expect(run.output.scientificClaimAllowed).toBe(false)
  }, 180_000)
})
