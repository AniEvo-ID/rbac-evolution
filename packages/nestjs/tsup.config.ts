import { defineConfig } from 'tsup'

// esbuild reads `experimentalDecorators` from tsconfig.json (legacy decorators, incl. parameter decorators).
// It does not emit `design:paramtypes`, so every injected dependency uses an explicit `@Inject(token)`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@anievo-id/rbac-evolution', '@nestjs/common', '@nestjs/core', 'reflect-metadata'],
})
