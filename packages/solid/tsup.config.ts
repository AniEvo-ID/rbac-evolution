import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // No JSX in the sources: plain `createComponent` calls, so no Solid compiler is needed and the same build runs
  // with Solid's client and server (SSR) builds.
  external: ['@anievo-id/rbac-evolution', 'solid-js'],
})
