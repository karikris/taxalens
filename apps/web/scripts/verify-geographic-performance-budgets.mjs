import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const executeFile = promisify(execFile)
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const baselinePath = resolve(
  scriptDirectory,
  '../performance/geographic-impact-performance-baseline.json',
)
const reportScriptPath = resolve(scriptDirectory, 'report-geographic-bundle-size.mjs')

export function allowedPerformanceMaximum(budget) {
  validateBudget(budget)
  return budget.baseline + Math.max(
    budget.baseline * budget.relativeTolerance,
    budget.absoluteTolerance,
  )
}

export function assertWithinPerformanceBudget(name, actual, budget) {
  if (!Number.isFinite(actual) || actual < 0) {
    throw new Error(`${name} measurement must be a non-negative finite number`)
  }
  const maximum = allowedPerformanceMaximum(budget)
  if (actual > maximum) {
    throw new Error(
      `${name} ${actual} ${budget.unit} exceeds the measured regression ceiling ${maximum} ${budget.unit}`,
    )
  }
  return maximum
}

export async function verifyGeographicBundleBudgets() {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  const { stdout } = await executeFile(process.execPath, [reportScriptPath], {
    maxBuffer: 4 * 1024 * 1024,
  })
  const report = JSON.parse(stdout)
  const checks = [
    ['total distribution', report.total.bytes, baseline.bundle.totalDistribution],
    [
      'geographic evidence group',
      report.productGroups.geographicEvidence.bytes,
      baseline.bundle.geographicEvidence,
    ],
    [
      'MapLibre renderer vendor',
      report.productGroups.mapRendererVendor.bytes,
      baseline.bundle.mapRendererVendor,
    ],
    [
      'dashboard chunks',
      report.productGroups.dashboardChunks.bytes,
      baseline.bundle.dashboardChunks,
    ],
  ]
  const results = checks.map(([name, actual, budget]) => ({
    name,
    actual,
    maximum: assertWithinPerformanceBudget(name, actual, budget),
    unit: budget.unit,
  }))
  if (report.sourceMapsExcluded !== 0) {
    throw new Error('Production bundle emitted source maps outside the measured baseline')
  }
  return Object.freeze(results)
}

function validateBudget(budget) {
  for (const [name, value] of Object.entries({
    baseline: budget?.baseline,
    relativeTolerance: budget?.relativeTolerance,
    absoluteTolerance: budget?.absoluteTolerance,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Performance budget ${name} must be a non-negative finite number`)
    }
  }
  if (typeof budget.unit !== 'string' || budget.unit === '') {
    throw new Error('Performance budget unit must be a non-empty string')
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await verifyGeographicBundleBudgets()
  process.stdout.write(`Geographic performance budgets passed: ${JSON.stringify(results)}\n`)
}
