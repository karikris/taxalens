import { useState } from 'react'

import type {
  DiscoveryProvenanceInput,
  EvidenceFacade,
  ReplayEvidence,
} from '../data/evidenceFacade'
import { EvidenceDesignation, EvidenceState, EvidenceTier } from '../design-system'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'
import './evidence.css'

export type DiscoveryProvenanceExecutor = (
  input: DiscoveryProvenanceInput,
) => Promise<DiscoveryProvenanceResult>

const defaultDiscoveryProvenanceExecutor: DiscoveryProvenanceExecutor = async (input) => {
  const { executeDiscoveryProvenance } = await import('./discoveryProvenance')
  return executeDiscoveryProvenance(input)
}

type InspectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly result: DiscoveryProvenanceResult }

export function EvidenceLensWorkspace({
  executeProvenance = defaultDiscoveryProvenanceExecutor,
  facade,
  replay,
}: {
  readonly executeProvenance?: DiscoveryProvenanceExecutor
  readonly facade: EvidenceFacade
  readonly replay: ReplayEvidence
}) {
  const [inspection, setInspection] = useState<InspectionState>({ kind: 'idle' })

  const inspectRecord = () => {
    setInspection({ kind: 'running' })
    void (async () => {
      try {
        const result = await executeProvenance(facade.loadDiscoveryProvenanceInput())
        setInspection({ kind: 'ready', result })
      } catch (reason: unknown) {
        setInspection({
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The verified discovery record could not be inspected.',
        })
      }
    })()
  }

  return (
    <section className="detail-panel evidence-lens" aria-labelledby="evidence-title">
      <p className="eyebrow">Evidence boundary</p>
      <h2 id="evidence-title">No scientific result is promoted</h2>
      <EvidenceState state="review" title="Human decision required">
        The hero remains {replay.heroState.replaceAll('_', ' ')} and scientific claims are not
        allowed.
      </EvidenceState>
      <div className="evidence-boundary">
        <EvidenceDesignation kind="candidate" />
        <EvidenceTier tier="unavailable" />
      </div>
      <dl className="evidence-facts">
        <div>
          <dt>Hero record</dt>
          <dd>{replay.heroRecordId}</dd>
        </div>
        <div>
          <dt>Scientific claim</dt>
          <dd>{replay.scientificClaimAllowed ? 'Allowed' : 'Not allowed'}</dd>
        </div>
        <div>
          <dt>Unavailable sections</dt>
          <dd>{replay.unavailableSectionCount}</dd>
        </div>
      </dl>

      <section className="discovery-evidence" aria-labelledby="discovery-evidence-title">
        <div className="discovery-evidence__heading">
          <div>
            <p className="eyebrow">Source and discovery evidence</p>
            <h3 id="discovery-evidence-title">Inspect one many-to-many discovery record</h3>
            <p>
              The local query selects the source photo with the most recorded query associations,
              then breaks ties by source and photo ID. A discovery hit is not an image label or an
              occurrence claim.
            </p>
          </div>
          <button
            className="discovery-evidence__run"
            type="button"
            disabled={inspection.kind === 'running'}
            onClick={inspectRecord}
          >
            {inspection.kind === 'running'
              ? 'Inspecting local Parquet…'
              : inspection.kind === 'ready'
                ? 'Inspect again'
                : 'Inspect verified discovery record'}
          </button>
        </div>

        <div className="discovery-media" role="img" aria-label="Licensed source image unavailable">
          <strong>Image or licensed thumbnail unavailable</strong>
          <span>{replay.discovery.media.reason}</span>
          <small>
            {replay.discovery.media.includedImageCount} included ·{' '}
            {replay.discovery.media.licensedImageCount} licensed
          </small>
        </div>

        <div className="discovery-evidence__state" aria-live="polite">
          {inspection.kind === 'idle' ? (
            <EvidenceState state="review" title="Discovery query not yet executed">
              Two checksum-verified BioMiner Parquet artifacts are ready; DuckDB-Wasm remains
              stopped until the inspection action.
            </EvidenceState>
          ) : inspection.kind === 'running' ? (
            <EvidenceState state="loading" title="Tracing discovery provenance locally">
              Joining source identity to every recorded query association in a temporary browser
              worker.
            </EvidenceState>
          ) : inspection.kind === 'error' ? (
            <EvidenceState state="failure" title="Discovery inspection stopped">
              {inspection.message}
            </EvidenceState>
          ) : (
            <DiscoveryProvenanceCard replay={replay} result={inspection.result} />
          )}
        </div>
      </section>

      <h3>Explicitly unavailable evidence</h3>
      <ul className="unavailable-evidence-list">
        {replay.unavailableSections.map((section) => (
          <li key={section.name}>
            <strong>{section.name.replaceAll('_', ' ')}</strong>
            <span>{section.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DiscoveryProvenanceCard({
  replay,
  result,
}: {
  readonly replay: ReplayEvidence
  readonly result: DiscoveryProvenanceResult
}) {
  return (
    <article className="provenance-card" aria-labelledby="provenance-card-title">
      <div className="provenance-card__heading">
        <div>
          <p className="eyebrow">Verified discovery provenance</p>
          <h4 id="provenance-card-title">Source {result.sourceId}</h4>
        </div>
        <strong>{result.associationCount.toLocaleString('en-US')} associations</strong>
      </div>
      <EvidenceState state="available" title="Discovery associations traced">
        DuckDB {result.engineVersion} joined the exact source identity to every verified query-hit
        row. Scientific claim remains not allowed.
      </EvidenceState>
      <dl className="provenance-card__facts">
        <div>
          <dt>Source ID</dt>
          <dd>
            <code>{result.sourceId}</code>
          </dd>
        </div>
        <div>
          <dt>Source network</dt>
          <dd>{result.source}</dd>
        </div>
        <div>
          <dt>Photo ID</dt>
          <dd>
            <code>{result.sourcePhotoId}</code>
          </dd>
        </div>
        <div>
          <dt>Canonical source hash</dt>
          <dd>
            <code>{result.sourceRecordHash}</code>
          </dd>
        </div>
        <UnavailableFact label="Creator" />
        <UnavailableFact label="Licence" />
        <UnavailableFact label="Attribution" />
        <div data-availability="unavailable">
          <dt>Duplicate group</dt>
          <dd>Unavailable — {replay.discovery.duplicateRelationships.reason}</dd>
        </div>
      </dl>
      <p className="provenance-card__boundary">
        The canonical source hash identifies one source payload; it is not a duplicate-group ID.
        Coordinate quality is <code>{result.coordinateQuality}</code>.
      </p>

      <details className="query-associations">
        <summary>
          Inspect all {result.associationCount.toLocaleString('en-US')} query associations
        </summary>
        <ol aria-label="Discovery query associations">
          {result.associations.map((association) => (
            <li key={association.queryHash}>
              <dl>
                <div>
                  <dt>Rank / type</dt>
                  <dd>{association.rank.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                  <dt>Keyword</dt>
                  <dd>{association.keyword}</dd>
                </div>
                <div>
                  <dt>Trust tier</dt>
                  <dd>{association.trustTier}</dd>
                </div>
                <div>
                  <dt>Search field</dt>
                  <dd>{association.searchField}</dd>
                </div>
                <div className="query-associations__hash">
                  <dt>Query hash</dt>
                  <dd>
                    <code>{association.queryHash}</code>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </details>

      <details className="provenance-card__artifacts">
        <summary>Inspect verified source artifacts</summary>
        <ul aria-label="Discovery source artifacts">
          {result.artifacts.map((artifact) => (
            <li key={artifact.artifactId}>
              <strong>{artifact.artifactId}</strong>
              <code>{artifact.sha256}</code>
              <span>{artifact.recordCount?.toLocaleString('en-US')} rows</span>
              <span>BioMiner {artifact.producerSha}</span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  )
}

function UnavailableFact({ label }: { readonly label: string }) {
  return (
    <div data-availability="unavailable">
      <dt>{label}</dt>
      <dd>Unavailable — not present in the verified discovery artifacts for this record.</dd>
    </div>
  )
}
