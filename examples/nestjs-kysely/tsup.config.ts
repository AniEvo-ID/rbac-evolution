import { defineConfig } from 'tsup'

// Bundles the Nest server into dist/ (dependencies stay external).
export default defineConfig({
  entry: { main: 'src/main.ts' },
  outDir: 'dist',
  format: 'esm',
  target: 'node20',
  clean: true,
})
