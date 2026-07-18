import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { projectVerificationConsensus, type VerificationEvent } from './domain'
import { HUMAN_REVIEW_CAMPAIGN, HUMAN_REVIEW_ITEMS } from './reviewPacket'
import {
  SupabaseReviewRepository,
  SupabaseReviewRepositoryError,
} from './repositories/supabaseReviewRepository'
import {
  SUPABASE_VERIFICATION_ITEM_PAYLOAD_SCHEMA_VERSION,
  verificationEventToSupabaseInsert,
} from './repositories/supabaseReviewRows'

describe('Supabase review repository', () => {
  it('loads validated rows and persists a domain event through the publishable client', async () => {
    const firstEvent = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-first',
      '2026-07-16T19:45:00.000Z',
    )
    const secondEvent = eventForItem(
      HUMAN_REVIEW_ITEMS[1]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-second',
      '2026-07-16T19:46:00.000Z',
    )
    const server = fakeSupabaseServer([firstEvent])
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(
      repository.loadCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual(HUMAN_REVIEW_CAMPAIGN)
    await expect(
      repository.loadItems(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual(HUMAN_REVIEW_ITEMS)
    await expect(
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([firstEvent])

    await repository.appendEvent(secondEvent)

    expect(server.insertedEvents).toEqual([
      verificationEventToSupabaseInsert(secondEvent),
    ])
    await expect(
      repository.loadCurrentDecisions(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toMatchObject({
      [firstEvent.itemId]: { eventId: firstEvent.eventId },
      [secondEvent.itemId]: { eventId: secondEvent.eventId },
    })
    await expect(
      repository.loadConsensus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual(
      projectVerificationConsensus(HUMAN_REVIEW_CAMPAIGN, HUMAN_REVIEW_ITEMS, [
        firstEvent,
        secondEvent,
      ]),
    )
    expect(server.fetch).toHaveBeenCalled()
  })

  it('fails closed when an indexed column differs from its versioned item payload', async () => {
    const server = fakeSupabaseServer([])
    const firstItemRow = server.itemRows[0]
    if (firstItemRow === undefined) {
      throw new Error('The Commons fixture requires a first item row.')
    }
    server.itemRows[0] = {
      ...firstItemRow,
      image_sha256: 'f'.repeat(64),
    }
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(
      repository.loadItems(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).rejects.toMatchObject({
      name: 'SupabaseReviewRepositoryError',
      code: 'invalid_remote_data',
    } satisfies Partial<SupabaseReviewRepositoryError>)
  })

  it('loads a persisted consensus projection with exact source-event lineage', async () => {
    const event = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-consensus',
      '2026-07-16T19:48:00.000Z',
    )
    const consensus = projectVerificationConsensus(
      HUMAN_REVIEW_CAMPAIGN,
      HUMAN_REVIEW_ITEMS,
      [event],
    ).find(({ itemId }) => itemId === event.itemId)
    if (consensus === undefined) {
      throw new Error(
        'The Commons fixture requires consensus for its first item.',
      )
    }
    const server = fakeSupabaseServer([event])
    server.consensusRows.push(consensusRow(consensus))
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(
      repository.loadConsensus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([consensus])
  })

  it('does not treat the server adapter clear operation as cloud deletion', async () => {
    const server = fakeSupabaseServer([])
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await repository.clearLocalCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId)

    expect(server.fetch).not.toHaveBeenCalled()
  })

  it('treats an already persisted identical event ID as an idempotent retry', async () => {
    const event = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-retry',
      '2026-07-16T19:49:00.000Z',
    )
    const server = fakeSupabaseServer([event])
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(repository.appendEvent(event)).resolves.toBeUndefined()

    expect(server.insertedEvents).toEqual([])
  })

  it('rejects an event ID already bound to a different payload', async () => {
    const event = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-conflict',
      '2026-07-16T19:50:00.000Z',
    )
    const conflictingEvent = Object.freeze({
      ...event,
      comment: 'A different persisted payload.',
    })
    const server = fakeSupabaseServer([conflictingEvent])
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(repository.appendEvent(event)).rejects.toMatchObject({
      name: 'SupabaseReviewRepositoryError',
      code: 'event_id_conflict',
      postgrestCode: null,
    } satisfies Partial<SupabaseReviewRepositoryError>)
    expect(server.insertedEvents).toEqual([])
  })

  it('resolves a concurrent identical insert after PostgreSQL reports 23505', async () => {
    const event = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-race-retry',
      '2026-07-16T19:51:00.000Z',
    )
    const server = fakeSupabaseServer([], {
      duplicateOnNextInsert: event,
    })
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(repository.appendEvent(event)).resolves.toBeUndefined()

    expect(server.insertedEvents).toEqual([])
    expect(server.eventRows).toEqual([eventRow(event)])
  })

  it('rejects a concurrent event-ID collision with a different payload', async () => {
    const event = eventForItem(
      HUMAN_REVIEW_ITEMS[0]!,
      '00000000-0000-4000-8000-000000000001',
      'event-supabase-race-conflict',
      '2026-07-16T19:52:00.000Z',
    )
    const conflictingEvent = Object.freeze({
      ...event,
      comment: 'The concurrent writer used this payload.',
    })
    const server = fakeSupabaseServer([], {
      duplicateOnNextInsert: conflictingEvent,
    })
    const repository = new SupabaseReviewRepository({
      client: supabaseClient(server.fetch),
    })

    await expect(repository.appendEvent(event)).rejects.toMatchObject({
      name: 'SupabaseReviewRepositoryError',
      code: 'event_id_conflict',
      postgrestCode: null,
    } satisfies Partial<SupabaseReviewRepositoryError>)
    expect(server.insertedEvents).toEqual([])
  })
})

function supabaseClient(fetch: typeof globalThis.fetch) {
  return createClient(
    'https://taxalens-test.supabase.co',
    'sb_publishable_taxalens_test',
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { fetch },
    },
  )
}

function fakeSupabaseServer(
  initialEvents: readonly VerificationEvent[],
  {
    duplicateOnNextInsert = null,
  }: {
    readonly duplicateOnNextInsert?: VerificationEvent | null
  } = {},
) {
  const insertedEvents: ReturnType<typeof verificationEventToSupabaseInsert>[] =
    []
  const itemRows = HUMAN_REVIEW_ITEMS.map(itemRow)
  const eventRows = initialEvents.map(eventRow)
  const consensusRows: Record<string, unknown>[] = []
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    )
    const table = url.pathname.split('/').at(-1)
    const method = init?.method ?? 'GET'
    if (table === 'verification_events' && method === 'POST') {
      if (duplicateOnNextInsert !== null) {
        eventRows.push(eventRow(duplicateOnNextInsert))
        duplicateOnNextInsert = null
        return response(
          {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "verification_events_pkey"',
            details: null,
            hint: null,
          },
          409,
        )
      }
      const body = JSON.parse(String(init?.body))
      const insert = (Array.isArray(body) ? body[0] : body) as ReturnType<
        typeof verificationEventToSupabaseInsert
      >
      insertedEvents.push(insert)
      eventRows.push({
        ...insert,
        received_at: '2026-07-16T19:47:00.000Z',
      })
      return response(null, 201)
    }
    if (table === 'verification_campaigns') {
      return response(campaignRow())
    }
    if (table === 'verification_items') {
      return response(itemRows)
    }
    if (table === 'verification_events') {
      const eventIdFilter = url.searchParams.get('event_id')
      if (eventIdFilter?.startsWith('eq.')) {
        return response(
          eventRows.find(
            ({ event_id }) => event_id === eventIdFilter.slice('eq.'.length),
          ) ?? null,
        )
      }
      return response(eventRows)
    }
    if (table === 'verification_consensus') {
      return response(consensusRows)
    }
    return response(
      {
        code: 'PGRST205',
        message: `Unexpected test table: ${table}`,
        details: null,
        hint: null,
      },
      404,
    )
  })
  return {
    consensusRows,
    eventRows,
    fetch,
    insertedEvents,
    itemRows,
  }
}

function response(payload: unknown, status = 200): Response {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function campaignRow() {
  return {
    campaign_id: HUMAN_REVIEW_CAMPAIGN.campaignId,
    schema_version: HUMAN_REVIEW_CAMPAIGN.schemaVersion,
    title: HUMAN_REVIEW_CAMPAIGN.title,
    description: HUMAN_REVIEW_CAMPAIGN.description,
    kind: HUMAN_REVIEW_CAMPAIGN.kind,
    status: HUMAN_REVIEW_CAMPAIGN.status,
    target_taxon: HUMAN_REVIEW_CAMPAIGN.targetTaxon,
    source_providers: HUMAN_REVIEW_CAMPAIGN.sourceProviders,
    review_requirement: HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
    sampling_plan: HUMAN_REVIEW_CAMPAIGN.samplingPlan,
    disclosure_policy: HUMAN_REVIEW_CAMPAIGN.disclosurePolicy,
    question_sha256: HUMAN_REVIEW_CAMPAIGN.questionFingerprint,
    manifest_sha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalens_sha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominer_sha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    public_replay: HUMAN_REVIEW_CAMPAIGN.publicReplay,
    scientific_claim_allowed: HUMAN_REVIEW_CAMPAIGN.scientificClaimAllowed,
  }
}

function itemRow(item: (typeof HUMAN_REVIEW_ITEMS)[number]) {
  return {
    campaign_id: item.campaignId,
    item_id: item.itemId,
    schema_version: SUPABASE_VERIFICATION_ITEM_PAYLOAD_SCHEMA_VERSION,
    source_provider: item.source,
    source_observation_id: item.sourceObservationId,
    source_media_id: item.sourceMediaId,
    media_object_key: null,
    image_sha256: item.imageSha256,
    question_sha256: item.questionFingerprint,
    source_payload: {
      schemaVersion: SUPABASE_VERIFICATION_ITEM_PAYLOAD_SCHEMA_VERSION,
      item,
    },
    duplicate_group_id: item.duplicateGroupId,
    observation_group_id: item.observationGroupId,
    owner_photographer_group_id: item.ownerPhotographerGroupId,
    sampling_stratum_id: item.samplingStratumId,
    inclusion_probability: item.inclusionProbability,
    rights_payload: item.rights,
  }
}

function eventRow(event: VerificationEvent) {
  return {
    ...verificationEventToSupabaseInsert(event),
    received_at: event.reviewedAt,
  }
}

function consensusRow(
  consensus: ReturnType<typeof projectVerificationConsensus>[number],
) {
  return {
    campaign_id: consensus.campaignId,
    item_id: consensus.itemId,
    schema_version: consensus.schemaVersion,
    status: consensus.status,
    consensus_outcome: consensus.consensusOutcome,
    consensus_payload: consensus,
    source_event_ids: consensus.latestEvents.map(({ eventId }) => eventId),
    revision: 1,
    resolved_at: consensus.resolvedAt,
  }
}

function eventForItem(
  item: (typeof HUMAN_REVIEW_ITEMS)[number],
  reviewerId: string,
  eventId: string,
  reviewedAt: string,
): VerificationEvent {
  return Object.freeze({
    schemaVersion: 'taxalens-verification-event:v1.3.0',
    eventId,
    campaignId: item.campaignId,
    itemId: item.itemId,
    reviewerId,
    reviewRound: 1,
    outcome: 'yes',
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
    reviewedAt,
    durationMs: 500,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  })
}
