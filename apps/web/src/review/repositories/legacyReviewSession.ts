import { HUMAN_REVIEW_PACKET } from '../reviewPacket'
import {
  ReviewPersistenceError,
  classifyReviewPersistenceError,
  reviewErrorCauseMessage,
} from '../domain/reviewErrors'
import {
  emptyHumanReviewSession,
  restoreHumanReviewEvents,
  restoreHumanReviewInspections,
  type HumanReviewDecisionInput,
  type HumanReviewSession,
} from '../domain/reviewSession'

export const HUMAN_REVIEW_SESSION_STORAGE_KEY =
  `taxalens-human-review:${HUMAN_REVIEW_PACKET.packetId}`

export interface HumanReviewSessionLoadResult {
  readonly session: HumanReviewSession
  readonly error: ReviewPersistenceError | null
}

export function loadHumanReviewSession(
  storage?: Pick<Storage, 'getItem'>,
): HumanReviewSession {
  return loadHumanReviewSessionResult(storage).session
}

export function loadHumanReviewSessionResult(
  storage?: Pick<Storage, 'getItem'>,
): HumanReviewSessionLoadResult {
  try {
    const raw = (storage ?? window.localStorage).getItem(
      HUMAN_REVIEW_SESSION_STORAGE_KEY,
    )
    if (raw === null) {
      return Object.freeze({
        session: emptyHumanReviewSession(),
        error: null,
      })
    }
    const value = JSON.parse(raw) as Partial<HumanReviewSession> & {
      readonly decisions?: Readonly<Record<string, HumanReviewDecisionInput>>
    }
    if (
      value.packetId !== HUMAN_REVIEW_PACKET.packetId ||
      typeof value.reviewerId !== 'string'
    ) {
      return Object.freeze({
        session: emptyHumanReviewSession(),
        error: new ReviewPersistenceError(
          'corrupt_session',
          'The stored local review session is incompatible and was ignored.',
        ),
      })
    }
    return Object.freeze({
      session: Object.freeze({
        packetId: HUMAN_REVIEW_PACKET.packetId,
        reviewerId: value.reviewerId,
        events: restoreHumanReviewEvents(value),
        inspections: restoreHumanReviewInspections(value.inspections),
      }),
      error: null,
    })
  } catch (reason) {
    return Object.freeze({
      session: emptyHumanReviewSession(),
      error: classifyReviewPersistenceError(reason),
    })
  }
}

export function saveHumanReviewSession(
  session: HumanReviewSession,
  storage?: Pick<Storage, 'setItem'>,
): void {
  let serialized: string
  try {
    serialized = JSON.stringify(session)
  } catch (reason) {
    throw new ReviewPersistenceError(
      'serialization_failed',
      `The local review session could not be serialized: ${reviewErrorCauseMessage(reason)}`,
    )
  }
  try {
    ;(storage ?? window.localStorage).setItem(
      HUMAN_REVIEW_SESSION_STORAGE_KEY,
      serialized,
    )
  } catch (reason) {
    throw classifyReviewPersistenceError(reason)
  }
}

export function clearHumanReviewSession(
  storage?: Pick<Storage, 'removeItem'>,
): void {
  try {
    ;(storage ?? window.localStorage).removeItem(
      HUMAN_REVIEW_SESSION_STORAGE_KEY,
    )
  } catch (reason) {
    throw classifyReviewPersistenceError(reason)
  }
}

export {
  ReviewPersistenceError,
  reviewPersistenceErrorMessage,
} from '../domain/reviewErrors'
export type { ReviewPersistenceErrorCode } from '../domain/reviewErrors'
