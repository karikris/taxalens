import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceTier } from '../design-system'
import { buildFullFrameComparison, type FullFrameMode } from './fullFrameComparisonModel'

export function FullFrameInputComparison({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildFullFrameComparison(replay)

  return (
    <section className="full-frame-comparison" aria-labelledby="full-frame-comparison-title">
      <div className="full-frame-comparison__heading">
        <div>
          <p className="eyebrow">Visual-input comparison</p>
          <h3 id="full-frame-comparison-title">Full-frame attention inputs</h3>
          <p>
            Compare the raw full canvas with each transformation contract. No image pair is shown
            until both sides are committed, rights-covered, and checksum verified.
          </p>
        </div>
        <strong>{model.transformationCount} transformations</strong>
      </div>

      <Tabs className="full-frame-viewer" defaultSelectedKey="focused-full-frame">
        <TabList className="full-frame-viewer__tabs" aria-label="Full-frame visual-input mode">
          {model.modes.map((mode) => (
            <Tab id={mode.id} key={mode.id}>
              {mode.label}
            </Tab>
          ))}
        </TabList>
        {model.modes.map((mode) => (
          <TabPanel id={mode.id} key={mode.id} className="full-frame-viewer__panel">
            <UnavailableComparison mode={mode} />
          </TabPanel>
        ))}
      </Tabs>

      <dl className="full-frame-comparison__identities" aria-label="Full-frame identities" role="group">
        {model.identities.map((identity) => (
          <div key={identity.id} data-availability={identity.status}>
            <dt>{identity.label}</dt>
            <dd>
              <strong>Unavailable</strong>
              <span>{identity.reason}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="full-frame-comparison__boundary">
        Pixel equality does not prove transformation identity. A real replay must bind the exact
        transformation version and fingerprint before assigning an embedding identity.
      </p>
    </section>
  )
}

function UnavailableComparison({ mode }: { readonly mode: FullFrameMode }) {
  return (
    <figure className="full-frame-viewer__figure" aria-labelledby={`${mode.id}-comparison-title`}>
      <div className="full-frame-viewer__panel-heading">
        <div>
          <EvidenceTier tier="unavailable" />
          <h4 id={`${mode.id}-comparison-title`}>Raw versus {mode.label.toLowerCase()}</h4>
          <p>{mode.description}</p>
        </div>
        <span>Crossfade unavailable</span>
      </div>
      <div className="full-frame-viewer__pair">
        <UnavailableFrame label="Raw full image" reason={mode.reason} />
        <UnavailableFrame label={mode.comparisonLabel} reason={mode.reason} />
      </div>
      <figcaption>
        Unavailable: {mode.reason} No before-and-after pixels or transformation metadata are
        substituted.
      </figcaption>
    </figure>
  )
}

function UnavailableFrame({ label, reason }: { readonly label: string; readonly reason: string }) {
  return (
    <div className="full-frame-viewer__frame">
      <div role="img" aria-label={`${label} unavailable`}>
        <span>No image rendered</span>
      </div>
      <strong>{label}</strong>
      <span>Unavailable</span>
      <small>{reason}</small>
    </div>
  )
}
