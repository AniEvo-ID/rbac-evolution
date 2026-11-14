import { defineConfig } from 'tsup'

// Bundles the Express server into dist/server (dependencies stay external).
export default defineConfig({
  entry: { index: 'server/index.ts' },
  outDir: 'dist/server',
  format: 'esm',
  target: 'node20',
  clean: true,
})
