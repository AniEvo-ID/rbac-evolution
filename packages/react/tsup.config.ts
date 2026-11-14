import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Rollup tree-shaking would strip the `'use client'` directive, so keep esbuild output as-is.
  treeshake: false,
  // Every export uses React context, so the whole entry is a client module (Next.js App Router).
  banner: { js: "'use client';" },
  external: ['@anievo-id/rbac-evolution', 'react'],
})
