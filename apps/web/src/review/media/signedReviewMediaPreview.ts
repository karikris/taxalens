import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'

export const SIGNED_REVIEW_MEDIA_PREVIEW_REQUEST_SCHEMA_VERSION =
  'taxalens-signed-review-media-preview-request:v1.0.0' as const

export const SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION =
  'taxalens-signed-review-media-preview:v1.0.0' as const

export interface SignedReviewMediaPreviewRequest {
  readonly schemaVersion: typeof SIGNED_REVIEW_MEDIA_PREVIEW_REQUEST_SCHEMA_VERSION
  readonly campaignId: string
  readonly itemId: string
  readonly requestedLifetimeSeconds: number
}

export interface SignedReviewMediaPreview {
  readonly schemaVersion: typeof SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION
  readonly campaignId: string
  readonly itemId: string
  readonly provider: 'backblaze_b2'
  readonly bucketAlias: string
  readonly objectKey: string
  readonly accessScope: 'assigned_reviewer'
  readonly rightsPolicyStatus: 'allowed' | 'restricted'
  readonly url: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly imageSha256: string
  readonly imageByteCount: number
  readonly mediaType: `image/${string}`
  readonly cacheKey: string
}

export type SignedReviewMediaPreviewErrorCode =
  | 'private_media_unavailable'
  | 'rights_blocked'
  | 'public_replay_forbidden'
  | 'signing_failed'
  | 'invalid_response'

export class SignedReviewMediaPreviewError extends Error {
  readonly code: SignedReviewMediaPreviewErrorCode

  constructor(
    code: SignedReviewMediaPreviewErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'SignedReviewMediaPreviewError'
    this.code = code
  }
}

export interface SignedReviewMediaPreviewProvider {
  getPreview(
    campaign: VerificationCampaign,
    item: VerificationItem,
    signal: AbortSignal,
  ): Promise<SignedReviewMediaPreview>
}

export interface SupabaseSignedReviewMediaPreviewClientOptions {
  readonly functions: Pick<SupabaseClient['functions'], 'invoke'>
  readonly functionName?: string
  readonly maxLifetimeSeconds?: number
  readonly now?: () => Date
  readonly timeoutMs?: number
}

export class SupabaseSignedReviewMediaPreviewClient
  implements SignedReviewMediaPreviewProvider
{
  readonly #functionName: string
  readonly #functions: Pick<SupabaseClient['functions'], 'invoke'>
  readonly #maxLifetimeSeconds: number
  readonly #now: () => Date
  readonly #timeoutMs: number

  constructor({
    functions,
    functionName = 'sign-review-media-preview',
    maxLifetimeSeconds = 300,
    now = () => new Date(),
    timeoutMs = 10_000,
  }: SupabaseSignedReviewMediaPreviewClientOptions) {
    if (!SAFE_FUNCTION_NAME.test(functionName)) {
      throw new Error('Signed review media function name is unsafe.')
    }
    if (
      !Number.isInteger(maxLifetimeSeconds) ||
      maxLifetimeSeconds < 30 ||
      maxLifetimeSeconds > 3_600
    ) {
      throw new Error(
        'Signed review media lifetime must be an integer from 30 to 3600 seconds.',
      )
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      throw new Error(
        'Signed review media timeout must be an integer from 1 to 60000 milliseconds.',
      )
    }
    this.#functions = functions
    this.#functionName = functionName
    this.#maxLifetimeSeconds = maxLifetimeSeconds
    this.#now = now
    this.#timeoutMs = timeoutMs
  }

  async getPreview(
    campaign: VerificationCampaign,
    item: VerificationItem,
    signal: AbortSignal,
  ): Promise<SignedReviewMediaPreview> {
    assertPreviewAllowed(campaign, item)
    const request: SignedReviewMediaPreviewRequest = Object.freeze({
      schemaVersion: SIGNED_REVIEW_MEDIA_PREVIEW_REQUEST_SCHEMA_VERSION,
      campaignId: campaign.campaignId,
      itemId: item.itemId,
      requestedLifetimeSeconds: this.#maxLifetimeSeconds,
    })
    const { data, error } = await this.#functions.invoke<unknown>(
      this.#functionName,
      {
        body: request,
        signal,
        timeout: this.#timeoutMs,
      },
    )
    if (error !== null) {
      throw new SignedReviewMediaPreviewError(
        'signing_failed',
        `The private review preview could not be signed: ${error.message}`,
        error,
      )
    }
    return decodeSignedPreview({
      campaign,
      item,
      maxLifetimeSeconds: this.#maxLifetimeSeconds,
      now: this.#now(),
      value: data,
    })
  }
}

export function signedReviewMediaCacheKey(item: VerificationItem): string {
  return [
    'taxalens-private-review-media',
    encodeURIComponent(item.campaignId),
    encodeURIComponent(item.itemId),
    item.imageSha256,
  ].join('/')
}

function assertPreviewAllowed(
  campaign: VerificationCampaign,
  item: VerificationItem,
): void {
  if (campaign.publicReplay) {
    throw new SignedReviewMediaPreviewError(
      'public_replay_forbidden',
      'Public replay campaigns cannot request private review media.',
    )
  }
  if (item.campaignId !== campaign.campaignId) {
    throw new SignedReviewMediaPreviewError(
      'private_media_unavailable',
      'The private review item does not belong to the requested campaign.',
    )
  }
  if (item.privateMedia === undefined) {
    throw new SignedReviewMediaPreviewError(
      'private_media_unavailable',
      'The verification item has no private review media reference.',
    )
  }
  if (
    item.rights.policyStatus !== 'allowed' &&
    item.rights.policyStatus !== 'restricted'
  ) {
    throw new SignedReviewMediaPreviewError(
      'rights_blocked',
      `Private review media is blocked by rights policy: ${item.rights.policyStatus}.`,
    )
  }
}

function decodeSignedPreview({
  campaign,
  item,
  maxLifetimeSeconds,
  now,
  value,
}: {
  readonly campaign: VerificationCampaign
  readonly item: VerificationItem
  readonly maxLifetimeSeconds: number
  readonly now: Date
  readonly value: unknown
}): SignedReviewMediaPreview {
  const row = recordValue(value)
  const privateMedia = item.privateMedia
  if (privateMedia === undefined) {
    throw invalidResponse('item private media disappeared during signing')
  }
  const schemaVersion = stringField(row, 'schemaVersion')
  const provider = stringField(row, 'provider')
  const accessScope = stringField(row, 'accessScope')
  const rightsPolicyStatus = stringField(row, 'rightsPolicyStatus')
  const mediaType = stringField(row, 'mediaType')
  const issuedAt = utcInstantField(row, 'issuedAt')
  const expiresAt = utcInstantField(row, 'expiresAt')
  const url = signedUrlField(row, 'url')
  const issuedMilliseconds = Date.parse(issuedAt)
  const expiresMilliseconds = Date.parse(expiresAt)
  const nowMilliseconds = now.getTime()
  const failures = [
    mismatch(
      schemaVersion,
      SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
      'schema version',
    ),
    mismatch(
      stringField(row, 'campaignId'),
      campaign.campaignId,
      'campaign ID',
    ),
    mismatch(stringField(row, 'itemId'), item.itemId, 'item ID'),
    mismatch(provider, privateMedia.provider, 'provider'),
    mismatch(
      stringField(row, 'bucketAlias'),
      privateMedia.bucketAlias,
      'bucket alias',
    ),
    mismatch(
      stringField(row, 'objectKey'),
      privateMedia.objectKey,
      'object key',
    ),
    mismatch(accessScope, privateMedia.accessScope, 'access scope'),
    mismatch(
      rightsPolicyStatus,
      item.rights.policyStatus,
      'rights policy status',
    ),
    mismatch(
      stringField(row, 'imageSha256'),
      item.imageSha256,
      'image SHA-256',
    ),
    mismatch(
      integerField(row, 'imageByteCount'),
      item.imageByteCount,
      'image byte count',
    ),
    mismatch(mediaType, item.mediaType, 'media type'),
  ].filter((failure): failure is string => failure !== null)
  if (provider !== 'backblaze_b2') {
    failures.push('provider is unsupported')
  }
  if (accessScope !== 'assigned_reviewer') {
    failures.push('access scope is unsupported')
  }
  if (
    rightsPolicyStatus !== 'allowed' &&
    rightsPolicyStatus !== 'restricted'
  ) {
    failures.push('rights policy status is unsupported')
  }
  if (!mediaType.startsWith('image/')) {
    failures.push('media type is not an image')
  }
  if (
    issuedMilliseconds > nowMilliseconds + CLOCK_SKEW_MILLISECONDS ||
    expiresMilliseconds <= nowMilliseconds + MINIMUM_REMAINING_MILLISECONDS ||
    expiresMilliseconds <= issuedMilliseconds ||
    expiresMilliseconds - issuedMilliseconds >
      maxLifetimeSeconds * 1_000 + CLOCK_SKEW_MILLISECONDS
  ) {
    failures.push('signed preview lifetime is invalid')
  }
  if (failures.length > 0) {
    throw invalidResponse(failures.join('; '))
  }
  return Object.freeze({
    schemaVersion: SIGNED_REVIEW_MEDIA_PREVIEW_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    provider: 'backblaze_b2',
    bucketAlias: privateMedia.bucketAlias,
    objectKey: privateMedia.objectKey,
    accessScope: 'assigned_reviewer',
    rightsPolicyStatus: rightsPolicyStatus as 'allowed' | 'restricted',
    url,
    issuedAt,
    expiresAt,
    imageSha256: item.imageSha256,
    imageByteCount: item.imageByteCount,
    mediaType: item.mediaType,
    cacheKey: signedReviewMediaCacheKey(item),
  })
}

function recordValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse('response is not an object')
  }
  return value as Record<string, unknown>
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidResponse(`${field} is not a non-empty string`)
  }
  return value
}

function integerField(row: Record<string, unknown>, field: string): number {
  const value = row[field]
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw invalidResponse(`${field} is not a positive integer`)
  }
  return value as number
}

function utcInstantField(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = stringField(row, field)
  const milliseconds = Date.parse(value)
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw invalidResponse(`${field} is not a normalized UTC instant`)
  }
  return value
}

function signedUrlField(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = stringField(row, field)
  let url: URL
  try {
    url = new URL(value)
  } catch (reason) {
    throw invalidResponse(`${field} is not a URL`, reason)
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    !BACKBLAZE_S3_HOST.test(url.hostname)
  ) {
    throw invalidResponse(
      `${field} is not an HTTPS Backblaze B2 S3 URL without URL userinfo`,
    )
  }
  return url.href
}

function mismatch(
  actual: unknown,
  expected: unknown,
  label: string,
): string | null {
  return actual === expected ? null : `${label} does not match the item`
}

function invalidResponse(
  detail: string,
  cause?: unknown,
): SignedReviewMediaPreviewError {
  return new SignedReviewMediaPreviewError(
    'invalid_response',
    `The signed private review preview is invalid: ${detail}.`,
    cause,
  )
}

const SAFE_FUNCTION_NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u
const BACKBLAZE_S3_HOST =
  /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.)?s3\.[a-z0-9-]+\.backblazeb2\.com$/u
const CLOCK_SKEW_MILLISECONDS = 30_000
const MINIMUM_REMAINING_MILLISECONDS = 5_000
