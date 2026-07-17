import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageDocument = await readJson(resolve(webRoot, 'package.json'))
const lockDocument = await readJson(resolve(webRoot, 'package-lock.json'))

const selected = Object.freeze({
  'maplibre-gl': Object.freeze({
    version: '5.24.0',
    license: 'BSD-3-Clause',
    licensePath: 'LICENSE.txt',
    licenseSha256: 'ee5fc05a0677eaf69601d2c7db0d9ecd6cc27c3abc1d0733bc9ed34707cf8ef2',
  }),
  '@vis.gl/react-maplibre': Object.freeze({
    version: '8.1.1',
    license: 'MIT',
    licensePath: 'LICENSE',
    licenseSha256: 'c80c7101e5039d2f5359729c5fa6b4d58c6904bf7ba75bd6cafd0078438d6634',
  }),
})
const acceptedLicenses = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '(MIT OR Apache-2.0)',
])

for (const [name, contract] of Object.entries(selected)) {
  assert(
    packageDocument.dependencies?.[name] === contract.version,
    `${name} must be an exact direct dependency at ${contract.version}`,
  )
  const packagePath = `node_modules/${name}`
  const locked = lockDocument.packages?.[packagePath]
  assert(locked?.version === contract.version, `${name} lock version differs`)
  assert(
    typeof locked?.integrity === 'string' && locked.integrity.startsWith('sha512-'),
    `${name} lock integrity is missing`,
  )
  const installed = await readJson(resolve(webRoot, packagePath, 'package.json'))
  assert(installed.version === contract.version, `${name} installed version differs`)
  assert(installed.license === contract.license, `${name} installed licence differs`)
  const licenseBytes = await readFile(resolve(webRoot, packagePath, contract.licensePath))
  assert(
    createHash('sha256').update(licenseBytes).digest('hex') === contract.licenseSha256,
    `${name} installed licence checksum differs`,
  )
}

const dependencyPaths = transitiveDependencyPaths(lockDocument, Object.keys(selected))
const observedLicenses = new Set()
for (const packagePath of dependencyPaths) {
  const installed = await readJson(resolve(webRoot, packagePath, 'package.json'))
  assert(
    typeof installed.license === 'string' && acceptedLicenses.has(installed.license),
    `${installed.name}@${installed.version} has an unapproved licence: ${String(installed.license)}`,
  )
  observedLicenses.add(installed.license)
}

console.log(
  `Offline map dependencies verified: direct=${Object.keys(selected).length}, transitive_paths=${dependencyPaths.size}, licences=${[...observedLicenses].sort().join(',')}`,
)

function transitiveDependencyPaths(lock, roots) {
  const selectedPaths = new Set()
  const pending = roots.map((name) => `node_modules/${name}`)
  while (pending.length > 0) {
    const packagePath = pending.pop()
    if (selectedPaths.has(packagePath)) continue
    const entry = lock.packages?.[packagePath]
    assert(entry !== undefined, `lock entry is missing: ${packagePath}`)
    selectedPaths.add(packagePath)
    for (const dependency of Object.keys(entry.dependencies ?? {})) {
      const resolvedPath = resolveLockedDependency(lock, packagePath, dependency)
      assert(resolvedPath !== null, `${packagePath} cannot resolve ${dependency}`)
      pending.push(resolvedPath)
    }
  }
  return selectedPaths
}

function resolveLockedDependency(lock, importerPath, dependency) {
  let current = importerPath
  while (true) {
    const candidate = `${current}/node_modules/${dependency}`
    if (lock.packages?.[candidate] !== undefined) return candidate
    const marker = current.lastIndexOf('/node_modules/')
    if (marker < 0) break
    current = current.slice(0, marker)
  }
  const rootCandidate = `node_modules/${dependency}`
  return lock.packages?.[rootCandidate] === undefined ? null : rootCandidate
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
