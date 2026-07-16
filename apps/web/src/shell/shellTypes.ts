export const SHELL_VIEWS = [
  { id: 'mission', label: 'Mission', index: '01' },
  { id: 'observatory', label: 'Observatory', index: '02' },
  { id: 'evidence-lens', label: 'Evidence Lens', index: '03' },
  { id: 'verification', label: 'Verification', index: '04' },
  { id: 'dashboard', label: 'Dashboard', index: '05' },
  { id: 'agent', label: 'Agent Trace', index: '06' },
] as const

export type ShellView = (typeof SHELL_VIEWS)[number]['id']

export type VerificationReturnView = Exclude<ShellView, 'verification'>

export interface VerificationRouteParams {
  readonly campaignId: string | null
  readonly itemId: string | null
  readonly returnView: VerificationReturnView | null
  readonly errors: readonly string[]
}

export type ShellRoute =
  | {
      readonly view: Exclude<ShellView, 'verification'>
      readonly verification: null
    }
  | {
      readonly view: 'verification'
      readonly verification: VerificationRouteParams
    }

export function shellViewFromHash(hash: string): ShellView {
  return shellRouteFromHash(hash).view
}

export function shellRouteFromHash(hash: string): ShellRoute {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [rawCandidate = '', rawQuery = ''] = fragment.split('?', 2)
  const candidate =
    rawCandidate === 'human-review' ? 'verification' : rawCandidate
  const view = SHELL_VIEWS.some(({ id }) => id === candidate)
    ? (candidate as ShellView)
    : 'mission'
  if (view !== 'verification') {
    return Object.freeze({
      view,
      verification: null,
    }) as ShellRoute
  }
  return Object.freeze({
    view,
    verification: parseVerificationRouteParams(rawQuery),
  })
}

export function shellHashForRoute(route: ShellRoute): string {
  if (route.view !== 'verification') {
    return `#${route.view}`
  }
  const query = new URLSearchParams()
  if (route.verification.campaignId !== null) {
    query.set('campaign', route.verification.campaignId)
  }
  if (route.verification.itemId !== null) {
    query.set('item', route.verification.itemId)
  }
  if (route.verification.returnView !== null) {
    query.set('return', route.verification.returnView)
  }
  const suffix = query.toString()
  return `#verification${suffix === '' ? '' : `?${suffix}`}`
}

export function verificationShellRoute({
  campaignId = null,
  itemId = null,
  returnView = null,
}: {
  readonly campaignId?: string | null
  readonly itemId?: string | null
  readonly returnView?: VerificationReturnView | null
} = {}): ShellRoute {
  const errors: string[] = []
  const campaign = validRouteId(campaignId) ? campaignId : null
  const item = validRouteId(itemId) ? itemId : null
  if (campaignId !== null && campaign === null) {
    errors.push('campaign is invalid')
  }
  if (itemId !== null && item === null) {
    errors.push('item is invalid')
  }
  if (item !== null && campaign === null) {
    errors.push('item requires campaign')
  }
  return Object.freeze({
    view: 'verification',
    verification: Object.freeze({
      campaignId: campaign,
      itemId: campaign === null ? null : item,
      returnView,
      errors: Object.freeze(errors),
    }),
  })
}

export function shellRouteForView(view: ShellView): ShellRoute {
  return view === 'verification'
    ? verificationShellRoute()
    : Object.freeze({
        view,
        verification: null,
      })
}

function parseVerificationRouteParams(
  rawQuery: string,
): VerificationRouteParams {
  const query = new URLSearchParams(rawQuery)
  const errors: string[] = []
  for (const key of new Set(query.keys())) {
    if (key !== 'campaign' && key !== 'item' && key !== 'return') {
      errors.push(`unknown verification route parameter: ${key}`)
    }
  }
  const campaignId = singleRouteId(query, 'campaign', errors)
  let itemId = singleRouteId(query, 'item', errors)
  const returnValue = singleValue(query, 'return', errors)
  const returnView =
    returnValue !== null && isVerificationReturnView(returnValue)
      ? returnValue
      : null
  if (returnValue !== null && returnView === null) {
    errors.push('return is not a valid non-Verification view')
  }
  if (itemId !== null && campaignId === null) {
    errors.push('item requires campaign')
    itemId = null
  }
  return Object.freeze({
    campaignId,
    itemId,
    returnView,
    errors: Object.freeze(errors),
  })
}

function singleRouteId(
  query: URLSearchParams,
  name: 'campaign' | 'item',
  errors: string[],
): string | null {
  const value = singleValue(query, name, errors)
  if (value === null) {
    return null
  }
  if (!validRouteId(value)) {
    errors.push(`${name} has an invalid identifier`)
    return null
  }
  return value
}

function singleValue(
  query: URLSearchParams,
  name: 'campaign' | 'item' | 'return',
  errors: string[],
): string | null {
  const values = query.getAll(name)
  if (values.length > 1) {
    errors.push(`${name} is repeated`)
    return null
  }
  const value = values[0]
  return value === undefined || value === '' ? null : value
}

function validRouteId(value: string | null): value is string {
  return (
    value !== null &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
  )
}

function isVerificationReturnView(
  value: string,
): value is VerificationReturnView {
  return (
    value !== 'verification' &&
    SHELL_VIEWS.some(({ id }) => id === value)
  )
}

export function canonicalShellHashForLegacyHash(hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [candidate, query] = fragment.split('?', 2)
  if (candidate !== 'human-review') {
    return null
  }
  return `#verification${query === undefined ? '' : `?${query}`}`
}
