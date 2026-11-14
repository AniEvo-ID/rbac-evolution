---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-express': patch
'@anievo-id/rbac-evolution-fastify': patch
'@anievo-id/rbac-evolution-hono': patch
'@anievo-id/rbac-evolution-nestjs': patch
'@anievo-id/rbac-evolution-nuxt': patch
---

The framework integrations now share one requirement parser and checker from core (`permissionRequirement`, `roleRequirement`, `roleOrPermissionRequirement`, `satisfiesRequirement`, `splitRequirementArgs`, `REQUIREMENT_MESSAGES`), instead of five copies. Behaviour is unchanged, with one stricter case: in Express, Fastify and Hono, a role guard whose names are all blank (`requireRole(' | ')`) now throws a `TypeError` when it is defined, like NestJS and Nuxt already did, instead of answering 403 on every request.
