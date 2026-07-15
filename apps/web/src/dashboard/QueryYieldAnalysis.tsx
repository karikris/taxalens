import { useState } from 'react'

import type { EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { EvidenceState } from '../design-system'
import type { QueryYieldInput, QueryYieldRankRow, QueryYieldResult } from './queryYield'

export type QueryYieldExecutor = (input: QueryYieldInput) => Promise<QueryYieldResult>

const defaultQueryYieldExecutor: QueryYieldExecutor = async (input) => {
  const module = await import('./queryYield')
  return module.executeQueryYield(input)
}

type QueryYieldState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly result: QueryYieldResult }

export function QueryYieldAnalysis({
  execute = defaultQueryYieldExecutor,
  facade,
  replay,
}: {
  readonly execute?: QueryYieldExecutor
  readonly facade: EvidenceFacade
  readonly replay: ReplayEvidence
}) {
  const [state, setState] = useState<QueryYieldState>({ kind: 'idle' })
  const globalAdultRouteCount = replay.observatory.yoloeImageCount
  const globalEvidenceRecordCount = replay.observatory.finalEvidenceCount
  if (globalAdultRouteCount !== 0 || globalEvidenceRecordCount !== 0) {
    throw new Error('Query-yield analysis requires the verified zero-output routing boundary')
  }

  const measureYield = () => {
    setState({ kind: 'running' })
    void (async () => {
      try {
        const artifact = facade
          .loadAnalyticsReplayInput()
          .artifacts.find(({ artifactId }) => artifactId === 'biominer-flickr-query-hits-parquet')
        if (artifact === undefined) {
          throw new Error('Verified Flickr query-hit Parquet is unavailable')
        }
        const result = await execute({
          artifact,
          expectedQueryHitCount: replay.observatory.flickrQueryHitCount,
          expectedUniqueImageCount: replay.observatory.canonicalPhotoCount,
          globalAdultRouteCount,
          globalEvidenceRecordCount,
        })
        setState({ kind: 'ready', result })
      } catch (reason: unknown) {
        setState({
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The query-yield analysis could not be prepared.',
        })
      }
    })()
  }

  return (
    <section className="query-yield" aria-labelledby="query-yield-title">
      <div className="query-yield__heading">
        <div>
          <p className="eyebrow">Discovery acquisition analysis</p>
          <h3 id="query-yield-title">Query yield by taxonomic tier</h3>
          <p>
            Measure rank-attributed query-hit associations and unique source photos. Logical
            definitions, physical requests, and API cost remain unavailable without their ledgers.
          </p>
        </div>
        <button type="button" disabled={state.kind === 'running'} onClick={measureYield}>
          {state.kind === 'running'
            ? 'Measuring local yield…'
            : state.kind === 'ready'
              ? 'Rerun local yield'
              : 'Measure verified discovery yield'}
        </button>
      </div>

      <EvidenceState state="review" title="Partial rank attribution · no occurrence claim">
        Only direct BioMiner family, genus, and scientific-name tier prefixes are assigned. Search
        context, common names, and other discovery terms are not forced into a taxonomic rank.
      </EvidenceState>

      <dl className="query-yield__summary" aria-label="Discovery-yield source boundary">
        <SummaryMetric
          label="Query hits"
          value={replay.observatory.flickrQueryHitCount.toLocaleString('en-US')}
          detail="query associations"
        />
        <SummaryMetric
          label="Unique source photos"
          value={replay.observatory.canonicalPhotoCount.toLocaleString('en-US')}
          detail="canonical source identities"
        />
        <SummaryMetric
          label="Adult routes"
          value={globalAdultRouteCount.toLocaleString('en-US')}
          detail="global verified boundary"
        />
        <SummaryMetric
          label="Evidence records"
          value={globalEvidenceRecordCount.toLocaleString('en-US')}
          detail="global verified boundary"
        />
        <SummaryMetric label="Physical requests" value="Unavailable" detail="ledger absent" />
        <SummaryMetric label="Marginal API cost" value="Unavailable" detail="cost basis absent" />
      </dl>

      {state.kind === 'idle' ? (
        <EvidenceState state="review" title="Rank slices not yet queried">
          The verified query-hit Parquet is ready; the local worker stays stopped until requested.
        </EvidenceState>
      ) : state.kind === 'running' ? (
        <EvidenceState state="loading" title="Measuring rank-attributed discovery yield">
          Reading one local Parquet and cross-checking every hit and canonical source identity.
        </EvidenceState>
      ) : state.kind === 'error' ? (
        <EvidenceState state="failure" title="Query-yield analysis stopped">
          {state.message}
        </EvidenceState>
      ) : (
        <QueryYieldResults result={state.result} />
      )}
    </section>
  )
}

function SummaryMetric({
  detail,
  label,
  value,
}: {
  readonly detail: string
  readonly label: string
  readonly value: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{detail}</small>
    </div>
  )
}

function QueryYieldResults({ result }: { readonly result: QueryYieldResult }) {
  return (
    <div className="query-yield__results" aria-live="polite">
      <EvidenceState state="available" title="Measured rank slices ready">
        All {result.queryHitCount.toLocaleString('en-US')} associations are partitioned between three
        direct rank tiers and one explicitly unassigned context bucket. Unique-photo counts overlap
        between slices and must not be added.
      </EvidenceState>

      <div className="query-yield__table">
        <table>
          <caption>
            Discovery yield by canonical taxonomic rank. Unavailable is not interpreted as zero.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Logical queries</th>
              <th scope="col">Physical requests</th>
              <th scope="col">Hits</th>
              <th scope="col">Unique images</th>
              <th scope="col">Adult routes</th>
              <th scope="col">Evidence records</th>
              <th scope="col">Marginal API cost</th>
            </tr>
          </thead>
          <tbody>
            {result.ranks.map((row) => (
              <RankYieldTableRow key={row.rank} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <aside className="query-yield__context" aria-labelledby="query-context-title">
        <div>
          <p className="eyebrow">Not a taxonomic rank</p>
          <h4 id="query-context-title">Unassigned context tiers</h4>
          <p>
            Common-name, regional-synonym, host-plant, life-stage, pest-context,
            comment-derived, and broad-butterfly terms remain separate.
          </p>
        </div>
        <dl>
          <div>
            <dt>Hit associations</dt>
            <dd>{result.context.hitCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Unique source photos</dt>
            <dd>{result.context.uniqueImageCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Represented terms</dt>
            <dd>{result.context.representedSearchTermCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Represented hashes</dt>
            <dd>{result.context.representedQueryHashCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Term classes</dt>
            <dd>{result.context.termClassCount.toLocaleString('en-US')}</dd>
          </div>
        </dl>
      </aside>

      <details className="query-yield__alternative">
        <summary>Read the complete rank-yield interpretation</summary>
        <ol>
          {result.ranks.map((row) => (
            <li key={row.rank}>
              <strong>{row.label}:</strong>{' '}
              {row.status === 'measured'
                ? `${row.hitCount?.toLocaleString('en-US')} query-hit associations and ${row.uniqueImageCount?.toLocaleString('en-US')} unique source photos within the slice; ${row.representedSearchTermCount} represented search terms and ${row.representedQueryHashCount} represented hashes are diagnostics, not authoritative logical or physical request counts.`
                : 'rank-attributed hits and unique photos are unavailable because no direct tier is committed.'}{' '}
              Logical queries, physical requests, rank-level adult routes, rank-level evidence records,
              and marginal API cost are unavailable. The fixture-wide adult-route and evidence-record
              totals are both verified zero.
            </li>
          ))}
        </ol>
      </details>

      <details className="query-yield__provenance">
        <summary>Inspect query-yield provenance</summary>
        <div>
          <strong>{result.artifact.artifactId}</strong>
          <span>
            {result.artifact.path} · {result.artifact.recordCount?.toLocaleString('en-US')} rows
          </span>
          <code>{result.artifact.sha256}</code>
          <small>Producer {result.artifact.producerSha}</small>
        </div>
      </details>
    </div>
  )
}

function RankYieldTableRow({ row }: { readonly row: QueryYieldRankRow }) {
  const unavailableRank = row.status === 'unavailable'
  return (
    <tr data-rank={row.rank} data-rank-status={row.status}>
      <th scope="row">
        <strong>{row.label}</strong>
        {row.sourceTier === null ? (
          <small>No direct BioMiner tier</small>
        ) : (
          <>
            <code>{row.sourceTier}</code>
            <small>
              {row.representedSearchTermCount} represented terms ·{' '}
              {row.representedQueryHashCount} represented hashes
            </small>
          </>
        )}
      </th>
      <UnavailableCell reason="definition IDs absent" />
      <UnavailableCell reason="request ledger absent" />
      {unavailableRank ? (
        <UnavailableCell reason="no direct rank tier" />
      ) : (
        <MeasuredCell value={row.hitCount!} unit="associations" />
      )}
      {unavailableRank ? (
        <UnavailableCell reason="no direct rank tier" />
      ) : (
        <MeasuredCell value={row.uniqueImageCount!} unit="slice-local · non-additive" />
      )}
      <GlobalZeroCell label="adult routes" />
      <GlobalZeroCell label="evidence records" />
      <UnavailableCell reason="cost basis absent" />
    </tr>
  )
}

function MeasuredCell({ value, unit }: { readonly unit: string; readonly value: number }) {
  return (
    <td data-value-status="measured">
      <strong>{value.toLocaleString('en-US')}</strong>
      <small>{unit}</small>
    </td>
  )
}

function UnavailableCell({ reason }: { readonly reason: string }) {
  return (
    <td data-value-status="unavailable">
      <strong>Unavailable</strong>
      <small>{reason}</small>
    </td>
  )
}

function GlobalZeroCell({ label }: { readonly label: string }) {
  return (
    <td data-value-status="global-zero">
      <strong>0 globally</strong>
      <small>not {label} by rank</small>
    </td>
  )
}
