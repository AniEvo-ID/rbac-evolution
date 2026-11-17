---
'@anievo-id/rbac-evolution-elysia': minor
---

New package `@anievo-id/rbac-evolution-elysia`: an Elysia plugin (`rbacPlugin()`) that adds a typed `rbac` to the request context, and `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll` guards used as `beforeHandle` hooks, on a route or a whole `app.guard()` group. Same responses, options (`guard`, `team`, `exposeRequirements`, custom handlers, `createGuards<AppRbac>()`) and semantics as the Hono integration. Bun first, also on Node, Deno and Cloudflare Workers.
