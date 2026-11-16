# @anievo-id/rbac-evolution-sveltekit

SvelteKit 2 and 3 (Svelte 5) integration for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): a
`handle` hook, guards for `load` functions, form actions and `+server.ts` endpoints, and `<Can>` / `<HasRole>`
components with a runes-based context.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sveltekit
```

## Usage

```ts
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks'
import { rbacHandle } from '@anievo-id/rbac-evolution-sveltekit/server'
import { rbac } from '$lib/server/rbac' // createRbac({ adapter })

export const handle = sequence(
  authHandle, // yours: sets event.locals.user
  rbacHandle({ rbac, getSubject: (event) => (event.locals.user ? { type: 'user', id: event.locals.user.id } : null) }),
)
```

```ts
// src/routes/+layout.server.ts
import { getSnapshot } from '@anievo-id/rbac-evolution-sveltekit/server'
export const load = async (event) => ({ rbac: await getSnapshot(event) })

// src/routes/admin/+page.server.ts
import { requireRole } from '@anievo-id/rbac-evolution-sveltekit/server'
export const load = async (event) => {
  await requireRole(event, 'admin') // error(401) for guests, error(403) without the role
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setRbacContext } from '@anievo-id/rbac-evolution-sveltekit'
  let { data, children } = $props()
  setRbacContext(() => data.rbac, { superAdminRoles: ['super-admin'] })
</script>

{@render children()}

<!-- any component below it -->
<script lang="ts">
  import { Can, HasRole } from '@anievo-id/rbac-evolution-sveltekit'
</script>

<Can permission="articles.publish">
  <button>Publish</button>
  {#snippet fallback()}Ask an editor.{/snippet}
</Can>
<HasRole role="admin|editor">Staff tools</HasRole>
```

> Client checks only decide what the UI shows. Enforce access on the server with the guards of `/server`.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/sveltekit

## License

MIT
