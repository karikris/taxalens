import { useState } from 'react'
import { Button, Dialog, Heading, Modal } from 'react-aria-components'

import type { ShellView } from './shellTypes'

interface TourStep {
  readonly view: ShellView
  readonly title: string
  readonly description: string
}

const TOUR_STEPS: readonly TourStep[] = [
  {
    view: 'mission',
    title: 'Mission',
    description:
      'Start with the target identity and its evidence boundary. The current pilot is metadata only and still awaits human review.',
  },
  {
    view: 'observatory',
    title: 'Observatory',
    description:
      'Inspect the exact replay bundle, artifact inventory, rights state, and source lineage before interpreting any evidence.',
  },
  {
    view: 'evidence-lens',
    title: 'Evidence Lens',
    description:
      'See which claims are permitted, which sections are unavailable, and why candidate metadata is not a verified occurrence.',
  },
  {
    view: 'dashboard',
    title: 'Dashboard',
    description:
      'Review the credential-free client runtime. The shell reports replay mechanics without inventing evaluation results.',
  },
  {
    view: 'agent',
    title: 'Agent Trace',
    description:
      'Audit the public request, plan, tools, artifact citations, structured output, answer, and budgets without exposing private reasoning.',
  },
]

interface GuidedTourProps {
  readonly onVisit: (view: ShellView) => void
}

function tourStepAt(index: number): TourStep {
  const step = TOUR_STEPS[index]
  if (step === undefined) {
    throw new Error('Guided tour step is outside the configured range')
  }
  return step
}

export function GuidedTour({ onVisit }: GuidedTourProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const step = tourStepAt(stepIndex)

  function openTour() {
    setStepIndex(0)
    setIsOpen(true)
  }

  function visitStep() {
    onVisit(step.view)
    setIsOpen(false)
  }

  return (
    <>
      <Button className="shell-action" onPress={openTour}>
        Guided tour
      </Button>
      <Modal
        className="tour-modal"
        isDismissable
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
        <Dialog className="tour-dialog">
          {({ close }) => (
            <>
              <div className="tour-dialog__topline">
                <p className="tl-kicker">
                  Guided tour · Step {stepIndex + 1} of {TOUR_STEPS.length}
                </p>
                <Button className="tour-dialog__close" onPress={close}>
                  Close tour
                </Button>
              </div>
              <div className="tour-dialog__content" aria-live="polite">
                <Heading slot="title" className="tl-editorial-title">
                  {step.title}
                </Heading>
                <p>{step.description}</p>
              </div>
              <ol className="tour-dialog__progress" aria-label="Tour progress">
                {TOUR_STEPS.map((item, index) => (
                  <li key={item.view} aria-current={index === stepIndex ? 'step' : undefined}>
                    <span aria-hidden="true">{index + 1}</span>
                    <span className="tl-visually-hidden">{item.title}</span>
                  </li>
                ))}
              </ol>
              <div className="tour-dialog__actions">
                <Button
                  className="tour-dialog__button tour-dialog__button--quiet"
                  isDisabled={stepIndex === 0}
                  onPress={() => setStepIndex((index) => Math.max(0, index - 1))}
                >
                  Previous
                </Button>
                <Button className="tour-dialog__button" onPress={visitStep}>
                  Visit {step.title}
                </Button>
                {stepIndex < TOUR_STEPS.length - 1 ? (
                  <Button
                    className="tour-dialog__button"
                    onPress={() =>
                      setStepIndex((index) => Math.min(TOUR_STEPS.length - 1, index + 1))
                    }
                  >
                    Next: {TOUR_STEPS[stepIndex + 1]?.title}
                  </Button>
                ) : (
                  <Button className="tour-dialog__button" onPress={close}>
                    Finish tour
                  </Button>
                )}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </>
  )
}
