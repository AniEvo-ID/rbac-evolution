---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-express': minor
'@anievo-id/rbac-evolution-fastify': minor
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-nestjs': minor
'@anievo-id/rbac-evolution-nuxt': minor
---

spatie v8 parity:

- `canAny()` / `canAll()` route guards in Express, Fastify and Hono, `@CanAny` / `@CanAll` decorators in NestJS, and `canAny` / `canAll` server helpers in Nuxt (spatie v8.5 route macros).
- `rbac.role(name).syncSubjects(subjectType, ids)` makes the given subjects the role's only holders of that type (spatie `Role::syncModels()`).
