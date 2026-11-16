---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-cli': minor
'@anievo-id/rbac-evolution-express': minor
'@anievo-id/rbac-evolution-fastify': minor
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-nestjs': minor
'@anievo-id/rbac-evolution-next': minor
'@anievo-id/rbac-evolution-nuxt': minor
---

Typed names now reach the integrations. With `createRbac<AppTypes>()`, a typo in a guard, a server helper or the CLI seed is a type error. Pipe lists like `'edit articles|delete articles'` are checked part by part, and the error names the wrong part (`UnknownRequirementName<"delete artcles">`).

- **Express, Fastify, Hono:** `createGuards<AppTypes>()` or `createGuards<typeof rbac>()`.
- **NestJS:** `createRbacDecorators<AppTypes>()` returns typed `RequirePermissions`, `RequireRoles`, `RequireRoleOrPermission`, `CanAny` and `CanAll`.
- **Next.js:** `createNextRbac({ rbac })` takes the names from the engine you pass in.
- **Nuxt:** `createRbacServer({ rbac })` takes the names from the engine you pass in. With an explicit event type, pass both: `createRbacServer<MyEvent, AppTypes>()`.
- **CLI:** `defineConfig({ rbac, seed })` checks `seed` against the engine.
- **Core:** exports `RequirementArgs`, `CheckRequirementName` and their error types, so custom integrations can do the same.

The guards and decorators exported directly still accept any string. A guard called with no names, with only options, or with options before a name is now a type error everywhere, because it threw or ignored the options at runtime. Fix such calls, or move the options last.
