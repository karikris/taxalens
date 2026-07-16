import type { ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'

import { EvidenceState } from '../../design-system'
import { ConflictQueue } from './ConflictQueue'
import { QualityPanel } from './QualityPanel'

export type VerificationSection =
  | 'flickr-results'
  | 'reference-images'
  | 'conflicts'
  | 'quality'

export function VerificationSections({
  defaultSection = 'reference-images',
  flickrResults,
  referenceImages,
}: {
  readonly defaultSection?: VerificationSection
  readonly flickrResults?: ReactNode
  readonly referenceImages: ReactNode
}) {
  return (
    <Tabs
      className="verification-sections"
      defaultSelectedKey={defaultSection}
    >
      <TabList
        className="verification-sections__tabs"
        aria-label="Verification workspace sections"
      >
        <Tab id="flickr-results">Flickr Results</Tab>
        <Tab id="reference-images">Reference Images</Tab>
        <Tab id="conflicts">Conflicts</Tab>
        <Tab id="quality">Quality</Tab>
      </TabList>
      <TabPanel
        id="flickr-results"
        className="verification-sections__panel"
      >
        {flickrResults ?? (
          <EvidenceState
            state="blocked"
            title="No Flickr verification campaign is attached yet"
          >
            Flickr candidate campaigns will appear here when their item
            manifest and sampling design are committed. The Commons reference
            fixture is kept in Reference Images.
          </EvidenceState>
        )}
      </TabPanel>
      <TabPanel
        id="reference-images"
        className="verification-sections__panel"
      >
        {referenceImages}
      </TabPanel>
      <TabPanel id="conflicts" className="verification-sections__panel">
        <ConflictQueue />
      </TabPanel>
      <TabPanel id="quality" className="verification-sections__panel">
        <QualityPanel />
      </TabPanel>
    </Tabs>
  )
}
