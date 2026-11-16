# Wildcard permissions

With wildcards, one stored permission can cover a whole family of permissions. Instead of creating `articles.create`, `articles.edit` and `articles.delete` and giving all three to an editor, you give `articles.*`.

## Enabling wildcards

```ts
const rbac = createRbac({ adapter, wildcard: true })
```

## The format

A wildcard permission is made of **parts** separated by dots. A part can list several **subparts** separated by commas, or be `*`:

| Permission | Parts |
| --- | --- |
| `articles` | resource |
| `articles.edit` | resource, action |
| `articles.edit,delete` | resource, two actions |
| `articles.edit.own` | resource, action, target |
| `articles.*` | resource, any action |
| `*` | everything |

What the parts mean is up to you. `resource.action.target` is a common convention.

## Examples

```ts
await rbac.createPermission('articles.*')
await rbac.for(user).givePermissionTo('articles.*')

await rbac.for(user).can('articles.edit')     // true
await rbac.for(user).can('articles.edit.own') // true
await rbac.for(user).can('posts.edit')        // false
```

Subparts:

```ts
await rbac.createPermission('articles.edit,delete')
await rbac.for(user).givePermissionTo('articles.edit,delete')

await rbac.for(user).can('articles.edit')   // true
await rbac.for(user).can('articles.delete') // true
await rbac.for(user).can('articles.create') // false
```

## Matching rules

A stored permission **covers** a checked permission when:

- it is `*`, which covers everything;
- each of its parts is `*` or contains the checked part's subparts, so `articles.*` covers `articles.edit` and `articles.edit.own`;
- it is **shorter**: `articles` covers `articles.edit`, `articles.edit.own`, and so on.

It does **not** work the other way round. Having `articles.edit` does not give you `articles.*` or `articles`.

| Stored | Checked | Result |
| --- | --- | --- |
| `*` | `anything.at.all` | ✔ |
| `articles.*` | `articles.edit` | ✔ |
| `articles.*` | `articles.edit.own` | ✔ |
| `articles` | `articles.edit` | ✔ |
| `articles.edit,delete` | `articles.delete` | ✔ |
| `articles.edit,delete` | `articles.create` | ✘ |
| `articles.edit` | `articles.*` | ✘ |
| `articles.edit` | `articles` | ✘ |
| `articles.*` | `posts.edit` | ✘ |

## Checking permissions that are not stored

With wildcards on, you check permissions that you never created. `articles.edit` above is only implied by `articles.*`. That's why, with `wildcard: true`, `hasPermissionTo()` and `hasDirectPermission()` don't throw `PermissionDoesNotExist` for unknown names. They just answer whether some stored permission covers it.

Everything that checks permissions understands wildcards: `can()`, `canAny()`, `canAll()`, `hasPermissionTo()`, `hasDirectPermission()`, `hasAnyPermission()`, `hasAllPermissions()` and `rbac.role(...).hasPermissionTo()`.

`rbac.subjectsWithPermission()` matches exact permission rows by default. Pass `expandWildcards: true` to also find the subjects whose wildcard covers the name, directly or through a role:

```ts
await rbac.subjectsWithPermission('user', 'articles.edit')                            // exact holders only
await rbac.subjectsWithPermission('user', 'articles.edit', { expandWildcards: true }) // + articles.*, articles, *
```

See [Querying subjects](/advanced/querying-subjects#wildcards).

## A shorter name covers the longer ones

The third matching rule is easy to miss. A stored permission **without** `*` still covers every permission that
starts with it:

```ts
await rbac.sync({ permissions: ['orders.refund', 'orders.refund.large'] })
await rbac.for(user).givePermissionTo('orders.refund')

await rbac.for(user).can('orders.refund.large') // true: `orders.refund` is shorter
```

If `orders.refund.large` was meant as a stricter permission, whoever holds `orders.refund` has it anyway. To catch
this, `sync()` and `createPermission()` check, with `wildcard: true`, whether one name implies another only by
being shorter. Names with a `*` part, like `orders.*`, are not reported: there the wide match is the point.

By default this logs a one-time warning per pair when `NODE_ENV` is `development`, the way deprecations are
reported:

```text
[rbac-evolution] `orders.refund` also grants `orders.refund.large` (guard `web`): with wildcards, a shorter name implies the longer ones. ...
```

Choose what happens with the `wildcardPrefixCheck` option:

| Value | Effect |
| --- | --- |
| `'warn'` (default) | One `console.warn` per pair, only when `NODE_ENV` is `development`. Nothing else changes. |
| `'error'` | Throws `RbacError` with code `INVALID_WILDCARD_PERMISSION` before writing anything, in every environment. `sync()` throws for a dry run too, so CI can catch it. |
| `'off'` | No check. |

```ts
const rbac = createRbac({ adapter, wildcard: true, wildcardPrefixCheck: 'error' })
```

What is checked:

- `sync()` looks at the permissions of each guard **as they will be after the sync** (stored names plus the
  definition, minus what `prune` removes), and reports the pairs that involve at least one name from the definition.
- `createPermission()` compares the new name with the stored names of its guard, in both directions.

To fix a reported pair, rename one side so neither name is a prefix of the other, for example `orders.refund.standard`
and `orders.refund.large`, or grant the wide permission on purpose as `orders.refund.*`.

## Validation

When wildcards are on, `createPermission()` validates the name. Empty parts or subparts, like `articles..edit` or `articles.edit,`, throw `InvalidWildcardPermission`. It also runs the [prefix check](#a-shorter-name-covers-the-longer-ones).

## Front end

The React and Vue packages need to know about wildcards too, so they match the server. Pass `wildcard` to `<RbacProvider>` (React) or `createRbacPlugin()` (Vue). See [React](/frameworks/react) and [Vue](/frameworks/vue).

## Helpers

The matching functions are exported if you need them:

```ts
import { parseWildcardPermission, wildcardImplies } from '@anievo-id/rbac-evolution'

parseWildcardPermission('articles.edit,delete.own') // [['articles'], ['edit', 'delete'], ['own']]
wildcardImplies('articles.*', 'articles.edit')      // true
wildcardImplies('articles.edit', 'articles.*')      // false
```
