import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/pg.ts', 'src/sqlite.ts', 'src/mysql.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@anievo-id/rbac-evolution', /^drizzle-orm(\/.*)?$/],
})
