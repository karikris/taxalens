import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  VERIFICATION_LIFE_STAGES,
  VERIFICATION_VIEWS,
  VERIFICATION_VISUAL_DOMAINS,
  type FlickrVerificationSource,
} from './verificationContracts'

const SCORE_BANDS = new Set([
  'not_scored',
  'low',
  'middle',
  'high',
  'unavailable',
])
const MARGIN_BANDS = new Set([
  'negative',
  'near_tie',
  'small_positive',
  'clear_positive',
  'unavailable',
])
const DECISION_STATES = new Set([
  'target',
  'non_target',
  'abstain',
  'awaiting_human_review',
  'unavailable',
])
const DATASET_PARTITIONS = new Set([
  'support',
  'model_selection',
  'calibration',
  'final_test',
])

export function validateFlickrVerificationSource(
  source: FlickrVerificationSource,
): readonly string[] {
  const failures: string[] = []
  if (source.schemaVersion !== FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION) {
    failures.push('Flickr verification source schema is unsupported')
  }
  for (const [value, label] of [
    [source.flickrRecordId, 'Flickr record ID'],
    [source.flickrPhotoId, 'Flickr photo ID'],
    [source.fullFrameMedia.mediaId, 'full-frame media ID'],
    [source.duplicateGroupId, 'duplicate group ID'],
    [source.ownerGroupId, 'owner group ID'],
    [source.observationGroupId, 'observation group ID'],
    [source.samplingStratumId, 'sampling stratum ID'],
    [source.query.term, 'query term'],
    [source.route.routeLabel, 'route label'],
  ] as const) {
    if (value.trim() === '') {
      failures.push(`${label} must not be empty`)
    }
  }
  if (
    !/^[a-f0-9]{64}$/.test(source.fullFrameMedia.sha256) ||
    !source.fullFrameMedia.checksumVerified
  ) {
    failures.push('full-frame media must be checksum-verified')
  }
  if (
    !Number.isInteger(source.fullFrameMedia.byteCount) ||
    source.fullFrameMedia.byteCount < 1 ||
    !source.fullFrameMedia.mediaType.startsWith('image/')
  ) {
    failures.push('full-frame media identity is invalid')
  }
  if (
    source.fullFrameMedia.rights.policyStatus !== 'allowed' ||
    source.fullFrameMedia.rights.attribution.trim() === '' ||
    source.fullFrameMedia.rights.sourceUri.trim() === ''
  ) {
    failures.push('full-frame media rights are not reviewable')
  }
  const queryParts = source.query.tier.split(':')
  if (
    queryParts.length !== 3 ||
    queryParts[0] !== source.query.rank ||
    queryParts[1] !== source.query.trustTier ||
    queryParts[2] !== source.query.searchField ||
    queryParts.some((part) => part.length === 0)
  ) {
    failures.push('query tier parts do not match the raw tier')
  }
  if (!VERIFICATION_LIFE_STAGES.includes(source.route.lifeStage)) {
    failures.push('route life stage is unsupported')
  }
  if (!VERIFICATION_VISUAL_DOMAINS.includes(source.route.visualDomain)) {
    failures.push('route visual domain is unsupported')
  }
  if (!VERIFICATION_VIEWS.includes(source.route.view)) {
    failures.push('route view is unsupported')
  }
  if (
    source.route.subjectAreaRatio !== null &&
    (!Number.isFinite(source.route.subjectAreaRatio) ||
      source.route.subjectAreaRatio < 0 ||
      source.route.subjectAreaRatio > 1)
  ) {
    failures.push('route subject area ratio must be between zero and one')
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(source.route.fingerprint)) {
    failures.push('route fingerprint must be a prefixed SHA-256 digest')
  }
  if (!SCORE_BANDS.has(source.targetScoreBand)) {
    failures.push('target score band is unsupported')
  }
  if (!MARGIN_BANDS.has(source.competitorMarginBand)) {
    failures.push('competitor margin band is unsupported')
  }
  if (!DECISION_STATES.has(source.decisionState)) {
    failures.push('decision state is unsupported')
  }
  if (!DATASET_PARTITIONS.has(source.datasetPartition)) {
    failures.push('dataset partition is unsupported')
  }
  if (
    source.inclusionProbability !== null &&
    (!Number.isFinite(source.inclusionProbability) ||
      source.inclusionProbability <= 0 ||
      source.inclusionProbability > 1)
  ) {
    failures.push(
      'source inclusion probability must be null or greater than zero and at most one',
    )
  }
  const { latitude, longitude } = source.coordinate
  if ((latitude === null) !== (longitude === null)) {
    failures.push('Flickr coordinates must be populated together')
  } else if (
    latitude !== null &&
    longitude !== null &&
    (latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180)
  ) {
    failures.push('Flickr coordinates are outside valid bounds')
  }
  if (
    source.coordinate.outlier !== null &&
    (latitude === null || longitude === null)
  ) {
    failures.push('geographic outlier state requires coordinates')
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(source.sourceArtifactFingerprint)) {
    failures.push('source artifact fingerprint must be a prefixed SHA-256 digest')
  }
  if (!/^[a-f0-9]{40}$/.test(source.biominerSha)) {
    failures.push('source BioMiner SHA must be a full commit')
  }
  for (const [key, value] of Object.entries(source.prioritySignals)) {
    if (value !== null && typeof value !== 'boolean') {
      failures.push(`priority signal ${key} must be Boolean or null`)
    }
  }
  return Object.freeze(failures)
}
