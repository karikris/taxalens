import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixtureRoot = fileURLToPath(
  new URL('../../demo/fixture/papilio_pilot', import.meta.url),
)
const buildRoot = fileURLToPath(new URL('../../dist/web', import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react(), deployedMapNotices()],
  publicDir: fixtureRoot,
  build: {
    outDir: buildRoot,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: 'baseline-widely-available',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.names.includes('parquet.duckdb_extension.wasm')
            ? 'assets/parquet.duckdb_extension.wasm'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    fs: {
      allow: [repositoryRoot],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

function deployedMapNotices(): Plugin {
  const notices = [
    {
      packageName: 'maplibre-gl@5.24.0',
      path: fileURLToPath(new URL('./node_modules/maplibre-gl/LICENSE.txt', import.meta.url)),
    },
    {
      packageName: '@vis.gl/react-maplibre@8.1.1',
      path: fileURLToPath(
        new URL('./node_modules/@vis.gl/react-maplibre/LICENSE', import.meta.url),
      ),
    },
  ]
  const source = notices
    .map(
      ({ packageName, path }) =>
        `${'='.repeat(78)}\n${packageName}\n${'='.repeat(78)}\n\n${readFileSync(path, 'utf8').trim()}\n`,
    )
    .join('\n')

  return {
    name: 'taxalens-deployed-map-notices',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_NOTICES.txt',
        source,
      })
    },
  }
}
