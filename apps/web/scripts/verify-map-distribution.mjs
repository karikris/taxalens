import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distributionRoot = resolve(webRoot, '../../dist/web')
const deployedNotice = await readFile(
  resolve(distributionRoot, 'THIRD_PARTY_NOTICES.txt'),
  'utf8',
)

const requiredNotices = [
  {
    packageName: 'maplibre-gl@5.24.0',
    path: resolve(webRoot, 'node_modules/maplibre-gl/LICENSE.txt'),
  },
  {
    packageName: '@vis.gl/react-maplibre@8.1.1',
    path: resolve(webRoot, 'node_modules/@vis.gl/react-maplibre/LICENSE'),
  },
]

for (const { packageName, path } of requiredNotices) {
  const installedNotice = (await readFile(path, 'utf8')).trim()
  assert(deployedNotice.includes(packageName), `${packageName} heading is missing`)
  assert(
    deployedNotice.includes(installedNotice),
    `${packageName} installed licence text is not retained verbatim`,
  )
}

console.log(
  `Offline map distribution notices verified: packages=${requiredNotices.length}, bytes=${Buffer.byteLength(deployedNotice)}`,
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
