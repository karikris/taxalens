import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { canonicalExportJsonBytes } from '../../evidence/evidenceExport'
import {
  projectVerificationConsensus,
  type VerificationConsensus,
} from '../domain/verificationConsensus'
import {
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
} from '../domain/verificationEvents'
import { validateVerificationEventExtension } from '../domain/verificationAdjudication'
import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import {
  reviewRepositoryReceiptBytes,
  type ReviewCurrentDecisions,
  type ReviewRepository,
} from './reviewRepository'
import {
  verificationCampaignFromSupabaseRow,
  verificationConsensusFromSupabaseRow,
  verificationEventFromSupabaseRow,
  verificationEventToSupabaseInsert,
  verificationItemFromSupabaseRow,
} from './supabaseReviewRows'

export type SupabaseReviewRepositoryErrorCode =
  | 'query_failed'
  | 'write_failed'
  | 'invalid_remote_data'
  | 'event_id_conflict'

export class SupabaseReviewRepositoryError extends Error {
  readonly code: SupabaseReviewRepositoryErrorCode
  readonly operation: string
  readonly postgrestCode: string | null

  constructor({
    code,
    message,
    operation,
    postgrestCode = null,
    cause,
  }: {
    readonly code: SupabaseReviewRepositoryErrorCode
    readonly message: string
    readonly operation: string
    readonly postgrestCode?: string | null
    readonly cause?: unknown
  }) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'SupabaseReviewRepositoryError'
    this.code = code
    this.operation = operation
    this.postgrestCode = postgrestCode
  }
}

export interface SupabaseReviewRepositoryOptions {
  readonly client: SupabaseClient
}

export class SupabaseReviewRepository implements ReviewRepository {
  readonly #client: SupabaseClient

  constructor({ client }: SupabaseReviewRepositoryOptions) {
    this.#client = client
  }

  async loadCampaign(campaignId: string): Promise<VerificationCampaign | null> {
    const operation = `load campaign ${campaignId}`
    const { data, error } = await this.#client
      .from('verification_campaigns')
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle()
    throwQueryError(error, operation)
    if (data === null) {
      return null
    }
    const campaign = decodeRemote(operation, () =>
      verificationCampaignFromSupabaseRow(data),
    )
    if (campaign.campaignId !== campaignId) {
      throw invalidRemote(
        operation,
        `query returned campaign ${campaign.campaignId}`,
      )
    }
    return campaign
  }

  async loadItems(campaignId: string): Promise<readonly VerificationItem[]> {
    const campaign = await this.loadCampaign(campaignId)
    if (campaign === null) {
      return Object.freeze([])
    }
    return this.#loadItemsForCampaign(campaign)
  }

  async loadEvents(campaignId: string): Promise<readonly VerificationEvent[]> {
    const campaign = await this.loadCampaign(campaignId)
    if (campaign === null) {
      return Object.freeze([])
    }
    const items = await this.#loadItemsForCampaign(campaign)
    return this.#loadEventsForCampaign(campaign, items)
  }

  async appendEvent(event: VerificationEvent): Promise<void> {
    const campaign = await this.loadCampaign(event.campaignId)
    if (campaign === null) {
      throw invalidRemote(
        `append event ${event.eventId}`,
        `campaign is unavailable: ${event.campaignId}`,
      )
    }
    const items = await this.#loadItemsForCampaign(campaign)
    const events = await this.#loadEventsForCampaign(campaign, items)
    const existingEvent = events.find(
      ({ eventId }) => eventId === event.eventId,
    )
    if (existingEvent !== undefined) {
      assertSameEvent(existingEvent, event)
      return
    }
    const item = items.find(({ itemId }) => itemId === event.itemId)
    if (item === undefined) {
      throw invalidRemote(
        `append event ${event.eventId}`,
        `item is unavailable: ${event.itemId}`,
      )
    }
    const failures = [
      ...validateVerificationEvent(event, campaign, item),
      ...validateVerificationEventExtension(event, campaign, item, events),
      ...validateVerificationEventLedger([...events, event]),
    ]
    if (failures.length > 0) {
      throw invalidRemote(`append event ${event.eventId}`, failures.join('; '))
    }
    const operation = `append event ${event.eventId}`
    const { error } = await this.#client
      .from('verification_events')
      .insert(verificationEventToSupabaseInsert(event))
    if (error === null) {
      return
    }
    if (
      error.code === '23505' &&
      (await this.#resolveDuplicateEvent(event, campaign, items, events))
    ) {
      return
    }
    throw new SupabaseReviewRepositoryError({
      code: 'write_failed',
      operation,
      postgrestCode: error.code,
      message: `Supabase verification write failed: ${error.message}`,
      cause: error,
    })
  }

  async loadCurrentDecisions(
    campaignId: string,
  ): Promise<ReviewCurrentDecisions> {
    return projectCurrentVerificationEvents(await this.loadEvents(campaignId))
  }

  async loadConsensus(
    campaignId: string,
  ): Promise<readonly VerificationConsensus[]> {
    const operation = `load consensus for campaign ${campaignId}`
    const { data, error } = await this.#client
      .from('verification_consensus')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('item_id', { ascending: true })
    throwQueryError(error, operation)
    const rows = rowArray(data, operation)
    if (rows.length > 0) {
      const consensus = Object.freeze(
        rows.map((row) =>
          decodeRemote(operation, () =>
            verificationConsensusFromSupabaseRow(row),
          ),
        ),
      )
      const unexpected = consensus.find(
        (projection) => projection.campaignId !== campaignId,
      )
      if (unexpected !== undefined) {
        throw invalidRemote(
          operation,
          `query returned consensus for campaign ${unexpected.campaignId}`,
        )
      }
      return consensus
    }
    const campaign = await this.loadCampaign(campaignId)
    if (campaign === null) {
      return Object.freeze([])
    }
    const items = await this.#loadItemsForCampaign(campaign)
    const events = await this.#loadEventsForCampaign(campaign, items)
    return projectVerificationConsensus(campaign, items, events)
  }

  async exportReceipt(campaignId: string): Promise<Uint8Array<ArrayBuffer>> {
    const campaign = await this.loadCampaign(campaignId)
    if (campaign === null) {
      throw invalidRemote(
        `export campaign ${campaignId}`,
        `campaign is unavailable: ${campaignId}`,
      )
    }
    const items = await this.#loadItemsForCampaign(campaign)
    const events = await this.#loadEventsForCampaign(campaign, items)
    const consensus = await this.loadConsensus(campaignId)
    return reviewRepositoryReceiptBytes({
      campaign,
      items,
      events,
      consensus,
    })
  }

  async clearLocalCampaign(_campaignId: string): Promise<void> {
    // This adapter owns no local state and never deletes the cloud ledger.
  }

  async #loadItemsForCampaign(
    campaign: VerificationCampaign,
  ): Promise<readonly VerificationItem[]> {
    const campaignId = campaign.campaignId
    const operation = `load items for campaign ${campaignId}`
    const { data, error } = await this.#client
      .from('verification_items')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('item_id', { ascending: true })
    throwQueryError(error, operation)
    const rows = rowArray(data, operation)
    return Object.freeze(
      rows.map((row) =>
        decodeRemote(operation, () =>
          verificationItemFromSupabaseRow(row, campaign),
        ),
      ),
    )
  }

  async #loadEventsForCampaign(
    campaign: VerificationCampaign,
    items: readonly VerificationItem[],
  ): Promise<readonly VerificationEvent[]> {
    const campaignId = campaign.campaignId
    const itemById = new Map(items.map((item) => [item.itemId, item]))
    const operation = `load events for campaign ${campaignId}`
    const { data, error } = await this.#client
      .from('verification_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('reviewed_at', { ascending: true })
      .order('review_round', { ascending: true })
      .order('event_id', { ascending: true })
    throwQueryError(error, operation)
    const events: VerificationEvent[] = []
    for (const row of rowArray(data, operation)) {
      const itemId = remoteStringField(row, 'item_id', operation)
      const item = itemById.get(itemId)
      if (item === undefined) {
        throw invalidRemote(
          operation,
          `event names an unavailable item: ${itemId}`,
        )
      }
      events.push(
        decodeRemote(operation, () =>
          verificationEventFromSupabaseRow(row, campaign, item, events),
        ),
      )
    }
    return Object.freeze(events)
  }

  async #resolveDuplicateEvent(
    event: VerificationEvent,
    campaign: VerificationCampaign,
    items: readonly VerificationItem[],
    priorEvents: readonly VerificationEvent[],
  ): Promise<boolean> {
    const operation = `resolve duplicate event ${event.eventId}`
    const { data, error } = await this.#client
      .from('verification_events')
      .select('*')
      .eq('event_id', event.eventId)
      .maybeSingle()
    throwQueryError(error, operation)
    if (data === null) {
      return false
    }
    const row = remoteRecord(data, operation)
    if (!canonicalEqual(row.event_payload, event)) {
      throw eventIdConflict(event.eventId)
    }
    const itemId = remoteStringField(row, 'item_id', operation)
    const item = items.find((candidate) => candidate.itemId === itemId)
    if (item === undefined) {
      throw invalidRemote(
        operation,
        `event names an unavailable item: ${itemId}`,
      )
    }
    const persistedEvent = decodeRemote(operation, () =>
      verificationEventFromSupabaseRow(row, campaign, item, priorEvents),
    )
    assertSameEvent(persistedEvent, event)
    return true
  }
}

function throwQueryError(
  error: PostgrestError | null,
  operation: string,
): void {
  if (error === null) {
    return
  }
  throw new SupabaseReviewRepositoryError({
    code: 'query_failed',
    operation,
    postgrestCode: error.code,
    message: `Supabase verification query failed: ${error.message}`,
    cause: error,
  })
}

function decodeRemote<T>(operation: string, decode: () => T): T {
  try {
    return decode()
  } catch (reason) {
    if (reason instanceof SupabaseReviewRepositoryError) {
      throw reason
    }
    throw invalidRemote(operation, errorMessage(reason), reason)
  }
}

function invalidRemote(
  operation: string,
  detail: string,
  cause?: unknown,
): SupabaseReviewRepositoryError {
  return new SupabaseReviewRepositoryError({
    code: 'invalid_remote_data',
    operation,
    message: `Supabase verification data is invalid: ${detail}`,
    cause,
  })
}

function rowArray(data: unknown, operation: string): readonly unknown[] {
  if (!Array.isArray(data)) {
    throw invalidRemote(operation, 'query did not return a row array')
  }
  return data
}

function remoteStringField(
  value: unknown,
  field: string,
  operation: string,
): string {
  const fieldValue = remoteRecord(value, operation)[field]
  if (typeof fieldValue !== 'string') {
    throw invalidRemote(operation, `${field} is not a string`)
  }
  return fieldValue
}

function remoteRecord(
  value: unknown,
  operation: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidRemote(operation, 'query returned a non-object row')
  }
  return value as Record<string, unknown>
}

function assertSameEvent(
  persistedEvent: VerificationEvent,
  attemptedEvent: VerificationEvent,
): void {
  if (!canonicalEqual(persistedEvent, attemptedEvent)) {
    throw eventIdConflict(attemptedEvent.eventId)
  }
}

function eventIdConflict(eventId: string): SupabaseReviewRepositoryError {
  return new SupabaseReviewRepositoryError({
    code: 'event_id_conflict',
    operation: `append event ${eventId}`,
    message: `Supabase verification event ID is already bound to a different payload: ${eventId}`,
  })
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalExportJsonBytes(left)
  const rightBytes = canonicalExportJsonBytes(right)
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    leftBytes.every((byte, index) => byte === rightBytes[index])
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'unknown decoding failure'
}
