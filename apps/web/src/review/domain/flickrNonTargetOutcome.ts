import type { HumanReviewDecisionInput, HumanReviewOutcome } from './reviewSession'
import type { FlickrNonTargetCategory } from './verificationEvents'

export interface FlickrNonTargetOutcomeDraft {
  readonly category: FlickrNonTargetCategory | ''
  readonly alternativeAcceptedTaxonKey: string
  readonly alternativeScientificName: string
}

export const EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT: FlickrNonTargetOutcomeDraft =
  Object.freeze({
    category: '',
    alternativeAcceptedTaxonKey: '',
    alternativeScientificName: '',
  })

export function validateFlickrNonTargetOutcomeDraft(
  draft: FlickrNonTargetOutcomeDraft,
): readonly string[] {
  const failures: string[] = []
  if (draft.category === '') {
    failures.push('Choose what the image shows before recording No.')
    return Object.freeze(failures)
  }
  const acceptedTaxonKey = draft.alternativeAcceptedTaxonKey.trim()
  const scientificName = draft.alternativeScientificName.trim()
  if (draft.category === 'alternative_species') {
    if (acceptedTaxonKey === '' || scientificName === '') {
      failures.push(
        'Alternative species requires an accepted taxon key and scientific name.',
      )
    }
  } else if (acceptedTaxonKey !== '' || scientificName !== '') {
    failures.push(
      'A named taxon is only allowed for the Alternative species outcome.',
    )
  }
  return Object.freeze(failures)
}

export function flickrNonTargetDecisionFields(
  draft: FlickrNonTargetOutcomeDraft,
  outcome: HumanReviewOutcome,
): Pick<
  HumanReviewDecisionInput,
  'nonTargetCategory' | 'alternativeTaxon'
> {
  if (outcome !== 'no') {
    return Object.freeze({
      nonTargetCategory: null,
      alternativeTaxon: null,
    })
  }
  const failures = validateFlickrNonTargetOutcomeDraft(draft)
  if (failures.length > 0 || draft.category === '') {
    throw new Error(`Invalid Flickr No outcome: ${failures.join(' ')}`)
  }
  return Object.freeze({
    nonTargetCategory: draft.category,
    alternativeTaxon:
      draft.category === 'alternative_species'
        ? Object.freeze({
            acceptedTaxonKey: draft.alternativeAcceptedTaxonKey.trim(),
            scientificName: draft.alternativeScientificName.trim(),
            commonName: null,
            rank: 'species',
            authority: null,
          })
        : null,
  })
}

export function flickrNonTargetCategoryLabel(
  category: FlickrNonTargetCategory,
): string {
  switch (category) {
    case 'alternative_species':
      return 'Alternative species'
    case 'other_butterfly':
      return 'Other butterfly'
    case 'other_insect':
      return 'Other insect'
    case 'artifact':
      return 'Artifact'
    case 'specimen':
      return 'Specimen'
    case 'no_organism':
      return 'No organism'
    case 'insufficient_visual_detail':
      return 'Insufficient visual detail'
  }
}
