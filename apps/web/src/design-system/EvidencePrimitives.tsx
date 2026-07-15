import type { ReactNode } from 'react'

export type EvidenceStateKind =
  | 'available'
  | 'loading'
  | 'blocked'
  | 'review'
  | 'abstention'
  | 'failure'

export type EvidenceTierKind = 'metadata' | 'candidate' | 'reviewed' | 'unavailable'

const STATE_MARKERS: Readonly<Record<EvidenceStateKind, string>> = {
  available: 'OK',
  loading: '…',
  blocked: 'BL',
  review: 'RV',
  abstention: 'AB',
  failure: '!',
}

const TIER_LABELS: Readonly<Record<EvidenceTierKind, string>> = {
  metadata: 'Metadata only',
  candidate: 'Candidate evidence',
  reviewed: 'Human-reviewed evidence',
  unavailable: 'Evidence unavailable',
}

interface EvidenceStateProps {
  readonly state: EvidenceStateKind
  readonly title: string
  readonly children?: ReactNode
  readonly compact?: boolean
}

export function EvidenceState({
  state,
  title,
  children,
  compact = false,
}: EvidenceStateProps) {
  const role = state === 'failure' ? 'alert' : 'status'

  return (
    <div
      className="tl-evidence-state"
      data-state={state}
      data-compact={compact || undefined}
      role={role}
      aria-busy={state === 'loading' || undefined}
      aria-live={state === 'loading' ? 'polite' : undefined}
    >
      <span className="tl-evidence-state__marker" aria-hidden="true">
        {STATE_MARKERS[state]}
      </span>
      <div className="tl-evidence-state__body">
        <strong className="tl-evidence-state__title">{title}</strong>
        {children !== undefined && !compact && (
          <p className="tl-evidence-state__detail">{children}</p>
        )}
      </div>
    </div>
  )
}

export function EvidenceTier({ tier }: { readonly tier: EvidenceTierKind }) {
  return (
    <span className="tl-evidence-tier" data-tier={tier}>
      {TIER_LABELS[tier]}
    </span>
  )
}

type EvidenceDesignationProps =
  | { readonly kind: 'candidate'; readonly label?: string }
  | {
      readonly kind: 'occurrence'
      readonly verification: 'human-verified'
      readonly label?: string
    }

export function EvidenceDesignation(props: EvidenceDesignationProps) {
  const text =
    props.kind === 'candidate'
      ? (props.label ?? 'Candidate — not an occurrence')
      : (props.label ?? 'Human-verified occurrence')

  return (
    <span className="tl-designation" data-kind={props.kind}>
      {text}
    </span>
  )
}

type ScoreSemanticsProps =
  | { readonly kind: 'raw'; readonly label?: string }
  | {
      readonly kind: 'calibrated'
      readonly calibrationEvidence: string
      readonly label?: string
    }

export function ScoreSemantics(props: ScoreSemanticsProps) {
  const text =
    props.kind === 'raw'
      ? (props.label ?? 'Raw similarity — not a probability')
      : (props.label ?? 'Calibrated probability')

  return (
    <span
      className="tl-score-semantics"
      data-kind={props.kind}
      title={props.kind === 'calibrated' ? props.calibrationEvidence : undefined}
    >
      {text}
    </span>
  )
}

export function UncertaintyNote({ children }: { readonly children: ReactNode }) {
  return (
    <aside className="tl-uncertainty-note" aria-label="Uncertainty">
      <strong>Uncertainty</strong>
      {children}
    </aside>
  )
}
