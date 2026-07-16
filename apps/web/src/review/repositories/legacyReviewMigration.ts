import type { ReviewRepository } from './reviewRepository'
import {
  HUMAN_REVIEW_SESSION_STORAGE_KEY,
  clearHumanReviewSession,
  loadHumanReviewSessionResult,
} from './legacyReviewSession'
import type { HumanReviewInspection } from '../domain/reviewSession'

export interface LegacyReviewMigrationResult {
  readonly status: 'absent' | 'migrated'
  readonly reviewerId: string
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
  readonly eventCount: number
}

export async function migrateLegacyHumanReviewSession(
  repository: ReviewRepository,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.localStorage,
): Promise<LegacyReviewMigrationResult> {
  if (storage.getItem(HUMAN_REVIEW_SESSION_STORAGE_KEY) === null) {
    return Object.freeze({
      status: 'absent',
      reviewerId: '',
      inspections: Object.freeze({}),
      eventCount: 0,
    })
  }
  const loaded = loadHumanReviewSessionResult(storage)
  if (loaded.error !== null) {
    throw loaded.error
  }
  for (const event of loaded.session.events) {
    await repository.appendEvent(event)
  }
  clearHumanReviewSession(storage)
  return Object.freeze({
    status: 'migrated',
    reviewerId: loaded.session.reviewerId,
    inspections: loaded.session.inspections,
    eventCount: loaded.session.events.length,
  })
}
