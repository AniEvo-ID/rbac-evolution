# Database seeding

Most apps have a fixed set of roles and permissions that every environment needs: development, CI, staging and production. Instead of a script full of `createPermission` and `givePermissionTo` calls, describe the end state once and let `rbac.sync()` bring the database in line with it.

This is the JS equivalent of the seeders on spatie's "Database Seeding" page, with two differences: it is idempotent, so you can run it on every deploy, and it can show you a plan before it writes anything.

## Defining roles & permissions

```ts
import { createRbac } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter })

await rbac.sync({
  permissions: ['edit articles', 'delete articles', 'publish articles', 'unpublish articles'],
  roles: {
    writer: ['edit articles'],
    moderator: ['publish articles', 'unpublish articles'],
    'super-admin': '*',
  },
})
```

`sync()` does three things:

1. **Creates missing permissions.** Every name in `permissions` and every name used by a role. A permission referenced only by a role is still created.
2. **Creates missing roles.**
3. **Syncs each role's permissions** to exactly the list you gave. Permissions you add are attached, and permissions no longer in the list are detached.

Roles and permissions that are not in the definition are left alone, unless you pass [`prune`](#pruning).

### `'*'`: every permission

`'*'` instead of a list gives the role every permission of its guard, as it will be after the sync. That includes permissions created outside the definition, unless they are pruned. It is the seeder equivalent of spatie's `$role->givePermissionTo(Permission::all())`.

If you want a role that passes every check without holding the permissions, look at [Super-admin](/basic-usage/super-admin) instead.

::: tip Wildcard permissions
With `wildcard: true`, a `'*'` *inside* a list (`admin: ['*']`) is an ordinary wildcard permission named `*`. Only the bare string `'*'` means "every permission". See [Wildcard permissions](/basic-usage/wildcard-permissions).
:::

### Idempotency

Running the same definition again changes nothing. It creates no rows and fires no events, and the summary is empty. Run it from a deploy hook, a `postinstall`, or the start of your test suite.

## The summary

`sync()` returns what it did:

```ts
const result = await rbac.sync(definition)

result.created.permissions // [{ name: 'publish articles', guard: 'web' }]
result.created.roles       // [{ name: 'moderator', guard: 'web', team: null, permissions: ['publish articles', ...] }]
result.updated.roles       // [{ name: 'writer', guard: 'web', team: null, attached: ['edit articles'], detached: [] }]
result.deleted.permissions // only with prune
result.deleted.roles       // only with prune, each with the permissions it had
result.dryRun              // false
```

`updated.roles` lists only existing roles whose permissions actually changed. Newly created roles appear in `created.roles` along with the permissions they were given.

## Dry run

Pass `dryRun: true` to compute the same summary without writing anything:

```ts
const plan = await rbac.sync(definition, { prune: true, dryRun: true })
if (plan.deleted.roles.length > 0) {
  console.warn('These roles would be deleted:', plan.deleted.roles.map((r) => r.name))
}
```

The definition is fully validated during a dry run too. That covers its shape, empty names, and wildcard syntax when `wildcard` is enabled, so a dry run in CI catches mistakes before a deploy.

## Pruning

By default `sync()` only adds and updates. With `prune: true` it also **deletes** what the definition doesn't mention:

```ts
await rbac.sync(definition, { prune: true })
```

Deletion goes through `deleteRole` / `deletePermission`, so subjects lose those roles and direct permissions too. Pruning is scoped so a definition never touches what it doesn't describe:

| What | Pruned when |
| --- | --- |
| Roles | They are in a guard + team scope that appears in the definition (e.g. global roles of guard `web`). |
| Permissions | They are in a guard that has a **global** (team-less) definition. Permissions are guard-wide, so a team-only definition never deletes them. |
| Other guards / teams | Never. |

::: warning
`prune` deletes data. Run it with `dryRun: true` first, especially against production.
:::

## Multiple guards

`guard` sets the guard of a definition. Pass an array to sync several guards at once:

```ts
await rbac.sync([
  {
    permissions: ['edit articles', 'delete articles'],
    roles: { writer: ['edit articles'], admin: '*' },
  },
  {
    guard: 'api',
    permissions: ['read articles'],
    roles: { client: ['read articles'] },
  },
])
```

A definition without `guard` uses the `guard` option, then the engine's `defaultGuard`:

```ts
await rbac.sync({ roles: { client: ['read articles'] } }, { guard: 'api' })
```

See [Multiple guards](/basic-usage/multiple-guards).

## Teams

With `teams: true`, `team` creates the roles of a definition for that team. Permissions are always guard-wide.

```ts
const rbac = createRbac({ adapter, teams: true })

await rbac.sync([
  // global roles, available in every team
  { permissions: ['edit articles', 'manage team'], roles: { member: ['edit articles'] } },
  // roles that only exist in team 1
  { team: 1, roles: { owner: '*', member: ['edit articles', 'manage team'] } },
])
```

A team role with the same name as a global role is a separate role. In team 1 it wins over the global one, just as with `createRole(name, { team })`. The `team` option sets the default team, which is handy when you provision a new tenant:

```ts
await rbac.sync(teamTemplate, { team: newTeam.id })
```

Passing a team while teams are disabled throws `TEAMS_NOT_ENABLED`. See [Teams](/basic-usage/teams).

## Typed names

With [typed names](/basic-usage/typed-names), the definition is type-checked as well: unknown permissions and roles are compile errors.

```ts
const rbac = createRbac<{ permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }>({ adapter })

await rbac.sync({
  permissions: ['edit articles', 'delete articles'],
  roles: { admin: '*', writer: ['edit articles'] },
})

// @ts-expect-error: 'fly' is not a permission
await rbac.sync({ roles: { writer: ['fly'] } })
```

To keep a definition in its own file, type it with `SyncDefinition`:

```ts
import type { SyncDefinition } from '@anievo-id/rbac-evolution'

export const seed = {
  permissions: ['edit articles', 'delete articles'],
  roles: { admin: '*', writer: ['edit articles'] },
} satisfies SyncDefinition<AppTypes>
```

## Events

`sync()` writes through the regular engine methods (`createPermission`, `createRole`, `role().syncPermissions()`, `deleteRole`, `deletePermission`). The usual [events](/advanced/events) fire and the [cache](/advanced/cache) is cleared, so an audit log picks up seeding like any other change.

## Errors

| Code | When |
| --- | --- |
| `INVALID_SYNC_DEFINITION` | The definition has the wrong shape (e.g. from a JSON file), or the same role appears twice in one guard + team scope. |
| `INVALID_NAME` | A role or permission name is empty. |
| `INVALID_WILDCARD_PERMISSION` | A permission isn't valid wildcard syntax (with `wildcard: true`). |
| `TEAMS_NOT_ENABLED` | A `team` was given but teams are disabled. |

Validation happens before anything is written. `sync()` is **not** atomic, though: adapters have no transactions, so an adapter error halfway through leaves the earlier changes in place. Running the sync again picks up where it stopped.

## From the CLI

The [CLI](/basic-usage/cli) runs the same sync from a `seed` field in `rbac.config.ts`:

```ts
// rbac.config.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { defineConfig } from '@anievo-id/rbac-evolution-cli'

export default defineConfig({
  rbac: () => createRbac({ adapter }),
  seed: {
    permissions: ['edit articles', 'delete articles', 'publish articles'],
    roles: { admin: '*', writer: ['edit articles'] },
  },
})
```

```bash
npx rbac-evolution sync --dry-run   # print the plan
npx rbac-evolution sync             # apply it
npx rbac-evolution sync --prune --dry-run  # preview what pruning would delete
npx rbac-evolution sync --prune --yes      # also delete what's not in the seed
```

```
+ permission `publish articles` (guard web)
+ role `writer` (guard web): edit articles
~ role `admin` (guard web): +publish articles

Done: created 1 permission & 1 role, updated 1 role, deleted 0 roles & 0 permissions.
```

Or keep the seed in its own file, as JSON or as a module that default-exports the definition. For example, `roles.json`:

```json
[
  { "permissions": ["edit articles"], "roles": { "admin": "*", "writer": ["edit articles"] } },
  { "guard": "api", "roles": { "client": ["read articles"] } }
]
```

```bash
npx rbac-evolution sync --file roles.json
npx rbac-evolution sync --file seed/roles.ts --guard api --team 7
```

| Option | Description |
| --- | --- |
| `-f, --file <file>` | Seed file (`.json`, `.ts`, `.js`, …). Default: `seed` in the config. |
| `--prune` | Delete roles & permissions that are not in the seed. Needs `--yes` (or `--dry-run` to preview). |
| `-y`, `--yes` | Confirm the deletions of `--prune`. |
| `--dry-run` | Print the plan without writing anything. |
| `-g, --guard` / `-t, --team` | Default guard / team for definitions that don't set one. |
| `--json` | Print the summary as JSON. |
