# Koa

There is no Koa package: a Koa middleware is a few lines on top of the core. The core exports the same helpers
the Express, Hono and Elysia guards are built from, so this recipe behaves exactly like them, with the same `401`
and `403` bodies.

::: info Assumptions
- Koa 2 or 3, with `@koa/router`.
- Your auth middleware (a session, `koa-jwt`, ...) runs first and sets `ctx.state.user`.
:::

## 1. The middleware and the guards

```ts
// rbac-koa.ts
import type { Context, Next } from 'koa'
import {
  permissionRequirement,
  type Rbac,
  type RbacRequirement,
  REQUIREMENT_MESSAGES,
  type RequirementNames,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  type Subject,
  type SubjectRbac,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'

/** Sets `ctx.state.rbac`: the subject's `SubjectRbac`, or `null` for guests. */
export function rbacMiddleware(rbac: Rbac, getSubject: (ctx: Context) => Subject | null | undefined) {
  return async (ctx: Context, next: Next) => {
    const subject = getSubject(ctx)
    ctx.state.rbac = subject ? rbac.for(subject) : null
    await next()
  }
}

function guard(requirement: RbacRequirement) {
  return async (ctx: Context, next: Next) => {
    const subject = ctx.state.rbac as SubjectRbac | null | undefined
    if (subject === undefined) throw new Error('Register rbacMiddleware() before RBAC guards.')
    if (subject === null) {
      ctx.status = 401
      ctx.body = { error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }
      return
    }
    if (!(await satisfiesRequirement(subject, requirement))) {
      ctx.status = 403
      ctx.body = { error: 'FORBIDDEN', reason: requirement.kind, message: REQUIREMENT_MESSAGES[requirement.kind] }
      return
    }
    await next()
  }
}

/** `'a'`, `'a|b'` (any of), `'a', 'b'` (all of). */
export const requirePermission = (...names: RequirementNames[]) => guard(permissionRequirement(names))
/** Any of the roles: `'admin|editor'` or `'admin', 'editor'`. */
export const requireRole = (...names: RequirementNames[]) => guard(roleRequirement(names))
/** Any of the names as a role OR a permission. */
export const requireRoleOrPermission = (...names: RequirementNames[]) => guard(roleOrPermissionRequirement(names))
```

The requirement helpers throw a `TypeError` without names, when the route is defined, not on a request.

## 2. Use them

```ts
// app.ts
import Koa from 'koa'
import Router from '@koa/router'
import { rbacMiddleware, requirePermission, requireRole } from './rbac-koa'

const app = new Koa()
const router = new Router()

app.use(yourAuthMiddleware) // sets ctx.state.user
app.use(rbacMiddleware(rbac, (ctx) => (ctx.state.user ? { type: 'user', id: ctx.state.user.id } : null)))

router.patch('/articles/:id', requirePermission('edit articles'), updateArticle)
router.get('/admin/stats', requireRole('admin|editor'), getStats)

app.use(router.routes())
app.listen(3000)
```

## Going further

- **Teams and guards**: pass `{ team, guard }` to `rbac.for(subject, { ... })` in the middleware. See
  [Teams](/basic-usage/teams) and [Guards](/basic-usage/guards).
- **Any of the permissions**: `permissionRequirement(names, { any: true })`; all of the roles:
  `roleRequirement(names, { all: true })`.
- **Typed names**: type the arguments as `PermissionName<AppRbac>` instead of `RequirementNames`. See
  [Typed names](/basic-usage/typed-names).
- The [Express guide](/frameworks/express) documents the same semantics in full.
