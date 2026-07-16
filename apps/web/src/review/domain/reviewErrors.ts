export type ReviewPersistenceErrorCode =
  | 'unavailable'
  | 'quota_exceeded'
  | 'serialization_failed'
  | 'corrupt_session'
  | 'unknown'

export class ReviewPersistenceError extends Error {
  readonly code: ReviewPersistenceErrorCode

  constructor(code: ReviewPersistenceErrorCode, message: string) {
    super(message)
    this.name = 'ReviewPersistenceError'
    this.code = code
  }
}

export function reviewPersistenceErrorMessage(
  error: ReviewPersistenceError,
): string {
  switch (error.code) {
    case 'quota_exceeded':
      return `${error.message} Browser storage quota is full; the current review remains in memory only.`
    case 'serialization_failed':
      return `${error.message} The current review remains in memory and was not persisted.`
    case 'corrupt_session':
      return error.message
    case 'unavailable':
      return `${error.message} This can occur in private browsing or when site storage is blocked; the current review remains in memory only.`
    case 'unknown':
      return `${error.message} The current review remains in memory only.`
  }
}

export function classifyReviewPersistenceError(
  reason: unknown,
): ReviewPersistenceError {
  if (reason instanceof ReviewPersistenceError) {
    return reason
  }
  const name =
    typeof DOMException !== 'undefined' && reason instanceof DOMException
      ? reason.name
      : reason instanceof Error
        ? reason.name
        : ''
  const message = reviewErrorCauseMessage(reason)
  if (
    name === 'QuotaExceededError' ||
    /quota|storage.?full|space available/u.test(message.toLowerCase())
  ) {
    return new ReviewPersistenceError(
      'quota_exceeded',
      'The browser refused to save the local review session because its storage quota was exceeded.',
    )
  }
  if (
    name === 'SecurityError' ||
    /security|denied|disabled|unavailable|not supported|private/u.test(
      message.toLowerCase(),
    )
  ) {
    return new ReviewPersistenceError(
      'unavailable',
      'Browser persistence is unavailable or blocked for this session.',
    )
  }
  if (/json|parse|unexpected token|corrupt/u.test(message.toLowerCase())) {
    return corruptReviewSession(
      'The stored local review session could not be parsed and was ignored.',
    )
  }
  return new ReviewPersistenceError(
    'unknown',
    `Browser persistence failed: ${message}`,
  )
}

export function corruptReviewSession(
  message: string,
): ReviewPersistenceError {
  return new ReviewPersistenceError('corrupt_session', message)
}

export function reviewErrorCauseMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
