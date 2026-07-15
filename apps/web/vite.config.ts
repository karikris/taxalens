import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixtureRoot = fileURLToPath(
  new URL('../../demo/fixture/papilio_pilot', import.meta.url),
)
const buildRoot = fileURLToPath(new URL('../../dist/web', import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
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
