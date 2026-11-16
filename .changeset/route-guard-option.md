---
'@anievo-id/rbac-evolution-express': minor
'@anievo-id/rbac-evolution-fastify': minor
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-nestjs': minor
'@anievo-id/rbac-evolution-nuxt': minor
---

Guards take a `guard` option for one route, like spatie's `role:admin,api`: `requireRole('admin', { guard: 'api' })`, `@RequireRoles('admin', { guard: 'api' })`, and in Nuxt `requireRole(event, 'admin', { guard: 'api' })`. That check runs in the given guard; the request's own subject stays in its default guard. `requireRoleOrPermission`, `canAny` and `canAll` (and the matching NestJS decorators and Nuxt helpers) now take an options object too. Next.js already had it through `RequireOptions`.
