import type { CSSProperties, ReactNode } from 'react'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceDesignation, EvidenceState, EvidenceTier } from '../design-system'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'
import {
  buildGeographyReferenceModel,
  type GeographyReferenceModel,
} from './geographyReferenceModel'
import { RecordGeographicMiniMap } from './RecordGeographicMiniMap'
import { RecordGeographicFacts } from './RecordGeographicFacts'
import type { RecordGeographicContextLoadState } from './recordGeographicContext'

export function GeographyReferenceContext({
  inspectionStatus,
  recordGeography,
  replay,
  result,
}: {
  readonly inspectionStatus: GeographyReferenceModel['inspectionStatus']
  readonly recordGeography: RecordGeographicContextLoadState
  readonly replay: ReplayEvidence
  readonly result: DiscoveryProvenanceResult | null
}) {
  const model = buildGeographyReferenceModel(replay, result, inspectionStatus)
  const ready = model.coordinate.status === 'metadata' && model.cluster.status === 'metadata'

  return (
    <section className="geography-reference" aria-labelledby="geography-reference-title">
      <div className="geography-reference__heading">
        <div>
          <p className="eyebrow">Geography and reference context</p>
          <h3 id="geography-reference-title">Candidate location, not occurrence</h3>
          <p>
            One deterministic search candidate can be located and clustered after local
            inspection. Its coordinate never verifies the photographed species.
          </p>
        </div>
        <EvidenceDesignation kind="candidate" label="Search candidate — not occurrence" />
      </div>

      {ready ? (
        <EvidenceState state="available" title="Candidate geography traced locally">
          Four checksum-verified BioMiner Parquets resolve source, coordinate, assignment, and
          cluster metadata. Scientific claim remains not allowed.
        </EvidenceState>
      ) : (
        <EvidenceState
          state={
            inspectionStatus === 'running'
              ? 'loading'
              : inspectionStatus === 'error'
                ? 'failure'
                : 'review'
          }
          title={
            inspectionStatus === 'running'
              ? 'Loading local geography'
              : 'Candidate coordinate not loaded'
          }
        >
          Use the verified discovery inspection above. No live map or network request is made.
        </EvidenceState>
      )}

      <div className="geography-reference__geography">
        {recordGeography.status === 'available' ? (
          <RecordGeographicMiniMap context={recordGeography.context} />
        ) : (
          <CoordinatePlane
            model={model}
            status={recordGeography.status}
            failureMessage={recordGeography.status === 'failure' ? recordGeography.message : null}
          />
        )}
        <dl className="geography-reference__facts">
          <Fact label="Candidate coordinate">
            {model.coordinate.status === 'metadata'
              ? `${model.coordinate.latitude.toFixed(6)}, ${model.coordinate.longitude.toFixed(6)}`
              : 'Unavailable until local inspection'}
          </Fact>
          <Fact label="Uncertainty">
            <strong>Unavailable in metres.</strong> {model.uncertainty.reason}
          </Fact>
          <Fact label="Cluster">
            {model.cluster.status === 'metadata' ? (
              <>
                <code>{model.cluster.id}</code>
                <span>
                  {model.cluster.memberImageCount.toLocaleString('en-US')} candidates ·{' '}
                  {model.cluster.memberCellCount} cells · P95 radius{' '}
                  {model.cluster.radiusP95Km.toFixed(3)} km
                </span>
              </>
            ) : (
              'Unavailable until local inspection'
            )}
          </Fact>
          <Fact label="Fallback">
            {model.fallback.selectedRecordStatus === 'pending'
              ? 'Pending inspection.'
              : model.fallback.selectedRecordStatus === 'not_used'
                ? `Not used for this record. ${model.fallback.summaryFallbackClusterCount} fallback cluster exists in the summary.`
                : `Used: ${model.fallback.selectedScope}`}
          </Fact>
        </dl>
      </div>

      {recordGeography.status === 'available' ? (
        <RecordGeographicFacts context={recordGeography.context} />
      ) : null}

      <div className="geography-reference__evidence">
        <ReferenceCard
          designation={model.targetEvidence.status === 'metadata' ? 'Metadata only' : 'Unavailable'}
          detail={model.targetEvidence.reason}
          name={model.targetEvidence.scientificName}
          role="Target evidence"
          taxonKey={model.targetEvidence.acceptedTaxonKey}
        />
        <ReferenceCard
          designation="Unavailable"
          detail={model.competitorEvidence.reason}
          name={`${model.competitorEvidence.candidateCount} planning hypotheses`}
          role="Competitor evidence"
          taxonKey="No scored or reviewed competitor reference"
        />
      </div>

      <section
        className="geography-reference__shortfalls"
        aria-labelledby="reference-shortfalls-title"
      >
        <div>
          <p className="eyebrow">Reference readiness</p>
          <h4 id="reference-shortfalls-title">Reference shortfalls</h4>
          <p>Source candidates are metadata, not admitted reference images.</p>
        </div>
        <dl>
          <Metric
            label="Eligible source candidates"
            value={model.shortfalls.eligibleSourceMediaCount}
          />
          <Metric
            label="Human-verified images"
            value={model.shortfalls.humanVerifiedSourceMediaCount}
          />
          <Metric
            label="Source-candidate shortfall"
            value={model.shortfalls.sourceCandidateShortfall}
          />
          <Metric
            label="Human-verified shortfall"
            value={model.shortfalls.humanVerifiedShortfall}
          />
        </dl>
      </section>

      <div className="geography-reference__footer">
        <section aria-labelledby="geography-verification-title">
          <p className="eyebrow">Verification state</p>
          <h4 id="geography-verification-title">Metadata boundaries</h4>
          <dl>
            <Fact label="Geography">{model.verification.geography.replaceAll('_', ' ')}</Fact>
            <Fact label="Readiness">{model.verification.readiness.replaceAll('_', ' ')}</Fact>
            <Fact label="Shortfalls">{model.verification.shortfalls.replaceAll('_', ' ')}</Fact>
            <Fact label="Scientific claim">Not allowed</Fact>
          </dl>
        </section>
        <section aria-labelledby="geography-rights-title">
          <p className="eyebrow">Source and licence</p>
          <h4 id="geography-rights-title">Metadata rights only</h4>
          <dl>
            <Fact label="Candidate source">{model.sourceId ?? 'Pending local inspection'}</Fact>
            <Fact label="Metadata origin">{model.rights.sourceUrl}</Fact>
            <Fact label="Metadata licence">
              {model.rights.licenseName} · {model.rights.creatorOrOwner}
            </Fact>
            <Fact label="Image source and licence">
              Unavailable — {model.rights.includedImageCount} included and{' '}
              {model.rights.licensedImageCount} licensed images.
            </Fact>
          </dl>
        </section>
      </div>
    </section>
  )
}

function CoordinatePlane({
  failureMessage,
  model,
  status,
}: {
  readonly failureMessage: string | null
  readonly model: GeographyReferenceModel
  readonly status: RecordGeographicContextLoadState['status']
}) {
  if (model.coordinate.status !== 'metadata') {
    return (
      <div className="coordinate-plane" role="img" aria-label="Candidate coordinate unavailable">
        <strong>Coordinate plane unavailable</strong>
        <span>
          {status === 'failure'
            ? `Record mini-map unavailable: ${failureMessage}`
            : 'Run the local source inspection above.'}
        </span>
      </div>
    )
  }
  const markerStyle = {
    '--candidate-x': `${model.coordinate.mapXPercent}%`,
    '--candidate-y': `${model.coordinate.mapYPercent}%`,
  } as CSSProperties
  return (
    <figure className="coordinate-plane" aria-labelledby="coordinate-plane-caption">
      <div style={markerStyle}>
        <span aria-hidden="true" />
      </div>
      <figcaption id="coordinate-plane-caption">
        <strong>{status === 'loading' ? 'Loading record mini-map' : 'Candidate coordinate plane'}</strong>
        <span>
          {model.coordinate.latitude.toFixed(6)}, {model.coordinate.longitude.toFixed(6)} ·{' '}
          {model.coordinate.quality.replaceAll('_', ' ')} · Flickr accuracy level{' '}
          {model.coordinate.accuracyLevel}
        </span>
      </figcaption>
    </figure>
  )
}

function ReferenceCard({
  designation,
  detail,
  name,
  role,
  taxonKey,
}: {
  readonly designation: string
  readonly detail: string
  readonly name: string
  readonly role: string
  readonly taxonKey: string
}) {
  return (
    <article>
      <div className="geography-reference__image" role="img" aria-label={`${role} image unavailable`}>
        <EvidenceTier tier="unavailable" />
        <strong>No admitted reference image</strong>
      </div>
      <div>
        <p className="eyebrow">{role}</p>
        <h4>{name}</h4>
        <code>{taxonKey}</code>
        <strong>{designation}</strong>
        <p>{detail}</p>
      </div>
    </article>
  )
}

function Fact({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Metric({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value.toLocaleString('en-US')}</dd>
    </div>
  )
}
