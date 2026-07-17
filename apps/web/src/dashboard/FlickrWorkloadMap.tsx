import { useState } from 'react'

import type { EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import type { GeographicWorkloadInput, GeographicWorkloadResult } from './geographicWorkload'
import { projectWorkloadPoint, workloadMarkerRadius } from './workloadMapProjection'

export type GeographicWorkloadExecutor = (
  input: GeographicWorkloadInput,
) => Promise<GeographicWorkloadResult>

const defaultGeographicWorkloadExecutor: GeographicWorkloadExecutor = async (input) => {
  const module = await import('./geographicWorkload')
  return module.executeGeographicWorkload(input)
}

type WorkloadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly result: GeographicWorkloadResult }

export function FlickrWorkloadMap({
  execute = defaultGeographicWorkloadExecutor,
  facade,
  replay,
}: {
  readonly execute?: GeographicWorkloadExecutor
  readonly facade: EvidenceFacade
  readonly replay: ReplayEvidence
}) {
  const [state, setState] = useState<WorkloadState>({ kind: 'idle' })
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const boundary = replay.geographyReference

  const loadMap = () => {
    setState({ kind: 'running' })
    void (async () => {
      try {
        const result = await execute(facade.loadGeographicWorkloadInput())
        setSelectedClusterId(result.clusters[0]?.id ?? null)
        setState({ kind: 'ready', result })
      } catch (reason: unknown) {
        setState({
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The candidate workload map could not be prepared.',
        })
      }
    })()
  }

  const result = state.kind === 'ready' ? state.result : null
  const selectedCluster =
    result?.clusters.find(({ id }) => id === selectedClusterId) ?? result?.clusters[0] ?? null

  return (
    <section className="geographic-workload" aria-labelledby="geographic-workload-title">
      <div className="geographic-workload__heading">
        <div>
          <p className="eyebrow">Candidate acquisition geography</p>
          <h3 id="geographic-workload-title">Geographic workload map</h3>
          <p>
            Plot checksum-verified cluster centroids as candidate workload. No point is a confirmed
            occurrence, and no external basemap or tile request is used.
          </p>
        </div>
        <button type="button" disabled={state.kind === 'running'} onClick={loadMap}>
          {state.kind === 'running'
            ? 'Loading local clusters…'
            : state.kind === 'ready'
              ? 'Reload local workload'
              : 'Load verified workload map'}
        </button>
      </div>

      <EvidenceState state="review" title="Candidate distribution only">
        Cluster radius is a dispersion summary, not coordinate uncertainty. H3 identities and
        per-cluster review density are not committed.
      </EvidenceState>

      <dl className="geographic-workload__metrics" aria-label="Geographic workload summary">
        <Metric
          label="Candidate clusters"
          value={boundary.geography.locatedClusterCount.toLocaleString('en-US')}
          detail="located centroid clusters"
          source="geographic-clusters"
        />
        <Metric
          label="No-geo"
          value={result === null ? 'Verify locally' : result.noGeoRecordCount.toLocaleString('en-US')}
          detail="records without usable coordinates"
          source="biominer-flickr-geo-assignments-parquet"
        />
        <Metric
          label="Unassigned geotags"
          value={boundary.geography.unassignedGeotaggedRecordCount.toLocaleString('en-US')}
          detail="geotagged candidate records"
          source="geographic-clusters"
        />
        <Metric
          label="Outliers"
          value={boundary.geography.outlierRecordCount.toLocaleString('en-US')}
          detail="assignment rows flagged as outliers"
          source="geographic-clusters"
        />
        <Metric
          label="Reference shortfalls"
          value={`${boundary.reference.sourceCandidateShortfall} source · ${boundary.reference.humanVerifiedShortfall} review`}
          detail="aggregate shortfalls; not per cluster"
          source="reference-shortfalls"
        />
        <Metric
          label="Review density"
          value="Unavailable"
          detail="no geographic review assignments"
          source="comments / review queue unavailable"
        />
      </dl>

      {state.kind === 'idle' ? (
        <EvidenceState state="review" title="Cluster payload not yet queried">
          Two verified BioMiner Parquets are ready; DuckDB-Wasm remains stopped until the map action.
        </EvidenceState>
      ) : state.kind === 'running' ? (
        <EvidenceState state="loading" title="Reading candidate workload locally">
          Verifying cluster, no-geo, unassigned, and outlier counts in a temporary browser worker.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="failure" title="Workload map stopped">
          {state.message}
        </EvidenceState>
      ) : (
        <WorkloadMap result={state.result} selected={selectedCluster} onSelect={setSelectedClusterId} />
      )}
    </section>
  )
}

function Metric({
  detail,
  label,
  source,
  value,
}: {
  readonly detail: string
  readonly label: string
  readonly source: string
  readonly value: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{detail}</small>
      <code>{source}</code>
    </div>
  )
}

function WorkloadMap({
  onSelect,
  result,
  selected,
}: {
  readonly onSelect: (clusterId: string) => void
  readonly result: GeographicWorkloadResult
  readonly selected: GeographicWorkloadResult['clusters'][number] | null
}) {
  const maximum = Math.max(...result.clusters.map(({ memberImageCount }) => memberImageCount))

  return (
    <div className="geographic-workload__ready" aria-live="polite">
      <EvidenceState state="available" title="Candidate workload plotted locally">
        {result.locatedClusterCount} centroids and {result.assignmentRecordCount.toLocaleString('en-US')}{' '}
        assignments agree with the verified BioMiner summaries.
      </EvidenceState>

      <div className="geographic-workload__map-layout">
        <figure aria-labelledby="workload-map-caption">
          <svg
            viewBox="0 0 360 180"
            role="img"
            aria-label={`${result.locatedClusterCount} candidate workload cluster centroids on an equirectangular coordinate plane`}
          >
            <rect x="0" y="0" width="360" height="180" />
            {[60, 120, 180, 240, 300].map((x) => (
              <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="180" />
            ))}
            {[45, 90, 135].map((y) => (
              <line key={`y-${y}`} x1="0" y1={y} x2="360" y2={y} />
            ))}
            {result.clusters.map((cluster) => {
              const point = projectWorkloadPoint(cluster.latitude, cluster.longitude)
              const isSelected = cluster.id === selected?.id
              return (
                <circle
                  key={cluster.id}
                  data-cluster="candidate-workload"
                  data-selected={isSelected ? 'true' : 'false'}
                  cx={point.x}
                  cy={point.y}
                  r={workloadMarkerRadius(cluster.memberImageCount, maximum)}
                />
              )
            })}
          </svg>
          <figcaption id="workload-map-caption">
            Marker area encodes candidate-record workload. The selected outline is not an
            uncertainty ring. Longitude spans −180° to 180°; latitude spans 90° to −90°.
          </figcaption>
        </figure>

        <section className="geographic-workload__inspection" aria-labelledby="cluster-inspection-title">
          <label>
            Inspect candidate cluster
            <select
              value={selected?.id ?? ''}
              onChange={(event) => onSelect(event.currentTarget.value)}
            >
              {result.clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.id} · {cluster.memberImageCount} candidates
                </option>
              ))}
            </select>
          </label>
          <h4 id="cluster-inspection-title">Selected workload cluster</h4>
          {selected === null ? null : (
            <dl>
              <div>
                <dt>Cluster</dt>
                <dd><code>{selected.id}</code></dd>
              </div>
              <div>
                <dt>Centroid</dt>
                <dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd>
              </div>
              <div>
                <dt>Candidate workload</dt>
                <dd>{selected.memberImageCount.toLocaleString('en-US')} records</dd>
              </div>
              <div>
                <dt>Coarse cells</dt>
                <dd>{selected.memberCellCount.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Outlier workload</dt>
                <dd>{selected.outlierRecordCount.toLocaleString('en-US')} records</dd>
              </div>
              <div>
                <dt>P95 dispersion</dt>
                <dd>{selected.radiusP95Km.toFixed(3)} km · not uncertainty</dd>
              </div>
              <div data-availability="unavailable">
                <dt>H3 identity</dt>
                <dd>Unavailable — no H3 output committed</dd>
              </div>
              <div data-availability="unavailable">
                <dt>Review density</dt>
                <dd>Unavailable — {result.reviewDensityReason}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>

      <details className="geographic-workload__table">
        <summary>Read all {result.clusters.length} candidate clusters as a table</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Cluster</th>
                <th scope="col">Centroid</th>
                <th scope="col">Candidates</th>
                <th scope="col">Outliers</th>
                <th scope="col">P95 dispersion</th>
              </tr>
            </thead>
            <tbody>
              {result.clusters.map((cluster) => (
                <tr key={cluster.id}>
                  <th scope="row"><code>{cluster.id}</code></th>
                  <td>{cluster.latitude.toFixed(6)}, {cluster.longitude.toFixed(6)}</td>
                  <td>{cluster.memberImageCount.toLocaleString('en-US')}</td>
                  <td>{cluster.outlierRecordCount.toLocaleString('en-US')}</td>
                  <td>{cluster.radiusP95Km.toFixed(3)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="geographic-workload__provenance">
        <summary>Inspect workload-map provenance</summary>
        <ul>
          {result.artifacts.map((artifact) => (
            <li key={artifact.artifactId}>
              <strong>{artifact.artifactId}</strong>
              <span>{artifact.path} · {artifact.recordCount?.toLocaleString('en-US')} rows</span>
              <code>{artifact.sha256}</code>
              <small>Producer {artifact.producerSha}</small>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
