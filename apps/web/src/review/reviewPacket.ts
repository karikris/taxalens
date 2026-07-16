export const HUMAN_REVIEW_PACKET_SCHEMA_VERSION =
  'taxalens-human-review-packet:v1.0.0' as const

export interface HumanReviewItem {
  readonly itemId: string
  readonly imageUrl: string
  readonly imageSha256: string
  readonly imageByteCount: number
  readonly mediaType: 'image/jpeg'
  readonly verificationLabel: string
  readonly lifeStage: 'adult'
  readonly visualDomain: 'live_field'
  readonly view: 'dorsal' | 'ventral'
  readonly source: {
    readonly title: string
    readonly creator: string
    readonly sourceUrl: string
    readonly licenseName: 'CC BY-SA 4.0'
    readonly licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
  }
}

export interface HumanReviewPacket {
  readonly schemaVersion: typeof HUMAN_REVIEW_PACKET_SCHEMA_VERSION
  readonly packetId: 'papilio-demoleus-commons-review-v1'
  readonly target: {
    readonly acceptedTaxonKey: 'gbif:1938069'
    readonly scientificName: 'Papilio demoleus'
    readonly commonName: 'lime swallowtail'
  }
  readonly items: readonly HumanReviewItem[]
  readonly semantics: {
    readonly separateFromFrozenBioMinerReferenceBank: true
    readonly reviewerDecisionsAreLocalUntilExported: true
    readonly scientificClaimAllowed: false
  }
}

export const HUMAN_REVIEW_PACKET: HumanReviewPacket = Object.freeze({
  schemaVersion: HUMAN_REVIEW_PACKET_SCHEMA_VERSION,
  packetId: 'papilio-demoleus-commons-review-v1',
  target: Object.freeze({
    acceptedTaxonKey: 'gbif:1938069',
    scientificName: 'Papilio demoleus',
    commonName: 'lime swallowtail',
  }),
  items: Object.freeze([
    reviewItem({
      itemId: 'commons-papilio-demoleus-open-wing',
      asset: 'papilio-demoleus-open-wing.jpg',
      imageSha256: '47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
      imageByteCount: 180_698,
      verificationLabel:
        'Does this image show an adult Papilio demoleus (lime swallowtail) in dorsal view?',
      view: 'dorsal',
      title: 'Common Lime Butterfly Papilio demoleus UP by Kadavoor',
      creator: 'Jeevan Jose',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Common_Lime_Butterfly_Papilio_demoleus_UP_by_Kadavoor.jpg',
    }),
    reviewItem({
      itemId: 'commons-papilio-demoleus-closed-wing',
      asset: 'papilio-demoleus-closed-wing.jpg',
      imageSha256: '3bd3248347c3b82a977b0890f192f2f0c93253eff13d38b4b54dedb08b39627b',
      imageByteCount: 159_332,
      verificationLabel:
        'Does this image show an adult Papilio demoleus (lime swallowtail) in ventral view?',
      view: 'ventral',
      title:
        'Close wing position of Papilio demoleus, Linnaeus, 1758 – Lime Butterfly',
      creator: 'Sayan Sanyal',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Close_wing_position_of_Papilio_demoleus,_Linnaeus,_1758_%E2%80%93_Lime_Butterfly_WLB.jpg',
    }),
    reviewItem({
      itemId: 'commons-papilio-demoleus-lime-swallowtail',
      asset: 'papilio-demoleus-lime-swallowtail.jpg',
      imageSha256: '9ceb5c0e354627441ba7be5a8e75a8eed7c278948e606e4892ae47387ee1bbea',
      imageByteCount: 130_460,
      verificationLabel:
        'Does this image show an adult Papilio demoleus (lime swallowtail) in ventral view?',
      view: 'ventral',
      title: 'Closed wing of Papilio demoleus Linnaeus, 1758 – Lime Swallowtail',
      creator: 'Bias Chakraborty',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Closed_wing_of_Papilio_demoleus_Linnaeus,_1758_%E2%80%93_Lime_Swallowtail.jpg',
    }),
  ]),
  semantics: Object.freeze({
    separateFromFrozenBioMinerReferenceBank: true,
    reviewerDecisionsAreLocalUntilExported: true,
    scientificClaimAllowed: false,
  }),
})

function reviewItem({
  asset,
  creator,
  imageByteCount,
  imageSha256,
  itemId,
  sourceUrl,
  title,
  verificationLabel,
  view,
}: {
  readonly asset: string
  readonly creator: string
  readonly imageByteCount: number
  readonly imageSha256: string
  readonly itemId: string
  readonly sourceUrl: string
  readonly title: string
  readonly verificationLabel: string
  readonly view: HumanReviewItem['view']
}): HumanReviewItem {
  return Object.freeze({
    itemId,
    imageUrl: new URL(`./assets/${asset}`, import.meta.url).href,
    imageSha256,
    imageByteCount,
    mediaType: 'image/jpeg',
    verificationLabel,
    lifeStage: 'adult',
    visualDomain: 'live_field',
    view,
    source: Object.freeze({
      title,
      creator,
      sourceUrl,
      licenseName: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    }),
  })
}
