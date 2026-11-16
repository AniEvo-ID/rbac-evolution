# SvelteKit

`@anievo-id/rbac-evolution-sveltekit` connects RBAC Evolution to SvelteKit 2 and 3 with Svelte 5:

- a **`handle` hook** that resolves the user once per request and puts their `SubjectRbac` on `event.locals.rbac`;
- **guards** for `load` functions, form actions and `+server.ts` endpoints (`requirePermission`, `requireRole`,
  `requireRoleOrPermission`, `canAny`, `canAll`), with the same names, semantics and 401 / 403 bodies as the
  [Express](/frameworks/express) package, thrown as SvelteKit `error()`s or `redirect()`s;
- **`getSnapshot(event)`** to send the user's roles and permissions to the browser from the root layout;
- a **runes-based context** (`setRbacContext()` / `getRbacContext()`) and **`<Can>` / `<HasRole>`** components with
  snippets, with the same rules as the [Vue](/frameworks/vue) and [React](/frameworks/react) packages
  (super-admin roles, wildcards and `before` hook denials).

::: warning
Everything that runs in the browser only decides what the UI *shows*. Always enforce authorization on the server, in
every `+page.server.ts`, action and `+server.ts` that needs it. See [Security](/best-practices/security).
:::

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sveltekit
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sveltekit
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-sveltekit
```

:::

It needs `@sveltejs/kit` 2 or later and `svelte` 5 or later, which a SvelteKit app already has.

The package has two entry points:

| Import | Where | What |
| --- | --- | --- |
| `@anievo-id/rbac-evolution-sveltekit/server` | `hooks.server.ts`, `+page.server.ts`, `+layout.server.ts`, `+server.ts`, `$lib/server/*` | `rbacHandle`, the guards, `getSnapshot` |
| `@anievo-id/rbac-evolution-sveltekit` | components, `+layout.svelte`, universal `load` | `setRbacContext`, `getRbacContext`, `<Can>`, `<HasRole>`, `createRbacChecker` |

## Setup

### 1. Create the engine

Keep the engine in a server-only module, so it never ends up in the browser bundle:

```ts
// src/lib/server/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'

export type AppRbac = {
  permissions: 'articles.edit' | 'articles.publish' | 'articles.delete' | 'billing.manage'
  roles: 'admin' | 'editor' | 'writer'
}

export const rbac = createRbac<AppRbac>({ adapter: yourAdapter })
```

The `AppRbac` type is optional. With it, every name you pass to a guard is checked at compile time; see
[Typed names](#typed-names).

### 2. Add the `handle` hook

`rbacHandle()` returns a SvelteKit `handle` hook. Run it after your auth hook, so it can read the user:

```ts
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks'
import { rbacHandle } from '@anievo-id/rbac-evolution-sveltekit/server'
import { rbac } from '$lib/server/rbac'

export const handle = sequence(
  authHandle, // yours: sets event.locals.user
  rbacHandle({
    rbac,
    // Return null or undefined for guests.
    getSubject: (event) => (event.locals.user ? { type: 'user', id: event.locals.user.id } : null),
  }),
)
```

For every request, it sets `event.locals.rbac` to the subject's `SubjectRbac` (`rbac.for(subject)`), or `null` for
guests. Nothing is read from the database there: only the checks a request makes reach the adapter (or the cache).

| Option       | Type                                                    | Description                                                |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------- |
| `rbac`       | `Rbac`                                                  | Your `createRbac(...)` instance. **Required.**             |
| `getSubject` | `(event) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                |
| `guard`      | `string`                                                | Guard name. Defaults to the engine's `defaultGuard`.       |
| `team`       | `(event) => TeamId \| undefined \| Promise<…>`          | Current team. Only for engines created with `teams: true`. |

### 3. Type `event.locals`

Add `rbac` to `App.Locals` in `src/app.d.ts`. `RbacLocals<AppRbac>` types it with your names:

```ts
// src/app.d.ts
import type { RbacLocals } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { AppRbac } from '$lib/server/rbac'

declare global {
  namespace App {
    interface Locals extends RbacLocals<AppRbac> {
      user?: { id: string } // from your auth hook
    }
    // Optional: the fields of the 401 / 403 errors, for `page.error` in +error.svelte.
    interface Error {
      error?: 'UNAUTHENTICATED' | 'FORBIDDEN'
      reason?: 'permission' | 'role' | 'role_or_permission'
      required?: string[][]
    }
  }
}
```

Then `event.locals.rbac` is a `SubjectRbac<AppRbac> | null` in every server file:

```ts
// src/routes/articles/[id]/+page.server.ts
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const canEdit = (await locals.rbac?.can('articles.edit')) ?? false
  return { canEdit }
}
```

### 4. Send the snapshot to the browser

Return the user's snapshot from the root layout's server `load`:

```ts
// src/routes/+layout.server.ts
import { getSnapshot } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async (event) => ({
  // { roles, permissions } for users, null for guests.
  rbac: await getSnapshot(event, { checkBefore: ['billing.manage'] }),
})
```

`checkBefore` lists the permissions to run the engine's [`before` hook](/basic-usage/super-admin) for. Those it
denies are sent as `denied`, and the client treats them as not allowed, even for a super-admin. `getSnapshot` also
takes `{ guard }`, to send the roles and permissions of another guard.

Then put it in the context in the root `+layout.svelte`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setRbacContext } from '@anievo-id/rbac-evolution-sveltekit'

  let { data, children } = $props()

  // A getter, so the checks follow `data` (e.g. after login, logout or invalidateAll()).
  setRbacContext(() => data.rbac, {
    wildcard: true, // must mirror createRbac({ wildcard })
    superAdminRoles: ['super-admin'], // must mirror createRbac({ superAdminRoles })
  })
</script>

{@render children()}
```

| Option            | Default | Description                                                     |
| ----------------- | ------- | --------------------------------------------------------------- |
| `wildcard`        | `false` | Match permissions like `articles.*`. Mirror the engine's option. |
| `superAdminRoles` | `[]`    | Roles that pass every permission check, except `denied` names.  |

The layout data is serialized into the page, so the browser starts with the same data as the server render: no
extra request and no flash of hidden buttons.

## Protecting loads, actions and endpoints

The guards take the request `event` first, then the names, then an optional options object. They resolve to the
subject's `SubjectRbac` (use it for finer checks) and throw when the check fails.

```ts
// src/routes/admin/+page.server.ts
import { requirePermission, requireRole } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  await requireRole(event, 'admin|editor') // any of the roles
}

export const actions: Actions = {
  publish: async (event) => {
    const subject = await requirePermission(event, 'articles.publish')
    // subject is the SubjectRbac: use it for finer checks
  },
}
```

```ts
// src/routes/api/articles/[id]/+server.ts
import { json } from '@sveltejs/kit'
import { requirePermission } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { RequestHandler } from './$types'

export const DELETE: RequestHandler = async (event) => {
  await requirePermission(event, 'articles.delete|articles.moderate') // any of them
  return json({ deleted: event.params.id })
}
```

| Guard                                                 | Passes when the user has…                                   |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `requirePermission(event, 'a')`                       | the permission                                              |
| `requirePermission(event, 'a', 'b')`                  | **all** of them                                             |
| `requirePermission(event, 'a\|b')`                    | **any** of them                                             |
| `requirePermission(event, 'a', 'b', { any: true })`   | **any** of them                                             |
| `requireRole(event, 'admin', 'editor')` / `'admin\|editor'` | **any** of the roles                                  |
| `requireRole(event, 'writer', 'editor', { all: true })` | **all** of the roles                                      |
| `requireRoleOrPermission(event, 'admin\|articles.edit')` | any of the names, as a role or a permission              |
| `canAny(event, 'a', 'b')` / `canAll(event, 'a', 'b')` | any of the permissions / every entry (spatie v8.5)          |

These are the semantics of the Express, Fastify, Hono and Nuxt guards and the NestJS decorators. A super-admin
passes the permission guards; a permission the `before` hook denies stays denied.

::: warning Guard each page, action and endpoint
A guard in a `+layout.server.ts` protects the pages below it on navigation, but **not** their form actions or the
`+server.ts` endpoints next to them, and it runs in parallel with the pages' own `load`. Put the guard where the data
is: in the `load`, action or endpoint itself.
:::

### When a check fails

By default, a guest gets `error(401, …)` and a user without access `error(403, …)`, with the body of the Express
package:

```json
{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }
```

A guest's body is `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }`. SvelteKit renders the error
page (`+error.svelte`, with the body as `page.error`) for page requests, and sends the body as JSON to API clients
of an endpoint (any `Accept` header but `text/html`). SvelteKit 3 adds a `status` field to every error body.

For page loads, a redirect is often friendlier. Build the guards once with `createGuards()` and shared defaults:

```ts
// src/lib/server/guards.ts
import { redirect } from '@sveltejs/kit'
import { createGuards } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { AppRbac } from '$lib/server/rbac'

export const { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } = createGuards<AppRbac>({
  onUnauthenticated: (event) => redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`),
  forbiddenRedirect: '/403',
})
```

```ts
// src/routes/admin/+page.server.ts
import { requireRole } from '$lib/server/guards'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async (event) => {
  await requireRole(event, 'admin')
}
```

| Option                    | Default | Description                                                                        |
| ------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `onUnauthenticated`       | 401 error | `(event, { kind, requirements }) => never`. Must throw: `redirect()` or `error()`. |
| `onForbidden`             | 403 error | The same, for a user without access.                                             |
| `unauthenticatedRedirect` | none    | Redirect guests here (`redirect(303, url)`). `onUnauthenticated` wins over it.     |
| `forbiddenRedirect`       | none    | Redirect users without access here. `onForbidden` wins over it.                   |
| `exposeRequirements`      | `false` | Add the required names to the 403 body (`required`).                               |

Every guard also takes these options as its last argument, and a guard's own options win over the defaults:
`requireRole(event, 'admin', { forbiddenRedirect: '/' })`. Without `createGuards()`, the guards exported by
`/server` use the defaults (401 / 403 errors) and take any name.

### Another guard per route

Every guard also takes a `{ guard }` option: that check runs in that guard (`subject.withScope({ guard })`) instead of
the hook's, like spatie's `role:admin,api`. The subject it returns is in that guard; `event.locals.rbac` is unchanged,
and a guest still gets `401`.

```ts
// src/routes/api/reports/+server.ts
import { json } from '@sveltejs/kit'
import { canAny, requireRole } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async (event) => {
  await requireRole(event, 'admin', { guard: 'api' }) // role:admin,api
  await canAny(event, 'reports.view', 'reports.export', { guard: 'api' })
  return json([])
}
```

### Names per guard

With [typed names per guard](/basic-usage/typed-names#names-per-guard), tell `createGuards` the guard of the
requests (the hook's `guard`; the default guard without it). Names are checked in that guard, or in a call's
`{ guard }`, and the subject a guard returns is typed for the guard it checked in:

```ts
// src/lib/server/api-guards.ts
import { createGuards } from '@anievo-id/rbac-evolution-sveltekit/server'

type GuardedRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}

const api = createGuards<GuardedRbac, 'api'>()

export async function example(event: import('@sveltejs/kit').RequestEvent) {
  const key = await api.requirePermission(event, 'orders.read') // SubjectRbac<GuardedRbac, 'api'>
  await key.can('orders.write')
  await api.requirePermission(event, 'api-keys.manage') // type error: a `web` permission
  await api.requireRole(event, 'admin', { guard: 'web' }) // ok: checked in `web`
}
```

## In components

### `getRbacContext()`

Any component below the root layout can read the context. Call `getRbacContext()` in its `<script>` (like any
Svelte context), then use the checks anywhere in the component:

```svelte
<script lang="ts">
  import { getRbacContext } from '@anievo-id/rbac-evolution-sveltekit'
  import type { AppRbac } from '$lib/server/rbac'

  let { article } = $props()

  const rbac = getRbacContext<AppRbac>() // typed names; getRbacContext() takes any name
  const canEdit = $derived(rbac.can('articles.edit'))
</script>

{#if canEdit}
  <a href="/articles/{article.id}/edit">Edit</a>
{/if}

{#if rbac.isGuest}
  <a href="/login">Log in to comment</a>
{/if}
```

| Member | Description |
| --- | --- |
| `can(permission)` / `cannot(permission)` | The permission, or **all** of a list |
| `canAny(permissions)` / `canAll(permissions)` | **any** / **all** of the permissions |
| `hasRole(roles)` / `hasAnyRole(roles)` | the role, or **any** of a list or `'a\|b'` |
| `hasAllRoles(roles)` | **all** of the roles |
| `isSuperAdmin()` | one of the `superAdminRoles` |
| `snapshot`, `isGuest` | the current snapshot, and whether it is `null` |

Every check reads rune state, so it re-runs in markup, `$derived` and `$effect` when the layout data changes. Runes
rather than stores: they are what Svelte 5 builds on (and what `$app/state` uses), a check reads like a plain function
call, and the same object works in markup, `.svelte.ts` modules and tests.

The rules are those of the Vue and React packages: an empty list is never allowed, `superAdminRoles` pass every
permission check, and a name in the snapshot's `denied` is never allowed, super-admins included.

### `<Can>` and `<HasRole>`

```svelte
<script lang="ts">
  import { Can, HasRole } from '@anievo-id/rbac-evolution-sveltekit'
</script>

<Can permission="articles.publish">
  <button>Publish</button>
  {#snippet fallback()}
    <p>Ask an editor to publish.</p>
  {/snippet}
</Can>

<Can anyOf={['articles.edit', 'articles.delete']}>…</Can>
<Can allOf={['articles.edit', 'articles.publish']}>…</Can>
<Can permission="articles.edit" not>Read only</Can>

<HasRole role="admin|editor">Staff tools</HasRole>
<HasRole allOf={['writer', 'editor']}>…</HasRole>
```

| Prop | `<Can>` | `<HasRole>` |
| --- | --- | --- |
| `permission` / `role` | the permission, or **all** of a list | the role, or **any** of a list or `'a\|b'` |
| `anyOf` | **any** of the permissions | **any** of the roles |
| `allOf` | **all** of the permissions | **all** of the roles |
| `not` | render `children` when the check fails | the same |
| `fallback` (snippet) | rendered when the check fails | the same |

Several conditions must all pass. Without any condition, nothing passes (`fallback` renders). The prop types are
exported as `CanProps` and `HasRoleProps`.

### After login and logout

The context follows the root layout's data. After a login or logout that doesn't navigate, rerun the loads:

```ts
// e.g. in a component's login handler
import { invalidateAll } from '$app/navigation'

export async function onLogin() {
  await fetch('/api/login', { method: 'POST' })
  await invalidateAll() // the layout returns the new snapshot, and every check updates
}
```

### Universal loads

A universal `load` (`+page.ts`) can't read `event.locals`, but it can check the layout's snapshot with
`createRbacChecker()`, for example to skip loading what the user can't see. It runs in the browser too, so it is not
a security check:

```ts
// src/routes/articles/+page.ts
import { createRbacChecker } from '@anievo-id/rbac-evolution-sveltekit'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'

export const load = async ({ parent }: { parent: () => Promise<{ rbac: RbacSnapshot | null }> }) => {
  const { rbac } = await parent()
  return { showDrafts: createRbacChecker(rbac).can('articles.edit') }
}
```

### Testing components

`createRbacState()` builds the context value without a layout. Pass it under `RBAC_KEY` in the `context` option of
`@testing-library/svelte` (or Svelte's `mount`):

```ts
import { render } from '@testing-library/svelte'
import { createRbacState, RBAC_KEY } from '@anievo-id/rbac-evolution-sveltekit'
import ArticleActions from './ArticleActions.svelte'

render(ArticleActions, {
  context: new Map([[RBAC_KEY, createRbacState({ roles: ['editor'], permissions: ['articles.edit'] })]]),
})
```

## Typed names

With a typed engine (`createRbac<AppRbac>()`), pass the same type to `createGuards<AppRbac>()`,
`RbacLocals<AppRbac>` and `getRbacContext<AppRbac>()`. Then a typo is a compile error. Every name is checked,
including each part of a `'a|b'` list:

```ts
import { createGuards, getSnapshot } from '@anievo-id/rbac-evolution-sveltekit/server'
import type { AppRbac } from '$lib/server/rbac'

const { requirePermission, requireRole } = createGuards<AppRbac>()

export async function example(event: import('@sveltejs/kit').RequestEvent) {
  await requirePermission(event, 'articles.edit|articles.publish') // ok
  await requireRole(event, 'admn') // type error

  // The subject they return has the names too
  const subject = await requirePermission(event, 'articles.edit')
  await subject.can('articles.pubish') // type error

  await getSnapshot<AppRbac>(event, { checkBefore: ['billing.manag'] }) // type error
}
```

`typeof rbac` works in place of `AppRbac` too. The default guards exported by `/server`, `<Can>` and `<HasRole>`
accept any string. See [Typed names](/basic-usage/typed-names).

Full API: [reference](/api/sveltekit/)
