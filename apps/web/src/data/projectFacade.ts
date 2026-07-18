import type {
  JudgeBundleArtifact,
  JudgeBundleContract,
  JudgeBundleSection,
  JudgeBundleSectionName,
} from '../../../../packages/contracts/src/judge_bundle_contract'

type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface JudgeBundleMigrationReceipt {
  readonly sourceSchemaVersion: string
  readonly targetSchemaVersion: JudgeBundleContract['schema_version']
  readonly applied: boolean
  readonly storedFilesRewritten: false
  readonly addedSections: readonly JudgeBundleSectionName[]
  readonly preservedV1FingerprintSha256: string | null
}

export interface JudgeBundleMigrationResult {
  readonly manifest: JudgeBundleContract
  readonly receipt: JudgeBundleMigrationReceipt
}

export interface VerifiedProjectArtifact {
  readonly descriptor: JudgeBundleArtifact
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly json: JsonValue | undefined
}

export type BundleContractVerification = (
  candidate: JsonValue,
) => Promise<JudgeBundleMigrationResult>
export type BundleSemanticVerification = (manifest: JudgeBundleContract) => Promise<void>
export type BundleAssetReader = (
  path: string,
  signal: AbortSignal,
) => Promise<Uint8Array<ArrayBuffer>>
export type BundleJsonParser = (
  bytes: Uint8Array<ArrayBuffer>,
  location: string,
) => JsonValue
export type BundleArtifactVerification = (
  descriptor: JudgeBundleArtifact,
  bytes: Uint8Array<ArrayBuffer>,
) => Promise<VerifiedProjectArtifact>

export class BundleVerifier {
  readonly #verifyContract: BundleContractVerification
  readonly #verifySemantics: BundleSemanticVerification

  constructor(
    verifyContract: BundleContractVerification,
    verifySemantics: BundleSemanticVerification,
  ) {
    this.#verifyContract = verifyContract
    this.#verifySemantics = verifySemantics
  }

  async verify(candidate: JsonValue): Promise<JudgeBundleMigrationResult> {
    const result = await this.#verifyContract(candidate)
    await this.#verifySemantics(result.manifest)
    return result
  }
}

export class BundleLoader {
  readonly #verifier: BundleVerifier
  readonly #readAsset: BundleAssetReader
  readonly #parseJson: BundleJsonParser
  readonly #verifyArtifact: BundleArtifactVerification

  constructor(
    verifier: BundleVerifier,
    readAsset: BundleAssetReader,
    parseJson: BundleJsonParser,
    verifyArtifact: BundleArtifactVerification,
  ) {
    this.#verifier = verifier
    this.#readAsset = readAsset
    this.#parseJson = parseJson
    this.#verifyArtifact = verifyArtifact
  }

  async load(signal: AbortSignal): Promise<TaxaLensProjectFacade> {
    const manifestBytes = await this.#readAsset('judge_bundle.json', signal)
    const candidate = this.#parseJson(manifestBytes, 'judge_bundle')
    const verification = await this.#verifier.verify(candidate)
    const artifacts = new Map<string, VerifiedProjectArtifact>()
    const orderedInventory = [...verification.manifest.artifact_inventory].sort(comparePaths)
    for (const descriptor of orderedInventory) {
      const bytes = await this.#readAsset(descriptor.path, signal)
      const artifact = await this.#verifyArtifact(descriptor, bytes)
      if (artifacts.has(descriptor.artifact_id)) {
        throw new Error(`Artifact id ${descriptor.artifact_id} was loaded twice`)
      }
      artifacts.set(descriptor.artifact_id, artifact)
    }
    return new TaxaLensProjectFacade(verification, artifacts)
  }
}

export class TaxaLensProjectFacade {
  readonly manifest: JudgeBundleContract
  readonly migrationReceipt: JudgeBundleMigrationReceipt
  readonly #artifacts: ReadonlyMap<string, VerifiedProjectArtifact>

  constructor(
    verification: JudgeBundleMigrationResult,
    artifacts: ReadonlyMap<string, VerifiedProjectArtifact>,
  ) {
    this.manifest = verification.manifest
    this.migrationReceipt = verification.receipt
    this.#artifacts = new Map(artifacts)
  }

  section(name: JudgeBundleSectionName): JudgeBundleSection {
    return this.manifest.sections[name]
  }

  artifact(artifactId: string): VerifiedProjectArtifact | undefined {
    return this.#artifacts.get(artifactId)
  }

  artifactsForRole(role: JudgeBundleArtifact['role']): readonly VerifiedProjectArtifact[] {
    return Object.freeze(
      [...this.#artifacts.values()]
        .filter(({ descriptor }) => descriptor.role === role)
        .sort((left, right) => comparePaths(left.descriptor, right.descriptor)),
    )
  }

  artifactEntries(): readonly (readonly [string, VerifiedProjectArtifact])[] {
    return Object.freeze(
      [...this.#artifacts.entries()]
        .sort((left, right) => comparePaths(left[1].descriptor, right[1].descriptor))
        .map(([artifactId, artifact]) => Object.freeze([artifactId, artifact] as const)),
    )
  }
}

export class PapilioJudgeFixtureValidator {
  static readonly identity = Object.freeze({
    bundleId: 'papilio-demoleus-prototype-74a7d648-v3',
    taxalensSha: 'fab9d3f1605d28d4bbfc3a4d0074f40e5ffff023',
    biominerSha: '74a7d648a562efa744e6502ef504a23b63b4e02f',
    legacyBiominerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
    verificationManifestTaxalensSha: '9b94891ea3ffc37c9e036838c938c596ef0dc529',
    verificationMediaTaxalensSha: 'ff96b7f8f6feaf8197000b0f5265110a7d331e08',
    analyticsSourceManifestSha256:
      'a62abef7cbac8638da219e53e08ab6760bedcd4f49d6396bfa0d1891d96e5cf2',
    geographicImpactManifestSha256:
      'd2ad9e8fd5314a26bd73fd27b7ead00d7e85e0f962a44319d5e0910c567a3b22',
    geographicSourceCommits: Object.freeze([
      'karikris/biominer:247b42f3206d48bb79e2dbf97c5a92e4f207ae71',
      'karikris/biominer:75461d9c065af0cd96b41cd1f845c2e920f7ae34',
      'karikris/taxalens:6b2eb94d8998ce07d4ebd93e1613fcb0126dd0c0',
      'karikris/taxalens:b399cd4fe92640ad9a219142f8a77ac2122e632e',
      'karikris/taxalens:cdee00c9e16e349d722733cd951709abce8d0fee',
      'karikris/taxalens:ce05ac9fdecff46008d6dbe93f9741edcfd5388b',
      'karikris/taxalens:e85b0d225cfdad4932de95d745b936ae85a61097',
      'karikris/taxalens:ffef38ec4abc289d31011f8c74b762524c0caeec',
    ]),
  })

  verify(project: TaxaLensProjectFacade): void {
    const { manifest } = project
    const expected = PapilioJudgeFixtureValidator.identity
    const geographicManifests = manifest.artifact_inventory.filter(
      ({ role }) => role === 'geographic_impact_manifest',
    )
    const hasFrozenGeographicManifest =
      geographicManifests.length === 1 &&
      geographicManifests[0]?.sha256 === expected.geographicImpactManifestSha256
    const geographicSourceCommits = new Set(expected.geographicSourceCommits)
    if (
      manifest.bundle_id !== expected.bundleId ||
      manifest.source_revisions.taxalens_sha !== expected.taxalensSha ||
      manifest.source_revisions.biominer_sha !== expected.biominerSha
    ) {
      throw new Error('judge_bundle identity does not match the frozen Papilio fixture')
    }
    for (const artifact of manifest.artifact_inventory) {
      const sourceIdentity = `${artifact.source_repository.toLowerCase()}:${artifact.source_commit}`
      const admitted =
        (artifact.source_repository === 'karikris/TaxaLens' &&
          (artifact.source_commit === manifest.source_revisions.taxalens_sha ||
            (['verification_campaigns', 'verification_items'] as const).some(
              (role) =>
                artifact.role === role &&
                artifact.source_commit === expected.verificationManifestTaxalensSha,
            ) ||
            (artifact.role === 'verification_media' &&
              artifact.source_commit === expected.verificationMediaTaxalensSha))) ||
        (artifact.source_repository === 'karikris/BioMiner' &&
          (artifact.source_commit === manifest.source_revisions.biominer_sha ||
            artifact.source_commit === expected.legacyBiominerSha)) ||
        (hasFrozenGeographicManifest && geographicSourceCommits.has(sourceIdentity))
      if (!admitted) {
        throw new Error(`${artifact.artifact_id} source revision is outside the Papilio fixture`)
      }
    }
  }
}

function comparePaths(
  left: { readonly path: string },
  right: { readonly path: string },
): number {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0
}
