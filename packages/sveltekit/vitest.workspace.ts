import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // The server helpers, as SvelteKit runs them: Node, and Node's build of `@sveltejs/kit` (not the browser one).
    test: { name: 'server', environment: 'node', include: ['test/server/**/*.test.ts'] },
  },
  {
    // The client: compiles `.svelte` and `.svelte.ts` (runes) files; `svelteTesting()` resolves Svelte's browser
    // build in jsdom and cleans up between tests.
    plugins: [svelte(), svelteTesting()],
    test: { name: 'client', environment: 'jsdom', include: ['test/*.test.ts'] },
  },
])
