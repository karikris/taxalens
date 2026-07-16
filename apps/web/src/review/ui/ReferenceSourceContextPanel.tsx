import type { VerificationItem } from '../domain'

export function ReferenceSourceContextPanel({
  campaignTargetAcceptedTaxonKey,
  item,
}: {
  readonly campaignTargetAcceptedTaxonKey: string | null
  readonly item: VerificationItem
}) {
  const provenance = item.sourceProvenance
  return (
    <section
      className="reference-source-context"
      aria-labelledby="reference-source-context-title"
    >
      <div>
        <p className="eyebrow">Source context</p>
        <h3 id="reference-source-context-title">
          Candidate provenance, not a verified identity
        </h3>
        <p>
          Provider labels and location metadata help review this image. They do
          not answer the taxonomic question for the reviewer.
        </p>
      </div>
      <dl>
        <ContextFact label="Provider">
          {provenance?.providerLabel ?? sourceProviderLabel(item.source)}
          {provenance?.originalProvider === null ||
          provenance?.originalProvider === undefined
            ? ''
            : ` · original ${provenance.originalProvider}`}
        </ContextFact>
        <ContextFact label="Accepted TaxaLens taxon">
          <i>{item.targetTaxon.scientificName}</i>{' '}
          <code>{item.targetTaxon.acceptedTaxonKey}</code>
        </ContextFact>
        <ContextFact label="Source observation">
          <a href={item.rights.sourceUri} target="_blank" rel="noreferrer">
            {provenance?.sourceObservationId ?? item.sourceObservationId}
          </a>
        </ContextFact>
        <ContextFact label="Provider media ID">
          {provenance?.providerMediaId ?? item.sourceMediaId}
        </ContextFact>
        <ContextFact label="Media licence">
          <a href={item.rights.licenseUri} target="_blank" rel="noreferrer">
            {item.rights.licenseName}
          </a>
        </ContextFact>
        <ContextFact label="Occurrence licence">
          {provenance?.occurrenceLicense ?? 'Unavailable'}
        </ContextFact>
        <ContextFact label="Attribution">
          {item.rights.attribution}
        </ContextFact>
        <ContextFact label="Observer">
          {provenance?.observerId ?? item.rights.creator ?? 'Unavailable'}
        </ContextFact>
        <ContextFact label="Location">
          {sourceLocation(item)}
        </ContextFact>
        <ContextFact label="Source date">
          {sourceDate(provenance?.observedAt ?? null)}
        </ContextFact>
        <ContextFact label="Duplicate group">
          <code>{item.duplicateGroupId}</code>
        </ContextFact>
        <ContextFact label="Fallback level">
          {fallbackLabel(provenance?.fallbackLevel)}
        </ContextFact>
        <ContextFact label="Route expectation">
          {referenceRouteExpectation(
            item,
            campaignTargetAcceptedTaxonKey,
          )}
        </ContextFact>
        <ContextFact label="Provider verification state">
          {provenance?.providerVerificationStatus ??
            item.providerSuppliedIdentity.verificationStatus ??
            'Unavailable'}
        </ContextFact>
      </dl>
    </section>
  )
}

export function referenceRouteExpectation(
  item: VerificationItem,
  campaignTargetAcceptedTaxonKey: string | null,
): string {
  const relationship =
    campaignTargetAcceptedTaxonKey === null
      ? 'Reference'
      : item.targetTaxon.acceptedTaxonKey ===
          campaignTargetAcceptedTaxonKey
        ? 'Target'
        : 'Competitor'
  const visualRoute =
    item.expectedVisualDomain === 'pinned_specimen'
      ? 'specimen identity review'
      : item.expectedVisualDomain === 'live_field'
        ? 'live-field identity review'
        : 'manual visual-domain review'
  return `${relationship} · ${visualRoute}`
}

function ContextFact({
  children,
  label,
}: {
  readonly children: React.ReactNode
  readonly label: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function sourceLocation(item: VerificationItem): string {
  const geography = item.sourceProvenance?.geography
  if (geography === undefined) {
    return 'Unavailable in campaign manifest'
  }
  const place = [geography.locality, geography.country]
    .filter((value): value is string => value !== null)
    .join(', ')
  if (geography.coordinatesObscured) {
    return `${place || 'Location withheld'} · coordinates obscured`
  }
  if (geography.latitude !== null && geography.longitude !== null) {
    const coordinates = `${geography.latitude.toFixed(4)}, ${geography.longitude.toFixed(4)}`
    return place === '' ? coordinates : `${place} · ${coordinates}`
  }
  return place || 'Unavailable'
}

function sourceDate(value: string | null): string {
  if (value === null) {
    return 'Unavailable'
  }
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString().slice(0, 10)
    : 'Invalid source date'
}

function fallbackLabel(value: number | undefined): string {
  if (value === undefined) {
    return 'Unavailable'
  }
  return value === 0 ? '0 · direct provider route' : `${value} · fallback route`
}

function sourceProviderLabel(source: VerificationItem['source']): string {
  switch (source) {
    case 'gbif':
      return 'GBIF'
    case 'inaturalist':
      return 'iNaturalist'
    case 'wikimedia_commons':
      return 'Wikimedia Commons'
    case 'flickr':
      return 'Flickr'
    case 'taxalens_fixture':
      return 'TaxaLens fixture'
  }
}
