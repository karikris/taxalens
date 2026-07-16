import type {
  HumanReviewOutcome,
  TaxonIdentity,
  VerificationConfidence,
  VerificationLifeStage,
  VerificationMediaQuality,
  VerificationView,
  VerificationVisualDomain,
} from '../domain'

export interface ReferenceReviewAnnotationDraft {
  readonly correctedLifeStage: VerificationLifeStage | ''
  readonly correctedVisualDomain: VerificationVisualDomain | ''
  readonly correctedView: VerificationView | ''
  readonly mediaQuality: VerificationMediaQuality
  readonly duplicateConcern: boolean
  readonly captiveOrCultivatedConcern: boolean
  readonly alternativeAcceptedTaxonKey: string
  readonly alternativeScientificName: string
  readonly exclusionReason: string
  readonly confidence: VerificationConfidence
}

export const EMPTY_REFERENCE_REVIEW_ANNOTATION_DRAFT: ReferenceReviewAnnotationDraft =
  Object.freeze({
    correctedLifeStage: '',
    correctedVisualDomain: '',
    correctedView: '',
    mediaQuality: 'unknown',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    alternativeAcceptedTaxonKey: '',
    alternativeScientificName: '',
    exclusionReason: '',
    confidence: 'unknown',
  })

export function StructuredReferenceReviewControls({
  draft,
  onChange,
}: {
  readonly draft: ReferenceReviewAnnotationDraft
  readonly onChange: (draft: ReferenceReviewAnnotationDraft) => void
}) {
  const update = <K extends keyof ReferenceReviewAnnotationDraft>(
    key: K,
    value: ReferenceReviewAnnotationDraft[K],
  ) => onChange(Object.freeze({ ...draft, [key]: value }))

  return (
    <details className="reference-review-annotations">
      <summary>Structured reference annotations</summary>
      <p>
        Optional corrections remain bound to this append-only review event.
        Provider labels and proposed dimensions are not treated as verified.
      </p>
      <div className="reference-review-annotations__grid">
        <label>
          Corrected life stage
          <select
            value={draft.correctedLifeStage}
            onChange={(event) =>
              update(
                'correctedLifeStage',
                event.target.value as ReferenceReviewAnnotationDraft['correctedLifeStage'],
              )
            }
          >
            <option value="">No correction</option>
            <option value="adult">Adult</option>
            <option value="larva">Larva</option>
            <option value="pupa">Pupa</option>
            <option value="egg">Egg</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Corrected visual domain
          <select
            value={draft.correctedVisualDomain}
            onChange={(event) =>
              update(
                'correctedVisualDomain',
                event.target.value as ReferenceReviewAnnotationDraft['correctedVisualDomain'],
              )
            }
          >
            <option value="">No correction</option>
            <option value="live_field">Live field</option>
            <option value="pinned_specimen">Pinned specimen</option>
            <option value="artwork">Artwork</option>
            <option value="logo">Logo</option>
            <option value="tattoo">Tattoo</option>
            <option value="partial_wing">Partial wing</option>
            <option value="dead_or_damaged_specimen">
              Dead or damaged specimen
            </option>
            <option value="ambiguous">Ambiguous</option>
            <option value="unsuitable">Unsuitable</option>
          </select>
        </label>
        <label>
          Corrected view
          <select
            value={draft.correctedView}
            onChange={(event) =>
              update(
                'correctedView',
                event.target.value as ReferenceReviewAnnotationDraft['correctedView'],
              )
            }
          >
            <option value="">No correction</option>
            <option value="dorsal">Dorsal</option>
            <option value="ventral">Ventral</option>
            <option value="lateral">Lateral</option>
            <option value="frontal">Frontal</option>
            <option value="oblique">Oblique</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Media quality
          <select
            value={draft.mediaQuality}
            onChange={(event) =>
              update(
                'mediaQuality',
                event.target.value as VerificationMediaQuality,
              )
            }
          >
            <option value="unknown">Unknown</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="unusable">Unusable</option>
          </select>
        </label>
        <label>
          Confidence
          <select
            value={draft.confidence}
            onChange={(event) =>
              update(
                'confidence',
                event.target.value as VerificationConfidence,
              )
            }
          >
            <option value="unknown">Unknown</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="reference-review-annotations__check">
          <input
            type="checkbox"
            checked={draft.duplicateConcern}
            onChange={(event) =>
              update('duplicateConcern', event.target.checked)
            }
          />
          Duplicate concern
        </label>
        <label className="reference-review-annotations__check">
          <input
            type="checkbox"
            checked={draft.captiveOrCultivatedConcern}
            onChange={(event) =>
              update('captiveOrCultivatedConcern', event.target.checked)
            }
          />
          Captive or cultivated concern
        </label>
        <label>
          Alternative accepted taxon key
          <input
            value={draft.alternativeAcceptedTaxonKey}
            placeholder="e.g. gbif:1234567"
            onChange={(event) =>
              update('alternativeAcceptedTaxonKey', event.target.value)
            }
          />
        </label>
        <label>
          Alternative scientific name
          <input
            value={draft.alternativeScientificName}
            placeholder="e.g. Papilio polytes"
            onChange={(event) =>
              update('alternativeScientificName', event.target.value)
            }
          />
        </label>
      </div>
      <label>
        Exclusion reason
        <textarea
          rows={3}
          value={draft.exclusionReason}
          placeholder="Wrong identity, unsuitable domain, damaged specimen, or another reason."
          onChange={(event) =>
            update('exclusionReason', event.target.value)
          }
        />
      </label>
    </details>
  )
}

export function validateReferenceReviewAnnotationDraft(
  draft: ReferenceReviewAnnotationDraft,
): readonly string[] {
  const failures: string[] = []
  const key = draft.alternativeAcceptedTaxonKey.trim()
  const name = draft.alternativeScientificName.trim()
  if ((key === '') !== (name === '')) {
    failures.push(
      'Alternative species requires both an accepted taxon key and scientific name.',
    )
  }
  if (key !== '' && !/^[a-z][a-z0-9_-]*:[A-Za-z0-9._-]+$/u.test(key)) {
    failures.push(
      'Alternative accepted taxon key must use a provider:key form.',
    )
  }
  return Object.freeze(failures)
}

export function referenceReviewEventFields(
  draft: ReferenceReviewAnnotationDraft,
  outcome: HumanReviewOutcome,
): {
  readonly alternativeTaxon: TaxonIdentity | null
  readonly correctedLifeStage: VerificationLifeStage | null
  readonly correctedVisualDomain: VerificationVisualDomain | null
  readonly correctedView: VerificationView | null
  readonly mediaQuality: VerificationMediaQuality
  readonly duplicateConcern: boolean
  readonly captiveOrCultivatedConcern: boolean
  readonly exclusionReason: string | null
  readonly confidence: VerificationConfidence
} {
  if (outcome === 'cant_view' || outcome === 'skipped') {
    return {
      alternativeTaxon: null,
      correctedLifeStage: null,
      correctedVisualDomain: null,
      correctedView: null,
      mediaQuality: 'unknown',
      duplicateConcern: false,
      captiveOrCultivatedConcern: false,
      exclusionReason: null,
      confidence: 'unknown',
    }
  }
  const key = draft.alternativeAcceptedTaxonKey.trim()
  const name = draft.alternativeScientificName.trim()
  return {
    alternativeTaxon:
      outcome === 'yes' || key === '' || name === ''
        ? null
        : {
            acceptedTaxonKey: key,
            scientificName: name,
            commonName: null,
            rank: 'species',
            authority: null,
          },
    correctedLifeStage: draft.correctedLifeStage || null,
    correctedVisualDomain: draft.correctedVisualDomain || null,
    correctedView: draft.correctedView || null,
    mediaQuality: draft.mediaQuality,
    duplicateConcern: draft.duplicateConcern,
    captiveOrCultivatedConcern: draft.captiveOrCultivatedConcern,
    exclusionReason: draft.exclusionReason.trim() || null,
    confidence: draft.confidence,
  }
}
