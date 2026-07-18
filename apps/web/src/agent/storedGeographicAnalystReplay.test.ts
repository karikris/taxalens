import { describe, expect, it } from 'vitest'

import storedReplay from './fixtures/geographicAnalystStoredReplay.json'
import { loadStoredGeographicAnalystReplay } from './storedGeographicAnalystReplay'

describe('stored geographic analyst replay', () => {
  it('loads a credential-free artifact-grounded GPT-5.6 replay', async () => {
    const replay = await loadStoredGeographicAnalystReplay()
    expect(replay).toMatchObject({ model: 'gpt-5.6-sol', reasoningEffort: 'xhigh', mode: 'stored_credential_free', externalActionsExecuted: false, scientificClaimAllowed: false })
    expect(replay.scope).toMatchObject({ scopeLevel: 'global', scopeId: 'global', scopeName: 'Global' })
    expect(replay.toolReceipts).toHaveLength(1)
    expect(replay.answer).toContain('Zero cells are human-supported additional cells')
  })

  it('rejects changed facts, prose, and fingerprints', async () => {
    const facts = structuredClone(storedReplay) as any
    facts.toolReceipts[0].facts.flickr_candidate_count = 13_417
    await expect(loadStoredGeographicAnalystReplay(facts)).rejects.toThrow('inspection facts differ')
    const prose = structuredClone(storedReplay) as any
    prose.answer = 'These are new Flickr records.'
    await expect(loadStoredGeographicAnalystReplay(prose)).rejects.toThrow('scientific terminology')
    const digest = structuredClone(storedReplay)
    digest.replaySha256 = 'f'.repeat(64)
    await expect(loadStoredGeographicAnalystReplay(digest)).rejects.toThrow('fingerprint differs')
  })
})
