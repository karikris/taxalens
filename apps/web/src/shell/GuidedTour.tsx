import { useReducer } from 'react'
import { Button, Dialog, Heading, Modal } from 'react-aria-components'

import type { ShellView } from './shellTypes'

export interface JudgeTourStep {
  readonly view: ShellView
  readonly targetId?: string
  readonly title: string
  readonly description: string
  readonly suggestedSeconds: number
}

export const JUDGE_TOUR_STEPS: readonly JudgeTourStep[] = Object.freeze([
  {
    view: 'mission',
    title: 'Research Mission',
    suggestedSeconds: 15,
    description:
      'Confirm the target, pinned source revisions, metadata-only pilot boundary, and replay-only launch policy before interpreting the workflow.',
  },
  {
    view: 'observatory',
    title: 'Observatory',
    suggestedSeconds: 20,
    description:
      'Follow all 13 evidence stages, then inspect the exact artifact inventory, rights state, and source lineage behind every displayed count.',
  },
  {
    view: 'evidence-lens',
    title: 'Evidence Lens',
    suggestedSeconds: 25,
    description:
      'Open the awaiting-review hero record, compare its evidence variants and regional hypotheses, and keep every unavailable score or decision explicit.',
  },
  {
    view: 'dashboard',
    title: 'Dashboard',
    suggestedSeconds: 20,
    description:
      'Read the evidence funnel, candidate workload, review priority, query yield, efficiency, and evaluation state without promoting a scientific result.',
  },
  {
    view: 'dashboard',
    targetId: 'research-outputs',
    title: 'Export',
    suggestedSeconds: 10,
    description:
      'Prepare six deterministic local research outputs and inspect their prototype boundary, checksums, unsigned manifest, and blocked scientific claims.',
  },
])

export type JudgeTourStatus = 'ready' | 'in_progress' | 'completed' | 'skipped'

export interface JudgeTourState {
  readonly isOpen: boolean
  readonly stepIndex: number
  readonly status: JudgeTourStatus
}

export type JudgeTourAction =
  | { readonly type: 'start' }
  | { readonly type: 'resume' }
  | { readonly type: 'replay' }
  | { readonly type: 'dismiss' }
  | { readonly type: 'skip' }
  | { readonly type: 'previous' }
  | { readonly type: 'next' }
  | { readonly type: 'reset' }
  | { readonly type: 'visit'; readonly completesTour: boolean }
  | { readonly type: 'finish' }

export const INITIAL_JUDGE_TOUR_STATE: JudgeTourState = Object.freeze({
  isOpen: false,
  stepIndex: 0,
  status: 'ready',
})

export function judgeTourReducer(
  state: JudgeTourState,
  action: JudgeTourAction,
): JudgeTourState {
  const finalIndex = JUDGE_TOUR_STEPS.length - 1
  switch (action.type) {
    case 'start':
      return { isOpen: true, stepIndex: 0, status: 'in_progress' }
    case 'resume':
      return { ...state, isOpen: true, status: 'in_progress' }
    case 'replay':
      return { isOpen: true, stepIndex: 0, status: 'in_progress' }
    case 'dismiss':
      return { ...state, isOpen: false }
    case 'skip':
      return { isOpen: false, stepIndex: state.stepIndex, status: 'skipped' }
    case 'previous':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) }
    case 'next':
      return { ...state, stepIndex: Math.min(finalIndex, state.stepIndex + 1) }
    case 'reset':
      return { isOpen: true, stepIndex: 0, status: 'in_progress' }
    case 'visit':
      return {
        isOpen: false,
        stepIndex: state.stepIndex,
        status: action.completesTour ? 'completed' : 'in_progress',
      }
    case 'finish':
      return { isOpen: false, stepIndex: finalIndex, status: 'completed' }
  }
}

interface GuidedTourProps {
  readonly onVisit: (view: ShellView, targetId?: string) => void
}

function tourStepAt(index: number): JudgeTourStep {
  const step = JUDGE_TOUR_STEPS[index]
  if (step === undefined) {
    throw new Error('Guided tour step is outside the configured range')
  }
  return step
}

function triggerLabel(status: JudgeTourStatus): string {
  if (status === 'in_progress') {
    return 'Resume 90-second judge tour'
  }
  if (status === 'completed' || status === 'skipped') {
    return 'Replay 90-second judge tour'
  }
  return 'Start 90-second judge tour'
}

export function GuidedTour({ onVisit }: GuidedTourProps) {
  const [state, dispatch] = useReducer(judgeTourReducer, INITIAL_JUDGE_TOUR_STATE)
  const step = tourStepAt(state.stepIndex)

  function openTour() {
    dispatch({
      type:
        state.status === 'ready'
          ? 'start'
          : state.status === 'in_progress'
            ? 'resume'
            : 'replay',
    })
  }

  function visitStep() {
    onVisit(step.view, step.targetId)
    dispatch({
      type: 'visit',
      completesTour: state.stepIndex === JUDGE_TOUR_STEPS.length - 1,
    })
  }

  return (
    <>
      <Button className="shell-action" onPress={openTour}>
        {triggerLabel(state.status)}
      </Button>
      <Modal
        className="tour-modal"
        isDismissable
        isOpen={state.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            dispatch({ type: 'dismiss' })
          }
        }}
      >
        <Dialog className="tour-dialog">
          <div className="tour-dialog__topline">
            <p className="tl-kicker">
              90-second judge tour · Step {state.stepIndex + 1} of {JUDGE_TOUR_STEPS.length}
            </p>
            <Button className="tour-dialog__close" onPress={() => dispatch({ type: 'skip' })}>
              Skip tour
            </Button>
          </div>
          <div className="tour-dialog__content" aria-live="polite">
            <Heading slot="title" className="tl-editorial-title">
              {step.title}
            </Heading>
            <p>{step.description}</p>
            <p className="tour-dialog__timing">
              Suggested time: {step.suggestedSeconds} seconds · Total route: 90 seconds
            </p>
          </div>
          <ol className="tour-dialog__progress" aria-label="Judge tour progress">
            {JUDGE_TOUR_STEPS.map((item, index) => (
              <li key={`${item.view}-${item.title}`} aria-current={index === state.stepIndex ? 'step' : undefined}>
                <span aria-hidden="true">{index + 1}</span>
                <span className="tl-visually-hidden">{item.title}</span>
              </li>
            ))}
          </ol>
          <div className="tour-dialog__actions">
            <Button
              className="tour-dialog__button tour-dialog__button--quiet"
              onPress={() => dispatch({ type: 'reset' })}
            >
              Reset tour
            </Button>
            <Button
              className="tour-dialog__button tour-dialog__button--secondary"
              isDisabled={state.stepIndex === 0}
              onPress={() => dispatch({ type: 'previous' })}
            >
              Previous
            </Button>
            <Button className="tour-dialog__button" onPress={visitStep}>
              Visit {step.title}
            </Button>
            {state.stepIndex < JUDGE_TOUR_STEPS.length - 1 ? (
              <Button
                className="tour-dialog__button"
                onPress={() => dispatch({ type: 'next' })}
              >
                Next: {JUDGE_TOUR_STEPS[state.stepIndex + 1]?.title}
              </Button>
            ) : (
              <Button
                className="tour-dialog__button"
                onPress={() => dispatch({ type: 'finish' })}
              >
                Finish tour
              </Button>
            )}
          </div>
        </Dialog>
      </Modal>
    </>
  )
}
