# Roles vs permissions

RBAC Evolution gives you two building blocks: **permissions** (what can be done) and **roles** (named bundles of
permissions given to people). The short version of this page:

> Check **permissions** in your code. Use **roles** to hand those permissions out.

## Why check permissions, not roles

A role check hard-codes a business decision into your code:

```ts
// ❌ Who may publish is now baked into the route
if (await rbac.for(user).hasRole('editor')) {
  await publish(article)
}
```

The day you add a `chief-editor` role, or let senior writers publish too, you have to find and update every
`hasRole('editor')` call — in route handlers, server actions, React components, Vue templates.

A permission check asks the actual question — *may this user publish?* — and leaves the answer to your data:

```ts
// ✅ The code asks what it needs to know
if (await rbac.for(user).can('articles.publish')) {
  await publish(article)
}
```

Now giving publishing rights to another group of users is a data change, not a code change:

```ts
await rbac.role('senior-writer').givePermissionTo('articles.publish')
```

The same applies to every layer:

::: code-group

```ts [Next.js]
await requirePermission('articles.publish')
```

```ts [Express]
app.post('/articles/:id/publish', requirePermission('articles.publish'), handler)
```

```tsx [React]
<Can permission="articles.publish">
  <PublishButton />
</Can>
```

```vue [Vue]
<PublishButton v-can="'articles.publish'" />
```

:::

## How roles fit in

Roles exist for the people who *manage* access. Assigning `editor` to a new colleague is much easier than
assigning twelve permissions one by one, and it keeps users with the same job consistent.

```ts
for (const name of ['articles.view', 'articles.edit', 'articles.publish']) {
  await rbac.createPermission(name)
}

await rbac.createRole('editor')
await rbac
  .role('editor')
  .givePermissionTo(['articles.view', 'articles.edit', 'articles.publish'])

await rbac.for({ type: 'user', id: 42 }).assignRole('editor')
await rbac.for({ type: 'user', id: 42 }).can('articles.edit') // true
```

A good mental model:

| Concept     | Answers                          | Who changes it          | Where it appears        |
| ----------- | -------------------------------- | ----------------------- | ----------------------- |
| Permission  | "What can be done?"              | Developers (with code)  | `can()` checks in code  |
| Role        | "What kind of user is this?"     | Admins (at runtime)     | Seeds, admin screens    |

Permissions change when features change. Roles change when the organisation changes.

## When a role check is fine

Role checks are not forbidden — they are just a weaker default. They make sense when the role itself is the
point, not the abilities behind it:

- Showing a label: "Staff" badge next to a name (`<HasRole role="staff">`).
- Analytics or routing that is genuinely about *who* someone is, such as onboarding flows per user type.
- A coarse first filter, like a middleware rule for `/admin/:path*`, backed by permission checks on the actual
  pages and endpoints.

If you notice that a role check is really standing in for "may they do X?", turn it into a permission.

## Direct permissions

You can also give permissions directly to a user. Use this for genuine exceptions (one contractor who needs to
export reports) rather than as the main way of granting access; otherwise you end up with users whose access nobody
can explain. See [Direct permissions](/basic-usage/direct-permissions).

## Naming conventions

Pick one scheme and stick to it. Names are compared exactly (after trimming), so `articles.edit`, `Articles.Edit`
and `edit articles` are three different permissions.

### Permissions: `resource.action`

We recommend lowercase, dot-separated names, starting with the resource and ending with the action:

| Permission                 | Meaning                                  |
| -------------------------- | ---------------------------------------- |
| `articles.view`            | View articles                            |
| `articles.create`          | Create articles                          |
| `articles.edit`            | Edit any article                         |
| `articles.edit.own`        | Edit only one's own articles             |
| `billing.invoices.export`  | Export invoices in the billing area      |

This scheme pays off in several ways:

- **Wildcards.** With `wildcard: true`, the dot is the segment separator, so `articles.*` covers every article
  permission, and `articles.edit,delete` covers exactly those two actions. See
  [Wildcard permissions](/basic-usage/wildcard-permissions).
- **Sorting and grouping.** Admin screens can group permissions by their first segment.
- **Searchability.** `grep "articles\."` finds every check for one resource.

::: warning Reserved characters
Avoid `|` and `,` inside names:

- `|` is the "any of" separator in the Express guards and in Vue role checks (`requireRole('admin|editor')`,
  `v-role="'admin|editor'"`).
- `,` separates alternatives inside a segment when wildcards are enabled.
:::

Spatie-style names with spaces (`edit articles`) also work, but they do not combine well with wildcards. Whatever
you choose, use it everywhere.

### Roles: job titles

Name roles after the job people do, in lowercase kebab-case: `editor`, `support-agent`, `billing-admin`,
`super-admin`. Avoid names that describe a permission (`can-publish`) — that is a permission pretending to be a
role.

### Keep names in one place

Typos in names fail silently: `can('artciles.edit')` is just `false`. Define names once and let TypeScript catch
mistakes:

```ts
// lib/permissions.ts
export const Permissions = {
  ArticlesView: 'articles.view',
  ArticlesEdit: 'articles.edit',
  ArticlesPublish: 'articles.publish',
} as const

export type PermissionName = (typeof Permissions)[keyof typeof Permissions]
```

```ts
import { createRbac } from '@anievo-id/rbac-evolution'
import type { PermissionName } from './permissions'

export const rbac = createRbac<{ permissions: PermissionName; roles: 'editor' | 'admin' }>({ adapter })

await rbac.for(user).can('articles.edit') // ✅
await rbac.for(user).can('artciles.edit') // ❌ type error
```

See [Typed names (enums)](/basic-usage/typed-names).

## Checklist

- [ ] Application code checks permissions (`can`, `requirePermission`, `<Can>`, `v-can`).
- [ ] Roles are assigned to users; permissions are assigned to roles.
- [ ] Direct permissions are rare and documented.
- [ ] Permission names follow `resource.action` and avoid `|` and `,`.
- [ ] Names live in one shared module, ideally typed.
- [ ] Roles and their permissions are created by a seed or migration, not by hand in production.
