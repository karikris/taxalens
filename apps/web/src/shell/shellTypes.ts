export const SHELL_VIEWS = [
  { id: 'mission', label: 'Mission', index: '01' },
  { id: 'observatory', label: 'Observatory', index: '02' },
  { id: 'evidence-lens', label: 'Evidence Lens', index: '03' },
  { id: 'verification', label: 'Verification', index: '04' },
  { id: 'dashboard', label: 'Dashboard', index: '05' },
  { id: 'agent', label: 'Agent Trace', index: '06' },
] as const

export type ShellView = (typeof SHELL_VIEWS)[number]['id']

export function shellViewFromHash(hash: string): ShellView {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const candidate = fragment.split('?', 1)[0] ?? ''
  if (candidate === 'human-review') {
    return 'verification'
  }
  return SHELL_VIEWS.some((view) => view.id === candidate)
    ? (candidate as ShellView)
    : 'mission'
}

export function canonicalShellHashForLegacyHash(hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [candidate, query] = fragment.split('?', 2)
  if (candidate !== 'human-review') {
    return null
  }
  return `#verification${query === undefined ? '' : `?${query}`}`
}
