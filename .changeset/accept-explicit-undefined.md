---
'@anievo-id/rbac-evolution-cli': patch
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-drizzle': patch
'@anievo-id/rbac-evolution-express': patch
'@anievo-id/rbac-evolution-fastify': patch
'@anievo-id/rbac-evolution-hono': patch
'@anievo-id/rbac-evolution-kysely': patch
'@anievo-id/rbac-evolution-mongoose': patch
'@anievo-id/rbac-evolution-nestjs': patch
'@anievo-id/rbac-evolution-next': patch
'@anievo-id/rbac-evolution-nuxt': patch
'@anievo-id/rbac-evolution-prisma': patch
'@anievo-id/rbac-evolution-react': patch
'@anievo-id/rbac-evolution-vue': patch
---

Options now accept an explicit `undefined` under TypeScript's `exactOptionalPropertyTypes`, with the same meaning as leaving the option out. Before, `rbac.for(user, { guard: process.env.GUARD })` or `rbacMiddleware({ rbac, getSubject, guard: maybeGuard })` failed to compile with that setting (TS2375/TS2379) although they worked at runtime, so the option had to be spread conditionally. Every optional option, prop and query field of every package is now declared `| undefined`.

The `createGuards()` defaults of the Express, Fastify and Hono integrations now also treat `undefined` as "not set": `requireRole('admin', { onForbidden: undefined })` keeps the shared `onForbidden` instead of falling back to the built-in 403.

Found by the new type tests, which now cover the public types of all 14 packages.
