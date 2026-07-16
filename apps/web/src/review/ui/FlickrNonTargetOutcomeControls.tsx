import { useId } from 'react'

import {
  FLICKR_NON_TARGET_CATEGORIES,
  flickrNonTargetCategoryLabel,
  type FlickrNonTargetCategory,
  type FlickrNonTargetOutcomeDraft,
} from '../domain'

export function FlickrNonTargetOutcomeControls({
  draft,
  onChange,
}: {
  readonly draft: FlickrNonTargetOutcomeDraft
  readonly onChange: (draft: FlickrNonTargetOutcomeDraft) => void
}) {
  const groupName = useId()
  return (
    <fieldset className="flickr-non-target">
      <legend>If No, what does the image show?</legend>
      <p>
        Choose one structured outcome. The optional comment can still capture
        visible details or uncertainty.
      </p>
      <div
        className="flickr-non-target__options"
        role="radiogroup"
        aria-label="Flickr non-target outcome"
      >
        {FLICKR_NON_TARGET_CATEGORIES.map((category) => (
          <label key={category}>
            <input
              type="radio"
              name={groupName}
              value={category}
              checked={draft.category === category}
              onChange={() => onChange(withCategory(draft, category))}
            />
            <span>{flickrNonTargetCategoryLabel(category)}</span>
          </label>
        ))}
      </div>
      {draft.category === 'alternative_species' && (
        <div className="flickr-non-target__taxon">
          <label>
            Accepted taxon key
            <input
              type="text"
              value={draft.alternativeAcceptedTaxonKey}
              placeholder="e.g. gbif:1938224"
              onChange={(event) =>
                onChange({
                  ...draft,
                  alternativeAcceptedTaxonKey: event.target.value,
                })
              }
            />
          </label>
          <label>
            Scientific name
            <input
              type="text"
              value={draft.alternativeScientificName}
              placeholder="e.g. Papilio polytes"
              onChange={(event) =>
                onChange({
                  ...draft,
                  alternativeScientificName: event.target.value,
                })
              }
            />
          </label>
        </div>
      )}
    </fieldset>
  )
}

function withCategory(
  draft: FlickrNonTargetOutcomeDraft,
  category: FlickrNonTargetCategory,
): FlickrNonTargetOutcomeDraft {
  return Object.freeze({
    ...draft,
    category,
    ...(category === 'alternative_species'
      ? {}
      : {
          alternativeAcceptedTaxonKey: '',
          alternativeScientificName: '',
        }),
  })
}
