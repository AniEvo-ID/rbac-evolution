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

::: warning
`rbac.subjectsWithPermission()` does **not** expand wildcards. It only finds subjects that have exactly the permission you ask for (directly or via a role).
:::

## Validation

When wildcards are on, `createPermission()` validates the name. Empty parts or subparts, like `articles..edit` or `articles.edit,`, throw `InvalidWildcardPermission`.

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
