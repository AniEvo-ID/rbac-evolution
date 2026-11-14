# @anievo-id/rbac-evolution-vue

Vue 3 bindings for [rbac-evolution](../core): a `v-can` / `v-role` directive, `<Can>` / `<HasRole>` components,
composables and template helpers — the Vue counterpart of spatie/laravel-permission's `@can` / `@role` Blade directives.

> **Security note:** everything in this package runs in the browser and only decides what the UI *shows*.
> A user can always edit client-side state. **Always enforce authorization on the server**
> (e.g. with [`@anievo-id/rbac-evolution-express`](../express)).

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-vue
```

## Setup

Send the user's snapshot from the server (`await rbac.for(user).snapshot()` → `{ roles, permissions }`)
and install the plugin:

```ts
import { createApp } from 'vue'
import { createRbacPlugin } from '@anievo-id/rbac-evolution-vue'

export const rbac = createRbacPlugin({
  snapshot: await fetch('/api/me/permissions').then((r) => r.json()), // or null for guests
  wildcard: true, // match `articles.*` like the server (must mirror `createRbac({ wildcard })`)
  superAdminRoles: ['super-admin'], // these roles pass every permission check
})

createApp(App).use(rbac).mount('#app')

// after login / logout — everything re-renders:
rbac.setSnapshot(await fetch('/api/me/permissions').then((r) => r.json()))
rbac.setSnapshot(null)
```

The object returned by `createRbacPlugin` is also the RBAC instance, so it can be used outside
components (router guards, Pinia stores): `rbac.can('edit articles')`.

Options: `snapshot`, `wildcard`, `superAdminRoles`, and `directives` / `components` / `globalProperties`
(all `true` by default) to opt out of global registration.

## Directives

Elements are hidden with `display: none` (like `v-show`) and re-evaluated whenever the snapshot or the bound value changes.

```vue
<button v-can="'edit articles'">Edit</button>
<button v-can="['edit articles', 'publish articles']">Edit & publish</button> <!-- all -->
<button v-can.all="['edit articles', 'publish articles']">Edit & publish</button>
<button v-can.any="['edit articles', 'delete articles']">Moderate</button>
<p v-can.not="'edit articles'">Read only</p>

<a v-role="'admin'">Admin</a>
<a v-role="'admin|editor'">Staff</a>            <!-- any (spatie pipe syntax) -->
<a v-role="['admin', 'editor']">Staff</a>        <!-- any -->
<a v-role.all="['writer', 'editor']">Both</a>
<a v-role.not="'banned'">Post a comment</a>
```

Need the element gone from the DOM instead of hidden? Use `v-if="$can(...)"` or `<Can>`.

## Components

```vue
<Can permission="edit articles">
  <EditButton />
  <template #fallback>You can't edit this article.</template>
</Can>

<Can :any-of="['edit articles', 'delete articles']">...</Can>
<Can :all-of="['edit articles', 'publish articles']">...</Can>
<Can permission="edit articles" not>Read only</Can>

<HasRole role="admin">...</HasRole>
<HasRole role="admin|editor">...</HasRole>
<HasRole :all-of="['writer', 'editor']">...</HasRole>
```

They are registered globally by the plugin; you can also import them: `import { Can, HasRole } from '@anievo-id/rbac-evolution-vue'`.

## Composables

All return a `ComputedRef<boolean>` and accept a value, a ref or a getter.

```ts
import { useCan, useCanAll, useCanAny, useHasRole, useHasAnyRole, useRbac } from '@anievo-id/rbac-evolution-vue'

const canEdit = useCan('edit articles')
const canModerate = useCanAny(['edit articles', 'delete articles'])
const canEditThis = useCan(() => `edit ${props.type}`)
const isStaff = useHasRole('admin|editor')

const rbac = useRbac() // the instance: rbac.can(), rbac.hasRole(), rbac.snapshot, rbac.setSnapshot()
```

## Template helpers

```vue
<button v-if="$can('edit articles')">Edit</button>
<span v-if="$hasRole('admin')">Admin</span>
<!-- also: $cannot, $canAny, $canAll, $hasAnyRole, $hasAllRoles, $rbac -->
```

They are typed through `ComponentCustomProperties` module augmentation — nothing to configure.

## Semantics

| Check | Single | List | `'a\|b'` |
| --- | --- | --- | --- |
| `can` / `v-can` / `<Can permission>` | has it | **all** | literal name |
| `canAny` / `v-can.any` / `<Can any-of>` | has it | any | literal name |
| `hasRole` / `v-role` / `<HasRole role>` | has it | **any** | any |
| `hasAllRoles` / `v-role.all` / `<HasRole all-of>` | has it | all | all |

An empty list never passes.

## License

MIT
