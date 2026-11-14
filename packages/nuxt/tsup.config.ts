import { defineConfig } from 'tsup'

// The module (`dist/module.js`) points Nuxt at the runtime files (`dist/runtime/*.js`), which
// import `#app` — a Nuxt alias resolved by the consumer's build, so it stays external.
export default defineConfig({
  entry: {
    module: 'src/module.ts',
    server: 'src/server.ts',
    'runtime/plugin': 'src/runtime/plugin.ts',
    'runtime/composables': 'src/runtime/composables.ts',
    'runtime/middleware': 'src/runtime/middleware.ts',
    'runtime/rule': 'src/runtime/rule.ts',
    'runtime/types': 'src/runtime/types.ts',
  },
  format: ['esm'],
  // Declarations are emitted by `tsc -p tsconfig.build.json` (keeps `#app` imports as-is).
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    '#app',
    '@anievo-id/rbac-evolution',
    '@anievo-id/rbac-evolution-vue',
    '@nuxt/kit',
    'nuxt',
    'vue',
  ],
})
