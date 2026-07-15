import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'

export interface WorkflowEfficiencyDiagnostic {
  readonly label: string
  readonly value: string
  readonly sourceField: string
}

export interface WorkflowEfficiencyMetric {
  readonly id:
    | 'api-calls-avoided'
    | 'duplicate-downloads-avoided'
    | 'repeated-inference-avoided'
    | 'embedding-reuse'
    | 'restart-efficiency'
    | 'evidence-completeness'
  readonly label: string
  readonly status: 'measured' | 'unavailable'
  readonly statusLabel: string
  readonly value: string
  readonly interpretation: string
  readonly diagnostics: readonly WorkflowEfficiencyDiagnostic[]
}

export interface WorkflowEfficiencyModel {
  readonly metrics: readonly WorkflowEfficiencyMetric[]
  readonly measuredMetricCount: 1
  readonly unavailableMetricCount: 5
  readonly sectionStates: {
    readonly available: number
    readonly partial: number
    readonly unavailable: number
    readonly total: number
  }
  readonly bundleVerification: {
    readonly artifactCount: number
    readonly verifiedArtifactCount: number
    readonly inventoryChecksumVerified: true
    readonly payloadRootChecksumVerified: true
    readonly artifactChecksumsVerified: true
  }
  readonly provenance: readonly ReplayArtifactEvidence[]
  readonly scientificClaimAllowed: false
}

export function buildWorkflowEfficiencyModel(replay: ReplayEvidence): WorkflowEfficiencyModel {
  const measurements = replay.geographyReference.reference.workflowMeasurements
  const counts = replay.observatory
  const sectionStates = Object.freeze(
    Object.values(replay.sections).reduce(
      (totals, section) => ({ ...totals, [section.status]: totals[section.status] + 1 }),
      { available: 0, partial: 0, unavailable: 0 },
    ),
  )
  const sectionTotal = sectionStates.available + sectionStates.partial + sectionStates.unavailable
  if (
    replay.artifactCount !== replay.verifiedArtifactCount ||
    replay.artifactCount < 1 ||
    sectionStates.unavailable !== replay.unavailableSectionCount ||
    sectionTotal !== Object.keys(replay.sections).length ||
    measurements.completeCheckpointCount !== measurements.checkpointCount ||
    measurements.observedRequestCount !== measurements.checkpointPageCount ||
    measurements.imagesDownloaded !== 0 ||
    counts.yoloeImageCount !== 0 ||
    counts.fullFrameTransformationCount !== 0 ||
    counts.candidateVisualScoreCount !== 0 ||
    replay.scientificClaimAllowed
  ) {
    throw new Error('Workflow efficiency requires the verified metadata-only execution boundary')
  }

  const metrics = Object.freeze([
    metric({
      id: 'api-calls-avoided',
      label: 'API calls avoided',
      status: 'unavailable',
      statusLabel: 'Not instrumented',
      value: 'Unavailable',
      interpretation:
        'The report counts executed requests, retries, and rate limits. It does not record a no-checkpoint baseline or saved-call counter.',
      diagnostics: [
        diagnostic('Observed requests', measurements.observedRequestCount, 'materialization.request_count'),
        diagnostic('Retries', measurements.retryCount, 'materialization.retry_count'),
        diagnostic('Rate limits', measurements.rateLimitCount, 'materialization.rate_limit_count'),
      ],
    }),
    metric({
      id: 'duplicate-downloads-avoided',
      label: 'Duplicate downloads avoided',
      status: 'unavailable',
      statusLabel: 'No download counterfactual',
      value: 'Unavailable',
      interpretation:
        'Metadata deduplication is measured, but no image was downloaded and no duplicate-download attempt ledger exists.',
      diagnostics: [
        diagnostic(
          'Media-candidate rows deduplicated',
          measurements.deduplicatedMediaCandidateCount,
          'counts.deduplicated_media_candidate_count',
        ),
        diagnostic('Images downloaded', measurements.imagesDownloaded, 'execution_constraints.images_downloaded'),
      ],
    }),
    metric({
      id: 'repeated-inference-avoided',
      label: 'Repeated inference avoided',
      status: 'unavailable',
      statusLabel: 'No inference run',
      value: 'Unavailable',
      interpretation:
        'Zero images reached routing or scoring, so there is no executed-inference denominator or reuse counter.',
      diagnostics: [
        diagnostic('YOLOE images processed', counts.yoloeImageCount, 'execution_constraints.yoloe_images_processed'),
        diagnostic(
          'BioCLIP images processed',
          counts.fullFrameTransformationCount,
          'execution_constraints.bioclip_images_processed',
        ),
      ],
    }),
    metric({
      id: 'embedding-reuse',
      label: 'Embedding reuse',
      status: 'unavailable',
      statusLabel: 'No embedding artifact',
      value: 'Unavailable',
      interpretation:
        'The fixture contains no computed embedding, cache-hit field, or reuse-event ledger.',
      diagnostics: [
        diagnostic(
          'BioCLIP images processed',
          counts.fullFrameTransformationCount,
          'execution_constraints.bioclip_images_processed',
        ),
      ],
    }),
    metric({
      id: 'restart-efficiency',
      label: 'Restart efficiency',
      status: 'unavailable',
      statusLabel: 'Completion measured · efficiency absent',
      value: 'Unavailable',
      interpretation:
        'All checkpoints completed, but no resumed run, skipped-work count, elapsed-time baseline, or restart speedup is recorded.',
      diagnostics: [
        diagnostic(
          'Complete checkpoints',
          `${measurements.completeCheckpointCount} of ${measurements.checkpointCount}`,
          'materialization.complete_checkpoint_count',
        ),
        diagnostic('Checkpoint pages', measurements.checkpointPageCount, 'materialization.checkpoint_page_count'),
      ],
    }),
    metric({
      id: 'evidence-completeness',
      label: 'Evidence completeness',
      status: 'measured',
      statusLabel: 'Measured state ledger',
      value: `${replay.verifiedArtifactCount} of ${replay.artifactCount} artifacts verified`,
      interpretation:
        'This measures artifact integrity and section states, not scientific completeness, accuracy, or readiness for a species claim.',
      diagnostics: [
        diagnostic('Available sections', sectionStates.available, 'judge_bundle.sections.status=available'),
        diagnostic('Partial sections', sectionStates.partial, 'judge_bundle.sections.status=partial'),
        diagnostic(
          'Unavailable sections',
          sectionStates.unavailable,
          'judge_bundle.sections.status=unavailable',
        ),
      ],
    }),
  ])

  return Object.freeze({
    metrics,
    measuredMetricCount: 1 as const,
    unavailableMetricCount: 5 as const,
    sectionStates: Object.freeze({ ...sectionStates, total: sectionTotal }),
    bundleVerification: Object.freeze({
      artifactCount: replay.artifactCount,
      verifiedArtifactCount: replay.verifiedArtifactCount,
      inventoryChecksumVerified: replay.verification.inventoryChecksumVerified,
      payloadRootChecksumVerified: replay.verification.payloadRootChecksumVerified,
      artifactChecksumsVerified: replay.verification.artifactChecksumsVerified,
    }),
    provenance: Object.freeze([
      requiredArtifact(replay, 'reference_readiness'),
      requiredArtifact(replay, 'duplicate_summaries'),
      requiredArtifact(replay, 'run_summary'),
    ]),
    scientificClaimAllowed: false as const,
  })
}

function metric(
  input: Omit<WorkflowEfficiencyMetric, 'diagnostics'> & {
    readonly diagnostics: readonly WorkflowEfficiencyDiagnostic[]
  },
): WorkflowEfficiencyMetric {
  return Object.freeze({ ...input, diagnostics: Object.freeze(input.diagnostics) })
}

function diagnostic(
  label: string,
  value: number | string,
  sourceField: string,
): WorkflowEfficiencyDiagnostic {
  return Object.freeze({
    label,
    value: typeof value === 'number' ? value.toLocaleString('en-US') : value,
    sourceField,
  })
}

function requiredArtifact(
  replay: ReplayEvidence,
  role: ReplayArtifactEvidence['role'],
): ReplayArtifactEvidence {
  const artifact = replay.artifactInventory.find((candidate) => candidate.role === role)
  if (artifact === undefined || !artifact.verified) {
    throw new Error(`Workflow efficiency is missing verified ${role} provenance`)
  }
  return artifact
}
