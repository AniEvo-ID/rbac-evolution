import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // Solid's browser build, in jsdom: what runs on the client.
    resolve: { conditions: ['browser', 'development'] },
    test: {
      name: 'dom',
      include: ['test/dom.test.ts', 'test/checker.test.ts'],
      environment: 'jsdom',
      server: { deps: { inline: [/solid-js/, /@solidjs\/web/] } },
    },
  },
  {
    // Solid's server build, in Node: SSR (SolidStart, TanStack Start).
    test: {
      name: 'ssr',
      include: ['test/ssr.test.ts'],
      environment: 'node',
    },
  },
])
