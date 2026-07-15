import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'
import type { PipelineStageModel, PipelineStageStatus } from './pipelineModel'

export type LineageContributionKind =
  | 'verified_metadata'
  | 'partial_metadata'
  | 'missing_evidence_state'
  | 'review_boundary'

export interface RecordLineageStage extends PipelineStageModel {
  readonly nodeId: string
  readonly artifactIds: readonly string[]
  readonly contributionKind: LineageContributionKind
}

export interface RecordLineageArtifact extends ReplayArtifactEvidence {
  readonly nodeId: string
  readonly stageIds: readonly string[]
  readonly contributionKind: 'stage_input' | 'record_frame'
}

export interface RecordLineageEdge {
  readonly from: string
  readonly to: string
}

export interface RecordLineageModel {
  readonly record: {
    readonly nodeId: string
    readonly recordId: string
    readonly label: 'Final replay record awaiting review'
    readonly state: 'awaiting_human_review'
    readonly scientificClaimAllowed: false
  }
  readonly stages: readonly RecordLineageStage[]
  readonly artifacts: readonly RecordLineageArtifact[]
  readonly edges: readonly RecordLineageEdge[]
}

export interface RecordLineageSelection {
  readonly recordNodeId: string
  readonly stageIds: ReadonlySet<string>
  readonly artifactIds: ReadonlySet<string>
}

const RECORD_FRAME_ARTIFACT_IDS = Object.freeze([
  'run-summary',
  'pipeline-stages',
  'stage-metrics',
] as const)

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

function contributionKind(status: PipelineStageStatus): LineageContributionKind {
  switch (status) {
    case 'verified':
      return 'verified_metadata'
    case 'partial':
      return 'partial_metadata'
    case 'unavailable':
      return 'missing_evidence_state'
    case 'review':
      return 'review_boundary'
  }
}

export function buildRecordLineage(
  replay: ReplayEvidence,
  pipelineStages: readonly PipelineStageModel[],
): RecordLineageModel {
  const recordNodeId = `record:${replay.heroRecordId}`
  const artifactById = new Map(
    replay.artifactInventory.map((artifact) => [artifact.artifactId, artifact] as const),
  )
  const artifactStageIds = new Map<string, Set<string>>()
  const stages = pipelineStages.map((stage) => {
    const artifactIds = Array.from(
      new Set(
        stage.sourceSections.flatMap((sectionName) => replay.sections[sectionName].artifactIds),
      ),
    )
    for (const artifactId of artifactIds) {
      if (!artifactById.has(artifactId)) {
        throw new Error(`Lineage stage ${stage.stageId} references unknown artifact ${artifactId}`)
      }
      const stageIds = artifactStageIds.get(artifactId) ?? new Set<string>()
      stageIds.add(stage.stageId)
      artifactStageIds.set(artifactId, stageIds)
    }
    return {
      ...stage,
      nodeId: `stage:${stage.stageId}`,
      artifactIds: Object.freeze(artifactIds),
      contributionKind: contributionKind(stage.status),
    }
  })

  const contributingArtifactIds = new Set<string>([
    ...RECORD_FRAME_ARTIFACT_IDS,
    ...artifactStageIds.keys(),
  ])
  const artifacts = replay.artifactInventory
    .filter(({ artifactId }) => contributingArtifactIds.has(artifactId))
    .map((artifact) => ({
      ...artifact,
      nodeId: `artifact:${artifact.artifactId}`,
      stageIds: Object.freeze(Array.from(artifactStageIds.get(artifact.artifactId) ?? [])),
      contributionKind: artifactStageIds.has(artifact.artifactId)
        ? ('stage_input' as const)
        : ('record_frame' as const),
    }))
  for (const artifactId of contributingArtifactIds) {
    if (!artifactById.has(artifactId)) {
      throw new Error(`Record lineage references unknown artifact ${artifactId}`)
    }
  }

  const edges: RecordLineageEdge[] = stages.map((stage) => ({
    from: stage.nodeId,
    to: recordNodeId,
  }))
  for (const artifact of artifacts) {
    if (artifact.stageIds.length === 0) {
      edges.push({ from: artifact.nodeId, to: recordNodeId })
    } else {
      for (const stageId of artifact.stageIds) {
        edges.push({ from: artifact.nodeId, to: `stage:${stageId}` })
      }
    }
  }

  return deepFreeze({
    record: {
      nodeId: recordNodeId,
      recordId: replay.heroRecordId,
      label: 'Final replay record awaiting review',
      state: 'awaiting_human_review',
      scientificClaimAllowed: false,
    },
    stages,
    artifacts,
    edges,
  })
}

export function traceRecordLineage(
  lineage: RecordLineageModel,
  recordId: string,
): RecordLineageSelection {
  if (recordId !== lineage.record.recordId) {
    throw new Error(`Unknown final replay record: ${recordId}`)
  }
  const incoming = new Map<string, string[]>()
  for (const edge of lineage.edges) {
    const sources = incoming.get(edge.to) ?? []
    sources.push(edge.from)
    incoming.set(edge.to, sources)
  }
  const visited = new Set<string>()
  const queue = [lineage.record.nodeId]
  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (nodeId === undefined || visited.has(nodeId)) {
      continue
    }
    visited.add(nodeId)
    queue.push(...(incoming.get(nodeId) ?? []))
  }
  return Object.freeze({
    recordNodeId: lineage.record.nodeId,
    stageIds: new Set(
      lineage.stages.filter(({ nodeId }) => visited.has(nodeId)).map(({ stageId }) => stageId),
    ),
    artifactIds: new Set(
      lineage.artifacts
        .filter(({ nodeId }) => visited.has(nodeId))
        .map(({ artifactId }) => artifactId),
    ),
  })
}
