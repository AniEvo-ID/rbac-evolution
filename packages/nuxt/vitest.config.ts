import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#app': fileURLToPath(new URL('./test/mocks/app.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
