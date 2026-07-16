export const SHELL_VIEWS = [
  { id: 'mission', label: 'Mission', index: '01' },
  { id: 'observatory', label: 'Observatory', index: '02' },
  { id: 'evidence-lens', label: 'Evidence Lens', index: '03' },
  { id: 'human-review', label: 'Human Review', index: '04' },
  { id: 'dashboard', label: 'Dashboard', index: '05' },
  { id: 'agent', label: 'Agent Trace', index: '06' },
] as const

export type ShellView = (typeof SHELL_VIEWS)[number]['id']

export function shellViewFromHash(hash: string): ShellView {
  const candidate = hash.startsWith('#') ? hash.slice(1) : hash
  return SHELL_VIEWS.some((view) => view.id === candidate)
    ? (candidate as ShellView)
    : 'mission'
}
