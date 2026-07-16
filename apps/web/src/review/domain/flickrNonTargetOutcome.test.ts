import { describe, expect, it } from 'vitest'

import {
  EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT,
  flickrNonTargetDecisionFields,
  validateFlickrNonTargetOutcomeDraft,
} from './flickrNonTargetOutcome'

describe('Flickr non-target outcome fields', () => {
  it('requires one closed category before recording No', () => {
    expect(
      validateFlickrNonTargetOutcomeDraft(
        EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT,
      ),
    ).toEqual(['Choose what the image shows before recording No.'])
    expect(() =>
      flickrNonTargetDecisionFields(
        EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT,
        'no',
      ),
    ).toThrow('Invalid Flickr No outcome')
  })

  it('binds a named taxon only to Alternative species', () => {
    expect(
      flickrNonTargetDecisionFields(
        {
          category: 'alternative_species',
          alternativeAcceptedTaxonKey: 'gbif:1938224',
          alternativeScientificName: 'Papilio polytes',
        },
        'no',
      ),
    ).toEqual({
      nonTargetCategory: 'alternative_species',
      alternativeTaxon: {
        acceptedTaxonKey: 'gbif:1938224',
        scientificName: 'Papilio polytes',
        commonName: null,
        rank: 'species',
        authority: null,
      },
    })
    expect(
      validateFlickrNonTargetOutcomeDraft({
        category: 'other_butterfly',
        alternativeAcceptedTaxonKey: 'gbif:1938224',
        alternativeScientificName: 'Papilio polytes',
      }),
    ).toEqual([
      'A named taxon is only allowed for the Alternative species outcome.',
    ])
  })

  it('clears non-target fields for outcomes other than No', () => {
    expect(
      flickrNonTargetDecisionFields(
        {
          category: 'other_insect',
          alternativeAcceptedTaxonKey: '',
          alternativeScientificName: '',
        },
        'cant_tell',
      ),
    ).toEqual({
      nonTargetCategory: null,
      alternativeTaxon: null,
    })
  })
})
