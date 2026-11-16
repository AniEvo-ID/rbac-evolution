// Read by `svelte-package` (build), `svelte-check` (typecheck) and the Svelte Vite plugin (tests).
// `vitePreprocess()` strips the TypeScript of `<script lang="ts">`, so `dist/*.svelte` ship plain JavaScript.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess({ script: true }),
}
