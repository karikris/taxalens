import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const assets = [
  {
    file: '../src/review/assets/papilio-demoleus-open-wing.jpg',
    bytes: 180_698,
    sha256: '47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
  },
  {
    file: '../src/review/assets/papilio-demoleus-closed-wing.jpg',
    bytes: 159_332,
    sha256: '3bd3248347c3b82a977b0890f192f2f0c93253eff13d38b4b54dedb08b39627b',
  },
  {
    file: '../src/review/assets/papilio-demoleus-lime-swallowtail.jpg',
    bytes: 130_460,
    sha256: '9ceb5c0e354627441ba7be5a8e75a8eed7c278948e606e4892ae47387ee1bbea',
  },
]

for (const asset of assets) {
  const path = fileURLToPath(new URL(asset.file, import.meta.url))
  const content = await readFile(path)
  const digest = createHash('sha256').update(content).digest('hex')
  if (content.byteLength !== asset.bytes || digest !== asset.sha256) {
    throw new Error(`Human-review asset identity differs: ${asset.file}`)
  }
  if (content[0] !== 0xff || content[1] !== 0xd8) {
    throw new Error(`Human-review asset is not a JPEG: ${asset.file}`)
  }
}

console.log(`Human-review assets verified: ${assets.length}`)
