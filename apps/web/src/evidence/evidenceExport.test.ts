import { beforeAll, describe, expect, it } from 'vitest'

import {
  loadEvidenceFacade,
  type EvidenceFacade,
  type ParquetArtifactInput,
} from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { evidenceLedgerCsv, prepareEvidenceExport } from './evidenceExport'

let facade: EvidenceFacade
let sourceParquet: ParquetArtifactInput

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
  const source = facade
    .loadAnalyticsReplayInput()
    .artifacts.find(({ artifactId }) => artifactId === 'biominer-flickr-query-hits-parquet')
  if (source === undefined) {
    throw new Error('Committed query-hit Parquet fixture is missing')
  }
  sourceParquet = source
})

describe('prepareEvidenceExport', () => {
  it('builds five deterministic local files and preserves BioMiner Parquet bytes', async () => {
    const first = await prepareEvidenceExport(facade.replay, sourceParquet)
    const second = await prepareEvidenceExport(facade.replay, sourceParquet)

    expect(first.schemaVersion).toBe('taxalens-evidence-export:v1.0.0')
    expect(first.files).toHaveLength(5)
    expect(first.files.map(({ role }) => role)).toEqual([
      'evidence_json',
      'csv_summary',
      'source_parquet',
      'manifest',
      'provenance_report',
    ])
    expect(second.files.map(({ filename, sha256 }) => ({ filename, sha256 }))).toEqual(
      first.files.map(({ filename, sha256 }) => ({ filename, sha256 })),
    )
    for (const file of first.files) {
      expect(second.files.find(({ role }) => role === file.role)?.bytes).toEqual(file.bytes)
      expect(file.filename).toMatch(/^taxalens-papilio-demoleus-awaiting-human-review\./u)
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/u)
    }

    const parquet = first.files.find(({ role }) => role === 'source_parquet')
    expect(parquet?.bytes).toEqual(sourceParquet.bytes)
    expect(parquet?.bytes).not.toBe(sourceParquet.bytes)
    expect(parquet?.sha256).toBe(sourceParquet.sha256)
  })

  it('writes canonical manifest and provenance boundaries without inventing a signature', async () => {
    const bundle = await prepareEvidenceExport(facade.replay, sourceParquet)
    const decoder = new TextDecoder()
    const manifestFile = bundle.files.find(({ role }) => role === 'manifest')
    const provenanceFile = bundle.files.find(({ role }) => role === 'provenance_report')
    const evidenceFile = bundle.files.find(({ role }) => role === 'evidence_json')

    expect(manifestFile).toBeDefined()
    expect(provenanceFile).toBeDefined()
    expect(evidenceFile).toBeDefined()
    const manifest = JSON.parse(decoder.decode(manifestFile?.bytes)) as {
      files: readonly { filename: string; sha256: string }[]
      signature: { status: string; signer: null; value: null }
      verification: { manifestSelfDigestIncluded: boolean }
    }
    expect(manifest.files).toHaveLength(4)
    expect(manifest.files.map(({ filename }) => filename)).not.toContain(manifestFile?.filename)
    expect(manifest.signature).toMatchObject({
      status: 'unavailable',
      signer: null,
      value: null,
    })
    expect(manifest.verification.manifestSelfDigestIncluded).toBe(false)
    for (const entry of manifest.files) {
      expect(bundle.files.find(({ filename }) => filename === entry.filename)?.sha256).toBe(
        entry.sha256,
      )
    }

    const provenance = JSON.parse(decoder.decode(provenanceFile?.bytes)) as {
      exportTimestamp: null
      execution: { networkRequestsRequired: number; scientificClaimsAdded: boolean }
      sourceParquet: { transferMethod: string; sourceSha256: string }
    }
    expect(provenance.exportTimestamp).toBeNull()
    expect(provenance.execution).toEqual(expect.objectContaining({
      networkRequestsRequired: 0,
      scientificClaimsAdded: false,
    }))
    expect(provenance.sourceParquet).toEqual(expect.objectContaining({
      transferMethod: 'byte_for_byte_copy',
      sourceSha256: sourceParquet.sha256,
    }))

    const evidence = JSON.parse(decoder.decode(evidenceFile?.bytes)) as {
      scientificClaimAllowed: boolean
      ledger: { events: readonly unknown[] }
    }
    expect(evidence.scientificClaimAllowed).toBe(false)
    expect(evidence.ledger.events).toHaveLength(10)
  })

  it('exports a ten-row CRLF CSV summary with escaped detail fields', () => {
    const csv = evidenceLedgerCsv(facade.replay)

    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(12)
    expect(csv).toContain('sequence,event_id,label,status,event_time')
    expect(csv).toContain('1,discovery,Discovery,metadata,')
    expect(csv).toContain('10,export,Export,available,2026-07-16T09:44:16Z')
    expect(csv).toContain('"838 eligible source candidates, 0 human-verified images')
  })

  it('rejects altered Parquet bytes before preparing an export', async () => {
    const altered = sourceParquet.bytes.slice()
    altered[4] = (altered[4] ?? 0) ^ 0xff

    await expect(
      prepareEvidenceExport(facade.replay, { ...sourceParquet, bytes: altered }),
    ).rejects.toThrow('exact verified BioMiner query-hit Parquet')
  })
})
