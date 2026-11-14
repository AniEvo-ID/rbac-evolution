# Security

RBAC Evolution answers one question — *does this subject have this role or permission?* — and it answers it
correctly only if you ask in the right place, with fresh data. This page collects the practices that matter most.

## Enforce on the server, decorate on the client

There are two kinds of checks, and they do different jobs:

| Where                       | Examples                                                                 | Purpose                    |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| **Server** (trusted)        | `rbac.for(user).can()`, `requirePermission()`, `withPermission()`, `withRbac()`, Express guards | Decides what is **allowed** |
| **Client** (untrusted)      | `<Can>`, `useCan()`, `v-can`, `$can()`, Vue router guards               | Decides what is **shown**   |

Anything that runs in the browser can be changed by the user: they can edit the snapshot in devtools, call your API
with `curl`, or invoke a Next.js server action directly. Client-side checks are a usability feature — they hide
buttons people cannot use. They are never a security boundary.

**Rule of thumb:** every request that reads or changes protected data must be checked on the server, even if the UI
that triggers it is already hidden.

::: code-group

```ts [Next.js server action]
'use server'
// ✅ checked on the server, even though the button is wrapped in <Can>
export const deleteArticle = withPermission('articles.delete', async (id: string) => {
  await db.article.delete({ where: { id } })
})
```

```ts [Express route]
// ✅ the guard runs before the handler
app.delete('/api/articles/:id', requirePermission('articles.delete'), deleteArticleHandler)
```

:::

Middleware (Next.js `middleware.ts`, a Vue Router guard) is useful for redirecting people away from pages early, but
treat it as a convenience. Keep the guards on the pages, actions and API routes themselves — they are what protect
your data. See [Next.js](/frameworks/nextjs#middleware).

## Snapshots

`rbac.for(user).snapshot()` returns `{ roles, permissions }`: the names of the subject's roles and every permission
they have (directly or via roles). It exists so that the browser can render the right UI.

- **It is disclosure.** Everything in the snapshot is visible to the user. That is normally fine — it is *their*
  access — but do not put secrets in role or permission names (for example customer names or internal codenames).
- **It is a copy.** A snapshot reflects the moment it was taken. After you change a user's roles, send a fresh one
  (`router.refresh()` in Next.js, `rbac.setSnapshot()` in Vue, a new `snapshot` prop in React).
- **It is scoped.** A snapshot belongs to one guard and one team. Build it with the same scope that your
  server-side checks use, or the UI and the server will disagree.
- **Never trust a snapshot sent by the client.** Do not accept roles or permissions in a request body or query
  string and check against those. The server must always derive access from its own data.

### Snapshots in tokens

Storing a snapshot in a signed session token (for example an Auth.js JWT) lets Edge middleware check access
without a database. The trade-off is staleness: a revoked permission keeps working in the token until it is
refreshed or expires.

- Keep token lifetimes short, or refresh the token whenever roles change.
- Only use token-based checks for coarse page routing. Server-side guards should read live data through the engine.
- Make sure the token is **signed** (and ideally encrypted). An unsigned cookie with a snapshot is just client input.

## Super-admins

`superAdminRoles` and the `before` hook let a role bypass every `can()` check. That is powerful and easy to get
wrong.

- **Keep the list tiny.** Ideally a single `super-admin` role held by very few accounts.
- **It affects `can()` only.** Pure data checks (`hasPermissionTo()`, `hasAnyPermission()`) and all role checks are
  not affected. A super-admin without the `editor` role still fails `hasRole('editor')`.
- **Mirror it deliberately on the client.** The snapshot does not carry server configuration. Pass the same
  `superAdminRoles` to `<RbacProvider>`, `createRbacPlugin()` or the Next.js middleware snapshot mode — but
  remember it only affects what is shown.
- **Watch the Next.js middleware.** In `rbac` mode, `createRbacMiddleware` checks against the subject's snapshot
  and does not run `superAdminRoles` or `before`. Route rules may therefore deny a super-admin that `can()` would
  allow. Fail-closed is the safe direction, but add the role to the rule if you need it.
- **Avoid broad `before` hooks.** A `before` that returns `true` for whole classes of users (for example "all
  employees") quietly overrides your permission model. Prefer real roles and permissions you can audit.
- **Audit assignments.** Listen to `role.attached` events and log who received a privileged role. See
  [Events](/advanced/events).

See [Super-admin](/basic-usage/super-admin) for configuration details.

## Error responses

A 403 response should tell the caller *that* access was denied, not *what* would have been required.

- **Express:** the default 403 body contains `error`, `reason` (`permission`, `role` or `role_or_permission`) and a
  generic `message`. The required names are only added when you set `exposeRequirements: true` — leave it off in
  production.
- **Next.js route handlers and middleware:** answer with the same body as Express —
  `{ "error": "FORBIDDEN", "reason": …, "message": … }` — naming only the kind of requirement.
- **Next.js pages:** `require*()` calls `notFound()` by default, so a page the user cannot access looks like a page
  that does not exist.
- **Server actions:** Next.js hides thrown error messages in production; return a value if the UI needs to react.
- **Your own handlers:** do not echo engine errors (such as `PermissionDoesNotExist`, which contains the permission
  name) to clients. Log them and return a generic response. See [Errors](/advanced/errors).

Return **401** for "not signed in" and **403** for "signed in but not allowed", so clients know whether to send the
user to a login page or show an access-denied message.

## Caching across processes

The engine caches each subject's roles and permissions (by default in memory, for 24 hours). Any change made
through RBAC Evolution — `assignRole()`, `givePermissionTo()`, and so on — clears the cache **of the process that
made the change**.

That is enough for a single server. With several processes (clustered Node.js, multiple containers, serverless
instances), the other processes keep serving their cached data until it expires, so a revoked permission can keep
working for a while.

Pick one of these:

| Setup                                          | Effect                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Shared `CacheStore` (e.g. Redis-backed)        | `clear()` reaches every process. Best for multi-instance deployments. |
| Short `cacheTtl`                               | Bounded staleness, more database reads.                                |
| `cache: false`                                 | Always fresh, every check hits the adapter.                            |

```ts
const rbac = createRbac({
  adapter,
  cache: sharedRedisCacheStore, // your CacheStore implementation
  cacheTtl: 5 * 60 * 1000, // 5 minutes
})
```

Also call `rbac.forgetCachedPermissions()` if roles or permissions are changed **outside** RBAC Evolution — a SQL
migration, a seed script, an admin tool talking to the database directly. See [Cache](/advanced/cache).

::: warning
A shared cache store must be dedicated to RBAC Evolution (or namespaced), because the engine calls `clear()` on
every change.
:::

## Teams

With `teams: true`, every check is scoped to the team you pass. RBAC Evolution does **not** know whether a user is a
member of that team. If the team id comes from the request (a URL segment, a header, a cookie), verify membership
before using it, or a user could switch to a team where they happen to have a powerful role. See
[Teams](/basic-usage/teams).

## Verifying the packages

All `@anievo-id/rbac-evolution*` packages are published from GitHub Actions using
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no long-lived npm token) with
**provenance** enabled. Each published version carries a signed attestation linking it to the exact commit and
workflow run that built it.

To verify the packages in your project:

```bash
npm audit signatures
```

This checks registry signatures and provenance attestations for your installed dependencies. You can also see the
provenance details on each package's page on npmjs.com.

For an authorization library, it is worth pinning versions with a lockfile and reviewing the changelog before
upgrading.

## Reporting vulnerabilities

Please report security issues privately through
[GitHub Security Advisories](https://github.com/AniEvo-ID/rbac-evolution/security/advisories/new), not in a public
issue. See the [security policy](https://github.com/AniEvo-ID/rbac-evolution/blob/main/SECURITY.md).

## Checklist

- [ ] Every page, server action and API route that touches protected data has a server-side check.
- [ ] Client components use `<Can>` / `v-can` only to show or hide UI.
- [ ] Snapshots are built on the server with the same guard and team as the server checks.
- [ ] Snapshots in tokens are signed and refreshed when roles change.
- [ ] `superAdminRoles` is short; `before` hooks are narrow.
- [ ] `exposeRequirements` is off in production; engine errors are not sent to clients.
- [ ] Multi-instance deployments use a shared cache store, a short TTL, or no cache.
- [ ] Team ids from requests are checked for membership.
- [ ] Dependencies are installed from a lockfile and verified with `npm audit signatures`.
