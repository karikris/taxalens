import { readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const distributionRoot = resolve(scriptDirectory, '../../../dist/web')

const files = await collectFiles(distributionRoot)
const productionFiles = files.filter(({ path }) => !path.endsWith('.map'))
const report = Object.freeze({
  schemaVersion: 'taxalens-geographic-bundle-size:v1.0.0',
  distributionPath: 'dist/web',
  sourceMapsExcluded: files.length - productionFiles.length,
  total: summarize(productionFiles),
  byExtension: Object.freeze(
    Object.fromEntries(
      [...new Set(productionFiles.map(extensionCategory))]
        .sort()
        .map((category) => [
          category,
          summarize(productionFiles.filter((file) => extensionCategory(file) === category)),
        ]),
    ),
  ),
  productGroups: Object.freeze({
    dashboardChunks: summarize(
      productionFiles.filter(({ path }) => /^assets\/dashboard-.*\.(?:css|js)$/u.test(path)),
    ),
    duckdbRuntime: summarize(
      productionFiles.filter(({ path }) =>
        /(?:duckdb|parquet\.duckdb_extension)/u.test(path),
      ),
    ),
    geographicEvidence: summarize(
      productionFiles.filter(({ path }) => isGeographicEvidencePath(path)),
    ),
    mapRendererVendor: summarize(
      productionFiles.filter(({ path }) => /^assets\/maplibre-gl-.*\.js$/u.test(path)),
    ),
    verificationMedia: summarize(
      productionFiles.filter(({ path }) => path.startsWith('verification/media/')),
    ),
  }),
})

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

async function collectFiles(root) {
  const records = []
  await visit(root)
  return records.sort((left, right) => left.path.localeCompare(right.path))

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath)
      } else if (entry.isFile()) {
        records.push({
          path: relative(root, absolutePath).split(sep).join('/'),
          bytes: (await stat(absolutePath)).size,
        })
      }
    }
  }
}

function extensionCategory({ path }) {
  const extension = extname(path).toLowerCase().slice(1)
  return extension === '' ? 'no_extension' : extension
}

function isGeographicEvidencePath(path) {
  return [
    /^analytics\/flickr_geo/u,
    /^assets\/geographic/u,
    /^data\/geographic_clusters\.json$/u,
    /^demo\/source\/biominer_phase14\/(?:baseline_geography|baseline_provider_union|flickr_geography|geographic_impact)\//u,
    /^demo\/source\/geography\/country_hierarchy\.json$/u,
    /^demo\/repository_storage\/supabase\/verification_consensus\.json$/u,
    /^demo\/source\/verification\/occurrence_release_decisions\.json$/u,
  ].some((pattern) => pattern.test(path))
}

function summarize(records) {
  return Object.freeze({
    bytes: records.reduce((total, { bytes }) => total + bytes, 0),
    fileCount: records.length,
    files: Object.freeze(records),
  })
}
