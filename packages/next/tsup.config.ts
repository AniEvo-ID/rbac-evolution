import { defineConfig } from 'tsup'

export default defineConfig({
  // `middleware` is a separate entry so `middleware.ts` never pulls in `next/navigation`.
  entry: { index: 'src/index.ts', middleware: 'src/middleware-entry.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@anievo-id/rbac-evolution', 'next', 'react'],
})
